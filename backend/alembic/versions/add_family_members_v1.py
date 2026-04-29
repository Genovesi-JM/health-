"""Add family_members table

Revision ID: add_family_members_v1
Revises: add_patient_medications_v1
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_family_members_v1'
down_revision = 'add_patient_medications_v1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'family_members',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('owner_patient_id', sa.String(36),
                  sa.ForeignKey('patients.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('full_name', sa.String(200), nullable=False),
        sa.Column('relationship', sa.String(50), nullable=False),
        sa.Column('date_of_birth', sa.String(10), nullable=True),
        sa.Column('gender', sa.String(20), nullable=True),
        sa.Column('phone', sa.String(30), nullable=True),
        sa.Column('email', sa.String(200), nullable=True),
        sa.Column('is_minor', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('emergency_contact', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table('family_members')
