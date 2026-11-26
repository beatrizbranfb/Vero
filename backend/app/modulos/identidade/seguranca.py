"""Hash de senha e PIN (bcrypt) e tokens de sessão (JWT)."""

import hashlib
import hmac
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.modulos.identidade.mensagens import Message
from app.modulos.identidade.modelos import Acompanhante, Usuario
from app.nucleo.banco import obter_sessao
from app.nucleo.config import settings

esquema_bearer = HTTPBearer(auto_error=False)


def gerar_hash(valor: str) -> str:
    return bcrypt.hashpw(valor.encode(), bcrypt.gensalt()).decode()


def conferir_hash(valor: str, hash_salvo: str) -> bool:
    return bcrypt.checkpw(valor.encode(), hash_salvo.encode())


# Hash determinístico para telefone (HMAC-SHA256 com SECRET_KEY como pepper)
# O mesmo telefone sempre gera o mesmo hash, permitindo buscas e unique constraint.
def hash_telefone(valor: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(), valor.encode(), hashlib.sha256
    ).hexdigest()


# Conferido quando o celular não existe, para a resposta levar o mesmo tempo
HASH_FICTICIO = gerar_hash("vero-hash-ficticio")


def criar_token(
    id_usuario: uuid.UUID,
    metodo: str,
    duracao: timedelta,
    versao: int = 0,
    id_titular: uuid.UUID | None = None,
) -> str:
    agora = datetime.now(UTC)
    dados = {
        "sub": str(id_usuario),
        "perfil": "titular" if id_titular is None else "acompanhante",
        "metodo": metodo,
        "ver": versao,
        "iat": agora,
        "exp": agora + duracao,
    }
    if id_titular is not None:
        dados["tit"] = str(id_titular)
    return jwt.encode(dados, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITMO)


def ler_token(token: str) -> dict:
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.JWT_ALGORITMO],
        options={"require": ["sub", "exp"]},
    )


def _ler_sessao(
    credenciais: HTTPAuthorizationCredentials | None, sessao: Session
) -> tuple[dict, Usuario]:
    nao_autorizado = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=Message.SESSAO_INVALIDA.message,
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credenciais is None:
        raise nao_autorizado
    try:
        dados = ler_token(credenciais.credentials)
        id_usuario = uuid.UUID(dados["sub"])
    except (jwt.PyJWTError, ValueError):
        raise nao_autorizado from None

    usuario = sessao.get(Usuario, id_usuario)
    if usuario is None or not token_na_versao_atual(dados, usuario):
        raise nao_autorizado
    return dados, usuario


def usuario_atual(
    credenciais: HTTPAuthorizationCredentials | None = Depends(esquema_bearer),
    sessao: Session = Depends(obter_sessao),
) -> Usuario:
    """Dependência das rotas que exigem login."""
    dados, usuario = _ler_sessao(credenciais, sessao)
    if dados.get("perfil", "titular") != "titular":
        raise HTTPException(status.HTTP_403_FORBIDDEN, Message.SO_TITULAR.message)
    return usuario


@dataclass(frozen=True)
class Acesso:
    titular: Usuario
    autor: Usuario


def acesso_aos_dados(
    credenciais: HTTPAuthorizationCredentials | None = Depends(esquema_bearer),
    sessao: Session = Depends(obter_sessao),
) -> Acesso:
    dados, usuario = _ler_sessao(credenciais, sessao)
    if dados.get("perfil", "titular") == "titular":
        return Acesso(titular=usuario, autor=usuario)

    sem_acesso = HTTPException(
        status.HTTP_403_FORBIDDEN, Message.ACESSO_REVOGADO.message
    )
    try:
        id_titular = uuid.UUID(dados["tit"])
    except (KeyError, ValueError):
        raise sem_acesso from None
    vinculo = sessao.get(Acompanhante, (id_titular, usuario.id))
    if vinculo is None or vinculo.status != "autorizado":
        raise sem_acesso
    return Acesso(titular=sessao.get(Usuario, id_titular), autor=usuario)


def token_na_versao_atual(dados: dict, usuario: Usuario) -> bool:
    """Falso quando o PIN mudou depois que o token foi emitido."""
    return dados.get("ver", 0) == usuario.versao_token
