from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

import os
import sys

# Alembic owns schema changes. Model imports must never bootstrap tables.
os.environ["KAYA_MANAGED_SCHEMA"] = "true"
from pathlib import Path

# permite importar app/*
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.database import Base
from app import models  # All models now consolidated in models.py
from app import health_models  # Health platform models

from app.config import DATABASE_URL

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
config.set_main_option("sqlalchemy.url", DATABASE_URL.replace("%", "%%"))


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    def migrate(connection):
        # Existing historical revision names exceed Alembic's 32-character default.
        connection.exec_driver_sql(
            "CREATE TABLE IF NOT EXISTS alembic_version ("
            "version_num VARCHAR(255) NOT NULL PRIMARY KEY)"
        )
        if connection.dialect.name == "postgresql":
            connection.exec_driver_sql(
                "ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(255)"
            )
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

    # Release tooling supplies an owner connection and controls the transaction.
    connection = config.attributes.get("connection")
    if connection is not None:
        migrate(connection)
        return
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.", poolclass=pool.NullPool,
    )
    with connectable.begin() as connection:
        migrate(connection)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
