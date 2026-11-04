"""Retain original renewal submissions, decisions, and resulting clinical records."""
from sqlalchemy import event, inspect


def _rules(tables):
    if 'prescription_request_decisions' not in tables: return []
    rules = []
    for table, collision in {
        'prescription_request_decisions': 'p.id=NEW.id OR p.request_id=NEW.request_id OR (p.actor_user_id=NEW.actor_user_id AND p.request_key=NEW.request_key)',
    }.items():
        for operation in ('UPDATE', 'DELETE'): rules.append((table + '_' + operation.lower(), table, operation, 'TRUE'))
        rules.append((table + '_insert', table, 'INSERT', f'EXISTS (SELECT 1 FROM {table} p WHERE {collision})'))
    request_fields = ('id','patient_id','doctor_id','country','consent_language','request_key','request_digest',
                      'medication_name','dose','frequency','reason','created_at','creation_evidence_json','creation_digest')
    clinical_fields = ('id','prescription_request_id','patient_id','doctor_id','renewal_decision_id','country',
                       'consent_language','medication_name','dosage','frequency','duration','instructions','issue_date','valid_until','created_at')
    subjects = [
        ('prescription_requests', 'p.request_key IS NOT NULL', 'p.id=NEW.id OR (p.patient_id=NEW.patient_id AND p.request_key=NEW.request_key)', request_fields),
        ('standalone_prescriptions', 'p.renewal_decision_id IS NOT NULL', 'p.id=NEW.id OR p.prescription_request_id=NEW.prescription_request_id OR p.renewal_decision_id=NEW.renewal_decision_id', clinical_fields),
        ('patients', 'EXISTS (SELECT 1 FROM prescription_requests r WHERE r.patient_id=p.id AND r.request_key IS NOT NULL)', 'p.id=NEW.id OR p.user_id=NEW.user_id', ('id','user_id')),
        ('doctors', 'EXISTS (SELECT 1 FROM prescription_requests r WHERE r.doctor_id=p.id AND r.request_key IS NOT NULL)', 'p.id=NEW.id OR p.user_id=NEW.user_id OR p.slug=NEW.slug', ('id','user_id')),
        ('users', 'EXISTS (SELECT 1 FROM prescription_requests r JOIN patients q ON q.id=r.patient_id JOIN doctors d ON d.id=r.doctor_id WHERE r.request_key IS NOT NULL AND (q.user_id=p.id OR d.user_id=p.id))', 'p.id=NEW.id OR p.email=NEW.email', ('id',)),
    ]
    for table, retained, collision, fields in subjects:
        if table not in tables: continue
        changed = ' OR '.join(f'OLD.{field} IS DISTINCT FROM NEW.{field}' for field in fields)
        rules.extend([
            (table + '_delete', table, 'DELETE', retained.replace('p.', 'OLD.')),
            (table + '_identity', table, 'UPDATE', f'({changed}) AND ' + retained.replace('p.', 'OLD.')),
            (table + '_insert', table, 'INSERT', f'EXISTS (SELECT 1 FROM {table} p WHERE ({collision}) AND {retained})'),
            (table + '_collision', table, 'UPDATE', f'EXISTS (SELECT 1 FROM {table} p WHERE p.id<>OLD.id AND ({collision}) AND {retained})'),
        ])
    # A terminal status cannot be rewritten independently of its immutable event.
    fields = ('status','revision','doctor_note','adjusted_dose','adjusted_frequency','decided_at')
    changed = ' OR '.join(f'OLD.{field} IS DISTINCT FROM NEW.{field}' for field in fields)
    rules.append(('request_terminal', 'prescription_requests', 'UPDATE', f"OLD.request_key IS NOT NULL AND OLD.revision>0 AND ({changed})"))
    return rules


def install_renewal_guards(connection):
    if connection.dialect.name not in ('sqlite','postgresql'): raise RuntimeError('Renewal retention requires SQLite or PostgreSQL')
    for key, table, operation, condition in _rules(set(inspect(connection).get_table_names())):
        name='kaya_renewal_'+key
        if connection.dialect.name=='sqlite':
            condition=condition.replace('IS DISTINCT FROM','IS NOT')
            connection.exec_driver_sql(f"CREATE TRIGGER IF NOT EXISTS {name} BEFORE {operation} ON {table} WHEN {condition} BEGIN SELECT RAISE(ABORT, 'renewal_evidence_is_retained'); END")
        else:
            connection.exec_driver_sql(f"CREATE OR REPLACE FUNCTION {name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF {condition} THEN RAISE EXCEPTION 'renewal_evidence_is_retained' USING ERRCODE='23514'; END IF; RETURN {'OLD' if operation=='DELETE' else 'NEW'}; END; $$")
            connection.exec_driver_sql(f'DROP TRIGGER IF EXISTS {name} ON {table}')
            connection.exec_driver_sql(f'CREATE TRIGGER {name} BEFORE {operation} ON {table} FOR EACH ROW EXECUTE FUNCTION {name}()')


def remove_renewal_guards(connection):
    for key, table, _, _ in _rules(set(inspect(connection).get_table_names())):
        name='kaya_renewal_'+key
        connection.exec_driver_sql(f'DROP TRIGGER IF EXISTS {name}' + (f' ON {table}' if connection.dialect.name=='postgresql' else ''))
        if connection.dialect.name=='postgresql': connection.exec_driver_sql(f'DROP FUNCTION IF EXISTS {name}()')


def _after_create(metadata, connection, **kwargs): install_renewal_guards(connection)


def register_renewal_guards(metadata):
    if not event.contains(metadata,'after_create',_after_create): event.listen(metadata,'after_create',_after_create)
