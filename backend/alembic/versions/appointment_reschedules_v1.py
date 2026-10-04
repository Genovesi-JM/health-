"""Atomic appointment rescheduling and retained retry identity.

Revision ID: appointment_reschedules_v1
Revises: clinical_amendments_v1
"""
from alembic import op
import sqlalchemy as sa

revision = "appointment_reschedules_v1"
down_revision = "clinical_amendments_v1"
branch_labels = None
depends_on = None


def _columns():
    return [sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("consultation_id", sa.String(36), sa.ForeignKey("consultations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False), sa.Column("request_key", sa.String(36), nullable=False),
        sa.Column("request_digest", sa.String(64), nullable=False), sa.Column("actor_user_id", sa.String(36), nullable=False),
        sa.Column("previous_slot_id", sa.String(36), nullable=True), sa.Column("slot_id", sa.String(36), nullable=False),
        sa.Column("previous_status", sa.String(20), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=False)]


def upgrade():
    inspector = sa.inspect(op.get_bind())
    column = next((c for c in inspector.get_columns("consultations") if c["name"] == "reschedule_revision"), None)
    exists = "consultation_reschedules" in inspector.get_table_names()
    if bool(column) != exists:
        raise RuntimeError("Partial appointment rescheduling schema requires explicit repair")
    if exists:
        if column["nullable"] or column["type"]._type_affinity is not sa.Integer:
            raise RuntimeError("Invalid rescheduling revision column")
        actual = {c["name"]: c for c in inspector.get_columns("consultation_reschedules")}
        if set(actual) != {c.name for c in _columns()}:
            raise RuntimeError("Invalid rescheduling history columns")
        for expected in _columns():
            found = actual[expected.name]
            if found["nullable"] != expected.nullable or found["type"]._type_affinity is not expected.type._type_affinity:
                raise RuntimeError("Invalid rescheduling history column")
            if isinstance(expected.type, sa.String) and found["type"].length != expected.type.length:
                raise RuntimeError("Invalid rescheduling history string length")
        if inspector.get_pk_constraint("consultation_reschedules")["constrained_columns"] != ["id"]:
            raise RuntimeError("Invalid rescheduling primary key")
        for fields in (["consultation_id", "request_key"], ["consultation_id", "revision"]):
            if not any(i["unique"] and i["column_names"] == fields for i in inspector.get_indexes("consultation_reschedules")):
                raise RuntimeError("Missing rescheduling uniqueness index")
        if not any(f["constrained_columns"] == ["consultation_id"] and f["referred_table"] == "consultations"
                   and f.get("options", {}).get("ondelete") == "RESTRICT"
                   for f in inspector.get_foreign_keys("consultation_reschedules")):
            raise RuntimeError("Missing rescheduling retention foreign key")
        return
    # Direct ADD COLUMN preserves the existing clinical-retention triggers.
    op.add_column("consultations", sa.Column("reschedule_revision", sa.Integer(), nullable=False, server_default="0"))
    op.create_table("consultation_reschedules", *_columns())
    op.create_index("uq_consultation_reschedule_request", "consultation_reschedules", ["consultation_id", "request_key"], unique=True)
    op.create_index("uq_consultation_reschedule_revision", "consultation_reschedules", ["consultation_id", "revision"], unique=True)


def downgrade():
    if op.get_bind().execute(sa.text("SELECT 1 FROM consultation_reschedules LIMIT 1")).first():
        raise RuntimeError("Retained rescheduling requests prevent destructive downgrade")
    op.drop_table("consultation_reschedules")
    op.drop_column("consultations", "reschedule_revision")
