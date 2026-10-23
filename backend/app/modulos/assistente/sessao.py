from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.modulos.assistente.extrator import TipoTransacao

TEMPO_EXPIRACAO_MINUTOS = 15

RESPOSTAS_SIM = {"sim", "s", "pode", "isso", "claro", "confirmo", "correto", "pode ser", "anota"}
RESPOSTAS_NAO = {"nao", "n", "cancela", "cancelar", "errei", "errado", "espera"}

@dataclass
class RegistroPendente:
    tipo: TipoTransacao
    valor: int
    categoria: str
    descricao: str
    criado: datetime

class GerenciadorSessao:
    def __init__(self):
        self._sessoes: dict[str, RegistroPendente] = {}

    def salvar_pendencia(self, telefone: str, tipo: TipoTransacao, valor: int, categoria: str, descricao: str) -> None:
        self._sessoes[telefone] = RegistroPendente(
            tipo = tipo,
            valor = valor,
            categoria = categoria,
            descricao = descricao,
            criado = datetime.now(timezone.utc),
        )

    def obter_pendencia(self, telefone: str) -> tuple[RegistroPendente | None, bool]:
        pendencia = self._sessoes.get(telefone)
        if not pendencia:
            return None, False

        agora = datetime.now(timezone.utc)
        if agora - pendencia.criado > timedelta(minutes = TEMPO_EXPIRACAO_MINUTOS):
            del self._sessoes[telefone]
            return None, True

        return pendencia, False

    def limpar_pendencia(self, telefone: str) -> None:
        self._sessoes.pop(telefone, None)

    @staticmethod
    def resposta_sim(texto: str) -> bool:
        return texto.strip().lower() in RESPOSTAS_SIM

    @staticmethod
    def resposta_nao(texto: str) -> bool:
        return texto.strip().lower() in RESPOSTAS_NAO

sessao_assistente = GerenciadorSessao()