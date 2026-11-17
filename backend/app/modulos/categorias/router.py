"""Lista única de categorias, servida pelo banco (RF09, critério 4).

O app mostra estas categorias com ícone e nome. Nenhuma outra parte do sistema
mantém uma lista própria.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modulos.categorias.modelos import Categoria
from app.nucleo.banco import obter_sessao

router = APIRouter(prefix="/api/v1/categorias", tags=["categorias"])


class CategoriaSaida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    nome: str


@router.get("", response_model=list[CategoriaSaida])
def listar(sessao: Session = Depends(obter_sessao)) -> list[Categoria]:
    return list(sessao.scalars(select(Categoria).order_by(Categoria.id)))
