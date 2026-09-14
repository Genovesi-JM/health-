"""Read informational planning metadata without importing clinical configuration.

The packaged policy is data, never an activation switch. Phase 1 accepts only
HOLD policies with every capability disabled; request context and environment
variables are deliberately absent from this module.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


POLICY_PATH = Path(__file__).with_name("kaya_policy.json")
MAX_POLICY_BYTES = 1_000_000
_HELD_STATES = {"NOT_BUILT", "MOCK", "SYNTHETIC_ONLY", "DISABLED_PENDING_GATE"}
_TEST_STATES = {"UNVERIFIED", "PRESERVED_SOURCE", "NOT_BUILT", "MOCK"}
_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "WEBSOCKET"}


class PolicyUnavailable(ValueError):
    """Missing or invalid planning metadata must leave the API on HOLD."""


def _require(condition: bool) -> None:
    if not condition:
        raise PolicyUnavailable("Planning policy is unavailable")


def _object(value: Any) -> dict:
    _require(isinstance(value, dict))
    return value


def _text(value: Any, limit: int = 200) -> str:
    _require(isinstance(value, str) and bool(value.strip()) and len(value) <= limit)
    return value


def _unique_object(pairs: list[tuple[str, Any]]) -> dict:
    result = {}
    for key, value in pairs:
        _require(key not in result)
        result[key] = value
    return result


def _reject_nonfinite(value: str) -> None:
    raise PolicyUnavailable("Planning policy is unavailable")


def public_pilot_scope() -> dict[str, Any]:
    """Return an explicitly informational view of a validated, disabled policy."""
    try:
        with POLICY_PATH.open("rb") as handle:
            raw = handle.read(MAX_POLICY_BYTES + 1)
        _require(len(raw) <= MAX_POLICY_BYTES)
        policy = _object(json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_object, parse_constant=_reject_nonfinite))
        _require(type(policy.get("policy_version")) is int and policy["policy_version"] == 1)

        planning = _object(policy.get("planning"))
        country_code = _text(planning.get("country_code"), 2)
        _require(re.fullmatch(r"[A-Z]{2}", country_code) is not None)
        country_name = _text(planning.get("country_name"))
        city = _text(planning.get("city"))
        _require(planning.get("decision_status") == "SELECTED_BY_USER")
        _require(planning.get("approval_scope") == "planning_only")
        _require(planning.get("formal_jurisdiction_status") == "BLOCKED_EXTERNAL")

        release = _object(policy.get("release"))
        _require(release.get("status") == "HOLD")
        _require(type(release.get("approved_jurisdictions")) is list and not release["approved_jurisdictions"])
        _require(release.get("default_client_profile") == "informational")
        _require(release.get("unknown_jurisdiction_profile") == "informational")
        _require(all(release.get(key) is False for key in (
            "real_participants_enabled", "external_communications_enabled", "provider_calls_enabled",
        )))
        endpoint = _object(release.get("public_metadata_endpoint"))
        _require(endpoint.get("method") == "GET" and endpoint.get("path") == "/api/v1/public/pilot-scope")
        _require(release.get("unlisted_api_action") == "DENY_503")
        _require(release.get("unlisted_ui_action") == "INFORMATIONAL_ONLY")

        flags = _object(policy.get("feature_flags"))
        _require(bool(flags) and all(value is False for value in flags.values()))
        capabilities = policy.get("capabilities")
        _require(isinstance(capabilities, list) and bool(capabilities))
        ids = set()
        public_capabilities = []
        for item in capabilities:
            capability = _object(item)
            identifier = _text(capability.get("id"), 100)
            _require(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", identifier) is not None)
            _require(identifier not in ids)
            ids.add(identifier)
            label = _text(capability.get("label"))
            state = _text(capability.get("state"))
            _require(state in _HELD_STATES)
            _require(capability.get("default_enabled") is False)
            test_state = _text(capability.get("synthetic_test_state"))
            _require(test_state in _TEST_STATES)
            included = capability.get("included_in_pilot")
            _require(type(included) is bool)
            bindings = capability.get("api_bindings")
            ui_routes = capability.get("ui_routes")
            _require(isinstance(bindings, list) and isinstance(ui_routes, list))
            for binding in bindings:
                route = _object(binding)
                _require(_text(route.get("method")) in _METHODS)
                _require(_text(route.get("path"), 500).startswith("/"))
            for route in ui_routes:
                _require(_text(route, 500).startswith("/"))
            public_capabilities.append({
                "id": identifier,
                "label": label,
                "state": state,
                "default_enabled": False,
                "synthetic_test_state": test_state,
                "included_in_pilot": included,
            })
        _require(set(flags) == ids)
    except (OSError, UnicodeError, ValueError, TypeError, RecursionError) as exc:
        raise PolicyUnavailable("Planning policy is unavailable") from exc

    return {
        "policy_version": 1,
        "status": "HOLD",
        "service_mode": "informational_only",
        "clinical_operations": "disabled",
        "planning": {
            "country_code": country_code,
            "country_name": country_name,
            "city": city,
            "decision_status": "SELECTED_BY_USER",
            "approval_scope": "planning_only",
            "formal_jurisdiction_status": "BLOCKED_EXTERNAL",
        },
        "release": {
            "status": "HOLD",
            "approved_jurisdictions": [],
            "default_client_profile": "informational",
        },
        "feature_flags": {identifier: False for identifier in flags},
        "capabilities": public_capabilities,
    }
