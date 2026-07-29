"""Add private photographs to triage sessions.

Revision ID: add_triage_photos_v1
Revises: add_notifications_v1
Create Date: 2026-07-29
"""
from alembic import op
import sqlalchemy as sa


revision = "add_triage_photos_v1"
down_revision = "add_notifications_v1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "triage_photos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "triage_session_id",
            sa.String(36),
            sa.ForeignKey("triage_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("view_type", sa.String(20), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(50), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("technical_check_json", sa.Text(), nullable=True, server_default="{}"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_triage_photos_triage_session_id",
        "triage_photos",
        ["triage_session_id"],
    )
    op.create_index(
        "ix_triage_photos_session_created",
        "triage_photos",
        ["triage_session_id", "created_at"],
    )


def downgrade():
    op.drop_index("ix_triage_photos_session_created", table_name="triage_photos")
    op.drop_index("ix_triage_photos_triage_session_id", table_name="triage_photos")
    op.drop_table("triage_photos")
