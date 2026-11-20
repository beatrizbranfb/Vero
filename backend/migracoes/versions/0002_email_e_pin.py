"""e-mail obrigatório e PIN opcional na tblUsuario

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-20

hashUsuario passa a guardar o hash da senha; o PIN fica em hashPin.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("tblUsuario", sa.Column("noEmail", sa.String(255), nullable=False))
    op.create_unique_constraint("tblusuario_noemail_unique", "tblUsuario", ["noEmail"])
    op.add_column("tblUsuario", sa.Column("hashPin", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("tblUsuario", "hashPin")
    op.drop_constraint("tblusuario_noemail_unique", "tblUsuario", type_="unique")
    op.drop_column("tblUsuario", "noEmail")
