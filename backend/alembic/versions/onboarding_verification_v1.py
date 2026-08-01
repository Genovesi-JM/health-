"""Onboarding + verification tables (multi-role onboarding build).

Creates the 11 tables added across the onboarding/verification engagement:
onboarding drafts, verification transitions + webhook dedup, document-expiry
reminders, MFA credentials + recovery codes, organisation onboarding
(profiles/locations/documents), and caregiver dependant links + access audit.

Idempotent — each table is created only if absent, so it is safe to run
against a database that was previously bootstrapped via create_all().

Revision ID: onboarding_verification_v1
Revises: add_teleconsultation_operations_v1
Create Date: 2026-08-01
"""
from alembic import op
import sqlalchemy as sa


revision = "onboarding_verification_v1"
down_revision = "add_teleconsultation_operations_v1"
branch_labels = None
depends_on = None


def _has(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def upgrade():
    inspector = sa.inspect(op.get_bind())

    # ── onboarding_drafts ────────────────────────────────────────────────
    if not _has(inspector, "onboarding_drafts"):
        op.create_table(
            "onboarding_drafts",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), nullable=False),
            sa.Column("role", sa.String(30), nullable=False),
            sa.Column("current_step", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("total_steps", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("completed_steps_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("data_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
            sa.Column("submitted_at", sa.DateTime()),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_onboarding_drafts_user_id", "onboarding_drafts", ["user_id"])
        op.create_index("ix_onboarding_drafts_role", "onboarding_drafts", ["role"])
        op.create_index("ix_onboarding_drafts_status", "onboarding_drafts", ["status"])
        op.create_index("ix_onboarding_drafts_user_role", "onboarding_drafts", ["user_id", "role"], unique=True)

    # ── verification_transitions ─────────────────────────────────────────
    if not _has(inspector, "verification_transitions"):
        op.create_table(
            "verification_transitions",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("entity_type", sa.String(40), nullable=False),
            sa.Column("entity_id", sa.String(36), nullable=False),
            sa.Column("previous_status", sa.String(30)),
            sa.Column("new_status", sa.String(30), nullable=False),
            sa.Column("actor_user_id", sa.String(36)),
            sa.Column("actor_kind", sa.String(20), nullable=False, server_default="user"),
            sa.Column("reason_code", sa.String(60)),
            sa.Column("reason_text", sa.Text()),
            sa.Column("reviewer_notes", sa.Text()),
            sa.Column("provider", sa.String(40)),
            sa.Column("evidence_ref", sa.String(200)),
            sa.Column("at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        )
        op.create_index("ix_verification_transitions_entity_type", "verification_transitions", ["entity_type"])
        op.create_index("ix_verification_transitions_entity_id", "verification_transitions", ["entity_id"])
        op.create_index("ix_verification_transitions_at", "verification_transitions", ["at"])
        op.create_index("ix_verification_transitions_entity", "verification_transitions", ["entity_type", "entity_id", "at"])

    # ── verification_webhook_events ──────────────────────────────────────
    if not _has(inspector, "verification_webhook_events"):
        op.create_table(
            "verification_webhook_events",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("provider", sa.String(40), nullable=False),
            sa.Column("event_id", sa.String(200), nullable=False),
            sa.Column("payload_hash", sa.String(64)),
            sa.Column("processed_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_webhook_events_dedupe", "verification_webhook_events", ["provider", "event_id"], unique=True)

    # ── document_expiry_reminders ────────────────────────────────────────
    if not _has(inspector, "document_expiry_reminders"):
        op.create_table(
            "document_expiry_reminders",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("entity_type", sa.String(40), nullable=False),
            sa.Column("entity_id", sa.String(36), nullable=False),
            sa.Column("document_kind", sa.String(40), nullable=False),
            sa.Column("expiry_date", sa.String(10), nullable=False),
            sa.Column("threshold_days", sa.Integer(), nullable=False),
            sa.Column("notified_at", sa.DateTime(), nullable=False),
            sa.Column("notification_id", sa.String(36)),
        )
        op.create_index("ix_document_expiry_reminders_entity_type", "document_expiry_reminders", ["entity_type"])
        op.create_index("ix_document_expiry_reminders_entity_id", "document_expiry_reminders", ["entity_id"])
        op.create_index("ix_expiry_reminder_dedup", "document_expiry_reminders",
                        ["entity_type", "entity_id", "document_kind", "threshold_days"], unique=True)

    # ── mfa_credentials ──────────────────────────────────────────────────
    if not _has(inspector, "mfa_credentials"):
        op.create_table(
            "mfa_credentials",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), nullable=False),
            sa.Column("secret", sa.String(64), nullable=False),
            sa.Column("method", sa.String(20), nullable=False, server_default="totp"),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("confirmed_at", sa.DateTime()),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("user_id"),
        )
        op.create_index("ix_mfa_credentials_user_id", "mfa_credentials", ["user_id"])

    # ── mfa_recovery_codes ───────────────────────────────────────────────
    if not _has(inspector, "mfa_recovery_codes"):
        op.create_table(
            "mfa_recovery_codes",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), nullable=False),
            sa.Column("code_hash", sa.String(64), nullable=False),
            sa.Column("used_at", sa.DateTime()),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_mfa_recovery_codes_user_id", "mfa_recovery_codes", ["user_id"])
        op.create_index("ix_mfa_recovery_user_code", "mfa_recovery_codes", ["user_id", "code_hash"], unique=True)

    # ── organisation_profiles ────────────────────────────────────────────
    if not _has(inspector, "organisation_profiles"):
        op.create_table(
            "organisation_profiles",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("owner_user_id", sa.String(36), nullable=False),
            sa.Column("org_type", sa.String(30), nullable=False),
            sa.Column("legal_name", sa.String(250), nullable=False),
            sa.Column("trading_name", sa.String(250)),
            sa.Column("registration_number", sa.String(100), nullable=False),
            sa.Column("tax_number", sa.String(100)),
            sa.Column("country", sa.String(2), nullable=False, server_default="AO"),
            sa.Column("registered_address", sa.Text()),
            sa.Column("operating_address", sa.Text()),
            sa.Column("website", sa.String(250)),
            sa.Column("general_email", sa.String(250)),
            sa.Column("general_phone", sa.String(50)),
            sa.Column("representative_name", sa.String(200)),
            sa.Column("responsible_professional", sa.String(200)),
            sa.Column("bank_holder_name", sa.String(200)),
            sa.Column("iban_last4", sa.String(8)),
            sa.Column("subscription_plan", sa.String(40)),
            sa.Column("integration_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
            sa.Column("submitted_at", sa.DateTime()),
            sa.Column("verified_at", sa.DateTime()),
            sa.Column("verified_by", sa.String(36)),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_organisation_profiles_owner_user_id", "organisation_profiles", ["owner_user_id"])
        op.create_index("ix_organisation_profiles_registration_number", "organisation_profiles", ["registration_number"])
        op.create_index("ix_organisation_profiles_status", "organisation_profiles", ["status"])
        op.create_index("ix_org_reg_country", "organisation_profiles", ["registration_number", "country"], unique=True)

    # ── organisation_locations ───────────────────────────────────────────
    if not _has(inspector, "organisation_locations"):
        op.create_table(
            "organisation_locations",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("organisation_id", sa.String(36), nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("address", sa.Text()),
            sa.Column("city", sa.String(120)),
            sa.Column("latitude", sa.Numeric(10, 6)),
            sa.Column("longitude", sa.Numeric(10, 6)),
            sa.Column("opening_hours", sa.String(200)),
            sa.Column("services", sa.Text()),
            sa.Column("emergency_available", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("home_delivery", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("home_sample_collection", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("contact_phone", sa.String(50)),
            sa.Column("manager_name", sa.String(200)),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["organisation_id"], ["organisation_profiles.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_organisation_locations_organisation_id", "organisation_locations", ["organisation_id"])

    # ── organisation_documents ───────────────────────────────────────────
    if not _has(inspector, "organisation_documents"):
        op.create_table(
            "organisation_documents",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("organisation_id", sa.String(36), nullable=False),
            sa.Column("kind", sa.String(50), nullable=False),
            sa.Column("storage_key", sa.String(300), nullable=False),
            sa.Column("original_filename", sa.String(250), nullable=False),
            sa.Column("content_type", sa.String(100), nullable=False),
            sa.Column("sha256", sa.String(64)),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["organisation_id"], ["organisation_profiles.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_organisation_documents_organisation_id", "organisation_documents", ["organisation_id"])

    # ── dependant_links ──────────────────────────────────────────────────
    if not _has(inspector, "dependant_links"):
        op.create_table(
            "dependant_links",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("caregiver_user_id", sa.String(36), nullable=False),
            sa.Column("dependant_user_id", sa.String(36)),
            sa.Column("caregiver_type", sa.String(30), nullable=False),
            sa.Column("relationship", sa.String(60), nullable=False),
            sa.Column("full_name", sa.String(200), nullable=False),
            sa.Column("date_of_birth", sa.String(10)),
            sa.Column("is_minor", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("evidence_storage_key", sa.String(300)),
            sa.Column("evidence_filename", sa.String(250)),
            sa.Column("can_view_appointments", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("can_view_prescriptions", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("can_receive_reminders", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("can_act_on_behalf", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("status", sa.String(20), nullable=False, server_default="active"),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["caregiver_user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["dependant_user_id"], ["users.id"], ondelete="SET NULL"),
        )
        op.create_index("ix_dependant_links_caregiver_user_id", "dependant_links", ["caregiver_user_id"])
        op.create_index("ix_dependant_links_dependant_user_id", "dependant_links", ["dependant_user_id"])
        op.create_index("ix_dependant_links_status", "dependant_links", ["status"])

    # ── dependant_access_events ──────────────────────────────────────────
    if not _has(inspector, "dependant_access_events"):
        op.create_table(
            "dependant_access_events",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("dependant_link_id", sa.String(36), nullable=False),
            sa.Column("actor_user_id", sa.String(36)),
            sa.Column("event_type", sa.String(30), nullable=False),
            sa.Column("detail", sa.Text()),
            sa.Column("at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["dependant_link_id"], ["dependant_links.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        )
        op.create_index("ix_dependant_access_events_link_id", "dependant_access_events", ["dependant_link_id"])
        op.create_index("ix_dependant_access_events_at", "dependant_access_events", ["at"])
        op.create_index("ix_dependant_access_events_link_at", "dependant_access_events", ["dependant_link_id", "at"])


def downgrade():
    for table in (
        "dependant_access_events",
        "dependant_links",
        "organisation_documents",
        "organisation_locations",
        "organisation_profiles",
        "mfa_recovery_codes",
        "mfa_credentials",
        "document_expiry_reminders",
        "verification_webhook_events",
        "verification_transitions",
        "onboarding_drafts",
    ):
        op.drop_table(table)
