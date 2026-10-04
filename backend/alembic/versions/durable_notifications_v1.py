"""Retry identities and first-read timestamps for in-app notifications.

Revision ID: durable_notifications_v1
Revises: appointment_slots_v1
"""
from alembic import op
import sqlalchemy as sa

revision = "durable_notifications_v1"
down_revision = "appointment_slots_v1"
branch_labels = None
depends_on = None


def _columns():
    return [sa.Column("read_at", sa.DateTime(), nullable=True),
            sa.Column("event_key", sa.String(160), nullable=True)]


def upgrade():
    inspector = sa.inspect(op.get_bind())
    actual = {item["name"]: item for item in inspector.get_columns("notifications")}
    present = set(actual) & {column.name for column in _columns()}
    if present:
        if present != {column.name for column in _columns()}:
            raise RuntimeError("Partial durable notification schema requires explicit repair")
        for column in _columns():
            item = actual[column.name]
            if not item["nullable"] or item["type"]._type_affinity is not column.type._type_affinity:
                raise RuntimeError("Existing durable notification schema does not match migration")
            if isinstance(column.type, sa.String) and item["type"].length != column.type.length:
                raise RuntimeError("Existing notification event bound does not match migration")
        indexes = inspector.get_indexes("notifications")
        if not any(index["unique"] and index["column_names"] == ["user_id", "event_key"] for index in indexes):
            raise RuntimeError("Missing notification event uniqueness constraint")
        if not any(index["column_names"] == ["user_id", "is_read", "created_at", "id"] for index in indexes):
            raise RuntimeError("Missing notification inbox index")
        return
    for column in _columns():
        op.add_column("notifications", column)
    op.create_index("uq_notifications_user_event", "notifications", ["user_id", "event_key"], unique=True)
    op.create_index("ix_notifications_user_unread", "notifications", ["user_id", "is_read", "created_at", "id"])


def downgrade():
    op.drop_index("ix_notifications_user_unread", table_name="notifications")
    op.drop_index("uq_notifications_user_event", table_name="notifications")
    for column in reversed(_columns()):
        op.drop_column("notifications", column.name)
