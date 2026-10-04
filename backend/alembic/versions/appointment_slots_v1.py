"""Persisted dated capacity and retry-safe booking identity.

Revision ID: appointment_slots_v1
Revises: consultation_closeout_v1
"""
from alembic import op
import sqlalchemy as sa

revision = "appointment_slots_v1"
down_revision = "consultation_closeout_v1"
branch_labels = None
depends_on = None


def _columns():
    return [sa.Column("scheduled_end_at", sa.DateTime(), nullable=True),
            sa.Column("slot_id", sa.String(36), nullable=True),
            sa.Column("country", sa.String(2), nullable=True),
            sa.Column("timezone", sa.String(50), nullable=True),
            sa.Column("booking_request_key", sa.String(36), nullable=True),
            sa.Column("booking_request_digest", sa.String(64), nullable=True)]


def _validate(actual, expected):
    for col in expected:
        item = actual.get(col.name)
        if not item or item["nullable"] != col.nullable or item["type"]._type_affinity is not col.type._type_affinity:
            raise RuntimeError("Existing appointment schema requires explicit repair")
        if isinstance(col.type, sa.String) and item["type"].length != col.type.length:
            raise RuntimeError("Existing appointment string bound requires explicit repair")


def upgrade():
    inspector = sa.inspect(op.get_bind())
    slot_columns = [sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("doctor_id", sa.String(36), sa.ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("country", sa.String(2), nullable=False), sa.Column("timezone", sa.String(50), nullable=False),
        sa.Column("starts_at", sa.DateTime(), nullable=False), sa.Column("ends_at", sa.DateTime(), nullable=False),
        sa.Column("withdrawn", sa.Boolean(), nullable=False),
        sa.Column("reserved_consultation_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False)]
    expected = _columns()
    actual = {item["name"]: item for item in inspector.get_columns("consultations")}
    present = set(actual) & {col.name for col in expected}
    slot_exists = "appointment_slots" in inspector.get_table_names()
    if slot_exists or present:
        if not slot_exists or present != {col.name for col in expected}:
            raise RuntimeError("Partial appointment schema requires explicit repair")
        _validate(actual, expected)
        _validate({item["name"]: item for item in inspector.get_columns("appointment_slots")}, slot_columns)
        if not any(index["unique"] and index["column_names"] == ["patient_id", "booking_request_key"]
                   for index in inspector.get_indexes("consultations")):
            raise RuntimeError("Missing booking request uniqueness constraint")
        if not any(fk["constrained_columns"] == ["slot_id"] and fk["referred_table"] == "appointment_slots"
                   for fk in inspector.get_foreign_keys("consultations")):
            raise RuntimeError("Missing consultation slot foreign key")
        if not any(fk["constrained_columns"] == ["doctor_id"] and fk["referred_table"] == "doctors"
                   for fk in inspector.get_foreign_keys("appointment_slots")):
            raise RuntimeError("Missing appointment clinician foreign key")
        return
    op.create_table("appointment_slots", *slot_columns)
    op.create_index("ix_appointment_slots_doctor_id", "appointment_slots", ["doctor_id"])
    op.create_index("ix_appointment_slots_doctor_start", "appointment_slots", ["doctor_id", "starts_at"])
    with op.batch_alter_table("consultations") as batch:
        for col in expected:
            batch.add_column(col)
        batch.create_foreign_key("fk_consultations_slot_id", "appointment_slots", ["slot_id"], ["id"])
        batch.create_index("ix_consultations_patient_booking_key", ["patient_id", "booking_request_key"], unique=True)


def downgrade():
    inspector = sa.inspect(op.get_bind())
    fk = next((item for item in inspector.get_foreign_keys("consultations") if item["constrained_columns"] == ["slot_id"]), None)
    with op.batch_alter_table("consultations", naming_convention={"fk": "fk_%(table_name)s_%(column_0_name)s"}) as batch:
        batch.drop_index("ix_consultations_patient_booking_key")
        if fk:
            batch.drop_constraint(fk["name"] or "fk_consultations_slot_id", type_="foreignkey")
        for col in reversed(_columns()):
            batch.drop_column(col.name)
    op.drop_table("appointment_slots")
