"""Explicit patient disclosure, attributed finalization and owned follow-up.

Revision ID: consultation_closeout_v1
Revises: patient_documents_v1
"""
from alembic import op
import sqlalchemy as sa

revision = "consultation_closeout_v1"
down_revision = "patient_documents_v1"
branch_labels = None
depends_on = None


def _columns():
    return [
        sa.Column("patient_summary", sa.Text(), nullable=True),
        sa.Column("follow_up_instructions", sa.Text(), nullable=True),
        sa.Column("follow_up_required", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("follow_up_due_at", sa.DateTime(), nullable=True),
        sa.Column("follow_up_task_id", sa.String(36), nullable=True),
        sa.Column("finalized_at", sa.DateTime(), nullable=True),
        sa.Column("finalized_by_user_id", sa.String(36), nullable=True),
        sa.Column("finalization_digest", sa.String(64), nullable=True),
    ]


def upgrade():
    inspector = sa.inspect(op.get_bind())
    existing = {item["name"]: item for item in inspector.get_columns("consultation_notes")}
    expected = _columns()
    present = {column.name for column in expected} & set(existing)
    if present:
        # create_all may have bootstrapped the new schema; never bless a partial
        # or incompatible adoption, and never rewrite a historical note.
        if present != {column.name for column in expected}:
            raise RuntimeError("Partial consultation closeout schema requires explicit repair")
        for column in expected:
            actual = existing[column.name]
            if actual["nullable"] != column.nullable or actual["type"]._type_affinity is not column.type._type_affinity:
                raise RuntimeError("Existing consultation closeout schema does not match migration")
            if isinstance(column.type, sa.String) and not isinstance(column.type, sa.Text) and actual["type"].length != column.type.length:
                raise RuntimeError("Existing consultation closeout string bound does not match migration")
        return
    for column in expected:
        op.add_column("consultation_notes", column)


def downgrade():
    for column in reversed(_columns()):
        op.drop_column("consultation_notes", column.name)
