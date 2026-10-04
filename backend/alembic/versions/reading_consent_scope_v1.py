"""Preserve explicit jurisdiction on new health readings; legacy remains unknown."""
from alembic import op
import sqlalchemy as sa

revision = 'reading_consent_scope_v1'
down_revision = 'consent_runtime_v1'
branch_labels = None
depends_on = None

_FIELDS = {'country': 2, 'consent_language': 10}


def upgrade():
    connection = op.get_bind()
    columns = {column['name']: column for column in sa.inspect(connection).get_columns('device_readings')}
    for name, length in _FIELDS.items():
        if name in columns:
            column = columns[name]
            if (not column['nullable'] or column['type']._type_affinity is not sa.String
                    or column['type'].length != length or column.get('default') is not None):
                raise RuntimeError('Invalid reading consent scope column')
    for name, length in _FIELDS.items():
        if name not in columns:
            op.add_column('device_readings', sa.Column(name, sa.String(length), nullable=True))


def downgrade():
    connection = op.get_bind()
    if connection.execute(sa.text(
        'SELECT 1 FROM device_readings WHERE country IS NOT NULL OR consent_language IS NOT NULL LIMIT 1'
    )).first():
        raise RuntimeError('Retained reading jurisdiction prevents destructive downgrade')
    for name in reversed(_FIELDS):
        op.drop_column('device_readings', name)
