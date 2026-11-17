"""Rotas de transações: anotar no app, saldo do mês e histórico com edição e exclusão
(RF08, RF10, RF18, RF19)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.modulos.identidade.modelos import Usuario
from app.modulos.identidade.seguranca import usuario_atual
from app.modulos.transacoes import servico
from app.modulos.transacoes.esquemas import (
    SaldoMesSaida,
    TransacaoAppEntrada,
    TransacaoEdicaoEntrada,
    TransacaoRegistroEntrada,
    TransacaoSaida,
)
from app.modulos.transacoes.mensagens import Message
from app.modulos.transacoes.modelos import Transacao
from app.nucleo.banco import obter_sessao

router = APIRouter(prefix="/api/v1/transacoes", tags=["transacoes"])


@router.post("", response_model=TransacaoSaida, status_code=status.HTTP_201_CREATED)
def anotar(
    dados: TransacaoAppEntrada,
    usuario: Usuario = Depends(usuario_atual),
    sessao: Session = Depends(obter_sessao),
) -> Transacao:
    """Gasto ou recebimento anotado no app. O app recebe o aviso pelo /ws (RF17)."""
    registro = TransacaoRegistroEntrada(**dados.model_dump())
    try:
        return servico.registrar(sessao, usuario.id, registro)
    except servico.ReferenciaInexistente:
        raise _categoria_inexistente() from None


@router.get("/saldo", response_model=SaldoMesSaida)
def saldo(
    mes: Annotated[
        str | None,
        Query(
            pattern=r"^\d{4}-(0[1-9]|1[0-2])$", description="AAAA-MM; vazio: este mês"
        ),
    ] = None,
    usuario: Usuario = Depends(usuario_atual),
    sessao: Session = Depends(obter_sessao),
) -> SaldoMesSaida:
    ano, numero = (int(p) for p in mes.split("-")) if mes else servico.mes_atual()
    return servico.saldo_do_mes(sessao, usuario.id, ano, numero)


@router.get("", response_model=list[TransacaoSaida])
def listar(
    usuario: Usuario = Depends(usuario_atual),
    sessao: Session = Depends(obter_sessao),
) -> list[Transacao]:
    return servico.listar(sessao, usuario.id)


@router.patch("/{transacao_id}", response_model=TransacaoSaida)
def editar(
    transacao_id: UUID,
    dados: TransacaoEdicaoEntrada,
    usuario: Usuario = Depends(usuario_atual),
    sessao: Session = Depends(obter_sessao),
) -> Transacao:
    try:
        return servico.editar(sessao, usuario.id, transacao_id, dados)
    except servico.TransacaoNaoEncontrada:
        raise _nao_encontrada() from None
    except servico.ReferenciaInexistente:
        raise _categoria_inexistente() from None


@router.delete("/{transacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(
    transacao_id: UUID,
    usuario: Usuario = Depends(usuario_atual),
    sessao: Session = Depends(obter_sessao),
) -> None:
    try:
        servico.excluir(sessao, usuario.id, transacao_id)
    except servico.TransacaoNaoEncontrada:
        raise _nao_encontrada() from None


def _nao_encontrada() -> HTTPException:
    return HTTPException(
        status.HTTP_404_NOT_FOUND, Message.TRANSACAO_NAO_ENCONTRADA.message
    )


def _categoria_inexistente() -> HTTPException:
    return HTTPException(
        status.HTTP_422_UNPROCESSABLE_ENTITY, Message.CATEGORIA_INEXISTENTE.message
    )
