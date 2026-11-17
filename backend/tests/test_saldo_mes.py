"""Testes do anotar no app e do saldo do mês (RF08, RF19, RF30) e da lista de
categorias (RF09)."""

import uuid
from datetime import date
from decimal import Decimal

import fakeredis
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modulos.categorias.modelos import Categoria
from app.modulos.contas.modelos import Conta
from app.modulos.identidade.modelos import Usuario
from app.modulos.transacoes import servico
from app.modulos.transacoes.modelos import Transacao
from app.nucleo import eventos


@pytest.fixture(autouse=True)
def valkey_falso(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(eventos, "cliente", fakeredis.FakeRedis())


def _lancar(
    sessao: Session, usuario_id: uuid.UUID, tipo: str, valor: str, data: date
) -> Transacao:
    transacao = Transacao(
        usuario_id=usuario_id,
        tipo=tipo,
        valor=Decimal(valor),
        data=data,
        origem="manual",
    )
    sessao.add(transacao)
    sessao.flush()
    return transacao


def _conta(
    sessao: Session, usuario_id: uuid.UUID, valor: str, vencimento: date
) -> Conta:
    conta = Conta(usuario_id=usuario_id, valor=Decimal(valor), vencimento_em=vencimento)
    sessao.add(conta)
    sessao.flush()
    return conta


def _saldo(cliente: TestClient, mes: str) -> dict:
    resposta = cliente.get("/api/v1/transacoes/saldo", params={"mes": mes})
    assert resposta.status_code == 200
    return resposta.json()


def test_anotar_gasto_no_app_retorna_201_e_entra_no_historico(
    cliente_logado: TestClient,
) -> None:
    resposta = cliente_logado.post(
        "/api/v1/transacoes",
        json={"tipo": "saida", "valor": "35.00", "data": "2026-03-10"},
    )

    assert resposta.status_code == 201
    assert resposta.json()["origem"] == "manual"
    historico = cliente_logado.get("/api/v1/transacoes").json()
    assert [t["valor"] for t in historico] == ["35.00"]


def test_anotar_avisa_o_app_pelo_tempo_real(
    cliente_logado: TestClient, usuario: Usuario, monkeypatch: pytest.MonkeyPatch
) -> None:
    avisos: list = []
    monkeypatch.setattr(eventos, "publicar", lambda *aviso: avisos.append(aviso))

    cliente_logado.post("/api/v1/transacoes", json={"tipo": "entrada", "valor": "10"})

    assert avisos and avisos[0][0] == usuario.id


def test_app_nao_pode_gravar_com_origem_do_whatsapp(
    cliente_logado: TestClient,
) -> None:
    resposta = cliente_logado.post(
        "/api/v1/transacoes",
        json={"tipo": "saida", "valor": "10", "origem": "whatsapp_texto"},
    )

    assert resposta.status_code == 422


def test_anotar_com_valor_zero_retorna_422(cliente_logado: TestClient) -> None:
    resposta = cliente_logado.post(
        "/api/v1/transacoes", json={"tipo": "saida", "valor": "0"}
    )

    assert resposta.status_code == 422


def test_anotar_sem_login_retorna_401(cliente: TestClient) -> None:
    resposta = cliente.post("/api/v1/transacoes", json={"tipo": "saida", "valor": "1"})

    assert resposta.status_code == 401


def test_saldo_e_entradas_menos_gastos_menos_contas(
    sessao: Session, usuario: Usuario, cliente_logado: TestClient
) -> None:
    _lancar(sessao, usuario.id, "entrada", "1500.00", date(2026, 3, 5))
    _lancar(sessao, usuario.id, "saida", "200.00", date(2026, 3, 6))
    _conta(sessao, usuario.id, "100.00", date(2026, 3, 20))

    corpo = _saldo(cliente_logado, "2026-03")

    assert corpo == {
        "mes": "2026-03",
        "entradas": "1500.00",
        "gastos": "200.00",
        "contas": "100.00",
        "saldo": "1200.00",
    }


def test_saldo_pode_ficar_negativo(
    sessao: Session, usuario: Usuario, cliente_logado: TestClient
) -> None:
    _lancar(sessao, usuario.id, "entrada", "100.00", date(2026, 3, 5))
    _lancar(sessao, usuario.id, "saida", "130.50", date(2026, 3, 6))

    assert _saldo(cliente_logado, "2026-03")["saldo"] == "-30.50"


def test_saldo_vazio_e_zero(cliente_logado: TestClient) -> None:
    corpo = _saldo(cliente_logado, "2026-03")

    assert Decimal(corpo["saldo"]) == 0


def test_virada_de_mes_separa_ultimo_e_primeiro_dia(
    sessao: Session, usuario: Usuario, cliente_logado: TestClient
) -> None:
    _lancar(sessao, usuario.id, "saida", "10.00", date(2026, 3, 31))
    _lancar(sessao, usuario.id, "saida", "20.00", date(2026, 4, 1))
    _conta(sessao, usuario.id, "5.00", date(2026, 3, 31))
    _conta(sessao, usuario.id, "7.00", date(2026, 4, 1))

    marco = _saldo(cliente_logado, "2026-03")
    abril = _saldo(cliente_logado, "2026-04")

    assert (marco["gastos"], marco["contas"]) == ("10.00", "5.00")
    assert (abril["gastos"], abril["contas"]) == ("20.00", "7.00")


def test_fevereiro_bissexto_inclui_o_dia_29(
    sessao: Session, usuario: Usuario, cliente_logado: TestClient
) -> None:
    _lancar(sessao, usuario.id, "saida", "10.00", date(2028, 2, 29))

    assert _saldo(cliente_logado, "2028-02")["gastos"] == "10.00"


def test_pagar_conta_nao_muda_o_saldo(
    sessao: Session, usuario: Usuario, cliente_logado: TestClient
) -> None:
    _lancar(sessao, usuario.id, "entrada", "500.00", date.today())
    conta = _conta(sessao, usuario.id, "100.00", date.today())
    mes = date.today().strftime("%Y-%m")
    antes = _saldo(cliente_logado, mes)["saldo"]

    cliente_logado.patch(f"/api/v1/contas/{conta.id}/pagamento", json={"paga": True})

    assert _saldo(cliente_logado, mes)["saldo"] == antes == "400.00"


def test_conta_fixa_lancada_pelo_rf18_nao_desconta_duas_vezes(
    sessao: Session, usuario: Usuario, cliente_logado: TestClient
) -> None:
    conta = _conta(sessao, usuario.id, "80.00", date(2026, 3, 10))
    conta.recorrente = True
    sessao.flush()

    servico.lancar_gastos_fixos(sessao, hoje=date(2026, 3, 10))
    corpo = _saldo(cliente_logado, "2026-03")

    assert (corpo["gastos"], corpo["contas"], corpo["saldo"]) == (
        "80.00",
        "0.00",
        "-80.00",
    )


def test_saldo_nao_mistura_usuarios(
    sessao: Session, usuario: Usuario, cliente_logado: TestClient
) -> None:
    outro = Usuario(
        id=uuid.uuid4(),
        nome="José",
        hash_telefone=uuid.uuid4().hex,
        email=f"jose{uuid.uuid4().hex[:8]}@vero.com",
        hash_pin="x",
        tentativas=0,
    )
    sessao.add(outro)
    sessao.flush()
    _lancar(sessao, outro.id, "saida", "999.00", date(2026, 3, 5))
    _conta(sessao, outro.id, "50.00", date(2026, 3, 5))

    corpo = _saldo(cliente_logado, "2026-03")

    assert Decimal(corpo["gastos"]) == Decimal(corpo["contas"]) == 0


def test_saldo_sem_mes_usa_o_mes_atual_de_brasilia(
    cliente_logado: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(servico, "mes_atual", lambda: (2026, 7))

    resposta = cliente_logado.get("/api/v1/transacoes/saldo")

    assert resposta.json()["mes"] == "2026-07"


@pytest.mark.parametrize("mes", ["2026-13", "2026-3", "marco", "2026-00"])
def test_saldo_com_mes_invalido_retorna_422(
    cliente_logado: TestClient, mes: str
) -> None:
    resposta = cliente_logado.get("/api/v1/transacoes/saldo", params={"mes": mes})

    assert resposta.status_code == 422


def test_categorias_vem_do_banco_em_ordem(sessao: Session, cliente: TestClient) -> None:
    sessao.add_all(
        [
            Categoria(id=9001, codigo="teste-mercado", nome="Mercado"),
            Categoria(id=9002, codigo="teste-farmacia", nome="Farmácia"),
        ]
    )
    sessao.flush()

    corpo = cliente.get("/api/v1/categorias").json()
    nossas = [c for c in corpo if c["codigo"].startswith("teste-")]

    assert nossas == [
        {"id": 9001, "codigo": "teste-mercado", "nome": "Mercado"},
        {"id": 9002, "codigo": "teste-farmacia", "nome": "Farmácia"},
    ]
