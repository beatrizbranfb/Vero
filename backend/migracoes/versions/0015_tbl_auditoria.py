"""tblAuditoria: quem fez cada alteração nos dados de um titular (RF06)

Revision ID: 0015
Revises: 0014
Create Date: 2026-11-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABELA = "tblAuditoria"


def upgrade() -> None:
    op.create_table(
        TABELA,
        sa.Column("idAuditoria", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "idUsuarioTitular",
            sa.Uuid(),
            sa.ForeignKey(
                "tblUsuario.idUsuario", name="tblauditoria_idusuariotitular_foreign"
            ),
            nullable=False,
        ),
        sa.Column(
            "idUsuarioAutor",
            sa.Uuid(),
            sa.ForeignKey(
                "tblUsuario.idUsuario", name="tblauditoria_idusuarioautor_foreign"
            ),
            nullable=False,
        ),
        sa.Column("noEntidade", sa.String(50), nullable=False),
        sa.Column("idRegistro", sa.Uuid(), nullable=False),
        sa.Column("noAcao", sa.String(20), nullable=False),
        sa.Column(
            "dhAcao",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "\"noAcao\" IN ('criou', 'editou', 'excluiu')",
            name="tblauditoria_noacao_check",
        ),
    )
    op.create_index(
        "ix_tblauditoria_titular_dhacao", TABELA, ["idUsuarioTitular", "dhAcao"]
    )


def downgrade() -> None:
    op.drop_index("ix_tblauditoria_titular_dhacao", table_name=TABELA)
    op.drop_table(TABELA)
