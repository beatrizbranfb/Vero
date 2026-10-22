"""Regras de cadastro, login e bloqueio por tentativas."""

import math
from datetime import UTC, datetime, timedelta
from enum import Enum

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modulos.identidade.esquemas import CadastroEntrada
from app.modulos.identidade.modelos import Usuario
from app.modulos.identidade.seguranca import HASH_FICTICIO, conferir_hash, gerar_hash


class Attempts(Enum):
    """política de tempo e número de tentativas de acesso do usuario"""

    MAX_TENTATIVAS = 5
    TEMPO_BLOQUEIO = timedelta(seconds=30)
    DURACAO_TOKEN_SENHA = timedelta(days=7)
    DURACAO_TOKEN_PIN = timedelta(hours=2)


class TelefoneJaCadastrado(Exception):
    pass


class EmailJaCadastrado(Exception):
    pass


class CredenciaisInvalidas(Exception):
    pass


class PinNaoCriado(Exception):
    pass


class ContaBloqueada(Exception):
    def __init__(self, segundos_restantes: int) -> None:
        super().__init__(segundos_restantes)
        self.segundos_restantes = segundos_restantes


def cadastrar(sessao: Session, dados: CadastroEntrada) -> Usuario:
    email = dados.email.lower()
    if sessao.scalar(select(Usuario.id).where(Usuario.telefone == dados.telefone)):
        raise TelefoneJaCadastrado
    if sessao.scalar(select(Usuario.id).where(Usuario.email == email)):
        raise EmailJaCadastrado

    usuario = Usuario(
        nome=dados.nome,
        telefone=dados.telefone,
        email=email,
        hash_senha=gerar_hash(dados.senha),
    )
    sessao.add(usuario)
    try:
        sessao.commit()
    except IntegrityError:
        # Outro cadastro com o mesmo celular entrou entre a verificação e o commit
        sessao.rollback()
        raise TelefoneJaCadastrado from None
    sessao.refresh(usuario)
    return usuario


def autenticar(sessao: Session, telefone: str, segredo: str, metodo: str) -> Usuario:
    """Confere a senha ou o PIN. Após MAX_TENTATIVAS erros seguidos, bloqueia por
    TEMPO_BLOQUEIO. Senha e PIN contam juntos."""
    usuario = sessao.scalar(
        select(Usuario).where(Usuario.telefone == telefone).with_for_update()
    )
    if usuario is None:
        conferir_hash(segredo, HASH_FICTICIO)
        raise CredenciaisInvalidas

    agora = datetime.now(UTC)
    if usuario.bloqueado_ate and usuario.bloqueado_ate > agora:
        sessao.rollback()
        raise ContaBloqueada(_segundos_ate(usuario.bloqueado_ate, agora))

    hash_salvo = usuario.hash_senha if metodo == "senha" else usuario.hash_pin
    if hash_salvo is None:
        sessao.rollback()
        raise PinNaoCriado

    if not conferir_hash(segredo, hash_salvo):
        usuario.tentativas += 1
        bloqueou = usuario.tentativas >= Attempts.MAX_TENTATIVAS.value
        if bloqueou:
            usuario.tentativas = 0
            usuario.bloqueado_ate = agora + Attempts.TEMPO_BLOQUEIO.value
        sessao.commit()
        if bloqueou:
            raise ContaBloqueada(int(Attempts.TEMPO_BLOQUEIO.value.total_seconds()))
        raise CredenciaisInvalidas

    usuario.tentativas = 0
    usuario.bloqueado_ate = None
    sessao.commit()
    return usuario


def definir_pin(sessao: Session, usuario: Usuario, pin: str) -> None:
    usuario.hash_pin = gerar_hash(pin)
    sessao.commit()


def _segundos_ate(momento: datetime, agora: datetime) -> int:
    return max(1, math.ceil((momento - agora).total_seconds()))
