"""Add external credential provider checks and jurisdiction.

Revision ID: add_credential_provider_checks_v1
Revises: add_clinician_credentials_v1
Create Date: 2026-07-30
"""
from alembic import op
import sqlalchemy as sa


revision = "add_credential_provider_checks_v1"
down_revision = "add_clinician_credentials_v1"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    credential_columns = {
        column["name"] for column in inspector.get_columns("clinician_credentials")
    }
    if "licence_jurisdiction" not in credential_columns:
        op.add_column("clinician_credentials", sa.Column("licence_jurisdiction", sa.String(120)))
    if "verification_consent_at" not in credential_columns:
        op.add_column("clinician_credentials", sa.Column("verification_consent_at", sa.DateTime()))

    if "credential_provider_checks" in inspector.get_table_names():
        return
    op.create_table(
        "credential_provider_checks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("credential_id", sa.String(36), nullable=False),
        sa.Column("evidence_id", sa.String(36)),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("check_type", sa.String(40), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="queued"),
        sa.Column("external_id", sa.String(255)),
        sa.Column("operation_url", sa.Text()),
        sa.Column("launch_url", sa.Text()),
        sa.Column("extracted_data_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("result_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("error_message", sa.Text()),
        sa.Column("requested_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["credential_id"], ["clinician_credentials.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["evidence_id"], ["credential_evidence.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_credential_provider_checks_credential_id",
        "credential_provider_checks", ["credential_id"],
    )
    op.create_index(
        "ix_credential_provider_checks_evidence_id",
        "credential_provider_checks", ["evidence_id"],
    )
    op.create_index(
        "ix_credential_provider_check_lookup",
        "credential_provider_checks", ["credential_id", "provider", "evidence_id", "status"],
    )


def downgrade():
    op.drop_index("ix_credential_provider_check_lookup", table_name="credential_provider_checks")
    op.drop_index("ix_credential_provider_checks_evidence_id", table_name="credential_provider_checks")
    op.drop_index("ix_credential_provider_checks_credential_id", table_name="credential_provider_checks")
    op.drop_table("credential_provider_checks")
    op.drop_column("clinician_credentials", "verification_consent_at")
    op.drop_column("clinician_credentials", "licence_jurisdiction")
