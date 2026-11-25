"""RF31: dar baixa em conta respondendo ao aviso no WhatsApp."""

import uuid
from contextlib import nullcontext
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock

import app.modulos.assistente.router as router_module
from app.modulos.assistente import mensagens
from app.modulos.contas import servico as servico_contas
from app.modulos.contas.esquemas import ContaSaida
from app.modulos.contas.modelos import Conta
from app.nucleo import eventos
from tests.test_assistente_rf12_rf15 import ambiente_assistente  # noqa: F401


@dataclass
class ContaTeste:
    id: uuid.UUID
    descricao: str
    valor: Decimal = Decimal("125.50")
    vencimento_em: date = date.today() + timedelta(days=1)
    pagamento_em: datetime | None = None
    avisada: bool = True


def test_definir_pagamento_publica_evento_de_conta_atualizada(monkeypatch):
    usuario_id = uuid.uuid4()
    conta = Conta(
        id=uuid.uuid4(),
        usuario_id=usuario_id,
        descricao="Luz",
        valor=Decimal("125.50"),
        vencimento_em=date.today() + timedelta(days=1),
        categoria_id=None,
        criado_em=datetime.now(UTC),
        recorrente=False,
    )
    sessao = Mock()
    sessao.scalar.return_value = conta
    publicar = Mock()
    monkeypatch.setattr(servico_contas.eventos, "publicar", publicar)
    monkeypatch.setattr(
        servico_contas,
        "registrar_pagamento",
        lambda _sessao, registro: setattr(registro, "pagamento_em", datetime.now(UTC)),
    )

    resultado = servico_contas.definir_pagamento(
        sessao, usuario_id, conta.id, paga=True
    )

    assert resultado is conta
    publicar.assert_called_once_with(
        usuario_id,
        eventos.TipoEvento.CONTA_ATUALIZADA,
        ContaSaida.model_validate(conta).model_dump(mode="json"),
    )


def _preparar(ambiente, monkeypatch, *contas):
    _, telefone, enviadas, registrar, enviar = ambiente
    usuario = SimpleNamespace(id=uuid.uuid4(), nome="Teste")
    sessao_db = object()
    monkeypatch.setattr(router_module, "SessaoLocal", lambda: nullcontext(sessao_db))
    monkeypatch.setattr(router_module, "buscar_usuario_telefone", lambda _: usuario)
    monkeypatch.setattr(
        router_module.servico_transacoes,
        "contas_com_aviso_whatsapp",
        lambda _sessao, _usuario_id: [
            conta for conta in contas if conta.avisada and conta.pagamento_em is None
        ],
    )
    monkeypatch.setattr(
        servico_contas,
        "contas_por_ids",
        lambda _sessao, _usuario_id, ids: [
            conta for conta in contas if conta.id in ids
        ],
    )

    def marcar_paga(_sessao, _usuario_id, conta_id, paga):
        conta = next(conta for conta in contas if conta.id == conta_id)
        if paga and conta.pagamento_em is None:
            conta.pagamento_em = datetime.now(UTC)
        return conta

    marcar_paga_mock = Mock(side_effect=marcar_paga)
    monkeypatch.setattr(servico_contas, "definir_pagamento", marcar_paga_mock)
    return telefone, enviadas, registrar, enviar, marcar_paga_mock


def test_pagar_responde_baixa_unica_conta_com_aviso(
    ambiente_assistente,  # noqa: F811
    monkeypatch,
):
    conta = ContaTeste(uuid.uuid4(), "Conta de luz")
    _, enviadas, _, enviar, marcar_paga = _preparar(
        ambiente_assistente, monkeypatch, conta
    )

    enviar("pago")

    assert conta.pagamento_em is not None
    assert enviadas[-1] == mensagens.conta_marcada_paga("Conta de luz")
    marcar_paga.assert_called_once()
    assert marcar_paga.call_args.args[2:] == (conta.id,)
    assert marcar_paga.call_args.kwargs == {"paga": True}


def test_pagar_com_varias_contas_pergunta_qual_e_processa_escolha(
    ambiente_assistente,  # noqa: F811
    monkeypatch,
):
    luz = ContaTeste(uuid.uuid4(), "Luz")
    internet = ContaTeste(uuid.uuid4(), "Internet")
    telefone, enviadas, _, enviar, marcar_paga = _preparar(
        ambiente_assistente, monkeypatch, luz, internet
    )

    enviar("pago")

    assert "Qual você pagou?" in enviadas[-1]
    assert "1. Luz" in enviadas[-1]
    assert "2. Internet" in enviadas[-1]
    ids_pendentes = router_module.sessao_assistente.obter_pagamento_pendente(telefone)[
        0
    ]
    assert ids_pendentes is not None
    assert len(ids_pendentes) == 2

    enviar("2")

    assert luz.pagamento_em is None
    assert internet.pagamento_em is not None
    assert enviadas[-1] == mensagens.conta_marcada_paga("Internet")
    assert router_module.sessao_assistente.obter_pagamento_pendente(telefone)[0] is None
    assert marcar_paga.call_args.args[2] == internet.id


def test_pagar_sem_aviso_nao_marca_contas(  # noqa: F811
    ambiente_assistente,  # noqa: F811
    monkeypatch,
):
    conta = ContaTeste(uuid.uuid4(), "Luz", avisada=False)
    _, enviadas, _, enviar, marcar_paga = _preparar(
        ambiente_assistente, monkeypatch, conta
    )

    enviar("pago")

    assert conta.pagamento_em is None
    assert enviadas[-1] == mensagens.nenhuma_conta_para_pagar()
    marcar_paga.assert_not_called()


def test_pagamento_no_whatsapp_preserva_lancamento_pendente(
    ambiente_assistente,  # noqa: F811
    monkeypatch,
):
    sessao_assistente, telefone, enviadas, registrar, enviar = ambiente_assistente
    conta = ContaTeste(uuid.uuid4(), "Luz")
    _preparar(ambiente_assistente, monkeypatch, conta)

    enviar("gastei 10 no mercado")
    pendencia_antes, _ = sessao_assistente.obter_pendencia(telefone)
    enviar("pago")
    pendencia_depois, _ = sessao_assistente.obter_pendencia(telefone)

    assert pendencia_depois == pendencia_antes
    assert enviadas[-1] == mensagens.conta_marcada_paga("Luz")
    registrar.assert_not_called()


def test_escolha_por_nome_e_cancelamento(  # noqa: F811
    ambiente_assistente,  # noqa: F811
    monkeypatch,
):
    luz = ContaTeste(uuid.uuid4(), "Conta de luz")
    internet = ContaTeste(uuid.uuid4(), "Internet")
    telefone, enviadas, _, enviar, _ = _preparar(
        ambiente_assistente, monkeypatch, luz, internet
    )

    enviar("pago")
    enviar("cancelar")
    assert enviadas[-1] == mensagens.escolha_conta_cancelada()
    assert router_module.sessao_assistente.obter_pagamento_pendente(telefone)[0] is None

    enviar("pago")
    assert "Qual você pagou?" in enviadas[-1]
    enviar("conta")
    assert "Qual você pagou?" in enviadas[-1]
    assert luz.pagamento_em is None
    assert internet.pagamento_em is None
    enviar("luz")

    assert luz.pagamento_em is not None
    assert internet.pagamento_em is None
    assert enviadas[-1] == mensagens.conta_marcada_paga("Conta de luz")

    enviar("pago")
    assert enviadas[-1] == mensagens.conta_marcada_paga("Internet")
    assert internet.pagamento_em is not None
    assert router_module.sessao_assistente.obter_pagamento_pendente(telefone)[0] is None


def test_lancamento_durante_escolha_de_conta_segue_fluxo_normal(  # noqa: F811
    ambiente_assistente,  # noqa: F811
    monkeypatch,
):
    sessao_assistente, _, _, _, _ = ambiente_assistente
    luz = ContaTeste(uuid.uuid4(), "Luz")
    internet = ContaTeste(uuid.uuid4(), "Internet")
    telefone, enviadas, _, enviar, marcar_paga = _preparar(
        ambiente_assistente, monkeypatch, luz, internet
    )

    enviar("pago")
    assert "Qual você pagou?" in enviadas[-1]

    enviar("gastei 30 no mercado")

    assert "Qual você pagou?" not in enviadas[-1]
    assert router_module.sessao_assistente.obter_pagamento_pendente(telefone)[0] is None
    pendencia, _ = sessao_assistente.obter_pendencia(telefone)
    assert pendencia is not None
    assert pendencia.valor == 3000
    marcar_paga.assert_not_called()


def test_numero_fora_da_lista_pergunta_de_novo(  # noqa: F811
    ambiente_assistente,  # noqa: F811
    monkeypatch,
):
    luz = ContaTeste(uuid.uuid4(), "Luz")
    internet = ContaTeste(uuid.uuid4(), "Internet")
    _, enviadas, _, enviar, marcar_paga = _preparar(
        ambiente_assistente, monkeypatch, luz, internet
    )

    enviar("pago")
    enviar("5")

    assert "Qual você pagou?" in enviadas[-1]
    marcar_paga.assert_not_called()
