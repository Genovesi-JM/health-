"""add prescription_requests table

Revision ID: add_prescription_requests_v1
Revises: 
Create Date: 2026-04-28
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_prescription_requests_v1'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'prescription_requests',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('patient_id', sa.String(36), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('doctor_id', sa.String(36), sa.ForeignKey('doctors.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('medication_name', sa.String(300), nullable=False),
        sa.Column('dose', sa.String(100), nullable=True),
        sa.Column('frequency', sa.String(100), nullable=True),
        sa.Column('reason', sa.Text, nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='pending'),
        sa.Column('risk_level', sa.String(10), nullable=True),
        sa.Column('risk_alert', sa.Text, nullable=True),
        sa.Column('doctor_note', sa.Text, nullable=True),
        sa.Column('adjusted_dose', sa.String(100), nullable=True),
        sa.Column('adjusted_frequency', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('decided_at', sa.DateTime, nullable=True),
    )


def downgrade():
    op.drop_table('prescription_requests')
