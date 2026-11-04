"""Tests independent of application settings, databases, and existing conftest."""
import importlib.util
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

PATH = Path(__file__).resolve().parents[1] / 'app' / 'main.py'


def load_hold():
    spec = importlib.util.spec_from_file_location('phase0_hold', PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize('method,path', [
    ('GET', '/health'), ('GET', '/api/v1/health'), ('POST', '/auth/register'),
    ('POST', '/api/v1/triage'), ('POST', '/api/v1/consultations'),
    ('POST', '/api/v1/webhooks/stripe'), ('GET', '/docs'),
    ('OPTIONS', '/api/v1/triage'), ('GET', '/unlisted-path'),
])
def test_default_denies_every_surface(monkeypatch, method, path):
    monkeypatch.delenv('KAYA_EXECUTION_MODE', raising=False)
    before = set(sys.modules)
    module = load_hold()
    with TestClient(module.app) as client:
        response = client.request(method, path)
    assert response.status_code == 503
    assert response.json()['clinical_operations'] == 'disabled'
    assert response.headers['cache-control'] == 'no-store'
    assert not ({'app.config', 'app.database', 'app.synthetic_runtime'} & (set(sys.modules) - before))


@pytest.mark.parametrize('mode', ['live', 'production', '', 'HOLD'])
def test_unknown_mode_cannot_activate_runtime(monkeypatch, mode):
    monkeypatch.setenv('KAYA_EXECUTION_MODE', mode)
    with pytest.raises(RuntimeError, match='HOLD'):
        load_hold()


def test_synthetic_rejects_production_environment(monkeypatch):
    monkeypatch.setenv('KAYA_EXECUTION_MODE', 'synthetic')
    monkeypatch.setenv('ENV', 'production')
    with pytest.raises(RuntimeError, match='ENV=test'):
        load_hold()


def test_synthetic_rejects_dotenv(monkeypatch):
    monkeypatch.setenv('KAYA_EXECUTION_MODE', 'synthetic')
    monkeypatch.setenv('ENV', 'test')
    monkeypatch.setattr(Path, 'exists', lambda self: True)
    with pytest.raises(RuntimeError, match='no backend/.env'):
        load_hold()
