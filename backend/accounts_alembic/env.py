from alembic import context
from sqlalchemy import engine_from_config, pool
from app.config import settings
from app.accounts.database import AccountsBase
from app.accounts import models
config = context.config
config.set_main_option("sqlalchemy.url", settings.accounts_database_url.replace("%", "%%"))
engine = engine_from_config(config.get_section(config.config_ini_section), prefix="sqlalchemy.", poolclass=pool.NullPool)
with engine.connect() as connection:
    context.configure(connection=connection, target_metadata=AccountsBase.metadata)
    with context.begin_transaction():
        context.run_migrations()
