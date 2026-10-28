"""Add strokes.

Revision ID: 9736675209a2
Revises: 6482dde5c2bf
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "9736675209a2"
down_revision: str | Sequence[str] | None = "6482dde5c2bf"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "strokes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_id", sa.Integer(), nullable=False),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("points", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("color", sa.String(length=16), nullable=False),
        sa.Column("width", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_strokes_file_page", "strokes", ["file_id", "page"])


def downgrade() -> None:
    op.drop_index("ix_strokes_file_page", table_name="strokes")
    op.drop_table("strokes")
