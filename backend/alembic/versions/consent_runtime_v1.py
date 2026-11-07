"""Immutable consent catalog, append-only decisions and episode authorization.

No text is approved or seeded, and no legacy declaration is upgraded.
"""
from alembic import op
import sqlalchemy as sa

revision = 'consent_runtime_v1'
down_revision = 'health_payment_attempts_v1'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    additions = {'consultations': [('consent_language', 10)],
                 'triage_sessions': [('country', 2), ('consent_language', 10)],
                 'patient_documents': [('country', 2), ('consent_language', 10)]}
    for table, fields in additions.items():
        columns = {row['name']: row for row in sa.inspect(connection).get_columns(table)}
        for name, size in fields:
            if name not in columns:
                op.add_column(table, sa.Column(name, sa.String(size), nullable=True))
            elif not columns[name]['nullable'] or columns[name]['type']._type_affinity is not sa.String or columns[name]['type'].length != size:
                raise RuntimeError('Invalid consent scope column')
    from app.health_models import ConsentCatalogDocument, PatientConsentEvent, ConsultationConsentSnapshot
    for model in (ConsentCatalogDocument, PatientConsentEvent, ConsultationConsentSnapshot):
        table = model.__table__
        if sa.inspect(connection).has_table(table.name):
            columns = {row['name']: row for row in sa.inspect(connection).get_columns(table.name)}
            if set(columns) != {column.name for column in table.columns}:
                raise RuntimeError('Incomplete consent evidence schema')
            for column in table.columns:
                existing = columns[column.name]
                if existing['nullable'] != column.nullable or existing['type']._type_affinity is not column.type._type_affinity:
                    raise RuntimeError('Invalid consent evidence column')
                if isinstance(column.type, sa.String) and getattr(existing['type'], 'length', None) != column.type.length:
                    raise RuntimeError('Invalid consent evidence column length')
            indexes = {row['name']: row for row in sa.inspect(connection).get_indexes(table.name)}
            for index in table.indexes:
                if index.name not in indexes or bool(indexes[index.name]['unique']) != bool(index.unique) or indexes[index.name]['column_names'] != [column.name for column in index.columns]:
                    raise RuntimeError('Invalid consent evidence uniqueness')
            inspector = sa.inspect(connection)
            if inspector.get_pk_constraint(table.name)['constrained_columns'] != [column.name for column in table.primary_key]:
                raise RuntimeError('Invalid consent evidence primary key')
            unique_columns = {tuple(row['column_names']) for row in inspector.get_unique_constraints(table.name)}
            for constraint in table.constraints:
                if isinstance(constraint, sa.UniqueConstraint) and tuple(column.name for column in constraint.columns) not in unique_columns:
                    raise RuntimeError('Invalid consent evidence unique constraint')
            foreign_keys = inspector.get_foreign_keys(table.name)
            for constraint in table.foreign_key_constraints:
                expected = ([column.name for column in constraint.columns], constraint.referred_table.name,
                    [element.column.name for element in constraint.elements], (constraint.ondelete or '').upper())
                if not any((row['constrained_columns'], row['referred_table'], row['referred_columns'],
                            (row.get('options', {}).get('ondelete') or '').upper()) == expected for row in foreign_keys):
                    raise RuntimeError('Invalid consent evidence foreign key')
        else:
            table.create(connection)
    from app.services.consent_retention import install_consent_guards
    install_consent_guards(connection)


def downgrade():
    connection = op.get_bind()
    tables = ('consultation_consent_snapshots', 'patient_consent_events', 'consent_catalog_documents')
    if any(connection.execute(sa.text(f'SELECT 1 FROM {table} LIMIT 1')).first() for table in tables):
        raise RuntimeError('Retained consent evidence prevents destructive downgrade')
    from app.services.consent_retention import remove_consent_guards
    remove_consent_guards(connection)
    for table in tables: op.drop_table(table)
    op.drop_column('triage_sessions', 'consent_language')
    op.drop_column('triage_sessions', 'country')
    op.drop_column('patient_documents', 'consent_language')
    op.drop_column('patient_documents', 'country')
    op.drop_column('consultations', 'consent_language')
