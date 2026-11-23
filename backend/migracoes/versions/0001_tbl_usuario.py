"""tblUsuario como está no schema do Supabase (linha de base)

Revision ID: 0001
Revises:
Create Date: 2026-10-20

No Supabase a tabela já existe, então só é criada em bancos vazios (desenvolvimento
local e CI).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("tblUsuario"):
        return
    op.create_table(
        "tblUsuario",
        sa.Column(
            "idUsuario",
            sa.Uuid(),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("noUsuario", sa.String(255), nullable=False),
        sa.Column("nuTelefone", sa.String(255), nullable=False, unique=True),
        sa.Column("hashUsuario", sa.Text(), nullable=False),
        sa.Column("nuTentativas", sa.Integer(), nullable=False),
        sa.Column("dhBloqueio", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "nuDiasAlerta", sa.Integer(), nullable=False, server_default=sa.text("3")
        ),
        sa.Column(
            "icAudioAtivado", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column(
            "icWhatsAppAtivo", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column(
            "dhCriacao",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("tblUsuario")
