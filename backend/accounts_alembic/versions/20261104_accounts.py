"""Create the separate Kaya customer/employee accounts schema."""
from alembic import op
import sqlalchemy as sa
revision = "kaya_accounts_20261104_v1"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("customer_accounts", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(200), nullable=False), sa.Column("email", sa.String(256), nullable=False), sa.Column("company", sa.String(200)), sa.Column("country", sa.String(100)), sa.Column("notes", sa.Text()), sa.Column("created_at", sa.DateTime(), nullable=False))
    op.create_index("ix_customer_accounts_id", "customer_accounts", ["id"])
    op.create_index("ix_customer_accounts_email", "customer_accounts", ["email"], unique=True)
    op.create_table("employees", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(200), nullable=False), sa.Column("email", sa.String(256), nullable=False), sa.Column("role", sa.String(120), nullable=False), sa.Column("department", sa.String(120)), sa.Column("phone", sa.String(60)), sa.Column("is_active", sa.Boolean()), sa.Column("created_at", sa.DateTime(), nullable=False))
    op.create_index("ix_employees_id", "employees", ["id"])
    op.create_index("ix_employees_email", "employees", ["email"], unique=True)

def downgrade():
    raise RuntimeError("Automatic destructive accounts downgrade is disabled; use an approved restore.")
