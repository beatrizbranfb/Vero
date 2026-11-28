import random
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modulos.identidade.modelos import Acompanhante, Usuario
from app.modulos.identidade.seguranca import criar_token, gerar_hash, hash_telefone
from app.modulos.transacoes.modelos import Transacao
from app.nucleo.auditoria import Auditoria
from app.nucleo.config import settings

AUTH = "/api/v1/auth"
TRANSACOES = "/api/v1/transacoes"
UMA_HORA = timedelta(hours=1)


def _celular() -> str:
    return "55619" + "".join(random.choices("0123456789", k=8))


def _pessoa(sessao: Session, nome: str) -> tuple[Usuario, str]:
    telefone = _celular()
    usuario = Usuario(
        id=uuid.uuid4(),
        nome=nome,
        hash_telefone=hash_telefone(telefone),
        email=f"{uuid.uuid4().hex[:8]}@vero.com",
        hash_pin=gerar_hash("123456"),
        tentativas=0,
    )
    sessao.add(usuario)
    sessao.flush()
    return usuario, telefone


def _token(usuario: Usuario, id_titular: uuid.UUID | None = None) -> dict[str, str]:
    token = criar_token(usuario.id, "pin", UMA_HORA, id_titular=id_titular)
    return {"Authorization": f"Bearer {token}"}


def _gasto(sessao: Session, dono: Usuario) -> Transacao:
    transacao = Transacao(
        usuario_id=dono.id,
        tipo="saida",
        valor=Decimal("10.00"),
        origem="manual",
        data=date(2026, 11, 20),
    )
    sessao.add(transacao)
    sessao.flush()
    return transacao


def _autorizar(sessao: Session, titular: Usuario, acompanhante: Usuario) -> None:
    sessao.add(
        Acompanhante(
            id_usuario_titular=titular.id,
            id_usuario_acompanhante=acompanhante.id,
            ic_pode_editar=True,
            status="autorizado",
        )
    )
    sessao.flush()


@pytest.fixture
def maria(sessao: Session) -> tuple[Usuario, str]:
    return _pessoa(sessao, "Maria")


@pytest.fixture
def ana(sessao: Session) -> tuple[Usuario, str]:
    return _pessoa(sessao, "Ana")


def test_fluxo_completo_convite_aceite_e_acesso(
    cliente: TestClient, sessao: Session, maria, ana
):
    maria, _ = maria
    ana, celular_ana = ana
    gasto = _gasto(sessao, maria)

    resposta = cliente.post(
        f"{AUTH}/convidar-acompanhante",
        json={"telefone": celular_ana[2:]},
        headers=_token(maria),
    )
    assert resposta.status_code == 201
    assert "Ana" in resposta.json()["mensagem"]

    negado = cliente.post(f"{AUTH}/acompanhar/{maria.id}", headers=_token(ana))
    assert negado.status_code == 403

    recebidos = cliente.get(f"{AUTH}/convites-recebidos", headers=_token(ana)).json()
    assert [(c["nome_titular"], c["status"]) for c in recebidos] == [
        ("Maria", "pendente")
    ]

    aceite = cliente.post(f"{AUTH}/aceitar-convite/{maria.id}", headers=_token(ana))
    assert aceite.status_code == 200

    troca = cliente.post(f"{AUTH}/acompanhar/{maria.id}", headers=_token(ana))
    assert troca.status_code == 200
    como_acompanhante = {"Authorization": f"Bearer {troca.json()['access_token']}"}

    historico = cliente.get(TRANSACOES, headers=como_acompanhante).json()
    assert [t["id"] for t in historico] == [str(gasto.id)]


def test_convite_para_celular_sem_conta(cliente: TestClient, maria):
    maria, _ = maria
    resposta = cliente.post(
        f"{AUTH}/convidar-acompanhante",
        json={"telefone": _celular()},
        headers=_token(maria),
    )
    assert resposta.status_code == 404
    assert "ainda não tem conta" in resposta.json()["detail"]


def test_nao_convida_o_proprio_celular(cliente: TestClient, maria):
    maria, celular = maria
    resposta = cliente.post(
        f"{AUTH}/convidar-acompanhante",
        json={"telefone": celular},
        headers=_token(maria),
    )
    assert resposta.status_code == 422


def test_convite_repetido_da_conflito(cliente: TestClient, maria, ana):
    maria, _ = maria
    _, celular_ana = ana
    corpo = {"telefone": celular_ana}
    cliente.post(f"{AUTH}/convidar-acompanhante", json=corpo, headers=_token(maria))
    repetido = cliente.post(
        f"{AUTH}/convidar-acompanhante", json=corpo, headers=_token(maria)
    )
    assert repetido.status_code == 409


def test_acompanhante_registra_no_nome_do_titular_e_fica_auditado(
    cliente: TestClient, sessao: Session, maria, ana
):
    maria, _ = maria
    ana, _ = ana
    _autorizar(sessao, maria, ana)

    resposta = cliente.post(
        TRANSACOES,
        json={"tipo": "saida", "valor": "42.00", "origem": "manual"},
        headers=_token(ana, id_titular=maria.id),
    )
    assert resposta.status_code == 201
    transacao = sessao.get(Transacao, uuid.UUID(resposta.json()["id"]))
    assert transacao.usuario_id == maria.id

    [registro] = sessao.scalars(
        select(Auditoria).where(Auditoria.registro_id == transacao.id)
    ).all()
    assert (registro.titular_id, registro.autor_id, registro.acao) == (
        maria.id,
        ana.id,
        "criou",
    )


def test_acompanhante_edita_e_a_edicao_fica_auditada(
    cliente: TestClient, sessao: Session, maria, ana
):
    maria, _ = maria
    ana, _ = ana
    _autorizar(sessao, maria, ana)
    gasto = _gasto(sessao, maria)

    resposta = cliente.patch(
        f"{TRANSACOES}/{gasto.id}",
        json={"valor": "15.00"},
        headers=_token(ana, id_titular=maria.id),
    )
    assert resposta.status_code == 200
    acoes = sessao.scalars(
        select(Auditoria.acao).where(
            Auditoria.registro_id == gasto.id, Auditoria.autor_id == ana.id
        )
    ).all()
    assert acoes == ["editou"]


def test_titular_tambem_fica_registrado_como_autor(
    cliente: TestClient, sessao: Session, maria
):
    maria, _ = maria
    resposta = cliente.post(
        TRANSACOES,
        json={"tipo": "entrada", "valor": "100.00", "origem": "manual"},
        headers=_token(maria),
    )
    registro = sessao.scalar(
        select(Auditoria).where(
            Auditoria.registro_id == uuid.UUID(resposta.json()["id"])
        )
    )
    assert registro.autor_id == maria.id == registro.titular_id


def test_acompanhante_ve_saldo_e_contas_do_titular(
    cliente: TestClient, sessao: Session, maria, ana
):
    maria, _ = maria
    ana, _ = ana
    _autorizar(sessao, maria, ana)
    cabecalho = _token(ana, id_titular=maria.id)

    assert cliente.get(f"{TRANSACOES}/saldo", headers=cabecalho).status_code == 200
    assert cliente.get("/api/v1/contas", headers=cabecalho).status_code == 200


def test_revogar_derruba_o_token_que_ja_foi_emitido(
    cliente: TestClient, sessao: Session, maria, ana
):
    maria, _ = maria
    ana, _ = ana
    _autorizar(sessao, maria, ana)
    cabecalho = _token(ana, id_titular=maria.id)
    assert cliente.get(TRANSACOES, headers=cabecalho).status_code == 200

    revogado = cliente.post(f"{AUTH}/revogar-acesso/{ana.id}", headers=_token(maria))
    assert revogado.status_code == 200

    assert cliente.get(TRANSACOES, headers=cabecalho).status_code == 403


def test_acompanhante_de_um_nao_acessa_outro_titular(
    cliente: TestClient, sessao: Session, maria, ana
):
    maria, _ = maria
    ana, _ = ana
    joao, _ = _pessoa(sessao, "João")
    _autorizar(sessao, maria, ana)
    gasto_do_joao = _gasto(sessao, joao)

    resposta = cliente.get(TRANSACOES, headers=_token(ana, id_titular=joao.id))
    assert resposta.status_code == 403
    troca = cliente.post(f"{AUTH}/acompanhar/{joao.id}", headers=_token(ana))
    assert troca.status_code == 403

    editar = cliente.patch(
        f"{TRANSACOES}/{gasto_do_joao.id}",
        json={"valor": "1.00"},
        headers=_token(ana, id_titular=maria.id),
    )
    assert editar.status_code == 404


def test_titular_nao_ve_dados_do_acompanhante(
    cliente: TestClient, sessao: Session, maria, ana
):
    maria, _ = maria
    ana, _ = ana
    _autorizar(sessao, maria, ana)
    _gasto(sessao, ana)

    assert cliente.get(TRANSACOES, headers=_token(maria)).json() == []


@pytest.mark.parametrize(
    ("metodo", "rota", "corpo"),
    [
        ("put", f"{AUTH}/pin", {"pin_atual": "123456", "novo_pin": "654321"}),
        ("post", f"{AUTH}/convidar-acompanhante", {"telefone": "61999998888"}),
        ("get", f"{AUTH}/contas-com-acompanhantes", None),
        ("post", "/api/v1/contas", {}),
    ],
)
def test_token_de_acompanhante_nao_vale_nas_rotas_do_titular(
    cliente: TestClient, sessao: Session, maria, ana, metodo, rota, corpo
):
    maria, _ = maria
    ana, _ = ana
    _autorizar(sessao, maria, ana)

    resposta = cliente.request(
        metodo, rota, json=corpo, headers=_token(ana, id_titular=maria.id)
    )
    assert resposta.status_code == 403


def test_acompanhante_nao_exclui_lancamento_do_titular(
    cliente: TestClient, sessao: Session, maria, ana
):
    maria, _ = maria
    ana, _ = ana
    _autorizar(sessao, maria, ana)
    gasto = _gasto(sessao, maria)

    resposta = cliente.delete(
        f"{TRANSACOES}/{gasto.id}", headers=_token(ana, id_titular=maria.id)
    )
    assert resposta.status_code == 403
    assert "você mesmo anotou" in resposta.json()["detail"]
    assert sessao.get(Transacao, gasto.id) is not None
    assert (
        sessao.scalar(
            select(Auditoria).where(
                Auditoria.registro_id == gasto.id, Auditoria.acao == "excluiu"
            )
        )
        is None
    )


def test_acompanhante_desfaz_o_proprio_lancamento_e_fica_auditado(
    cliente: TestClient, sessao: Session, maria, ana
):
    maria, _ = maria
    ana, _ = ana
    _autorizar(sessao, maria, ana)
    cabecalho = _token(ana, id_titular=maria.id)
    criado = cliente.post(
        TRANSACOES,
        json={"tipo": "saida", "valor": "35.00", "origem": "manual"},
        headers=cabecalho,
    )
    transacao_id = uuid.UUID(criado.json()["id"])

    resposta = cliente.delete(f"{TRANSACOES}/{transacao_id}", headers=cabecalho)

    assert resposta.status_code == 204
    assert sessao.get(Transacao, transacao_id) is None
    acoes = sessao.scalars(
        select(Auditoria.acao)
        .where(Auditoria.registro_id == transacao_id, Auditoria.autor_id == ana.id)
        .order_by(Auditoria.id)
    ).all()
    assert acoes == ["criou", "excluiu"]


def test_acompanhante_nao_exclui_lancamento_de_outro_acompanhante(
    cliente: TestClient, sessao: Session, maria, ana
):
    maria, _ = maria
    ana, _ = ana
    pedro, _ = _pessoa(sessao, "Pedro")
    _autorizar(sessao, maria, ana)
    _autorizar(sessao, maria, pedro)
    criado = cliente.post(
        TRANSACOES,
        json={"tipo": "saida", "valor": "20.00", "origem": "manual"},
        headers=_token(pedro, id_titular=maria.id),
    )

    resposta = cliente.delete(
        f"{TRANSACOES}/{criado.json()['id']}",
        headers=_token(ana, id_titular=maria.id),
    )
    assert resposta.status_code == 403


def test_titular_exclui_lancamento_feito_pelo_acompanhante(
    cliente: TestClient, sessao: Session, maria, ana
):
    maria, _ = maria
    ana, _ = ana
    _autorizar(sessao, maria, ana)
    criado = cliente.post(
        TRANSACOES,
        json={"tipo": "saida", "valor": "12.00", "origem": "manual"},
        headers=_token(ana, id_titular=maria.id),
    )
    transacao_id = uuid.UUID(criado.json()["id"])

    resposta = cliente.delete(f"{TRANSACOES}/{transacao_id}", headers=_token(maria))

    assert resposta.status_code == 204
    registro = sessao.scalar(
        select(Auditoria).where(
            Auditoria.registro_id == transacao_id, Auditoria.acao == "excluiu"
        )
    )
    assert registro.autor_id == maria.id


@pytest.mark.parametrize("titular", [None, "nao-e-um-uuid"])
def test_token_de_acompanhante_sem_titular_valido_e_recusado(
    cliente: TestClient, ana, titular
):
    ana, _ = ana
    agora = datetime.now(UTC)
    dados = {
        "sub": str(ana.id),
        "perfil": "acompanhante",
        "ver": 0,
        "iat": agora,
        "exp": agora + UMA_HORA,
    }
    if titular is not None:
        dados["tit"] = titular
    token = jwt.encode(dados, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITMO)

    resposta = cliente.get(TRANSACOES, headers={"Authorization": f"Bearer {token}"})
    assert resposta.status_code == 403


def test_token_de_acompanhante_cai_quando_o_acompanhante_troca_o_pin(
    cliente: TestClient, sessao: Session, maria, ana
):
    maria, _ = maria
    ana, _ = ana
    _autorizar(sessao, maria, ana)
    cabecalho = _token(ana, id_titular=maria.id)
    assert cliente.get(TRANSACOES, headers=cabecalho).status_code == 200

    troca = cliente.put(
        f"{AUTH}/pin",
        json={"pin_atual": "123456", "novo_pin": "654321"},
        headers=_token(ana),
    )
    assert troca.status_code == 200

    assert cliente.get(TRANSACOES, headers=cabecalho).status_code == 401


def test_revogar_convite_inexistente(cliente: TestClient, maria, ana):
    maria, _ = maria
    ana, _ = ana

    resposta = cliente.post(f"{AUTH}/revogar-acesso/{ana.id}", headers=_token(maria))
    assert resposta.status_code == 404
