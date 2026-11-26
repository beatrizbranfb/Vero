"""Rotas do histórico de transações: listar, editar e excluir (RF10, RF18)."""

from datetime import datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.modulos.identidade.modelos import Usuario
from app.modulos.identidade.seguranca import Acesso, acesso_aos_dados, usuario_atual
from app.modulos.transacoes import servico
from app.modulos.transacoes.esquemas import (
    SaldoMesSaida,
    TransacaoEdicaoEntrada,
    TransacaoRegistroEntrada,
    TransacaoSaida,
)
from app.modulos.transacoes.mensagens import Message
from app.modulos.transacoes.modelos import Transacao
from app.nucleo.banco import obter_sessao

router = APIRouter(prefix="/api/v1/transacoes", tags=["transacoes"])


@router.post("", response_model=TransacaoSaida, status_code=status.HTTP_201_CREATED)
def registrar(
    dados: TransacaoRegistroEntrada,
    acesso: Acesso = Depends(acesso_aos_dados),
    sessao: Session = Depends(obter_sessao),
) -> Transacao:
    try:
        return servico.registrar(sessao, acesso.titular.id, dados, acesso.autor.id)
    except servico.ReferenciaInexistente:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            Message.CATEGORIA_INEXISTENTE.message,
        ) from None


@router.get("", response_model=list[TransacaoSaida])
def listar(
    acesso: Acesso = Depends(acesso_aos_dados),
    sessao: Session = Depends(obter_sessao),
) -> list[Transacao]:
    return servico.listar(sessao, acesso.titular.id)


@router.get("/saldo", response_model=SaldoMesSaida)
def obter_saldo_mes(
    mes: str | None = Query(
        default=None,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
    ),
    acesso: Acesso = Depends(acesso_aos_dados),
    sessao: Session = Depends(obter_sessao),
) -> SaldoMesSaida:
    if mes is None:
        mes = datetime.now(ZoneInfo("America/Sao_Paulo")).strftime("%Y-%m")

    ano = int(mes[:4])
    if not 1 <= ano <= 9998:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Mês inválido.",
        )

    return servico.resumir_mes(sessao, acesso.titular.id, mes)


@router.patch("/{transacao_id}", response_model=TransacaoSaida)
def editar(
    transacao_id: UUID,
    dados: TransacaoEdicaoEntrada,
    acesso: Acesso = Depends(acesso_aos_dados),
    sessao: Session = Depends(obter_sessao),
) -> Transacao:
    try:
        return servico.editar(
            sessao, acesso.titular.id, transacao_id, dados, acesso.autor.id
        )
    except servico.TransacaoNaoEncontrada:
        raise _nao_encontrada() from None
    except servico.ReferenciaInexistente:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            Message.CATEGORIA_INEXISTENTE.message,
        ) from None


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
