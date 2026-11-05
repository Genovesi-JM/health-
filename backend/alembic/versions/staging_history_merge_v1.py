"""Join deployed staging repairs with the current clinical migration history.

No stamp, data deletion, or runtime schema bootstrap is used.
"""
revision = "staging_history_merge_v1"
down_revision = ("reconcile_db_extra_cols_v1", "clinical_document_requests_v1")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
