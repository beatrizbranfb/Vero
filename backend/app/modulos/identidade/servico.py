"""Regras de cadastro, login e bloqueio por tentativas."""

import json
import math
import uuid
from datetime import UTC, datetime, timedelta
from enum import Enum

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modulos.identidade.esquemas import CadastroEntrada
from app.modulos.identidade.modelos import Usuario
from app.modulos.identidade.seguranca import (
    HASH_FICTICIO,
    conferir_hash,
    gerar_hash,
    hash_telefone,
)


class Attempts(Enum):
    """política de tempo e número de tentativas de acesso do usuario"""

    MAX_TENTATIVAS = 5
    TEMPO_BLOQUEIO = timedelta(seconds=30)
    DURACAO_TOKEN_PIN = timedelta(hours=2)


class TelefoneJaCadastrado(Exception):
    pass


class EmailJaCadastrado(Exception):
    pass


class CredenciaisInvalidas(Exception):
    pass


class ContaBloqueada(Exception):
    def __init__(self, segundos_restantes: int) -> None:
        super().__init__(segundos_restantes)
        self.segundos_restantes = segundos_restantes


def cadastrar(sessao: Session, dados: CadastroEntrada) -> Usuario:
    hash_tel = hash_telefone(dados.telefone)
    if sessao.scalar(select(Usuario.id).where(Usuario.hash_telefone == hash_tel)):
        raise TelefoneJaCadastrado

    email = dados.email.lower()
    if sessao.scalar(select(Usuario.id).where(Usuario.email == email)):
        raise EmailJaCadastrado

    usuario = Usuario(
        nome=dados.nome,
        hash_telefone=hash_tel,
        email=email,
        hash_pin=gerar_hash(dados.pin),
    )
    usuario.telefone = dados.telefone  # para resposta da API (não persistido)
    sessao.add(usuario)
    try:
        sessao.commit()
    except IntegrityError:
        sessao.rollback()
        raise TelefoneJaCadastrado from None
    sessao.refresh(usuario)
    return usuario


def autenticar(sessao: Session, telefone: str, segredo: str) -> Usuario:
    """Confere o PIN. Após MAX_TENTATIVAS erros seguidos, bloqueia por TEMPO_BLOQUEIO."""
    hash_tel = hash_telefone(telefone)
    usuario = sessao.scalar(
        select(Usuario).where(Usuario.hash_telefone == hash_tel).with_for_update()
    )
    if usuario is None:
        conferir_hash(segredo, HASH_FICTICIO)
        raise CredenciaisInvalidas
    return conferir_pin(sessao, usuario, segredo)


def conferir_pin(sessao: Session, usuario: Usuario, segredo: str) -> Usuario:
    """Confere o PIN de um usuário já encontrado, contando tentativas e bloqueio (D17).

    Quem chama deve ter travado a linha do usuário (FOR UPDATE)."""
    agora = datetime.now(UTC)
    if usuario.bloqueado_ate and usuario.bloqueado_ate > agora:
        sessao.rollback()
        raise ContaBloqueada(_segundos_ate(usuario.bloqueado_ate, agora))

    if not conferir_hash(segredo, usuario.hash_pin):
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


def _segundos_ate(momento: datetime, agora: datetime) -> int:
    return max(1, math.ceil((momento - agora).total_seconds()))


def desafio_webauthn_gerar(usuario: Usuario) -> str:
    """gera um desafio unico para o webauthn e associa ao usuario"""
    desafio = uuid.uuid4().hex
    atual = usuario.versao_token if usuario.versao_token is not None else 0
    usuario.versao_token = atual + 1
    return desafio


def salvar_credencial_webauthn(
    sessao: Session,
    usuario: Usuario,
    credential_public_key: str,
    credential_id: str,
    counter: int,
) -> None:
    "salva a chave pública do credential no usuario pra um login futuro"
    credencial_existente = getattr(usuario, "credencial_webauthn", None) or {}
    if isinstance(credencial_existente, str):
        try:
            credencial_existente = json.loads(credencial_existente)
        except json.JSONDecodeError:
            credencial_existente = {}

    credencial_existente[credential_id] = {
        "public_key": credential_public_key,
        "counter": counter,
    }
    usuario.credencial_webauthn = json.dumps(credencial_existente)
    sessao.add(usuario)


def credencial_webauthn_existe(usuario: Usuario, credencial_id: str) -> bool:
    """verifica se ja existe credencial registrada com o id"""
    credencial = getattr(usuario, "credencial_webauthn", None)
    if not credencial:
        return False

    if isinstance(credencial, str):
        try:
            credencial = json.loads(credencial)
        except json.JSONDecodeError:
            return False

    return credencial_id in credencial  # true ou false
