"""tblCategoria: código estável e os mesmos nomes do app (RF09)

Revision ID: 0011
Revises: 0009
Create Date: 2026-11-17

Até aqui o banco tinha uma lista de categorias e o app outra. O app passa a ler a
lista do banco (`GET /api/v1/categorias`), e o banco fica com os nomes que o app já
mostrava e que passaram na QA da S1. As linhas antigas são renomeadas no lugar, sem
mudar o id, para não quebrar contas e transações que já apontam para elas.

Se o #92 (parcelas, revisão 0010) entrar antes, troque o down_revision para "0010".
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# nome antigo -> (código, nome novo)
RENOMEAR = {
    "Alimentação": ("mercado", "Mercado"),
    "Saúde": ("farmacia", "Farmácia"),
    "Moradia": ("casa", "Casa"),
    "Transporte": ("transporte", "Transporte"),
    "Lazer": ("lazer", "Lazer"),
    "Outros": ("outros", "Outros"),
    # Não existia no banco; reaproveitada se sobrou de um downgrade
    "Contas": ("contas", "Contas"),
}


def upgrade() -> None:
    op.add_column("tblCategoria", sa.Column("coCategoria", sa.String(30)))
    conexao = op.get_bind()
    for antigo, (codigo, novo) in RENOMEAR.items():
        conexao.execute(
            sa.text(
                'UPDATE "tblCategoria" SET "coCategoria" = :codigo, '
                '"noCategoria" = :novo WHERE "noCategoria" = :antigo'
            ),
            {"codigo": codigo, "novo": novo, "antigo": antigo},
        )
    existentes = set(
        conexao.scalars(
            sa.text(
                'SELECT "coCategoria" FROM "tblCategoria" '
                'WHERE "coCategoria" IS NOT NULL'
            )
        )
    )
    faltando = [
        (codigo, nome) for codigo, nome in RENOMEAR.values() if codigo not in existentes
    ]
    for codigo, nome in faltando:
        conexao.execute(
            sa.text(
                'INSERT INTO "tblCategoria" ("coCategoria", "noCategoria") '
                "VALUES (:codigo, :nome)"
            ),
            {"codigo": codigo, "nome": nome},
        )
    # Categoria criada à mão fora desta lista ganha um código a partir do id
    conexao.execute(
        sa.text(
            'UPDATE "tblCategoria" SET "coCategoria" = \'categoria-\' || "idCategoria" '
            'WHERE "coCategoria" IS NULL'
        )
    )
    op.alter_column("tblCategoria", "coCategoria", nullable=False)
    op.create_unique_constraint(
        "tblCategoria_coCategoria_key", "tblCategoria", ["coCategoria"]
    )


def downgrade() -> None:
    conexao = op.get_bind()
    for antigo, (codigo, _novo) in RENOMEAR.items():
        conexao.execute(
            sa.text(
                'UPDATE "tblCategoria" SET "noCategoria" = :antigo '
                'WHERE "coCategoria" = :codigo'
            ),
            {"antigo": antigo, "codigo": codigo},
        )
    op.drop_constraint("tblCategoria_coCategoria_key", "tblCategoria", type_="unique")
    op.drop_column("tblCategoria", "coCategoria")
