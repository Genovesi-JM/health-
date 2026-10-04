"""Private patient documents and independent review.

Revision ID: patient_documents_v1
Revises: onboarding_verification_v1
"""
from alembic import op
import sqlalchemy as sa

revision = "patient_documents_v1"
down_revision = "onboarding_verification_v1"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    if "patient_documents" in inspector.get_table_names():
        # Existing application startup uses metadata.create_all. Adopt an already
        # bootstrapped table only when this schema and idempotency constraint exist.
        expected = {
            "id", "patient_id", "original_filename", "content_type", "size_bytes", "storage_key",
            "sha256", "idempotency_key", "request_digest", "status", "scan_status", "version",
            "extraction_method", "extracted_text", "reviewed_text", "error_code", "created_at", "reviewed_at",
        }
        columns = {column["name"] for column in inspector.get_columns("patient_documents")}
        unique_request = any(index["unique"] and index["column_names"] == ["patient_id", "idempotency_key"]
                             for index in inspector.get_indexes("patient_documents"))
        # A current application bootstrap may include later explicit consent
        # scope columns. Their own migration validates types and nullability.
        if columns - {"country", "consent_language"} != expected or not unique_request:
            raise RuntimeError("Existing patient_documents schema does not match this migration")
        return
    op.create_table(
        "patient_documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("patient_id", sa.String(36), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(80), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("idempotency_key", sa.String(36), nullable=True),
        sa.Column("request_digest", sa.String(64), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("scan_status", sa.String(15), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("extraction_method", sa.String(30), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("reviewed_text", sa.Text(), nullable=True),
        sa.Column("error_code", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_patient_documents_patient_id", "patient_documents", ["patient_id"])
    op.create_index("uq_patient_document_request", "patient_documents", ["patient_id", "idempotency_key"], unique=True)


def downgrade():
    op.drop_index("uq_patient_document_request", table_name="patient_documents")
    op.drop_index("ix_patient_documents_patient_id", table_name="patient_documents")
    op.drop_table("patient_documents")
