"""Immutable consent evidence and parent identity guards, including SQLite REPLACE."""
from sqlalchemy import event, inspect


def _rules(tables):
    rules = []
    identities = {
        'consent_catalog_documents': 'p.id = NEW.id OR (p.country = NEW.country AND p.language = NEW.language AND p.purpose = NEW.purpose AND p.version = NEW.version)',
        'patient_consent_events': 'p.id = NEW.id OR (p.patient_id = NEW.patient_id AND (p.sequence = NEW.sequence OR p.request_key = NEW.request_key))',
        'consultation_consent_snapshots': 'p.id = NEW.id OR p.consultation_id = NEW.consultation_id',
    }
    for table, collision in identities.items():
        if table not in tables: continue
        for operation in ('UPDATE', 'DELETE'):
            rules.append((table + '_' + operation.lower(), table, operation, 'TRUE'))
        rules.append((table + '_insert', table, 'INSERT', f'EXISTS (SELECT 1 FROM {table} p WHERE {collision})'))
    if 'patient_consent_events' not in tables: return rules
    parents = [
        ('patients', 'EXISTS (SELECT 1 FROM patient_consent_events e WHERE e.patient_id=p.id)',
         'p.id=NEW.id OR p.user_id=NEW.user_id', ('id', 'user_id')),
        ('users', 'EXISTS (SELECT 1 FROM patient_consent_events e JOIN patients q ON q.id=e.patient_id WHERE e.actor_user_id=p.id OR q.user_id=p.id)',
         'p.id=NEW.id OR p.email=NEW.email', ('id',)),
    ]
    if 'consultation_consent_snapshots' in tables:
        parents.append(('consultations', 'EXISTS (SELECT 1 FROM consultation_consent_snapshots e WHERE e.consultation_id=p.id)',
            'p.id=NEW.id OR (p.patient_id=NEW.patient_id AND p.booking_request_key=NEW.booking_request_key)',
            ('id', 'patient_id', 'doctor_id', 'country', 'consent_language')))
    for table, retained, collision, fields in parents:
        if table not in tables: continue
        changed = ' OR '.join(f'OLD.{field} IS DISTINCT FROM NEW.{field}' for field in fields)
        rules.extend([
            (table + '_delete', table, 'DELETE', retained.replace('p.', 'OLD.')),
            (table + '_identity', table, 'UPDATE', f'({changed}) AND ' + retained.replace('p.', 'OLD.')),
            (table + '_insert', table, 'INSERT', f'EXISTS (SELECT 1 FROM {table} p WHERE ({collision}) AND {retained})'),
            (table + '_collision', table, 'UPDATE', f'EXISTS (SELECT 1 FROM {table} p WHERE p.id<>OLD.id AND ({collision}) AND {retained})'),
        ])
    return rules


def install_consent_guards(connection):
    tables = set(inspect(connection).get_table_names())
    if connection.dialect.name not in ('sqlite', 'postgresql'):
        raise RuntimeError('Consent retention requires SQLite or PostgreSQL')
    for key, table, operation, condition in _rules(tables):
        name = 'kaya_consent_' + key
        if connection.dialect.name == 'sqlite':
            condition = condition.replace('IS DISTINCT FROM', 'IS NOT')
            connection.exec_driver_sql(f"CREATE TRIGGER IF NOT EXISTS {name} BEFORE {operation} ON {table} WHEN {condition} BEGIN SELECT RAISE(ABORT, 'consent_evidence_is_retained'); END")
        else:
            connection.exec_driver_sql(f"CREATE OR REPLACE FUNCTION {name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF {condition} THEN RAISE EXCEPTION 'consent_evidence_is_retained' USING ERRCODE='23514'; END IF; RETURN {'OLD' if operation == 'DELETE' else 'NEW'}; END; $$")
            connection.exec_driver_sql(f'DROP TRIGGER IF EXISTS {name} ON {table}')
            connection.exec_driver_sql(f'CREATE TRIGGER {name} BEFORE {operation} ON {table} FOR EACH ROW EXECUTE FUNCTION {name}()')


def remove_consent_guards(connection):
    for key, table, _, _ in _rules(set(inspect(connection).get_table_names())):
        name = 'kaya_consent_' + key
        connection.exec_driver_sql(f"DROP TRIGGER IF EXISTS {name}" + (f' ON {table}' if connection.dialect.name == 'postgresql' else ''))
        if connection.dialect.name == 'postgresql': connection.exec_driver_sql(f'DROP FUNCTION IF EXISTS {name}()')


def _after_create(metadata, connection, **kwargs):
    install_consent_guards(connection)


def register_consent_guards(metadata):
    if not event.contains(metadata, 'after_create', _after_create): event.listen(metadata, 'after_create', _after_create)
