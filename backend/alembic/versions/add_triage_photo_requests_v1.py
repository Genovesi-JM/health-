"""Add clinician requests for triage photograph views.

Revision ID: add_triage_photo_requests_v1
Revises: add_triage_photos_v1
Create Date: 2026-07-29
"""
from alembic import op
import sqlalchemy as sa


revision = "add_triage_photo_requests_v1"
down_revision = "add_triage_photos_v1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "triage_photo_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "triage_session_id",
            sa.String(36),
            sa.ForeignKey("triage_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "consultation_id",
            sa.String(36),
            sa.ForeignKey("consultations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "doctor_id",
            sa.String(36),
            sa.ForeignKey("doctors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("view_type", sa.String(20), nullable=False),
        sa.Column("message", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="requested"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("fulfilled_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_triage_photo_requests_triage_session_id",
        "triage_photo_requests",
        ["triage_session_id"],
    )
    op.create_index(
        "ix_triage_photo_requests_consultation_id",
        "triage_photo_requests",
        ["consultation_id"],
    )
    op.create_index(
        "ix_triage_photo_requests_doctor_id",
        "triage_photo_requests",
        ["doctor_id"],
    )
    op.create_index(
        "ix_triage_photo_requests_session_status",
        "triage_photo_requests",
        ["triage_session_id", "status"],
    )


def downgrade():
    op.drop_index("ix_triage_photo_requests_session_status", table_name="triage_photo_requests")
    op.drop_index("ix_triage_photo_requests_doctor_id", table_name="triage_photo_requests")
    op.drop_index("ix_triage_photo_requests_consultation_id", table_name="triage_photo_requests")
    op.drop_index("ix_triage_photo_requests_triage_session_id", table_name="triage_photo_requests")
    op.drop_table("triage_photo_requests")
