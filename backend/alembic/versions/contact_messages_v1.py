"""Version the existing public contact model; no email delivery is enabled."""
from alembic import op
import sqlalchemy as sa

revision = "contact_messages_v1"
down_revision = "staging_history_merge_v1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "contact_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(250), nullable=False),
        sa.Column("subject", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_contact_messages_status", "contact_messages", ["status"])
    op.create_index("ix_contact_messages_created_at", "contact_messages", ["created_at"])


def downgrade():
    if op.get_bind().execute(sa.text("SELECT 1 FROM contact_messages LIMIT 1")).first():
        raise RuntimeError("Contact messages prevent destructive downgrade")
    op.drop_table("contact_messages")
