"""Database retention guards for finalized notes and their correction history.

These guards prevent ordinary SQL/ORM edits, deletes and parent cascades. They
do not claim protection from a database administrator who changes the schema.
No expiry date or legal deletion approval is inferred by the application.
"""
from sqlalchemy import event, inspect


def _finalized(alias):
    return (f"({alias}.finalized_at IS NOT NULL OR {alias}.finalized_by_user_id IS NOT NULL "
            f"OR {alias}.finalization_digest IS NOT NULL)")


def _rules(tables):
    if not {"consultation_notes", "consultations"} <= tables:
        return []
    note_conflict = ("EXISTS (SELECT 1 FROM consultation_notes n WHERE "
                     "(n.id = NEW.id OR n.consultation_id = NEW.consultation_id) AND " + _finalized("n") + ")")
    rules = [
        ("note_update", "consultation_notes", "UPDATE", _finalized("OLD")),
        ("note_delete", "consultation_notes", "DELETE", _finalized("OLD")),
        ("note_insert_collision", "consultation_notes", "INSERT", note_conflict),
        ("note_update_collision", "consultation_notes", "UPDATE",
         note_conflict.replace("WHERE ", "WHERE n.id <> OLD.id AND ", 1)),
    ]
    if "consultation_amendments" in tables:
        rules.extend((
            ("amendment_update", "consultation_amendments", "UPDATE", "TRUE"),
            ("amendment_delete", "consultation_amendments", "DELETE", "TRUE"),
            ("amendment_insert_collision", "consultation_amendments", "INSERT",
             "EXISTS (SELECT 1 FROM consultation_amendments a WHERE a.id = NEW.id OR "
             "(a.note_id = NEW.note_id AND (a.revision = NEW.revision OR a.request_key = NEW.request_key)))"),
        ))
    # INSERT/UPDATE OR REPLACE can remove a conflicting row without running its
    # DELETE triggers on SQLite's default recursive_triggers=0 connection. Check
    # every protected unique identity before conflict resolution, not a pragma.
    parents = [
        ("episode", "consultations",
         "EXISTS (SELECT 1 FROM consultation_notes n WHERE n.consultation_id = parent.id AND " + _finalized("n") + ")",
         "(parent.id = NEW.id OR (parent.patient_id = NEW.patient_id AND parent.booking_request_key = NEW.booking_request_key))",
         ("id", "patient_id", "doctor_id", "country", "timezone", "status")),
        ("patient", "patients",
         "EXISTS (SELECT 1 FROM consultations c JOIN consultation_notes n ON n.consultation_id = c.id "
         "WHERE c.patient_id = parent.id AND " + _finalized("n") + ")",
         "(parent.id = NEW.id OR parent.user_id = NEW.user_id)", ("id", "user_id")),
        ("doctor", "doctors",
         "EXISTS (SELECT 1 FROM consultation_notes n WHERE n.doctor_id = parent.id AND " + _finalized("n") + ")",
         "(parent.id = NEW.id OR parent.user_id = NEW.user_id OR parent.slug = NEW.slug)", ("id", "user_id")),
        ("follow_up", "clinical_care_tasks",
         "EXISTS (SELECT 1 FROM consultation_notes n WHERE n.follow_up_task_id = parent.id AND " + _finalized("n") + ")",
         "parent.id = NEW.id", ("id", "patient_id", "consultation_id")),
    ]
    if {"users", "patients", "doctors"} <= tables:
        parents.append(("user", "users",
                        "EXISTS (SELECT 1 FROM consultation_notes n JOIN consultations c ON c.id = n.consultation_id "
                        "LEFT JOIN patients p ON p.id = c.patient_id LEFT JOIN doctors d ON d.id = n.doctor_id "
                        "WHERE " + _finalized("n") + " AND (n.finalized_by_user_id = parent.id OR p.user_id = parent.id OR d.user_id = parent.id))",
                        "(parent.id = NEW.id OR parent.email = NEW.email)", ("id",)))
    for key, table, retained, conflict, identity_fields in parents:
        if table not in tables:
            continue
        changed = " OR ".join(f"OLD.{field} IS DISTINCT FROM NEW.{field}" for field in identity_fields)
        rules.extend((
            (key + "_delete", table, "DELETE", retained.replace("parent.", "OLD.")),
            (key + "_identity", table, "UPDATE", f"({changed}) AND " + retained.replace("parent.", "OLD.")),
            (key + "_insert_collision", table, "INSERT",
             f"EXISTS (SELECT 1 FROM {table} parent WHERE {conflict} AND {retained})"),
            (key + "_update_collision", table, "UPDATE",
             f"EXISTS (SELECT 1 FROM {table} parent WHERE parent.id <> OLD.id AND {conflict} AND {retained})"),
        ))
    return rules


def install_retention_guards(connection):
    dialect = connection.dialect.name
    if dialect not in {"sqlite", "postgresql"}:
        raise RuntimeError("Clinical retention requires SQLite or PostgreSQL")
    tables = set(inspect(connection).get_table_names())
    if "consultation_notes" not in tables:
        return
    columns = {column["name"] for column in inspect(connection).get_columns("consultation_notes")}
    if "finalized_at" not in columns:
        return  # An older schema is protected only after its explicit migration.
    for key, table, operation, condition in _rules(tables):
        name = f"kaya_retain_{key}"
        if dialect == "sqlite":
            # SQLite's IS NOT gives the same null-safe comparison as PostgreSQL.
            condition = condition.replace("IS DISTINCT FROM", "IS NOT")
            connection.exec_driver_sql(
                f"CREATE TRIGGER IF NOT EXISTS {name} BEFORE {operation} ON {table} "
                f"WHEN {condition} BEGIN SELECT RAISE(ABORT, 'finalized_clinical_record_is_retained'); END"
            )
        else:
            connection.exec_driver_sql(
                f"CREATE OR REPLACE FUNCTION {name}() RETURNS trigger LANGUAGE plpgsql AS $$ "
                f"BEGIN IF {condition} THEN RAISE EXCEPTION 'finalized_clinical_record_is_retained' "
                f"USING ERRCODE = '23514'; END IF; RETURN {'OLD' if operation == 'DELETE' else 'NEW'}; END; $$"
            )
            connection.exec_driver_sql(f"DROP TRIGGER IF EXISTS {name} ON {table}")
            connection.exec_driver_sql(
                f"CREATE TRIGGER {name} BEFORE {operation} ON {table} FOR EACH ROW EXECUTE FUNCTION {name}()"
            )


def remove_retention_guards(connection):
    for key, table, _, _ in _rules(set(inspect(connection).get_table_names())):
        name = f"kaya_retain_{key}"
        suffix = f" ON {table}" if connection.dialect.name == "postgresql" else ""
        connection.exec_driver_sql(f"DROP TRIGGER IF EXISTS {name}{suffix}")
        if connection.dialect.name == "postgresql":
            connection.exec_driver_sql(f"DROP FUNCTION IF EXISTS {name}()")


def _after_create(metadata, connection, **kwargs):
    install_retention_guards(connection)


def register_retention_guards(metadata):
    if not event.contains(metadata, "after_create", _after_create):
        event.listen(metadata, "after_create", _after_create)
