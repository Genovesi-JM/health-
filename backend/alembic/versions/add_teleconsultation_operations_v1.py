"""Add operational teleconsultation sessions and participants.

Revision ID: add_teleconsultation_operations_v1
Revises: add_credential_provider_checks_v1
Create Date: 2026-07-30
"""
from alembic import op
import sqlalchemy as sa


revision = "add_teleconsultation_operations_v1"
down_revision = "add_credential_provider_checks_v1"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    tables = inspector.get_table_names()

    if "teleconsultation_sessions" not in tables:
        op.create_table(
            "teleconsultation_sessions",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("consultation_id", sa.String(36), nullable=False),
            sa.Column("room_key", sa.String(80), nullable=False),
            sa.Column("provider", sa.String(30), nullable=False, server_default="jitsi_pilot"),
            sa.Column("provider_mode", sa.String(30), nullable=False, server_default="pilot"),
            sa.Column("status", sa.String(20), nullable=False, server_default="scheduled"),
            sa.Column("identity_confirmed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("consent_confirmed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("vitals_reviewed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("medication_reviewed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("clinical_summary_ready", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("preflight_note", sa.Text()),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("started_at", sa.DateTime()),
            sa.Column("ended_at", sa.DateTime()),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["consultation_id"], ["consultations.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("consultation_id"),
            sa.UniqueConstraint("room_key"),
        )
        op.create_index(
            "ix_teleconsultation_sessions_consultation_id",
            "teleconsultation_sessions", ["consultation_id"], unique=True,
        )
        op.create_index(
            "ix_teleconsultation_sessions_room_key",
            "teleconsultation_sessions", ["room_key"], unique=True,
        )

    inspector = sa.inspect(op.get_bind())
    if "teleconsultation_participants" not in inspector.get_table_names():
        op.create_table(
            "teleconsultation_participants",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("session_id", sa.String(36), nullable=False),
            sa.Column("user_id", sa.String(36), nullable=False),
            sa.Column("role", sa.String(20), nullable=False),
            sa.Column("camera_ready", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("microphone_ready", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("network_quality", sa.String(20)),
            sa.Column("consent_confirmed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("checked_in_at", sa.DateTime()),
            sa.Column("joined_at", sa.DateTime()),
            sa.Column("left_at", sa.DateTime()),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["session_id"], ["teleconsultation_sessions.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        )
        op.create_index(
            "ix_teleconsultation_participants_session_id",
            "teleconsultation_participants", ["session_id"],
        )
        op.create_index(
            "ix_teleconsultation_participants_user_id",
            "teleconsultation_participants", ["user_id"],
        )
        op.create_index(
            "ix_teleconsult_participant_session_user",
            "teleconsultation_participants", ["session_id", "user_id"], unique=True,
        )


def downgrade():
    inspector = sa.inspect(op.get_bind())
    if "teleconsultation_participants" in inspector.get_table_names():
        op.drop_index("ix_teleconsult_participant_session_user", table_name="teleconsultation_participants")
        op.drop_index("ix_teleconsultation_participants_user_id", table_name="teleconsultation_participants")
        op.drop_index("ix_teleconsultation_participants_session_id", table_name="teleconsultation_participants")
        op.drop_table("teleconsultation_participants")
    inspector = sa.inspect(op.get_bind())
    if "teleconsultation_sessions" in inspector.get_table_names():
        op.drop_index("ix_teleconsultation_sessions_room_key", table_name="teleconsultation_sessions")
        op.drop_index("ix_teleconsultation_sessions_consultation_id", table_name="teleconsultation_sessions")
        op.drop_table("teleconsultation_sessions")
