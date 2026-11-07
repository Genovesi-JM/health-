"""Prevent rewriting a retained document decision or its clinical record."""
from sqlalchemy import event, inspect


def rules(tables):
    if 'clinical_document_requests' not in tables: return []
    result = [('request_update', 'clinical_document_requests', 'UPDATE', 'TRUE'),
              ('request_delete', 'clinical_document_requests', 'DELETE', 'TRUE'),
              ('request_insert', 'clinical_document_requests', 'INSERT',
               'EXISTS (SELECT 1 FROM clinical_document_requests p WHERE p.id=NEW.id OR (p.actor_user_id=NEW.actor_user_id AND p.request_key=NEW.request_key) OR p.prescription_id=NEW.prescription_id OR p.referral_id=NEW.referral_id)')]
    for table, key, fields in (
        ('prescriptions', 'prescription_id', ('id', 'consultation_id', 'medications_json', 'instructions', 'created_at')),
        ('referrals', 'referral_id', ('id', 'consultation_id', 'destination', 'specialty', 'reason', 'urgency', 'created_at')),
    ):
        if table not in tables: continue
        retained = f'EXISTS (SELECT 1 FROM clinical_document_requests r WHERE r.{key}=OLD.id)'
        changed = ' OR '.join(f'OLD.{field} IS DISTINCT FROM NEW.{field}' for field in fields)
        result += [(table+'_delete', table, 'DELETE', retained),
            (table+'_update', table, 'UPDATE', f'({changed}) AND {retained}'),
            (table+'_artifact', table, 'UPDATE', f"EXISTS (SELECT 1 FROM clinical_document_requests r WHERE r.{key}=OLD.id AND ((NEW.file_storage_key IS NOT NULL AND NEW.file_storage_key<>r.storage_key) OR (OLD.file_storage_key IS NOT NULL AND NEW.file_storage_key IS NULL) OR NEW.file_url IS NOT NULL))"),
            (table+'_insert', table, 'INSERT', f'EXISTS (SELECT 1 FROM clinical_document_requests r WHERE r.{key}=NEW.id)'),
            (table+'_collision', table, 'UPDATE', f'OLD.id<>NEW.id AND EXISTS (SELECT 1 FROM clinical_document_requests r WHERE r.{key}=NEW.id)')]
    for table, field, identity, collision in (
        ('doctors','doctor_id',('id','user_id'),'p.id=NEW.id OR p.user_id=NEW.user_id OR p.slug=NEW.slug'),
        ('patients','patient_id',('id','user_id'),'p.id=NEW.id OR p.user_id=NEW.user_id'),
        ('users','actor_user_id',('id',),'p.id=NEW.id OR p.email=NEW.email'),
        ('consultations','consultation_id',('id','patient_id','doctor_id','country','consent_language'),'p.id=NEW.id'),
    ):
        if table not in tables: continue
        retained = f'EXISTS (SELECT 1 FROM clinical_document_requests r WHERE r.{field}=OLD.id)'
        changed = ' OR '.join(f'OLD.{name} IS DISTINCT FROM NEW.{name}' for name in identity)
        retained_other = f'EXISTS (SELECT 1 FROM clinical_document_requests r WHERE r.{field}=p.id)'
        result += [(table+'_delete', table, 'DELETE', retained),
            (table+'_identity', table, 'UPDATE', f'({changed}) AND {retained}'),
            (table+'_insert', table, 'INSERT', f'EXISTS (SELECT 1 FROM {table} p WHERE ({collision}) AND {retained_other})'),
            (table+'_collision', table, 'UPDATE', f'EXISTS (SELECT 1 FROM {table} p WHERE p.id<>OLD.id AND ({collision}) AND {retained_other})')]
    return result


def install_document_guards(connection):
    if connection.dialect.name not in ('sqlite', 'postgresql'): raise RuntimeError('Document retention requires SQLite or PostgreSQL')
    for key, table, operation, condition in rules(set(inspect(connection).get_table_names())):
        name = 'kaya_document_' + key
        if connection.dialect.name == 'sqlite':
            condition = condition.replace('IS DISTINCT FROM', 'IS NOT')
            connection.exec_driver_sql(f"CREATE TRIGGER IF NOT EXISTS {name} BEFORE {operation} ON {table} WHEN {condition} BEGIN SELECT RAISE(ABORT, 'clinical_document_is_retained'); END")
        else:
            connection.exec_driver_sql(f"CREATE OR REPLACE FUNCTION {name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF {condition} THEN RAISE EXCEPTION 'clinical_document_is_retained' USING ERRCODE='23514'; END IF; RETURN {'OLD' if operation == 'DELETE' else 'NEW'}; END; $$")
            connection.exec_driver_sql(f'DROP TRIGGER IF EXISTS {name} ON {table}')
            connection.exec_driver_sql(f'CREATE TRIGGER {name} BEFORE {operation} ON {table} FOR EACH ROW EXECUTE FUNCTION {name}()')


def remove_document_guards(connection):
    for key, table, _, _ in rules(set(inspect(connection).get_table_names())):
        name = 'kaya_document_' + key
        connection.exec_driver_sql(f'DROP TRIGGER IF EXISTS {name}' + (f' ON {table}' if connection.dialect.name=='postgresql' else ''))
        if connection.dialect.name=='postgresql': connection.exec_driver_sql(f'DROP FUNCTION IF EXISTS {name}()')


def _after_create(metadata, connection, **kwargs): install_document_guards(connection)

def register_document_guards(metadata):
    if not event.contains(metadata, 'after_create', _after_create): event.listen(metadata, 'after_create', _after_create)
