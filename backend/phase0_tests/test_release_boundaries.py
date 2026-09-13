"""Offline regressions for the Phase 0 server and deployment entry points."""
import ast
import builtins
import importlib.util
import json
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect


BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent


def load_source(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def reject_clinical_imports(monkeypatch):
    original_import = builtins.__import__

    def guarded_import(name, *args, **kwargs):
        if name in {"config", "database", "synthetic_runtime", "seed_data", "alembic"} or name.startswith(("app.config", "app.database", "app.routers", "app.synthetic_runtime", "app.seed_data", "sqlalchemy", "alembic")):
            raise AssertionError(f"Clinical or database import attempted: {name}")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", guarded_import)


@pytest.mark.parametrize("method", ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD", "TRACE", "CONNECT"])
def test_hold_survives_methods_headers_and_invalid_body(monkeypatch, reject_clinical_imports, method):
    monkeypatch.setenv("KAYA_EXECUTION_MODE", "hold")
    monkeypatch.setenv("ENV", "production")
    module = load_source("release_hold", BACKEND / "app/main.py")
    assert module.app.routes == []
    with TestClient(module.app) as client:
        response = client.request(
            method, "/api/v1/triage?mode=synthetic",
            content=b"{invalid-json",
            headers={"Content-Type": "application/json", "X-HTTP-Method-Override": "GET", "X-Forwarded-Proto": "https", "X-Kaya-Execution-Mode": "synthetic"},
        )
    assert response.status_code == 503
    assert response.headers["cache-control"] == "no-store"
    if method != "HEAD":
        assert response.json()["clinical_operations"] == "disabled"


def test_hold_has_no_websocket_surface(monkeypatch, reject_clinical_imports):
    monkeypatch.delenv("KAYA_EXECUTION_MODE", raising=False)
    module = load_source("release_hold_ws", BACKEND / "app/main.py")
    with TestClient(module.app) as client:
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/api/v1/teleconsultation"):
                pytest.fail("A held API must not accept WebSocket connections")


@pytest.mark.parametrize("mode,env,dotenv", [(None, "test", False), ("hold", "test", False), ("synthetic", "production", False), ("synthetic", "test", True)])
def test_direct_synthetic_import_is_guarded_before_settings(monkeypatch, reject_clinical_imports, mode, env, dotenv):
    if mode is None:
        monkeypatch.delenv("KAYA_EXECUTION_MODE", raising=False)
    else:
        monkeypatch.setenv("KAYA_EXECUTION_MODE", mode)
    monkeypatch.setenv("ENV", env)
    monkeypatch.setattr(Path, "exists", lambda self: dotenv)
    with pytest.raises(RuntimeError, match="clinical launch remains on HOLD"):
        load_source("release_synthetic", BACKEND / "app/synthetic_runtime.py")


def test_synthetic_module_has_no_eager_asgi_app_and_is_not_in_image():
    tree = ast.parse((BACKEND / "app/synthetic_runtime.py").read_text())
    for node in tree.body:
        if isinstance(node, ast.Assign):
            assert all(not isinstance(target, ast.Name) or target.id != "app" for target in node.targets)
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            assert node.target.id != "app"
    allowlist = (BACKEND / ".dockerignore").read_text().splitlines()
    assert "**" in allowlist
    assert "!app/synthetic_runtime.py" not in allowlist
    assert not any(line.startswith("!app/") and "*" in line for line in allowlist)


def test_python_server_starts_only_hold_without_database_work(monkeypatch, reject_clinical_imports):
    monkeypatch.delenv("KAYA_EXECUTION_MODE", raising=False)
    monkeypatch.setenv("PORT", "8123")
    calls = []
    monkeypatch.setitem(sys.modules, "uvicorn", SimpleNamespace(run=lambda *args, **kwargs: calls.append((args, kwargs))))
    module = load_source("release_start", BACKEND / "start.py")
    module.main()
    assert calls == [(("app.main:app",), {"host": "0.0.0.0", "port": 8123})]


@pytest.mark.parametrize("mode", ["synthetic", "production", ""])
def test_python_server_cannot_select_clinical_runtime(monkeypatch, reject_clinical_imports, mode):
    monkeypatch.setenv("KAYA_EXECUTION_MODE", mode)
    module = load_source("release_start_denied", BACKEND / "start.py")
    with pytest.raises(SystemExit, match="HOLD"):
        module.main()


def test_container_starts_held_api_without_migration_command():
    source = (BACKEND / "Dockerfile").read_text()
    runtime = source.split("FROM runtime AS security-test", 1)[0]
    command = json.loads(next(line[4:] for line in runtime.splitlines() if line.startswith("CMD ")))
    assert command[:2] == ["gunicorn", "app.main:app"]
    assert not {"sh", "alembic", "upgrade", "seed"}.intersection(command)
    assert "KAYA_EXECUTION_MODE=hold" in runtime
    assert "FROM runtime AS production" in source


@pytest.mark.parametrize("script", ["deploy/update.sh", "deploy/setup-droplet.sh"])
def test_deployment_script_exits_before_external_commands(tmp_path, script):
    sentinel = tmp_path / "external-command-ran"
    command_dir = tmp_path / "bin"
    command_dir.mkdir()
    for command in ("ssh", "docker", "git", "curl", "scp"):
        stub = command_dir / command
        stub.write_text('#!/bin/sh\n: > "$PHASE0_SENTINEL"\nexit 99\n')
        stub.chmod(0o700)
    result = subprocess.run(
        ["/bin/bash", str(REPO / script), "example.invalid"],
        cwd=tmp_path,
        env={"PATH": str(command_dir), "PHASE0_SENTINEL": str(sentinel), "KAYA_EXECUTION_MODE": "synthetic"},
        capture_output=True, text=True, timeout=5,
    )
    assert result.returncode == 1
    assert "HOLD" in result.stderr
    assert not sentinel.exists()


def test_checked_in_hosted_definitions_pin_hold_and_disable_autodeploy():
    compose = (REPO / "docker-compose.yml").read_text().split("  backend:", 1)[1]
    compose_prod = (REPO / "docker-compose.prod.yml").read_text().split("  backend:", 1)[1].split("  frontend:", 1)[0]
    assert "KAYA_EXECUTION_MODE: hold" in compose
    assert "KAYA_EXECUTION_MODE=hold" in compose_prod
    render = (REPO / "render.yaml").read_text()
    assert 'autoDeployTrigger: "off"' in render
    assert "gunicorn app.main:app" in render
    assert "key: KAYA_EXECUTION_MODE\n        value: hold" in render
    assert "--factory" not in render
    pages_deploy = (REPO / ".github/workflows/deploy.yml").read_text().split("  deploy:", 1)[1]
    assert "if: ${{ false }}" in pages_deploy
