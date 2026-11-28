"""Adaptadores da leitura de fotos de comprovantes (RF14).

A imagem só passa pela memória: não é gravada em disco, no banco nem no log (LGPD).
"""

import base64
import logging
from datetime import date

import anthropic
from pydantic import BaseModel, Field

from app.modulos.assistente.extrator import CATEGORIAS
from app.nucleo.config import AdaptadorLeitorComprovante, settings
from app.nucleo.portas import (
    FalhaLeituraComprovante,
    LeituraComprovante,
    PortaLeitorComprovante,
)

logger = logging.getLogger(__name__)

TIPOS_MIME_ACEITOS = {"image/jpeg", "image/png", "image/webp", "image/gif"}

INSTRUCOES = (
    "Você lê fotos enviadas por pessoas idosas no WhatsApp para um app de finanças "
    "pessoais. A foto pode ser um comprovante de pagamento, um Pix, uma nota fiscal, "
    "um cupom, um boleto ou uma conta a pagar (luz, água, gás, internet, fatura).\n\n"
    "Extraia:\n"
    "- valor_centavos: o valor total pago, recebido ou a pagar, em centavos "
    "(R$ 35,90 = 3590). Em nota ou cupom, use o total a pagar, não o de um item. "
    "Use null se não estiver legível ou se houver dúvida entre valores.\n"
    "- tipo:\n"
    "  * GASTO: o dinheiro já saiu (comprovante de pagamento, Pix enviado, nota fiscal, "
    "cupom ou conta já paga).\n"
    "  * RECEITA: o dinheiro entrou (Pix recebido, depósito, benefício).\n"
    "  * CONTA_PAGAR: boleto, fatura ou conta de consumo que ainda vai vencer / "
    "está para pagar (tem vencimento ou código de barras e não é comprovante de "
    "pagamento já realizado).\n"
    "  * DESCONHECIDO: se não der para saber se já foi paga ou se é conta a pagar.\n"
    '- vencimento: data de vencimento no formato AAAA-MM-DD (ex.: "2026-11-25") '
    "quando for conta a pagar/boleto e a data estiver legível; null nos demais casos "
    "ou se houver dúvida.\n"
    "- categoria: uma das opções da lista, ou DESCONHECIDA se nenhuma servir.\n"
    "- descricao: até 60 caracteres, como o estabelecimento ou a conta "
    '(ex.: "Drogaria São Paulo", "Conta de luz"). Vazio se não houver.\n\n'
    "Se a foto não for de um comprovante, nota ou conta, devolva valor_centavos null, "
    "tipo DESCONHECIDO, vencimento null e categoria DESCONHECIDA. Nunca invente um valor."
)


class _Leitura(BaseModel):
    valor_centavos: int | None
    tipo: str = Field(description="GASTO, RECEITA, CONTA_PAGAR ou DESCONHECIDO")
    categoria: str = Field(
        description="Uma de: " + ", ".join(CATEGORIAS) + " ou DESCONHECIDA"
    )
    descricao: str
    vencimento: str | None = Field(
        default=None,
        description="Data de vencimento AAAA-MM-DD para conta a pagar, ou null",
    )


def _parse_vencimento(texto: str | None) -> date | None:
    if not texto:
        return None
    try:
        return date.fromisoformat(texto.strip())
    except ValueError:
        return None


def _limpar(leitura: _Leitura) -> LeituraComprovante:
    """Descarta o que não faz sentido em vez de confiar cegamente na resposta."""
    valor = leitura.valor_centavos
    tipo_upper = leitura.tipo.upper()
    tipo = tipo_upper if tipo_upper in {"GASTO", "RECEITA", "CONTA_PAGAR"} else ""
    vencimento = (
        _parse_vencimento(leitura.vencimento) if tipo in {"CONTA_PAGAR", ""} else None
    )
    return LeituraComprovante(
        valor=valor if valor is not None and valor > 0 else None,
        tipo=tipo,
        categoria=leitura.categoria if leitura.categoria in CATEGORIAS else "",
        descricao=leitura.descricao.strip()[:60],
        vencimento=vencimento,
    )


class LeitorComprovanteFalso:
    """Para desenvolvimento e testes: não lê nada, então o assistente pede todos os
    dados à pessoa (RF16)."""

    async def ler(
        self, imagem: bytes, tipo_mime: str, legenda: str | None
    ) -> LeituraComprovante:
        logger.warning("Foto não lida (leitor falso, apenas para desenvolvimento)")
        return LeituraComprovante()


class LeitorComprovanteClaude:
    def __init__(self) -> None:
        self._cliente = anthropic.AsyncAnthropic(
            api_key=settings.AI_API_KEY,
            timeout=settings.AI_TIMEOUT_SEGUNDOS,
            # Uma nova tentativa estouraria o tempo do RNF04: na falha, o assistente
            # já pede os dados à pessoa
            max_retries=0,
        )

    async def ler(
        self, imagem: bytes, tipo_mime: str, legenda: str | None
    ) -> LeituraComprovante:
        if tipo_mime not in TIPOS_MIME_ACEITOS:
            raise FalhaLeituraComprovante(f"Formato de imagem não aceito: {tipo_mime}")

        conteudo: list[dict] = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": tipo_mime,
                    "data": base64.standard_b64encode(imagem).decode("ascii"),
                },
            }
        ]
        if legenda:
            conteudo.append(
                {"type": "text", "text": f"Legenda enviada com a foto: {legenda}"}
            )
        else:
            conteudo.append({"type": "text", "text": "Leia esta foto."})

        try:
            resposta = await self._cliente.messages.parse(
                model=settings.AI_MODELO,
                max_tokens=1024,
                system=INSTRUCOES,
                # Tarefa simples e com prazo curto (RNF04)
                output_config={"effort": "low"},
                messages=[{"role": "user", "content": conteudo}],
                output_format=_Leitura,
            )
        except anthropic.APIConnectionError as erro:
            # Inclui o tempo esgotado (APITimeoutError)
            raise FalhaLeituraComprovante(
                "Sem resposta do serviço de leitura"
            ) from erro
        except anthropic.APIStatusError as erro:
            raise FalhaLeituraComprovante(
                f"Serviço de leitura respondeu {erro.status_code}"
            ) from erro

        if resposta.stop_reason == "refusal" or resposta.parsed_output is None:
            raise FalhaLeituraComprovante("Leitura recusada ou incompleta")
        return _limpar(resposta.parsed_output)


def obter_leitor_comprovante() -> PortaLeitorComprovante:
    """Entrega o adaptador escolhido no LEITOR_COMPROVANTE."""
    if settings.LEITOR_COMPROVANTE == AdaptadorLeitorComprovante.CLAUDE:
        return LeitorComprovanteClaude()
    return LeitorComprovanteFalso()
