"""Persist acceptance deadlines without expiring or releasing care in migration.

Historical requests use a fixed, reviewed 24-hour backfill rule, capped by their
scheduled time. A moved request uses its matching retained reschedule timestamp.
Unknown/invalid chronology stays NULL for manual review. Operational expiry is
a separate audited worker transaction after this migration.

Revision ID: consultation_request_expiry_v1
Revises: appointment_reschedules_v1
"""
from datetime import datetime, timedelta, timezone
import json
from uuid import uuid4

from alembic import op
import sqlalchemy as sa

revision = 'consultation_request_expiry_v1'
down_revision = 'appointment_reschedules_v1'
branch_labels = None
depends_on = None
INDEX = 'ix_consultations_request_expiry'
FIELDS = ('requested_expires_at', 'expired_at')
PAYMENT_INDEX = 'ix_health_payments_consultation_id'


def _date(value):
    try:
        result = value if isinstance(value, datetime) else datetime.fromisoformat(value.replace('Z', '+00:00'))
        return result.astimezone(timezone.utc).replace(tzinfo=None) if result.tzinfo else result
    except (ValueError, TypeError, AttributeError):
        return None


def upgrade():
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = {row['name']: row for row in inspector.get_columns('consultations')}
    present = set(FIELDS) & set(columns)
    payment_table = 'health_payments' in inspector.get_table_names()
    payment_index = next((index for index in inspector.get_indexes('health_payments') if index['name'] == PAYMENT_INDEX), None) if payment_table else None
    if payment_index and (payment_index['column_names'] != ['consultation_id'] or payment_index['unique']):
        raise RuntimeError('Invalid linked-payment lookup index')
    if present:
        if present != set(FIELDS):
            raise RuntimeError('Partial consultation expiry schema requires explicit repair')
        for field in FIELDS:
            if not columns[field]['nullable'] or columns[field]['type']._type_affinity is not sa.DateTime:
                raise RuntimeError('Invalid consultation expiry column')
        if not any(index['name'] == INDEX and not index['unique'] and index['column_names'] == ['status', 'requested_expires_at', 'id']
                   for index in inspector.get_indexes('consultations')):
            raise RuntimeError('Missing consultation expiry index')
        if payment_table and (not payment_index or payment_index['column_names'] != ['consultation_id'] or payment_index['unique']):
            raise RuntimeError('Missing linked-payment lookup index')
        return
    for field in FIELDS:
        op.add_column('consultations', sa.Column(field, sa.DateTime(), nullable=True))
    op.create_index(INDEX, 'consultations', ['status', 'requested_expires_at', 'id'])
    if payment_table and not payment_index:
        op.create_index(PAYMENT_INDEX, 'health_payments', ['consultation_id'])
    now = datetime.utcnow()
    has_moves = 'consultation_reschedules' in inspector.get_table_names()
    has_audit = 'health_audit_logs' in inspector.get_table_names()
    revision_select = 'reschedule_revision' if 'reschedule_revision' in columns else '0 AS reschedule_revision'
    rows = connection.execute(sa.text('SELECT id, created_at, scheduled_at, ' + revision_select +
                                     " FROM consultations WHERE status='requested'")).mappings().all()
    for row in rows:
        created = _date(row['created_at'])
        base = created
        source = 'created_at'
        if row['reschedule_revision']:
            moved = connection.execute(sa.text('SELECT created_at FROM consultation_reschedules WHERE consultation_id=:id AND revision=:revision'),
                {'id': row['id'], 'revision': row['reschedule_revision']}).first() if has_moves else None
            base = _date(moved[0]) if moved else None
            source = 'reschedule_created_at'
        scheduled = _date(row['scheduled_at']) if row['scheduled_at'] is not None else None
        if (not created or not base or not created <= base <= now or
                (row['scheduled_at'] is not None and (not scheduled or scheduled < base))):
            continue
        expires = min(base + timedelta(hours=24), scheduled) if scheduled else base + timedelta(hours=24)
        connection.execute(sa.text('UPDATE consultations SET requested_expires_at=:expires WHERE id=:id'),
                           {'expires': expires, 'id': row['id']})
        if has_audit:
            connection.execute(sa.text('INSERT INTO health_audit_logs (id, actor_user_id, action, resource_type, resource_id, metadata_json, created_at) '
                "VALUES (:id, NULL, 'consultation_request_deadline_backfilled', 'consultation', :resource, :metadata, :created)"),
                {'id': str(uuid4()), 'resource': row['id'], 'created': now,
                 'metadata': json.dumps({'migration': revision, 'source': source, 'ttl_hours': 24,
                                         'requested_expires_at': expires.replace(tzinfo=timezone.utc).isoformat()})})


def downgrade():
    if op.get_bind().execute(sa.text("SELECT 1 FROM consultations WHERE requested_expires_at IS NOT NULL OR expired_at IS NOT NULL OR status='expired' LIMIT 1")).first():
        raise RuntimeError('Retained request deadlines prevent destructive downgrade')
    op.drop_index(INDEX, table_name='consultations')
    if 'health_payments' in sa.inspect(op.get_bind()).get_table_names():
        op.drop_index(PAYMENT_INDEX, table_name='health_payments')
    for field in reversed(FIELDS):
        op.drop_column('consultations', field)
