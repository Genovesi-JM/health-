"""Reconcile DB columns with the ORM models (column-level drift).

Several tables were created by earlier migrations without columns that the ORM
models declare, so operations touching those columns fail at runtime even
though the tables exist (the schema verifier only checks table/head presence,
not columns). This revision adds the missing columns and renames the one
mismatched column so the database matches the packaged models.

NOT NULL additions carry a server_default (the model's own default where it has
one, else a type-safe placeholder) so the step is safe on populated tables.
"""
from alembic import op
import sqlalchemy as sa

revision = "reconcile_model_columns_v1"
down_revision = "add_missing_care_tables_v1"
branch_labels = None
depends_on = None


def upgrade():
    # family_members: model column is `relationship_type`; DB has `relationship`.
    op.alter_column("family_members", "relationship", new_column_name="relationship_type")

    # doctor_invites
    op.add_column("doctor_invites", sa.Column("role", sa.String(20), nullable=False, server_default="doctor"))

    # orders
    op.add_column("orders", sa.Column("company_id", sa.String(36), nullable=True))
    op.add_column("orders", sa.Column("site_id", sa.String(36), nullable=True))

    # order_items
    op.add_column("order_items", sa.Column("product_type", sa.String(30), nullable=True))
    op.add_column("order_items", sa.Column("tax_rate", sa.Numeric(5, 4), nullable=True))
    op.add_column("order_items", sa.Column("tax_amount", sa.Numeric(12, 2), nullable=True))
    op.add_column("order_items", sa.Column("status", sa.String(30), nullable=True))
    op.add_column("order_items", sa.Column("scheduled_date", sa.DateTime(), nullable=True))

    # sites
    op.add_column("sites", sa.Column("country", sa.String(100), nullable=False, server_default="Angola"))

    # documents
    op.add_column("documents", sa.Column("file_path", sa.Text(), nullable=True))
    op.add_column("documents", sa.Column("uploaded_by", sa.String(), nullable=True))

    # datasets
    op.add_column("datasets", sa.Column("company_id", sa.String(36), nullable=False, server_default=""))
    op.add_column("datasets", sa.Column("source_tool", sa.String(50), nullable=True))
    op.add_column("datasets", sa.Column("sector", sa.String(50), nullable=True))
    op.add_column("datasets", sa.Column("capture_date", sa.DateTime(), nullable=True))
    op.add_column("datasets", sa.Column("metadata_json", sa.Text(), nullable=True))
    op.add_column("datasets", sa.Column("total_size_bytes", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("datasets", sa.Column("processed_at", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("datasets", "processed_at")
    op.drop_column("datasets", "total_size_bytes")
    op.drop_column("datasets", "metadata_json")
    op.drop_column("datasets", "capture_date")
    op.drop_column("datasets", "sector")
    op.drop_column("datasets", "source_tool")
    op.drop_column("datasets", "company_id")
    op.drop_column("documents", "uploaded_by")
    op.drop_column("documents", "file_path")
    op.drop_column("sites", "country")
    op.drop_column("order_items", "scheduled_date")
    op.drop_column("order_items", "status")
    op.drop_column("order_items", "tax_amount")
    op.drop_column("order_items", "tax_rate")
    op.drop_column("order_items", "product_type")
    op.drop_column("orders", "site_id")
    op.drop_column("orders", "company_id")
    op.drop_column("doctor_invites", "role")
    op.alter_column("family_members", "relationship_type", new_column_name="relationship")
