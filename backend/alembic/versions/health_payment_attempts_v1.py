"""Durable patient checkout identity and outbound dispatch ownership.

Legacy dispatch outcomes remain NULL/unassessed. No provider request is sent.
Revision ID: health_payment_attempts_v1
Revises: consultation_request_expiry_v1
"""
from alembic import op
import sqlalchemy as sa

revision = 'health_payment_attempts_v1'
down_revision = 'consultation_request_expiry_v1'
branch_labels = None
depends_on = None
FIELDS = {'checkout_request_key': 36, 'checkout_request_digest': 64, 'dispatch_state': 24}
INDEX = 'uq_health_payment_checkout_request'


def upgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {row['name']: row for row in inspector.get_columns('health_payments')}
    present = set(FIELDS) & set(columns)
    if present:
        if present != set(FIELDS):
            raise RuntimeError('Partial durable checkout schema requires repair')
        for field, size in FIELDS.items():
            if not columns[field]['nullable'] or columns[field]['type']._type_affinity is not sa.String or columns[field]['type'].length != size:
                raise RuntimeError('Invalid durable checkout column')
        if not any(row['name'] == INDEX and row['unique'] and row['column_names'] == ['patient_id', 'checkout_request_key']
                   for row in inspector.get_indexes('health_payments')):
            raise RuntimeError('Missing checkout identity constraint')
        return
    for field, size in FIELDS.items():
        op.add_column('health_payments', sa.Column(field, sa.String(size), nullable=True))
    op.create_index(INDEX, 'health_payments', ['patient_id', 'checkout_request_key'], unique=True)


def downgrade():
    if op.get_bind().execute(sa.text('SELECT 1 FROM health_payments WHERE checkout_request_key IS NOT NULL OR checkout_request_digest IS NOT NULL OR dispatch_state IS NOT NULL LIMIT 1')).first():
        raise RuntimeError('Retained payment attempts prevent destructive downgrade')
    op.drop_index(INDEX, table_name='health_payments')
    for field in reversed(FIELDS):
        op.drop_column('health_payments', field)
