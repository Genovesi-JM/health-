"""Retain exact clinical document decisions and immutable delivery bytes."""
from alembic import op
import sqlalchemy as sa

revision = 'clinical_document_requests_v1'
down_revision = 'prescription_renewals_v1'
branch_labels = None
depends_on = None


def upgrade():
    from app.clinical_document_models import ClinicalDocumentRequest
    from app.services.clinical_document_retention import install_document_guards
    connection = op.get_bind(); inspector = sa.inspect(connection)
    table = ClinicalDocumentRequest.__table__
    if not inspector.has_table(table.name): table.create(connection)
    else:
        columns = {item['name']: item for item in inspector.get_columns(table.name)}
        if set(columns) != {column.name for column in table.columns}: raise RuntimeError('Incomplete clinical document schema')
        for column in table.columns:
            actual = columns[column.name]
            if (actual['nullable'] != column.nullable or actual['type']._type_affinity is not column.type._type_affinity
                    or actual.get('default') is not None): raise RuntimeError('Invalid clinical document column')
            if isinstance(column.type, sa.String) and getattr(actual['type'], 'length', None) != column.type.length:
                raise RuntimeError('Invalid clinical document column length')
        if inspector.get_pk_constraint(table.name)['constrained_columns'] != ['id']: raise RuntimeError('Invalid clinical document primary key')
        indexes = {item['name']: item for item in inspector.get_indexes(table.name)}
        for index in table.indexes:
            if (index.name not in indexes or bool(indexes[index.name]['unique']) != bool(index.unique)
                    or indexes[index.name]['column_names'] != [column.name for column in index.columns]):
                raise RuntimeError('Invalid clinical document uniqueness')
        fks = inspector.get_foreign_keys(table.name)
        for constraint in table.foreign_key_constraints:
            expected = ([column.name for column in constraint.columns], constraint.referred_table.name,
                [element.column.name for element in constraint.elements], (constraint.ondelete or '').upper())
            if not any((item['constrained_columns'], item['referred_table'], item['referred_columns'],
                (item.get('options',{}).get('ondelete') or '').upper())==expected for item in fks):
                raise RuntimeError('Invalid clinical document foreign key')
        def normalized(sql):
            return ''.join(sql.replace('::text','').split()).replace('(','').replace(')','')
        checks = {item['name']: normalized(item['sqltext']) for item in inspector.get_check_constraints(table.name)}
        for constraint in table.constraints:
            if isinstance(constraint, sa.CheckConstraint) and checks.get(constraint.name) != normalized(str(constraint.sqltext)):
                raise RuntimeError('Invalid clinical document kind constraint')
    install_document_guards(connection)


def downgrade():
    from app.services.clinical_document_retention import remove_document_guards
    connection = op.get_bind()
    if connection.execute(sa.text('SELECT 1 FROM clinical_document_requests LIMIT 1')).first():
        raise RuntimeError('Retained clinical documents prevent destructive downgrade')
    remove_document_guards(connection)
    op.drop_table('clinical_document_requests')
