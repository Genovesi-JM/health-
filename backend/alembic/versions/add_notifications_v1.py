"""add notifications table

Revision ID: add_notifications_v1
Revises: add_family_members_v1
Create Date: 2026-04-30

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_notifications_v1'
down_revision = 'add_family_members_v1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'notifications',
        sa.Column('id',                   sa.String(36),  primary_key=True),
        sa.Column('user_id',              sa.String(36),  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('title',                sa.String(200), nullable=False),
        sa.Column('message',              sa.Text,        nullable=False),
        sa.Column('type',                 sa.String(20),  nullable=False, server_default='info'),
        sa.Column('is_read',              sa.Boolean,     nullable=False, server_default=sa.false()),
        sa.Column('related_entity_type',  sa.String(50),  nullable=True),
        sa.Column('related_entity_id',    sa.String(36),  nullable=True),
        sa.Column('created_at',           sa.DateTime,    nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_notifications_user_created', 'notifications', ['user_id', 'created_at'])


def downgrade() -> None:
    op.drop_index('ix_notifications_user_created', table_name='notifications')
    op.drop_table('notifications')
