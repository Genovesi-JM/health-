"""Add stable external identifiers for Apple Health and Health Connect.

Revision ID: add_health_sync_external_ids_v1
Revises: add_triage_photo_requests_v1
Create Date: 2026-07-30
"""
from alembic import op
import sqlalchemy as sa


revision = "add_health_sync_external_ids_v1"
down_revision = "add_triage_photo_requests_v1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "device_readings",
        sa.Column("external_id", sa.String(length=200), nullable=True),
    )
    op.create_index(
        "uq_device_readings_patient_source_external",
        "device_readings",
        ["patient_id", "source", "external_id"],
        unique=True,
    )


def downgrade():
    op.drop_index(
        "uq_device_readings_patient_source_external",
        table_name="device_readings",
    )
    op.drop_column("device_readings", "external_id")
