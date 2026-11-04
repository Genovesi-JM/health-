#!/usr/bin/env python3
"""Generate held client/backend policy copies and the review matrix; --check detects drift."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from kaya_phase1_scope import validate_policy
from kaya_phase1_inventory import extract_inventory, extract_web_routes

REPO = Path(__file__).resolve().parents[1]
MIRRORS = ["backend/app/kaya_policy.json", "frontend/src/config/kayaPolicy.json", "mobile/src/config/kayaPolicy.json"]


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("Duplicate policy key: " + key)
        value[key] = item
    return value


def reject_constant(value):
    raise ValueError("Non-finite JSON value: " + value)


def generated_files(repo=REPO):
    policy = json.loads((repo / "policy/kaya_phase1_policy.json").read_text(), object_pairs_hook=unique_object, parse_constant=reject_constant)
    validate_policy(policy)
    inventory = extract_inventory(repo)
    bound = {(row["method"], row["path"]) for cap in policy["capabilities"] for row in cap["api_bindings"]}
    actual = {(row["method"], row["path"]) for row in inventory["routes"]}
    if actual != bound or inventory["mounted_router_count"] != policy["route_inventory"]["mounted_router_count"]:
        raise ValueError(f"API binding drift: unbound={sorted(actual-bound)}, stale={sorted(bound-actual)}")
    legacy = repo / "frontend/src/LegacyApp.tsx"
    if not legacy.exists():
        legacy = repo / "frontend/src/App.tsx"
    routes = extract_web_routes(legacy.read_text())
    ui_bound = {route for cap in policy["capabilities"] for route in cap["ui_routes"]} | set(policy["ui_boundary"]["informational_routes"])
    if routes != ui_bound:
        raise ValueError(f"UI binding drift: unbound={sorted(routes-ui_bound)}, stale={sorted(ui_bound-routes)}")
    encoded = json.dumps(policy, indent=2, ensure_ascii=False) + "\n"
    lines = ["# Kaya Phase 1 capability matrix", "", "Generated from [canonical policy](../policy/kaya_phase1_policy.json). Run `python3 scripts/generate_kaya_policy.py --check` to verify mirrors, mounted API declarations and web route coverage. Do not edit generated files.", "", "**Planning: Angola first, initially Luanda; Portugal preparation in parallel. Release policy: HOLD. All feature flags are false.** Market configuration supplies display and formatting data, never care eligibility or activation. `included_in_pilot` identifies a future design dependency, never an enabled service. Legacy implementation evidence does not establish correctness or approval.", "", "## Target markets", "", "Select a clinic timezone explicitly from its market's supported IANA zones. Portugal has no default city or timezone; daylight-saving rules depend on the selected zone and date. Locale, currency and device settings do not choose a service country.", "", "| Market | Launch role | Initial city | Locale | Currency | Clinic timezones |", "| --- | --- | --- | --- | --- | --- |"]
    for market in policy["planning"]["target_markets"]:
        lines.append(f"| {market['country_name']} (`{market['country_code']}`) | {market['launch_role']} | {market['initial_city'] or 'Not selected'} | `{market['locale']}` | `{market['currency']}` | {', '.join('`'+zone+'`' for zone in market['timezones'])} |")
    lines += ["", "## Capability status", "", "States: NOT_BUILT, MOCK, SYNTHETIC_ONLY, DISABLED_PENDING_GATE, PILOT, LIVE. No capability is PILOT or LIVE. The preserved backend synthetic fixture is isolated test source; the public runtime does not expose it.", "", "| Capability / flag | Current state | Source evidence | Proposed pilot dependency | API bindings | Legacy web routes |", "| --- | --- | --- | --- | --- | --- |"]
    for cap in policy["capabilities"]:
        lines.append(f"| {cap['label']} (`{cap['id']}=false`) | {cap['state']} | {cap['synthetic_test_state']} | {'Yes' if cap['included_in_pilot'] else 'No'} | {len(cap['api_bindings'])} | {', '.join('`'+route+'`' for route in cap['ui_routes']) or 'None declared'} |")
    lines += ["", "Only `GET /api/v1/public/pilot-scope` exposes public planning metadata, without clinical imports or storage. Every other default API path/method is denied with 503/no-store, including unmounted legacy and unknown endpoints. Web informational pages and native reference-source limitations are recorded in the canonical `ui_boundary`. Existing deployments/binaries are not changed by this source checkpoint.", "", "## Exact preserved API bindings", "", "All bindings below have default state disabled. The inventory parses mounted source declarations without importing the clinical app. Future route additions or removals require an explicit policy update.", "", "| Method | Path | Capability flag |", "| --- | --- | --- |"]
    for cap in policy["capabilities"]:
        for row in cap["api_bindings"]:
            lines.append(f"| {row['method']} | `{row['path']}` | `{cap['id']}=false` |")
    return {**{name: encoded for name in MIRRORS}, "docs/KAYA_CAPABILITY_MATRIX.md": "\n".join(lines) + "\n"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    generated = generated_files()
    drift = []
    for name, value in generated.items():
        target = REPO / name
        if args.check:
            if not target.exists() or target.read_text() != value:
                drift.append(name)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(value)
    if drift:
        raise SystemExit("Generated policy drift: " + ", ".join(drift))
    print(f"Phase 1 policy {'verified' if args.check else 'generated'}: {len(generated)} artifacts; release HOLD")


if __name__ == "__main__":
    main()
