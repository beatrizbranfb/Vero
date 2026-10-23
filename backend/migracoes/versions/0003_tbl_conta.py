"""tblConta: cadastro de contas a pagar (RF25)

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-23

No Supabase a tabela já existe, então aqui ela só é criada em bancos vazios
(desenvolvimento local e CI). Onde já existe, apenas torna idCategoria opcional,
conforme o RF25 e o card [S2] ("nome ou ícone opcional").
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATEGORIAS_INICIAIS = [
    "Moradia",
    "Alimentação",
    "Saúde",
    "Transporte",
    "Lazer",
    "Outros",
]


def upgrade() -> None:
    inspetor = sa.inspect(op.get_bind())

    # tblCategoria é pré-requisito da FK de tblConta
    if not inspetor.has_table("tblCategoria"):
        tabela_categoria = op.create_table(
            "tblCategoria",
            sa.Column(
                "idCategoria", sa.BigInteger(), primary_key=True, autoincrement=True
            ),
            sa.Column("noCategoria", sa.String(255), nullable=False),
        )
        op.bulk_insert(
            tabela_categoria,
            [{"noCategoria": nome} for nome in CATEGORIAS_INICIAIS],
        )

    if not inspetor.has_table("tblConta"):
        op.create_table(
            "tblConta",
            sa.Column(
                "idConta",
                sa.Uuid(),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column(
                "idUsuario",
                sa.Uuid(),
                sa.ForeignKey("tblUsuario.idUsuario"),
                nullable=False,
            ),
            sa.Column("descConta", sa.Text(), nullable=True),
            sa.Column("vrSaldo", sa.Numeric(12, 2), nullable=False),
            sa.Column("dtProximoVencimento", sa.Date(), nullable=False),
            sa.Column(
                "idCategoria",
                sa.BigInteger(),
                sa.ForeignKey("tblCategoria.idCategoria"),
                nullable=True,
            ),
            sa.Column("dhPagamento", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "dhCriacao",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )
        op.create_index(
            "tblconta_idusuario_dtproximovencimento_index",
            "tblConta",
            ["idUsuario", "dtProximoVencimento"],
        )
        return

    # Tabela já existe (Supabase): RF25 exige categoria opcional
    op.alter_column(
        "tblConta", "idCategoria", existing_type=sa.BigInteger(), nullable=True
    )


def downgrade() -> None:
    op.alter_column(
        "tblConta", "idCategoria", existing_type=sa.BigInteger(), nullable=False
    )
