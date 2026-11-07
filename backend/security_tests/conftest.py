"""Isolated security regressions: no dotenv, real DB, mail, or network access."""
from __future__ import annotations

import socket
import sys
from pathlib import Path

import pytest
from pydantic_settings import BaseSettings
from pydantic_settings.sources import DotEnvSettingsSource, EnvSettingsSource

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Settings imports normally read an absolute backend/.env. Replace every
# source BEFORE importing application modules; no real configuration is read.
_original_sources = BaseSettings.__dict__["settings_customise_sources"]
# Pydantic constructs default sources before calling the customization hook;
# suppress their eager loaders too, not merely the selected source list.
_original_dotenv_loader = DotEnvSettingsSource._read_env_files
_original_env_loader = EnvSettingsSource._load_env_vars
DotEnvSettingsSource._read_env_files = lambda self: {}
EnvSettingsSource._load_env_vars = lambda self: {}
BaseSettings.settings_customise_sources = classmethod(
    lambda cls, settings_cls, **kwargs: (lambda: {
        "env": "test",
        "secret_key": "isolated-security-test-signing-key-not-for-production",
        "database_url": "sqlite://",
        "accounts_database_url": "sqlite://",
    },)
)
try:
    from app.config import settings
finally:
    BaseSettings.settings_customise_sources = _original_sources
    DotEnvSettingsSource._read_env_files = _original_dotenv_loader
    EnvSettingsSource._load_env_vars = _original_env_loader


@pytest.fixture(autouse=True)
def no_external_io(monkeypatch, tmp_path):
    def blocked(*args, **kwargs):
        raise AssertionError("External network/email is forbidden in security tests")

    monkeypatch.setattr(socket, "create_connection", blocked)
    monkeypatch.setattr(socket.socket, "connect", blocked)
    monkeypatch.setattr(socket.socket, "connect_ex", blocked)
    monkeypatch.setenv("KAYA_DISABLE_RATE_LIMIT", "1")
    for key in ("DO_SPACES_KEY", "DO_SPACES_SECRET", "DO_SPACES_ENDPOINT"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(settings, "env", "test")
    from app import mail
    monkeypatch.setattr(mail, "_send_email", blocked)
    monkeypatch.setattr(mail, "send_reset_email", blocked)


@pytest.fixture
def db(tmp_path):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.database import Base
    from app import models, health_models  # noqa: F401

    engine = create_engine(f"sqlite:///{tmp_path / 'security-test.sqlite'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


@pytest.fixture
def client(db, monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.database import get_db
    from app.routers import auth, mfa

    monkeypatch.setattr(auth, "log_audit", lambda *a, **kw: None)
    monkeypatch.setattr(mfa, "log_audit", lambda *a, **kw: None)
    # Avoid slow bcrypt; these tests cover authorization, not password hashing.
    monkeypatch.setattr(auth, "hash_password", lambda value: f"test-hash:{value}")
    monkeypatch.setattr(auth, "verify_password", lambda value, hashed: hashed == f"test-hash:{value}")
    app = FastAPI()
    app.include_router(auth.router)
    app.include_router(mfa.router)
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as test_client:
        yield test_client
