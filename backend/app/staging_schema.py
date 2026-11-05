"""Explicit owner-only staging migrations; never called by ASGI startup."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.pool import NullPool

ROOT = Path(__file__).resolve().parents[1]
HOST = 'pg-kaya-stage-iloie6.postgres.database.azure.com'
LEGACY_HEAD = 'reconcile_model_columns_v1'


def config():
    result = Config(str(ROOT / 'alembic.ini'))
    result.set_main_option('script_location', str(ROOT / 'alembic'))
    return result


def schema_status(connection):
    from app.database import Base
    from app import models, health_models  # noqa: F401
    inspector = inspect(connection)
    tables = set(inspector.get_table_names())
    missing_tables = sorted(set(Base.metadata.tables) - tables)
    missing_columns, required_extra = {}, {}
    for name, table in Base.metadata.tables.items():
        if name not in tables:
            continue
        columns = inspector.get_columns(name)
        missing = sorted(set(table.columns.keys()) - {item['name'] for item in columns})
        if missing:
            missing_columns[name] = missing
        extra = sorted(item['name'] for item in columns if item['name'] not in table.columns
                       and not item['nullable'] and item.get('default') is None
                       and not item.get('identity') and not item.get('computed'))
        if extra:
            required_extra[name] = extra
    heads = sorted(connection.execute(text('SELECT version_num FROM alembic_version')).scalars())
    expected = sorted(ScriptDirectory.from_config(config()).get_heads())
    return dict(tables=len(tables), model_tables=len(Base.metadata.tables), heads=heads,
                expected_heads=expected, missing_tables=missing_tables,
                missing_columns=missing_columns, required_extra_columns=required_extra,
                ready=not (missing_tables or missing_columns or required_extra or heads != expected))


def fingerprint(connection):
    """Schema and row counts only; no patient values or credentials leave the DB."""
    inspector = inspect(connection)
    result = {}
    quote = connection.dialect.identifier_preparer.quote
    for name in sorted(inspector.get_table_names()):
        result[name] = dict(columns=inspector.get_columns(name),
                            indexes=inspector.get_indexes(name),
                            foreign_keys=inspector.get_foreign_keys(name),
                            checks=inspector.get_check_constraints(name),
                            primary_key=inspector.get_pk_constraint(name),
                            rows=connection.exec_driver_sql('SELECT count(*) FROM ' + quote(name)).scalar())
    result['heads'] = list(connection.execute(text('SELECT version_num FROM alembic_version ORDER BY version_num')).scalars())
    return hashlib.sha256(json.dumps(result, sort_keys=True, default=str).encode()).hexdigest()


def upgrade(connection):
    heads = set(connection.execute(text('SELECT version_num FROM alembic_version')).scalars())
    expected = set(ScriptDirectory.from_config(config()).get_heads())
    if heads not in ({LEGACY_HEAD}, {'reconcile_db_extra_cols_v1'}, expected):
        raise RuntimeError('Unreviewed staging revision; migration refused')
    connection.execute(text("SET LOCAL lock_timeout='10s'"))
    connection.execute(text("SET LOCAL statement_timeout='120s'"))
    if not connection.execute(text('SELECT pg_try_advisory_xact_lock(20261105, 1)')).scalar():
        raise RuntimeError('Another Kaya migration holds the lock')
    cfg = config()
    cfg.attributes['connection'] = connection
    command.upgrade(cfg, 'head')
    result = schema_status(connection)
    if not result['ready']:
        raise RuntimeError('Post-migration schema validation failed')
    # Existing owner default privileges must already give the runtime DML only.
    for name in inspect(connection).get_table_names():
        if not all(connection.execute(text(
            "SELECT has_table_privilege('kaya_stage_app', :name, :privilege)"
        ), {'name': 'public.' + name, 'privilege': privilege}).scalar()
                   for privilege in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')):
            raise RuntimeError('Runtime table access is incomplete')
    if connection.execute(text("SELECT has_schema_privilege('kaya_stage_app','public','CREATE')")).scalar():
        raise RuntimeError('Runtime must not own schema creation')
    return result


def run(mode):
    os.environ['KAYA_MANAGED_SCHEMA'] = 'true'
    url = make_url(os.environ['KAYA_ADMIN_DATABASE_URL'])
    if (url.host, url.database, url.username) != (HOST, 'kaya', 'stageowner'):
        raise RuntimeError('Refusing a target outside the verified Kaya staging owner')
    engine = create_engine(url, poolclass=NullPool, hide_parameters=True,
                           connect_args={'connect_timeout': 12})
    try:
        with engine.connect() as connection:
            before = schema_status(connection)
            digest = fingerprint(connection)
            connection.rollback()
            if mode == 'check':
                return dict(mode=mode, schema=before, fingerprint=digest)
            transaction = connection.begin()
            try:
                after = upgrade(connection)
                if mode == 'apply':
                    transaction.commit()
                else:
                    transaction.rollback()
            except BaseException:
                transaction.rollback()
                raise
            if mode == 'rehearse':
                if fingerprint(connection) != digest:
                    raise RuntimeError('Rehearsal rollback verification failed')
            else:
                if not schema_status(connection)['ready']:
                    raise RuntimeError('Committed schema validation failed')
            return dict(mode=mode, before=before, after=after,
                        committed=mode == 'apply', rollback_verified=mode == 'rehearse')
    finally:
        engine.dispose()
