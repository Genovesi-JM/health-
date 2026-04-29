"""Add patient_medications table

Revision ID: add_patient_medications_v1
Revises: add_device_readings_v1
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_patient_medications_v1'
down_revision = 'add_device_readings_v1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'patient_medications',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('patient_id', sa.String(36), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('medication_name', sa.String(200), nullable=False),
        sa.Column('dosage', sa.String(100), nullable=True),
        sa.Column('frequency', sa.String(100), nullable=True),
        sa.Column('start_date', sa.String(10), nullable=True),
        sa.Column('end_date', sa.String(10), nullable=True),
        sa.Column('is_current', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('reason', sa.String(300), nullable=True),
        sa.Column('prescribed_by', sa.String(200), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table('patient_medications')
