"""RF27: conta a pagar a partir de foto de boleto ou conta (RF14, RF15, RF16, RF25)."""

import asyncio
import base64
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import fakeredis
import pytest

import app.modulos.assistente.router as router_module
from app.integracoes import leitor_comprovante
from app.modulos.assistente import mensagens
from app.modulos.assistente.extrator import (
    TipoTransacao,
    extrair_vencimento,
    identificar_tipo_resposta,
)
from app.modulos.assistente.sessao import CampoFaltando, GerenciadorSessao
from app.modulos.contas.esquemas import hoje_brasilia
from app.nucleo.portas import LeituraComprovante
from tests.test_assistente_rf12_rf15 import ambiente_assistente  # noqa: F401
from tests.test_assistente_rf14 import FOTO, _mensagem_com_foto


@pytest.fixture
def ambiente_contas(ambiente_assistente, monkeypatch):  # noqa: F811
    sessao, telefone, enviadas, registrar, enviar = ambiente_assistente
    cadastrar = Mock()
    monkeypatch.setattr(router_module.servico_contas, "cadastrar", cadastrar)
    falso = SimpleNamespace(leitura=LeituraComprovante(), recebido=None)

    async def ler(imagem, tipo_mime, legenda):
        falso.recebido = (imagem, tipo_mime, legenda)
        if isinstance(falso.leitura, Exception):
            raise falso.leitura
        return falso.leitura

    monkeypatch.setattr(
        router_module, "obter_leitor_comprovante", lambda: SimpleNamespace(ler=ler)
    )

    def enviar_foto(legenda: str | None = None):
        remetente = f"{telefone}@s.whatsapp.net"
        asyncio.run(
            router_module.processar_foto(remetente, _mensagem_com_foto(legenda))
        )

    return sessao, telefone, enviadas, registrar, cadastrar, enviar, enviar_foto, falso


def test_foto_boleto_lida_pede_confirmacao_e_cria_conta_a_pagar(ambiente_contas):
    _, _, enviadas, registrar, cadastrar, enviar, enviar_foto, leitor = ambiente_contas
    vencimento = hoje_brasilia() + timedelta(days=10)
    leitor.leitura = LeituraComprovante(
        valor=14590,
        tipo="CONTA_PAGAR",
        categoria="Moradia",
        descricao="Conta de luz",
        vencimento=vencimento,
    )

    enviar_foto()

    assert enviadas[-1] == mensagens.confirmacao_conta_pagar(
        14590, vencimento, "Moradia"
    )
    assert cadastrar.call_count == 0

    enviar("Sim")

    cadastrar.assert_called_once()
    registrar.assert_not_called()
    dados = cadastrar.call_args.kwargs["dados"]
    assert dados.valor == Decimal("145.90")
    assert dados.vencimento_em == vencimento
    assert dados.descricao == "Conta de luz"
    assert enviadas[-1] == mensagens.confirmacao_sucesso_conta_pagar(
        14590, vencimento, "Moradia"
    )


def test_foto_ambigua_diferencia_conta_a_pagar_de_gasto_perguntando(ambiente_contas):
    sessao, telefone, enviadas, registrar, cadastrar, enviar, enviar_foto, leitor = (
        ambiente_contas
    )
    leitor.leitura = LeituraComprovante(
        valor=8900,
        tipo="",
        categoria="Moradia",
        descricao="Internet",
    )

    enviar_foto()

    assert enviadas[-1] == mensagens.pedir_tipo(
        8900, router_module.MOTIVOS_FOTO[CampoFaltando.TIPO]
    )
    assert sessao.obter_pendencia(telefone)[0].faltando == CampoFaltando.TIPO

    enviar("conta a pagar")
    assert enviadas[-1] == mensagens.pedir_vencimento(8900)
    assert sessao.obter_pendencia(telefone)[0].faltando == CampoFaltando.VENCIMENTO

    vencimento = hoje_brasilia() + timedelta(days=5)
    enviar(vencimento.strftime("%d/%m/%Y"))
    assert enviadas[-1] == mensagens.confirmacao_conta_pagar(
        8900, vencimento, "Moradia"
    )

    enviar("Sim")
    cadastrar.assert_called_once()
    registrar.assert_not_called()
    assert cadastrar.call_args.kwargs["dados"].vencimento_em == vencimento


def test_foto_ambigua_respondida_como_ja_paga_vira_gasto(ambiente_contas):
    _, _, enviadas, registrar, cadastrar, enviar, enviar_foto, leitor = ambiente_contas
    leitor.leitura = LeituraComprovante(
        valor=8900, tipo="", categoria="Moradia", descricao="Internet"
    )

    enviar_foto()
    enviar("já paguei essa conta")

    assert enviadas[-1] == mensagens.confirmacao_gasto(8900, "Moradia")
    enviar("Sim")

    registrar.assert_called_once()
    cadastrar.assert_not_called()


def test_conta_sem_vencimento_cai_no_fallback_manual_e_valida_data(ambiente_contas):
    sessao, telefone, enviadas, _, cadastrar, enviar, enviar_foto, leitor = (
        ambiente_contas
    )
    leitor.leitura = LeituraComprovante(
        valor=12000,
        tipo="CONTA_PAGAR",
        categoria="Moradia",
        descricao="Conta de água",
        vencimento=None,
    )

    enviar_foto()
    assert enviadas[-1].startswith("Não consegui ler a data de vencimento na foto.")

    enviar("não sei")
    assert enviadas[-1] == mensagens.vencimento_ainda_nao_entendido()
    assert sessao.obter_pendencia(telefone)[0].faltando == CampoFaltando.VENCIMENTO

    enviar("01/01/2020")
    assert enviadas[-1] == mensagens.vencimento_ainda_nao_entendido()

    vencimento = hoje_brasilia() + timedelta(days=7)
    enviar(vencimento.strftime("%d/%m"))
    assert enviadas[-1] == mensagens.confirmacao_conta_pagar(
        12000, vencimento, "Moradia"
    )

    enviar("Sim")
    cadastrar.assert_called_once()
    assert cadastrar.call_args.kwargs["dados"].vencimento_em == vencimento


def test_cancelar_durante_vencimento_descarta_conta(ambiente_contas):
    sessao, telefone, enviadas, _, cadastrar, enviar, enviar_foto, leitor = (
        ambiente_contas
    )
    leitor.leitura = LeituraComprovante(
        valor=5000, tipo="CONTA_PAGAR", categoria="Outros"
    )

    enviar_foto()
    enviar("cancelar")

    assert enviadas[-1] == mensagens.registro_cancelado()
    assert sessao.obter_pendencia(telefone)[0] is None
    cadastrar.assert_not_called()


def test_correcao_de_valor_e_vencimento_antes_de_salvar(ambiente_contas):
    _, _, enviadas, _, cadastrar, enviar, enviar_foto, leitor = ambiente_contas
    vencimento_inicial = hoje_brasilia() + timedelta(days=3)
    vencimento_novo = hoje_brasilia() + timedelta(days=12)
    leitor.leitura = LeituraComprovante(
        valor=10000,
        tipo="CONTA_PAGAR",
        categoria="Moradia",
        descricao="Luz",
        vencimento=vencimento_inicial,
    )

    enviar_foto()
    enviar(f"não, é 150 e vence {vencimento_novo.strftime('%d/%m/%Y')}")

    assert enviadas[-1] == mensagens.confirmacao_conta_pagar(
        15000, vencimento_novo, "Moradia"
    )
    assert cadastrar.call_count == 0

    enviar("Sim")
    dados = cadastrar.call_args.kwargs["dados"]
    assert dados.valor == Decimal("150.00")
    assert dados.vencimento_em == vencimento_novo


def test_falha_no_banco_ao_salvar_conta_mantem_pendencia(ambiente_contas):
    sessao, telefone, enviadas, _, cadastrar, enviar, enviar_foto, leitor = (
        ambiente_contas
    )
    vencimento = hoje_brasilia() + timedelta(days=4)
    leitor.leitura = LeituraComprovante(
        valor=7500,
        tipo="CONTA_PAGAR",
        categoria="Moradia",
        vencimento=vencimento,
    )
    cadastrar.side_effect = RuntimeError("banco indisponível")

    enviar_foto()
    enviar("Sim")

    assert enviadas[-1] == mensagens.falha_ao_salvar()
    assert sessao.obter_pendencia(telefone)[0] is not None

    cadastrar.side_effect = None
    enviar("Sim")
    assert enviadas[-1] == mensagens.confirmacao_sucesso_conta_pagar(
        7500, vencimento, "Moradia"
    )
    assert sessao.obter_pendencia(telefone)[0] is None


def test_legenda_ajuda_a_identificar_conta_a_pagar_e_vencimento(ambiente_contas):
    _, _, enviadas, _, cadastrar, enviar, enviar_foto, leitor = ambiente_contas
    leitor.leitura = LeituraComprovante()
    vencimento = hoje_brasilia() + timedelta(days=8)

    enviar_foto(f"boleto de luz vence {vencimento.strftime('%d/%m/%Y')}")
    assert enviadas[-1].startswith("Não consegui ler o valor na foto.")

    enviar("210")
    assert enviadas[-1] == mensagens.confirmacao_conta_pagar(
        21000, vencimento, "Moradia"
    )

    enviar("Sim")
    cadastrar.assert_called_once()
    assert cadastrar.call_args.kwargs["dados"].valor == Decimal("210.00")
    assert cadastrar.call_args.kwargs["dados"].vencimento_em == vencimento


def test_claude_le_conta_a_pagar_com_vencimento(monkeypatch):
    resposta = SimpleNamespace(
        stop_reason="end_turn",
        parsed_output=leitor_comprovante._Leitura(
            valor_centavos=18950,
            tipo="CONTA_PAGAR",
            categoria="Moradia",
            descricao="  Enel Energia  ",
            vencimento="2026-12-10",
        ),
    )
    leitor = leitor_comprovante.LeitorComprovanteClaude()
    monkeypatch.setattr(
        leitor._cliente.messages, "parse", AsyncMock(return_value=resposta)
    )

    leitura = asyncio.run(leitor.ler(FOTO, "image/jpeg", None))

    assert leitura == LeituraComprovante(
        valor=18950,
        tipo="CONTA_PAGAR",
        categoria="Moradia",
        descricao="Enel Energia",
        vencimento=date(2026, 12, 10),
    )
    assert base64.standard_b64encode(FOTO).decode() in str(
        leitor._cliente.messages.parse.call_args.kwargs["messages"]
    )


def test_claude_descarta_vencimento_invalido_ou_de_gasto(monkeypatch):
    resposta = SimpleNamespace(
        stop_reason="end_turn",
        parsed_output=leitor_comprovante._Leitura(
            valor_centavos=5000,
            tipo="GASTO",
            categoria="Moradia",
            descricao="Cupom",
            vencimento="2026-12-10",
        ),
    )
    leitor = leitor_comprovante.LeitorComprovanteClaude()
    monkeypatch.setattr(
        leitor._cliente.messages, "parse", AsyncMock(return_value=resposta)
    )

    leitura = asyncio.run(leitor.ler(FOTO, "image/jpeg", None))
    assert leitura.vencimento is None

    resposta.parsed_output.tipo = "CONTA_PAGAR"
    resposta.parsed_output.vencimento = "data-invalida"
    leitura_invalida = asyncio.run(leitor.ler(FOTO, "image/jpeg", None))
    assert leitura_invalida.vencimento is None


def test_sessao_valkey_preserva_vencimento_da_conta():
    sessao = GerenciadorSessao()
    sessao._valkey = fakeredis.FakeRedis(decode_responses=True)
    tel = "5561977776666"
    vencimento = date(2026, 12, 15)

    sessao.salvar_pendencia(
        tel,
        TipoTransacao.CONTA_PAGAR,
        9900,
        "Moradia",
        "Internet",
        vencimento=vencimento,
    )
    pendencia, expirou = sessao.obter_pendencia(tel)

    assert expirou is False
    assert pendencia is not None
    assert pendencia.tipo == TipoTransacao.CONTA_PAGAR
    assert pendencia.vencimento == vencimento


@pytest.mark.parametrize(
    ("texto", "tipo"),
    [
        ("conta a pagar", TipoTransacao.CONTA_PAGAR),
        ("é um boleto", TipoTransacao.CONTA_PAGAR),
        ("conta", TipoTransacao.CONTA_PAGAR),
        ("já paguei essa conta", TipoTransacao.GASTO),
        ("comprovante", TipoTransacao.GASTO),
    ],
)
def test_identificar_tipo_resposta_diferencia_conta_a_pagar(texto, tipo):
    assert identificar_tipo_resposta(texto) == tipo


def test_extrair_vencimento_varios_formatos():
    ref = date(2026, 11, 28)
    assert extrair_vencimento("hoje", referencia=ref) == date(2026, 11, 28)
    assert extrair_vencimento("amanhã", referencia=ref) == date(2026, 11, 29)
    assert extrair_vencimento("15/12/2026", referencia=ref) == date(2026, 12, 15)
    assert extrair_vencimento("15/12/26", referencia=ref) == date(2026, 12, 15)
    assert extrair_vencimento("05/12", referencia=ref) == date(2026, 12, 5)
    assert extrair_vencimento("05/01", referencia=date(2026, 12, 20)) == date(
        2027, 1, 5
    )
    assert extrair_vencimento("dia 30", referencia=ref) == date(2026, 11, 30)
    assert extrair_vencimento("dia 5", referencia=ref) == date(2026, 12, 5)
    assert extrair_vencimento("10", referencia=ref, aceitar_dia_isolado=True) == date(
        2026, 12, 10
    )
    assert extrair_vencimento("10", referencia=ref, aceitar_dia_isolado=False) is None
    assert extrair_vencimento("31/02/2026", referencia=ref) is None
