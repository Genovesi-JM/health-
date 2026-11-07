# Ensure backend package is importable when pytest runs from the repo root.
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import importlib
import pytest
import os
import tempfile

# Disable rate limiting during tests (identical calls in quick succession).
os.environ["KAYA_DISABLE_RATE_LIMIT"] = "1"

# Configure tests to use a temporary on-disk SQLite database so the test
# suite always starts from a clean schema and multiple engine objects (which
# may be created during import/collection) all point to the same DB file.
from app.config import settings

tmpdir = tempfile.gettempdir()
db_path = os.path.join(tmpdir, f"geovision_test_{os.getpid()}.db")
settings.database_url = f"sqlite:///{db_path}"

print(f"[tests.conftest] using test database file: {db_path}")

# Ensure previous run's file is removed so we start clean
try:
    if os.path.exists(db_path):
        os.remove(db_path)
except Exception:
    pass

# Initialize the DB engine lazily with the test DB URL, then create tables.
import app.database as _db
_db.init_db_engine(settings.database_url)

# Import models and create tables
import app.models as _models
import app.health_models as _health_models  # Health platform models
from app.database import Base, engine
Base.metadata.create_all(bind=engine)

# Ensure demo users exist (avoid seeding codepath differences). We insert
# minimal demo users directly so tests relying on them (demo login) pass.
from app.models import User
from app.utils import hash_password
sess = _db.SessionLocal()
try:
    for email, role in (("teste@admin.com", "admin"), ("teste@clientes.com", "cliente")):
        u = sess.query(User).filter(User.email == email).first()
        if not u:
            sess.add(User(email=email, password_hash=hash_password("123456"), role=role, is_active=True))
    sess.commit()
finally:
    sess.close()


@pytest.fixture(scope="session", autouse=True)
def _cleanup_db_file():
    """Ensure the temporary DB file is removed at session end."""
    yield
    try:
        if os.path.exists(db_path):
            os.remove(db_path)
    except Exception:
        pass


@pytest.fixture(scope="function")
def db_session():
    """Provides a SQLAlchemy session connected to the in-memory DB."""
    session = _db.SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="session")
def client():
    """FastAPI TestClient against the operational app on the shared test DB.

    Session-scoped so the app (and its one-time seed) is built once for the whole
    suite instead of per test — the tests share the same on-disk test DB anyway.
    app.main is now the Phase-0 hold stub, so build the operational factory.
    """
    from app.factory import create_app
    from fastapi.testclient import TestClient

    app = create_app()
    with TestClient(app) as c:
        yield c
