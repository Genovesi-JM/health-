"""Retained scoped renewal submissions and exactly one immutable decision."""
from alembic import op
import sqlalchemy as sa

revision='prescription_renewals_v1'
down_revision='reading_consent_scope_v1'
branch_labels=None
depends_on=None

_REQUEST_FIELDS={'country':sa.String(2),'consent_language':sa.String(10),'request_key':sa.String(36),
    'request_digest':sa.String(64),'creation_evidence_json':sa.Text(),'creation_digest':sa.String(64),'revision':sa.Integer()}
_STANDALONE_FIELDS={'country':sa.String(2),'consent_language':sa.String(10),'renewal_decision_id':sa.String(36)}


def _validate_column(actual,kind,nullable):
    if actual['type']._type_affinity is not kind._type_affinity or actual['nullable']!=nullable:
        raise RuntimeError('Invalid renewal evidence column')
    if isinstance(kind,sa.String) and actual['type'].length!=kind.length:
        raise RuntimeError('Invalid renewal evidence length')


def _add_fields(connection,table,fields):
    columns={row['name']:row for row in sa.inspect(connection).get_columns(table)}
    for name,kind in fields.items():
        if name in columns:
            _validate_column(columns[name],kind,name!='revision')
            default=columns[name].get('default')
            if name=='revision':
                if str(default).strip() not in ('0', "'0'", "'0'::integer"):
                    raise RuntimeError('Invalid renewal revision default')
            elif default is not None: raise RuntimeError('Invalid renewal evidence default')
    for name,kind in fields.items():
        if name not in columns:
            if name=='renewal_decision_id':
                connection.exec_driver_sql('ALTER TABLE standalone_prescriptions ADD COLUMN renewal_decision_id VARCHAR(36) REFERENCES prescription_request_decisions(id) ON DELETE RESTRICT')
            else:
                op.add_column(table,sa.Column(name,kind,nullable=name!='revision',server_default='0' if name=='revision' else None))


def _index(connection,table,name,columns):
    existing={row['name']:row for row in sa.inspect(connection).get_indexes(table)}
    if name in existing:
        if not existing[name]['unique'] or existing[name]['column_names']!=columns: raise RuntimeError('Invalid renewal uniqueness')
    else: op.create_index(name,table,columns,unique=True)



def _foreign_keys(connection,table):
    if connection.dialect.name=='sqlite':
        # PRAGMA preserves ON DELETE for columns added with inline REFERENCES;
        # SQLAlchemy's CREATE TABLE parser can omit that option after ALTER.
        return [{'constrained_columns':[row[3]],'referred_table':row[2],'referred_columns':[row[4]],
                 'options':{'ondelete':row[6]}} for row in connection.exec_driver_sql(f'PRAGMA foreign_key_list({table})')]
    return sa.inspect(connection).get_foreign_keys(table)


def upgrade():
    connection=op.get_bind()
    _add_fields(connection,'prescription_requests',_REQUEST_FIELDS)
    _index(connection,'prescription_requests','uq_renewal_patient_request',['patient_id','request_key'])
    from app.health_models import PrescriptionRequestDecision
    table=PrescriptionRequestDecision.__table__
    inspector=sa.inspect(connection)
    if not inspector.has_table(table.name): table.create(connection)
    else:
        columns={row['name']:row for row in inspector.get_columns(table.name)}
        if set(columns)!={column.name for column in table.columns}: raise RuntimeError('Incomplete renewal decision schema')
        for column in table.columns: _validate_column(columns[column.name],column.type,column.nullable)
        if inspector.get_pk_constraint(table.name)['constrained_columns']!=['id']: raise RuntimeError('Invalid renewal decision primary key')
        for index in table.indexes:
            actual={row['name']:row for row in inspector.get_indexes(table.name)}.get(index.name)
            if not actual or actual['column_names']!=[column.name for column in index.columns] or bool(actual['unique'])!=bool(index.unique):
                raise RuntimeError('Invalid renewal decision uniqueness')
        for constraint in table.foreign_key_constraints:
            if not any(row['constrained_columns']==[column.name for column in constraint.columns]
                and row['referred_table']==constraint.referred_table.name and row['referred_columns']==[element.column.name for element in constraint.elements]
                and (row.get('options',{}).get('ondelete') or '').upper()=='RESTRICT' for row in _foreign_keys(connection,table.name)):
                raise RuntimeError('Invalid renewal decision foreign key')
    _add_fields(connection,'standalone_prescriptions',_STANDALONE_FIELDS)
    _index(connection,'standalone_prescriptions','uq_standalone_renewal_decision',['renewal_decision_id'])
    if not any(row['constrained_columns']==['renewal_decision_id'] and row['referred_table']=='prescription_request_decisions'
        and row['referred_columns']==['id'] and (row.get('options',{}).get('ondelete') or '').upper()=='RESTRICT'
        for row in _foreign_keys(connection,'standalone_prescriptions')):
        raise RuntimeError('Invalid standalone renewal decision reference')
    from app.services.renewal_retention import install_renewal_guards
    install_renewal_guards(connection)


def downgrade():
    connection=op.get_bind()
    if (connection.execute(sa.text('SELECT 1 FROM prescription_requests WHERE request_key IS NOT NULL LIMIT 1')).first()
        or connection.execute(sa.text('SELECT 1 FROM prescription_request_decisions LIMIT 1')).first()
        or connection.execute(sa.text('SELECT 1 FROM standalone_prescriptions WHERE renewal_decision_id IS NOT NULL LIMIT 1')).first()):
        raise RuntimeError('Retained renewal evidence prevents destructive downgrade')
    # SQLite needs a table rebuild to remove a reflected FK. Never risk a
    # dependent legacy dispensing record through a parent-table replacement.
    if connection.dialect.name=='sqlite' and connection.execute(sa.text('SELECT 1 FROM standalone_prescriptions LIMIT 1')).first():
        raise RuntimeError('Legacy standalone prescriptions require an explicit downgrade migration')
    from app.services.renewal_retention import remove_renewal_guards
    remove_renewal_guards(connection)
    op.drop_index('uq_standalone_renewal_decision',table_name='standalone_prescriptions')
    if connection.dialect.name=='sqlite':
        naming={'fk':'fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s'}
        with op.batch_alter_table('standalone_prescriptions',naming_convention=naming,recreate='always') as batch:
            batch.drop_constraint('fk_standalone_prescriptions_renewal_decision_id_prescription_request_decisions',type_='foreignkey')
            for name in reversed(_STANDALONE_FIELDS): batch.drop_column(name)
    else:
        for name in reversed(_STANDALONE_FIELDS): op.drop_column('standalone_prescriptions',name)
    op.drop_table('prescription_request_decisions')
    op.drop_index('uq_renewal_patient_request',table_name='prescription_requests')
    for name in reversed(_REQUEST_FIELDS): op.drop_column('prescription_requests',name)
