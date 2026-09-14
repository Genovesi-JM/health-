"""Independent negative tests for the informational Phase 1 boundary."""
import builtins
import importlib.util
import json
import socket
import sys
import types
from copy import deepcopy
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


APP = Path(__file__).resolve().parents[1] / "app"
ENDPOINT = "/api/v1/public/pilot-scope"


def valid_policy():
    return {
        "policy_version": 1,
        "planning": {"country_code": "AO", "country_name": "Angola", "city": "Luanda",
                     "decision_status": "SELECTED_BY_USER", "approval_scope": "planning_only",
                     "formal_jurisdiction_status": "BLOCKED_EXTERNAL"},
        "release": {"status": "HOLD", "approved_jurisdictions": [], "default_client_profile": "informational",
                    "unknown_jurisdiction_profile": "informational", "real_participants_enabled": False,
                    "external_communications_enabled": False, "provider_calls_enabled": False,
                    "public_metadata_endpoint": {"method": "GET", "path": ENDPOINT},
                    "unlisted_api_action": "DENY_503", "unlisted_ui_action": "INFORMATIONAL_ONLY"},
        "feature_flags": {"triage": False},
        "capabilities": [{"id": "triage", "label": "Triage", "state": "DISABLED_PENDING_GATE",
                          "default_enabled": False, "synthetic_test_state": "PRESERVED_SOURCE",
                          "api_bindings": [{"method": "POST", "path": "/api/v1/triage/start"}],
                          "ui_routes": ["/triage"], "included_in_pilot": False}],
    }


@pytest.fixture
def boundary(monkeypatch, tmp_path):
    monkeypatch.delenv("KAYA_EXECUTION_MODE", raising=False)
    original_import = builtins.__import__

    def guarded_import(name, *args, **kwargs):
        if name in {"config", "database", "routers", "seed_data", "synthetic_runtime"} or name.startswith(("app.config", "app.database", "app.routers", "app.synthetic_runtime", "sqlalchemy")):
            pytest.fail("Informational metadata attempted a clinical import: " + name)
        return original_import(name, *args, **kwargs)

    def blocked(*args, **kwargs):
        pytest.fail("Informational metadata attempted a network connection")

    monkeypatch.setattr(builtins, "__import__", guarded_import)
    monkeypatch.setattr(socket, "create_connection", blocked)
    monkeypatch.setattr(socket.socket, "connect", blocked)
    package = types.ModuleType("phase1_test_app")
    package.__path__ = [str(APP)]
    monkeypatch.setitem(sys.modules, "phase1_test_app", package)
    loaded = {}
    for name in ("phase1_policy", "main"):
        fullname = "phase1_test_app." + name
        spec = importlib.util.spec_from_file_location(fullname, APP / (name + ".py"))
        module = importlib.util.module_from_spec(spec)
        monkeypatch.setitem(sys.modules, fullname, module)
        spec.loader.exec_module(module)
        loaded[name] = module
    path = tmp_path / "policy.json"
    path.write_text(json.dumps(valid_policy()))
    monkeypatch.setattr(loaded["phase1_policy"], "POLICY_PATH", path)
    with TestClient(loaded["main"].app) as client:
        yield client, path, loaded["phase1_policy"]


@pytest.mark.parametrize("jurisdiction", [None, "AO", "AO-Luanda", "PT", "unknown", "", "null", "../../AO"])
def test_explicit_or_unknown_jurisdiction_never_enables_clinical_use(boundary, jurisdiction):
    client, _, _ = boundary
    params = {} if jurisdiction is None else {"jurisdiction": jurisdiction, "country": jurisdiction}
    response = client.get(ENDPOINT, params=params)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HOLD"
    assert data["service_mode"] == "informational_only"
    assert data["clinical_operations"] == "disabled"
    assert data["planning"]["approval_scope"] == "planning_only"
    assert data["planning"]["formal_jurisdiction_status"] == "BLOCKED_EXTERNAL"
    assert data["release"]["approved_jurisdictions"] == []
    assert all(value is False for value in data["feature_flags"].values())
    assert all(capability["default_enabled"] is False for capability in data["capabilities"])
    assert response.headers["cache-control"] == "no-store"


def test_locale_currency_ip_region_and_provider_configuration_are_not_jurisdiction(boundary, monkeypatch):
    client, _, _ = boundary
    baseline = client.get(ENDPOINT).json()
    for name, value in {"KAYA_ENABLE_TRIAGE": "true", "KAYA_FEATURE_TRIAGE": "true", "KAYA_JURISDICTION": "PT",
                        "COUNTRY": "PT", "CURRENCY": "EUR", "LANGUAGE": "pt", "TZ": "Europe/Lisbon",
                        "AZURE_REGION": "westeurope", "OPENAI_API_KEY": "synthetic-not-a-key",
                        "VIDEO_PROVIDER": "production", "STRIPE_SECRET_KEY": "synthetic-not-a-key"}.items():
        monkeypatch.setenv(name, value)
    response = client.get(ENDPOINT, params={"language": "pt", "currency": "EUR", "city": "Lisbon", "triage_enabled": "true"},
                          headers={"Accept-Language": "pt-PT", "X-Forwarded-For": "192.0.2.1", "CF-IPCountry": "PT",
                                   "X-Country": "PT", "X-Jurisdiction": "PT", "X-Kaya-Execution-Mode": "live"})
    assert response.status_code == 200
    assert response.json() == baseline


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD", "TRACE", "CONNECT"])
def test_metadata_is_get_only(boundary, method):
    client, _, _ = boundary
    assert client.request(method, ENDPOINT, content=b'{"triage":true}').status_code == 503


@pytest.mark.parametrize("method,path", [
    ("POST", "/auth/register"), ("POST", "/auth/register/doctor"), ("POST", "/auth/google/onboarding"),
    ("POST", "/api/v1/triage/start"), ("POST", "/api/v1/consultations/book"),
    ("POST", "/api/v1/teleconsultations/example/join"), ("POST", "/api/v1/consultations/example/prescription"),
    ("POST", "/api/v1/billing/webhook/stripe"), ("GET", "/api/v1/billing/consultation/example/payment-status"),
    ("GET", "/api/v1/shop/payments/example/status"), ("POST", "/api/v1/chatbot/public-guidance"),
    ("POST", "/api/v1/contact"), ("POST", "/chat"), ("GET", "/api/v1/files/example"),
    ("GET", "/health"), ("GET", "/api/v1/public/pilot-scope/"), ("GET", "/unknown"),
])
def test_informational_exception_cannot_reach_clinical_or_legacy_paths(boundary, method, path):
    client, _, _ = boundary
    response = client.request(method, path)
    assert response.status_code == 503
    assert response.json()["clinical_operations"] == "disabled"


@pytest.mark.parametrize("field,value", [
    ("policy_version", True), ("planning", None), ("planning.country_code", ["AO"]),
    ("planning.approval_scope", "clinical"), ("planning.formal_jurisdiction_status", "APPROVED"),
    ("release", []), ("release.status", "LIVE"), ("release.approved_jurisdictions", ["AO"]),
    ("release.approved_jurisdictions", {}), ("release.default_client_profile", "clinical"),
    ("release.provider_calls_enabled", True), ("feature_flags", []), ("feature_flags.triage", 0),
    ("feature_flags.triage", True), ("capabilities", {}), ("capabilities", []),
])
def test_malformed_policy_and_activation_attempts_fail_closed(boundary, field, value):
    client, path, _ = boundary
    data = valid_policy()
    target = data
    parts = field.split(".")
    for part in parts[:-1]:
        target = target[part]
    target[parts[-1]] = value
    path.write_text(json.dumps(data))
    response = client.get(ENDPOINT)
    assert response.status_code == 503
    assert response.json()["clinical_operations"] == "disabled"
    assert "policy.json" not in response.text


@pytest.mark.parametrize("field,value", [
    ("id", []), ("label", {}), ("state", "PILOT"), ("state", "LIVE"), ("state", []),
    ("default_enabled", "false"), ("default_enabled", True), ("synthetic_test_state", "PASSED"),
    ("included_in_pilot", "false"), ("api_bindings", {}), ("api_bindings", [None]),
    ("api_bindings", [{"method": [], "path": "/test"}]), ("ui_routes", [None]),
])
def test_malformed_capability_never_raises_500(boundary, field, value):
    client, path, _ = boundary
    data = valid_policy()
    data["capabilities"][0][field] = value
    path.write_text(json.dumps(data))
    assert client.get(ENDPOINT).status_code == 503


@pytest.mark.parametrize("case", ["duplicate_capability", "unknown_flag", "missing_flag", "missing_file", "invalid_json", "duplicate_json_key", "nonfinite_json", "invalid_unicode", "oversize"])
def test_unavailable_ambiguous_or_incomplete_policy_is_held(boundary, case):
    client, path, policy = boundary
    data = valid_policy()
    if case == "duplicate_capability":
        data["capabilities"].append(deepcopy(data["capabilities"][0]))
    elif case == "unknown_flag":
        data["feature_flags"]["unexpected"] = False
    elif case == "missing_flag":
        data["feature_flags"] = {}
    if case == "missing_file":
        path.unlink()
    elif case == "invalid_json":
        path.write_text("{")
    elif case == "duplicate_json_key":
        path.write_text('{"policy_version":1,"policy_version":1}')
    elif case == "nonfinite_json":
        path.write_text(json.dumps(data)[:-1] + ',"invalid":NaN}')
    elif case == "invalid_unicode":
        path.write_bytes(b"\xff")
    elif case == "oversize":
        path.write_bytes(b" " * (policy.MAX_POLICY_BYTES + 1))
    else:
        path.write_text(json.dumps(data))
    assert client.get(ENDPOINT).status_code == 503


def test_metadata_is_whitelisted_and_does_not_expose_internal_bindings(boundary):
    client, path, _ = boundary
    data = valid_policy()
    data["internal_note"] = "not-for-public-output"
    data["planning"]["internal_note"] = "not-for-public-output"
    data["capabilities"][0]["internal_note"] = "not-for-public-output"
    path.write_text(json.dumps(data))
    response = client.get(ENDPOINT)
    assert response.status_code == 200
    assert "not-for-public-output" not in response.text
    assert "api_bindings" not in response.text
    assert "ui_routes" not in response.text


def test_packaged_policy_is_valid_and_image_allows_only_reviewed_new_files(boundary, monkeypatch):
    _, _, policy = boundary
    monkeypatch.setattr(policy, "POLICY_PATH", APP / "kaya_policy.json")
    result = policy.public_pilot_scope()
    assert result["planning"]["country_code"] == "AO"
    assert result["planning"]["city"] == "Luanda"
    assert result["service_mode"] == "informational_only"
    allowlist = (APP.parent / ".dockerignore").read_text().splitlines()
    assert "!app/phase1_policy.py" in allowlist
    assert "!app/kaya_policy.json" in allowlist
    assert "!app/synthetic_runtime.py" not in allowlist
