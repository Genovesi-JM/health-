"""add device_readings table

Revision ID: add_device_readings_v1
Revises: add_prescription_requests_v1
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_device_readings_v1'
down_revision = 'add_prescription_requests_v1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'device_readings',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('patient_id', sa.String(36),
                  sa.ForeignKey('patients.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('reading_type', sa.String(30), nullable=False, index=True),
        # Generic scalar
        sa.Column('value', sa.Numeric(10, 4), nullable=True),
        sa.Column('unit', sa.String(20), nullable=True),
        # Blood pressure
        sa.Column('systolic', sa.Integer, nullable=True),
        sa.Column('diastolic', sa.Integer, nullable=True),
        sa.Column('pulse', sa.Integer, nullable=True),
        # Metadata
        sa.Column('measured_at', sa.DateTime, nullable=False),
        sa.Column('source', sa.String(30), nullable=True),
        sa.Column('device_brand', sa.String(100), nullable=True),
        sa.Column('device_model', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )
    op.create_index(
        'ix_device_readings_patient_measured',
        'device_readings',
        ['patient_id', 'measured_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_device_readings_patient_measured', table_name='device_readings')
    op.drop_table('device_readings')
