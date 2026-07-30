"""Add clinician credential verification dossier and evidence.

Revision ID: add_clinician_credentials_v1
Revises: add_health_sync_external_ids_v1, a1b2c3d4e5f6
Create Date: 2026-07-30
"""
from alembic import op
import sqlalchemy as sa


revision = "add_clinician_credentials_v1"
down_revision = ("add_health_sync_external_ids_v1", "a1b2c3d4e5f6")
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "clinician_credentials",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("profession", sa.String(length=20), nullable=False),
        sa.Column("legal_name", sa.String(length=200), nullable=False),
        sa.Column("nationality_country", sa.String(length=2), nullable=True),
        sa.Column("practice_country", sa.String(length=2), nullable=False),
        sa.Column("licence_country", sa.String(length=2), nullable=False),
        sa.Column("issuing_authority", sa.String(length=200), nullable=False),
        sa.Column("licence_number", sa.String(length=100), nullable=False),
        sa.Column("licence_expiry_date", sa.String(length=10), nullable=True),
        sa.Column("diploma_country", sa.String(length=2), nullable=False),
        sa.Column("diploma_institution", sa.String(length=250), nullable=False),
        sa.Column("degree_title", sa.String(length=200), nullable=False),
        sa.Column("graduation_year", sa.Integer(), nullable=True),
        sa.Column("specialization", sa.String(length=120), nullable=True),
        sa.Column("registry_profile_url", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("automated_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("automated_checks_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("verified_at", sa.DateTime(), nullable=True),
        sa.Column("verified_by", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["verified_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_clinician_credentials_user_id", "clinician_credentials", ["user_id"])
    op.create_index("ix_clinician_credentials_status", "clinician_credentials", ["status"])

    op.create_table(
        "credential_evidence",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("credential_id", sa.String(length=36), nullable=False),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("content_type", sa.String(length=80), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["credential_id"], ["clinician_credentials.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_credential_evidence_credential_id", "credential_evidence", ["credential_id"])
    op.create_index(
        "ix_credential_evidence_credential_kind",
        "credential_evidence",
        ["credential_id", "kind"],
    )


def downgrade():
    op.drop_index("ix_credential_evidence_credential_kind", table_name="credential_evidence")
    op.drop_index("ix_credential_evidence_credential_id", table_name="credential_evidence")
    op.drop_table("credential_evidence")
    op.drop_index("ix_clinician_credentials_status", table_name="clinician_credentials")
    op.drop_index("ix_clinician_credentials_user_id", table_name="clinician_credentials")
    op.drop_table("clinician_credentials")
