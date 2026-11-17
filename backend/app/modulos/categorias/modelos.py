"""Categoria de gasto ou receita. Colunas seguem o schema do banco (`tblCategoria`)."""

from sqlalchemy import BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.nucleo.banco import Base


class Categoria(Base):
    __tablename__ = "tblCategoria"

    id: Mapped[int] = mapped_column("idCategoria", BigInteger, primary_key=True)
    nome: Mapped[str] = mapped_column("noCategoria", String(255))
    # Identificador estável que o app usa para escolher o ícone (RF09)
    codigo: Mapped[str] = mapped_column("coCategoria", String(30), unique=True)
