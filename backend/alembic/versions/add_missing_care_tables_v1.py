"""Create health tables present in the ORM models but absent from the
migration chain (model/migration drift).

The following tables are declared on the main ``Base`` metadata in
``app/health_models.py`` but no earlier revision creates them, so a managed
(KAYA_MANAGED_SCHEMA) deployment fails its post-migration schema verification.
This revision creates exactly those tables from the model metadata so the
database matches the packaged models without hand-duplicating their columns.
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "add_missing_care_tables_v1"
down_revision = "onboarding_verification_v1"
branch_labels = None
depends_on = None

MISSING_TABLES = [
    "care_escalations",
    "clinical_care_tasks",
    "clinician_revenue_events",
    "consultation_messages",
    "doctor_applications",
    "doctor_reviews",
    "electronic_prescription_submissions",
    "nursing_observations",
]


def _model_metadata():
    # Import the application models so every table is registered on Base.metadata.
    from app.database import Base
    from app import models  # noqa: F401  (registers core tables)
    from app import health_models  # noqa: F401  (registers health tables)
    return Base.metadata


def upgrade():
    metadata = _model_metadata()
    bind = op.get_bind()
    tables = [metadata.tables[name] for name in MISSING_TABLES]
    # create_all resolves FK dependency order among the subset and skips any
    # object that already exists (checkfirst) so the step is idempotent.
    metadata.create_all(bind=bind, tables=tables, checkfirst=True)


def downgrade():
    metadata = _model_metadata()
    bind = op.get_bind()
    tables = [metadata.tables[name] for name in reversed(MISSING_TABLES)]
    metadata.drop_all(bind=bind, tables=tables, checkfirst=True)
