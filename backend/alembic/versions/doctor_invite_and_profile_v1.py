"""doctor_invite_and_rich_profile_v1

Revision ID: doctor_invite_profile_v1
Revises:
Create Date: 2026-04-28

Adds:
  - doctor_invites table (token-based onboarding)
  - Rich profile columns to doctors table
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "doctor_invite_profile_v1"
down_revision = 'add_notifications_v1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── doctor_invites ──
    op.create_table(
        "doctor_invites",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("token", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("invited_email", sa.String(254), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("used_at", sa.DateTime, nullable=True),
        sa.Column("used_by_user_id", sa.String(36), nullable=True),
        sa.Column("expires_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    # ── doctors — new profile columns (safe: nullable with defaults) ──
    with op.batch_alter_table("doctors") as batch:
        batch.alter_column("license_number", existing_type=sa.String(100), nullable=True)

        batch.add_column(sa.Column("display_name", sa.String(200), nullable=True))
        batch.add_column(sa.Column("title", sa.String(30), nullable=True, server_default="Dr."))
        batch.add_column(sa.Column("photo_url", sa.Text, nullable=True))
        batch.add_column(sa.Column("slug", sa.String(120), nullable=True))
        batch.add_column(sa.Column("phone", sa.String(30), nullable=True))
        batch.add_column(sa.Column("location_city", sa.String(100), nullable=True))
        batch.add_column(sa.Column("location_province", sa.String(100), nullable=True))
        batch.add_column(sa.Column("years_experience", sa.Integer, nullable=True))
        batch.add_column(sa.Column("accepts_new_patients", sa.Boolean, nullable=False, server_default=sa.true()))
        batch.add_column(sa.Column("consultation_types_json", sa.Text, nullable=True, server_default='["teleconsulta"]'))
        batch.add_column(sa.Column("languages_json", sa.Text, nullable=True, server_default='["PT"]'))
        batch.add_column(sa.Column("education_json", sa.Text, nullable=True, server_default="[]"))
        batch.add_column(sa.Column("price_min", sa.Integer, nullable=True))
        batch.add_column(sa.Column("price_max", sa.Integer, nullable=True))

    # Unique index on slug
    op.create_index("ix_doctors_slug", "doctors", ["slug"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_doctors_slug", table_name="doctors")
    with op.batch_alter_table("doctors") as batch:
        batch.drop_column("price_max")
        batch.drop_column("price_min")
        batch.drop_column("education_json")
        batch.drop_column("languages_json")
        batch.drop_column("consultation_types_json")
        batch.drop_column("accepts_new_patients")
        batch.drop_column("years_experience")
        batch.drop_column("location_province")
        batch.drop_column("location_city")
        batch.drop_column("phone")
        batch.drop_column("slug")
        batch.drop_column("photo_url")
        batch.drop_column("title")
        batch.drop_column("display_name")
        batch.alter_column("license_number", existing_type=sa.String(100), nullable=False)

    op.drop_table("doctor_invites")
