"""Fixtures dos testes: banco Postgres de teste e cliente autenticado."""

import os
import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.main import app
from app.modulos.contas.modelos import Conta  # noqa: F401  (registra a tabela)
from app.modulos.identidade.modelos import Usuario
from app.modulos.identidade.seguranca import criar_token, gerar_hash
from app.nucleo.banco import Base, obter_sessao, url_sqlalchemy

URL_TESTE = os.getenv(
    "DATABASE_URL_TESTE", "postgresql://vero:vero@host.docker.internal:5432/vero"
)


@pytest.fixture(scope="session")
def engine():
    motor = create_engine(url_sqlalchemy(URL_TESTE))
    Base.metadata.create_all(motor)
    return motor


@pytest.fixture
def sessao(engine) -> Iterator[Session]:
    """Cada teste roda numa transação que é desfeita no fim."""
    conexao = engine.connect()
    transacao = conexao.begin()
    fabrica = sessionmaker(
        bind=conexao, expire_on_commit=False, join_transaction_mode="create_savepoint"
    )
    with fabrica() as s:
        yield s
    transacao.rollback()
    conexao.close()


@pytest.fixture
def usuario(sessao: Session) -> Usuario:
    u = Usuario(
        nome="Maria",
        telefone="55619" + uuid.uuid4().hex[:8],
        email=f"maria{uuid.uuid4().hex[:8]}@vero.com",
        hash_senha=gerar_hash("senha12345"),
        tentativas=0,
    )
    sessao.add(u)
    sessao.flush()
    sessao.refresh(u)
    return u


@pytest.fixture
def cliente(sessao: Session) -> Iterator[TestClient]:
    app.dependency_overrides[obter_sessao] = lambda: sessao
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def cliente_logado(cliente: TestClient, usuario: Usuario) -> TestClient:
    from datetime import timedelta

    token = criar_token(usuario.id, "senha", timedelta(hours=1))
    cliente.headers["Authorization"] = f"Bearer {token}"
    return cliente
