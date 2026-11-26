import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, DateTime, String, func
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.nucleo.banco import Base


class Acao(StrEnum):
    CRIOU = "criou"
    EDITOU = "editou"
    EXCLUIU = "excluiu"


class Auditoria(Base):
    __tablename__ = "tblAuditoria"

    id: Mapped[int] = mapped_column(
        "idAuditoria", BigInteger, primary_key=True, autoincrement=True
    )
    titular_id: Mapped[uuid.UUID] = mapped_column("idUsuarioTitular")
    autor_id: Mapped[uuid.UUID] = mapped_column("idUsuarioAutor")
    entidade: Mapped[str] = mapped_column("noEntidade", String(50))
    registro_id: Mapped[uuid.UUID] = mapped_column("idRegistro")
    acao: Mapped[str] = mapped_column("noAcao", String(20))
    feito_em: Mapped[datetime] = mapped_column(
        "dhAcao", DateTime(timezone=True), server_default=func.now()
    )


def registrar_acao(
    sessao: Session,
    titular_id: uuid.UUID,
    autor_id: uuid.UUID,
    entidade: str,
    registro_id: uuid.UUID,
    acao: Acao,
) -> None:
    sessao.add(
        Auditoria(
            titular_id=titular_id,
            autor_id=autor_id,
            entidade=entidade,
            registro_id=registro_id,
            acao=acao,
        )
    )
