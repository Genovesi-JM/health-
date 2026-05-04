"""Add standalone_prescriptions table

Revision ID: add_standalone_prescriptions_v1
Revises: add_notifications_v1
Create Date: 2026-05-04

Creates a standalone_prescriptions table for prescriptions issued via
prescription requests (no consultation required). This gives patients a
real pharmacy-ready document when a doctor approves or adjusts a request.
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_standalone_prescriptions_v1'
down_revision = 'add_prescription_requests_v1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'standalone_prescriptions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('prescription_request_id', sa.String(36),
                  sa.ForeignKey('prescription_requests.id', ondelete='CASCADE'),
                  nullable=False, unique=True, index=True),
        sa.Column('patient_id', sa.String(36),
                  sa.ForeignKey('patients.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('doctor_id', sa.String(36),
                  sa.ForeignKey('doctors.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('medication_name', sa.String(300), nullable=False),
        sa.Column('dosage', sa.String(100), nullable=True),
        sa.Column('frequency', sa.String(100), nullable=True),
        sa.Column('duration', sa.String(100), nullable=True),
        sa.Column('instructions', sa.Text, nullable=True),
        sa.Column('issue_date', sa.DateTime, nullable=False),
        sa.Column('valid_until', sa.DateTime, nullable=True),
        sa.Column('pharmacy_status', sa.String(30), nullable=False,
                  server_default='pending_pharmacy'),
        sa.Column('file_url', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
    )


def downgrade() -> None:
    op.drop_table('standalone_prescriptions')
