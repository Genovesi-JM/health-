"""Private Azure staging schema ownership and secret-free verification."""
import os
import json
from pathlib import Path
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from alembic.config import Config
from alembic.script import ScriptDirectory
from app.config import settings

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_HOST = 'pg-kaya-stage-iloie6.postgres.database.azure.com'

def _assert_target(url, database):
    parsed = make_url(url)
    if parsed.host != EXPECTED_HOST or parsed.database != database:
        raise RuntimeError('Refusing a database outside isolated Kaya staging')

def _config(accounts=False):
    config = Config(str(ROOT / ('accounts_alembic.ini' if accounts else 'alembic.ini')))
    config.set_main_option('script_location', str(ROOT / ('accounts_alembic' if accounts else 'alembic')))
    return config

def verify_schema():
    from app.database import Base
    from app import models, health_models
    from app.accounts.database import AccountsBase
    from app.accounts import models as accounts_models
    results = {}
    for name, url, metadata, separate in [('kaya',settings.database_url,Base.metadata,False),('kaya_accounts',settings.accounts_database_url,AccountsBase.metadata,True)]:
        _assert_target(url,name)
        with create_engine(url,pool_pre_ping=True).connect() as connection:
            tables=set(inspect(connection).get_table_names())
            missing=set(metadata.tables)-tables
            heads=set(connection.execute(text('SELECT version_num FROM alembic_version')).scalars())
            expected=set(ScriptDirectory.from_config(_config(separate)).get_heads())
            results[name]={'tables':sorted(tables),'tableCount':len(tables),'missingModelTables':sorted(missing),'heads':sorted(heads),'expectedHeads':sorted(expected)}
            if missing or heads != expected:
                print('KAYA_SCHEMA_INCOMPLETE '+json.dumps(results[name]),flush=True)
                raise RuntimeError('Kaya schema is incomplete or not at packaged head')
    return results

def migrate():
    from alembic import command
    from psycopg2 import sql
    admin_url=os.environ['KAYA_ADMIN_DATABASE_URL']; _assert_target(admin_url,'kaya')
    engine=create_engine(admin_url,pool_pre_ping=True)
    password=os.environ['KAYA_APP_PASSWORD']
    with engine.begin() as connection:
        exists=connection.execute(text("SELECT 1 FROM pg_roles WHERE rolname='kaya_stage_app'")).scalar()
        dbapi=connection.connection.driver_connection
        statement=sql.SQL('ALTER ROLE {} WITH LOGIN PASSWORD {}') if exists else sql.SQL('CREATE ROLE {} WITH LOGIN PASSWORD {}')
        with dbapi.cursor() as cursor:
            cursor.execute(statement.format(sql.Identifier('kaya_stage_app'),sql.Literal(password)))
    # Run the checked-in migration chains as owner. Never stamp or create_all.
    old_main=settings.database_url; old_accounts=settings.accounts_database_url
    settings.database_url=admin_url
    settings.accounts_database_url=str(make_url(admin_url).set(database='kaya_accounts').render_as_string(hide_password=False))
    import app.config as config_module
    old_compat=config_module.DATABASE_URL; config_module.DATABASE_URL=admin_url
    try:
        command.upgrade(_config(False),'head')
        command.upgrade(_config(True),'head')
        for database in ['kaya','kaya_accounts']:
            with create_engine(make_url(admin_url).set(database=database)).begin() as connection:
                connection.execute(text('REVOKE CREATE ON SCHEMA public FROM PUBLIC'))
                connection.execute(text('GRANT CONNECT ON DATABASE '+database+' TO kaya_stage_app'))
                connection.execute(text('GRANT USAGE ON SCHEMA public TO kaya_stage_app'))
                connection.execute(text('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kaya_stage_app'))
                connection.execute(text('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kaya_stage_app'))
                connection.execute(text('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kaya_stage_app'))
                connection.execute(text('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO kaya_stage_app'))
    finally:
        settings.database_url=old_main;settings.accounts_database_url=old_accounts;config_module.DATABASE_URL=old_compat
    print('KAYA_SCHEMA '+json.dumps(verify_schema()),flush=True)
