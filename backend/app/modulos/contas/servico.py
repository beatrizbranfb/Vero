"""Regras de cadastro de contas a pagar (RF25)."""

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modulos.contas.esquemas import ContaCadastroEntrada
from app.modulos.contas.modelos import Conta


class CategoriaInexistente(Exception):
    pass


def cadastrar(
    sessao: Session, usuario_id: uuid.UUID, dados: ContaCadastroEntrada
) -> Conta:
    """Cria a conta com status A_VENCER (calculado: sem pagamento e sem atraso)."""
    conta = Conta(
        usuario_id=usuario_id,
        vencimento_em=dados.vencimento_em,
        valor=dados.valor,
        descricao=dados.descricao,
        categoria_id=dados.categoria_id,
    )
    sessao.add(conta)
    try:
        sessao.commit()
    except IntegrityError:
        # Única FK que o usuário controla é a categoria
        sessao.rollback()
        raise CategoriaInexistente from None
    sessao.refresh(conta)
    return conta


def listar(sessao: Session, usuario_id: uuid.UUID) -> list[Conta]:
    """Contas do usuário, do vencimento mais próximo para o mais distante."""
    comando = (
        select(Conta)
        .where(Conta.usuario_id == usuario_id)
        .order_by(Conta.vencimento_em)
    )
    return list(sessao.scalars(comando))
