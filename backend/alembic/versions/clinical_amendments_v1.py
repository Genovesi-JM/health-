"""Persisted clinical correction chain and retention guards.

Revision ID: clinical_amendments_v1
Revises: durable_notifications_v1
"""
from alembic import op
import sqlalchemy as sa

from app.services.clinical_retention import install_retention_guards, remove_retention_guards

revision = "clinical_amendments_v1"
down_revision = "durable_notifications_v1"
branch_labels = None
depends_on = None


def _columns():
    return [
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("note_id", sa.String(36), sa.ForeignKey("consultation_notes.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("author_user_id", sa.String(36), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("publish_to_patient", sa.Boolean(), nullable=False),
        sa.Column("snapshot_json", sa.Text(), nullable=False),
        sa.Column("previous_digest", sa.String(64), nullable=False),
        sa.Column("digest", sa.String(64), nullable=False),
        sa.Column("request_key", sa.String(36), nullable=False),
        sa.Column("request_digest", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    ]


def upgrade():
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    if "consultation_amendments" in inspector.get_table_names():
        actual = {item["name"]: item for item in inspector.get_columns("consultation_amendments")}
        if set(actual) != {column.name for column in _columns()}:
            raise RuntimeError("Existing clinical amendment schema requires explicit repair")
        for column in _columns():
            item = actual[column.name]
            if item["nullable"] != column.nullable or item["type"]._type_affinity is not column.type._type_affinity:
                raise RuntimeError("Existing clinical amendment schema does not match migration")
            if isinstance(column.type, sa.String) and not isinstance(column.type, sa.Text) and item["type"].length != column.type.length:
                raise RuntimeError("Existing clinical amendment string bound does not match migration")
        indexes = inspector.get_indexes("consultation_amendments")
        if inspector.get_pk_constraint("consultation_amendments").get("constrained_columns") != ["id"]:
            raise RuntimeError("Missing clinical amendment primary key")
        for fields in (["note_id", "revision"], ["note_id", "request_key"]):
            if not any(index["unique"] and index["column_names"] == fields for index in indexes):
                raise RuntimeError("Missing clinical amendment uniqueness constraint")
        if not any(fk["constrained_columns"] == ["note_id"] and fk["referred_table"] == "consultation_notes"
                   and fk.get("options", {}).get("ondelete") == "RESTRICT"
                   for fk in inspector.get_foreign_keys("consultation_amendments")):
            raise RuntimeError("Missing clinical amendment retention foreign key")
    else:
        op.create_table("consultation_amendments", *_columns())
        op.create_index("uq_consultation_amendment_revision", "consultation_amendments", ["note_id", "revision"], unique=True)
        op.create_index("uq_consultation_amendment_request", "consultation_amendments", ["note_id", "request_key"], unique=True)
    install_retention_guards(connection)


def downgrade():
    connection = op.get_bind()
    # Never let a deployment rollback erase clinical history or remove its
    # protections once a finalized record exists. Restore application code only.
    if connection.execute(sa.text("SELECT 1 FROM consultation_amendments LIMIT 1")).first():
        raise RuntimeError("Clinical correction history prevents destructive downgrade")
    if connection.execute(sa.text("SELECT 1 FROM consultation_notes WHERE finalized_at IS NOT NULL OR finalized_by_user_id IS NOT NULL OR finalization_digest IS NOT NULL LIMIT 1")).first():
        raise RuntimeError("Finalized clinical records prevent removal of retention guards")
    remove_retention_guards(connection)
    op.drop_table("consultation_amendments")
