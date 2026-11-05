"""Relax NOT NULL on DB columns the current ORM models no longer populate.

These columns exist in the database (from older schema revisions) but are not
declared on the current models, so the app's inserts omit them. While they are
NOT NULL with no default, every such insert fails with NotNullViolation (e.g.
creating a company workspace on first login). Making them nullable unblocks the
inserts without dropping any existing data.
"""
from alembic import op

revision = "reconcile_db_extra_cols_v1"
down_revision = "reconcile_model_columns_v1"
branch_labels = None
depends_on = None

_COLS = [
    ("companies", "country"),
    ("documents", "original_filename"),
    ("documents", "file_extension"),
    ("documents", "storage_path"),
    ("documents", "storage_provider"),
    ("documents", "download_blocked"),
]


def upgrade():
    for table, col in _COLS:
        op.alter_column(table, col, nullable=True)


def downgrade():
    # Best-effort: re-imposing NOT NULL only succeeds if no NULLs are present.
    for table, col in reversed(_COLS):
        op.alter_column(table, col, nullable=False)
