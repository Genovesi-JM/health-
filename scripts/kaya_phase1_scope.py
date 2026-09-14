"""Validate the held planning contract and simulate draft stop rules offline.

This is not an admission, clinical assessment, telemetry collector, or approval
engine. Passing a synthetic scenario never changes the release HOLD.
"""
from __future__ import annotations

import math

STATES = {"NOT_BUILT", "MOCK", "SYNTHETIC_ONLY", "DISABLED_PENDING_GATE", "PILOT", "LIVE"}
METRICS = {
    "safety_boundary_violation_count", "failed_escalation_count",
    "privacy_unauthorized_disclosure_count", "credential_invalid_confirmation_count",
    "booking_conflict_count", "staffed_coverage_ratio", "pending_request_count",
    "support_unacknowledged_staffed_minutes", "booking_completion_ratio",
    "critical_boundary_comprehension_ratio",
}
ZERO_TOLERANCE = {
    "safety_boundary_violation_count", "failed_escalation_count",
    "privacy_unauthorized_disclosure_count", "credential_invalid_confirmation_count",
    "booking_conflict_count",
}
METRIC_CONTRACT = {
    **{key: {"kind": "count", "operator": "max", "threshold": 0, "breach_action": "HOLD"} for key in ZERO_TOLERANCE},
    "staffed_coverage_ratio": {"kind": "ratio", "operator": "min", "threshold": 1.0, "breach_action": "CLOSE_BOOKING_WINDOW"},
    "pending_request_count": {"kind": "count", "operator": "max", "threshold": 5, "breach_action": "PAUSE_ADMISSION", "at_limit_action": "REJECT_NEW_REQUESTS"},
    "support_unacknowledged_staffed_minutes": {"kind": "duration_minutes", "operator": "max", "threshold": 30, "breach_action": "PAUSE_ADMISSION"},
    "booking_completion_ratio": {"kind": "ratio", "operator": "min", "threshold": 0.9, "minimum_sample": 10, "window_days": 7, "breach_action": "PAUSE_ADMISSION"},
    "critical_boundary_comprehension_ratio": {"kind": "ratio", "operator": "min", "threshold": 0.9, "minimum_sample": 10, "required_evidence_kind": "consented_human_evaluation", "individual_failure_blocks_admission": True, "breach_action": "HOLD"},
}
OWNER_ROLES = {"operator", "licensed_clinic", "clinical_safety", "data_controller", "privacy", "security", "operations", "credentialing", "language_accessibility", "release_board"}


def require(condition):
    if not condition:
        raise ValueError("Invalid held planning contract")


def validate_policy(policy):
    """Raise ValueError if this Phase 1 artifact could misrepresent a release."""
    try:
        require(type(policy["policy_version"]) is int and policy["policy_version"] == 1)
        release, planning, pilot = (policy[key] for key in ("release", "planning", "pilot"))
        require(release["status"] == pilot["launch_status"] == "HOLD")
        require(release["approved_jurisdictions"] == [])
        require(release["default_client_profile"] == release["unknown_jurisdiction_profile"] == "informational")
        for key in ("real_participants_enabled", "external_communications_enabled", "provider_calls_enabled"):
            require(release[key] is False)
        require(planning["approval_scope"] == "planning_only")
        require(planning["decision_status"] == "SELECTED_BY_USER")
        require(planning["formal_jurisdiction_status"] == "BLOCKED_EXTERNAL")
        require(planning["country_code"] == pilot["country_code"] == "AO")
        require(planning["city"] == pilot["city"] == "Luanda")
        require(pilot["execution_mode"] == "synthetic_only")
        require(pilot["real_participants_enabled"] is False and pilot["automatic_resume"] is False)
        require(pilot["metric_status"] == "DRAFT_REQUIRES_HUMAN_APPROVAL")
        for key in ("clinic_id", "operator_id", "clinical_owner_id", "data_controller_id", "start_date", "end_date"):
            require(pilot[key] is None)
        require(pilot["age_min"] == 18 and pilot["invited_only"] is True)
        require(pilot["clinic_count"] == 1 and pilot["timezone"] == "Africa/Luanda")
        require(pilot["schedule"]["staffed_dates"] == [])
        require(pilot["schedule"]["approval_status"] == "BLOCKED_EXTERNAL")
        require(pilot["schedule"]["holiday_calendar"] is None)
        require(pilot["schedule"]["weekdays"] == ["MON", "TUE", "WED", "THU", "FRI"])
        require(pilot["schedule"]["start_local"] == "09:00" and pilot["schedule"]["end_local_exclusive"] == "13:00")
        require(pilot["schedule"]["staffing_requirements"] == {"authorized_coordinator_count": 1, "verified_primary_care_clinician_count": 1, "approval_status": "BLOCKED_EXTERNAL"})
        require(pilot["capacity"] == {"max_invited_adults": 25, "max_confirmed_appointments_per_day": 5, "max_pending_requests": 5, "proposed_appointment_minutes": 30})
        require(all(type(value) is int for value in pilot["capacity"].values()))
        require(pilot["duration_days"] == 14 and pilot["coordination_target_staffed_minutes"] == 30)
        require(len(pilot["owners"]) == len(OWNER_ROLES) and {owner["role"] for owner in pilot["owners"]} == OWNER_ROLES)
        require(all(owner["assigned_person"] is None and owner["status"] == "BLOCKED_EXTERNAL" for owner in pilot["owners"]))
        caps = policy["capabilities"]
        ids = [cap["id"] for cap in caps]
        require(ids and len(ids) == len(set(ids)))
        require(set(ids) == set(policy["feature_flags"]))
        require(all(value is False for value in policy["feature_flags"].values()))
        bindings = []
        for cap in caps:
            require(cap["state"] in STATES - {"PILOT", "LIVE"})
            require(cap["default_enabled"] is False)
            require(type(cap["included_in_pilot"]) is bool)
            require(isinstance(cap["label"], str) and cap["label"])
            bindings.extend((entry["method"], entry["path"]) for entry in cap["api_bindings"])
        require(len(bindings) == len(set(bindings)) == policy["route_inventory"]["mounted_route_count"])
        metrics = pilot["metrics"]
        require(len(metrics) == len(METRICS) and {metric["id"] for metric in metrics} == METRICS)
        for metric in metrics:
            contract = METRIC_CONTRACT[metric["id"]]
            require(all(metric.get(key) == value and type(metric.get(key)) is type(value) for key, value in contract.items()))
            require(isinstance(metric["owner_role"], str) and bool(metric["owner_role"].strip()))
            require(metric["kind"] in {"count", "ratio", "duration_minutes"})
            require(metric["operator"] in {"min", "max"})
            require(type(metric["threshold"]) in {int, float} and math.isfinite(metric["threshold"]))
            require(metric["threshold"] >= 0)
            require(metric["breach_action"] in {"HOLD", "CLOSE_BOOKING_WINDOW", "PAUSE_ADMISSION"})
            if metric["kind"] == "ratio":
                require(metric["threshold"] <= 1)
        require(pilot["capacity"]["max_pending_requests"] == next(m["threshold"] for m in metrics if m["id"] == "pending_request_count"))
    except (AssertionError, KeyError, TypeError, AttributeError, ValueError) as exc:
        raise ValueError("Invalid Phase 1 planning policy; release remains HOLD") from exc


def evaluate_draft_metrics(policy, observations, events=()):
    """Evaluate already-aggregated synthetic scenarios; always return HOLD.

    Human-evaluation provenance is a required input to the comprehension rule,
    not evidence generated or verified by this function. No patient data belongs
    in observations. Unknown/missing/invalid inputs block rather than pass.
    """
    validate_policy(policy)
    rows, actions = [], set()
    if not isinstance(observations, dict) or set(observations) != METRICS:
        return {"release_status": "HOLD", "assessment": "INDETERMINATE", "actions": ["BLOCK"], "metrics": []}
    if not isinstance(events, (list, tuple)) or events:
        actions.add("HOLD")
    for metric in policy["pilot"]["metrics"]:
        row = observations[metric["id"]]
        valid = isinstance(row, dict)
        value = row.get("value") if valid else None
        valid = valid and type(value) in {int, float} and math.isfinite(value) and value >= 0
        if valid and metric["kind"] == "count":
            valid = type(value) is int
        if valid and metric["kind"] == "ratio":
            valid = value <= 1
            sample = row.get("sample_size")
            valid = valid and type(sample) is int and sample >= metric.get("minimum_sample", 1)
        if valid and metric.get("required_evidence_kind"):
            valid = row.get("evidence_kind") == metric["required_evidence_kind"]
            individual_failures = row.get("individual_failure_count")
            valid = valid and type(individual_failures) is int and individual_failures >= 0
        if not valid:
            state = "INDETERMINATE"
            actions.add("BLOCK")
        else:
            breached = (value > metric["threshold"] if metric["operator"] == "max" else value < metric["threshold"])
            if metric.get("individual_failure_blocks_admission") and row["individual_failure_count"] > 0:
                breached = True
            state = "BREACHED" if breached else "WITHIN_DRAFT_LIMIT"
            if breached:
                actions.add(metric["breach_action"])
            elif value == metric["threshold"] and metric.get("at_limit_action"):
                actions.add(metric["at_limit_action"])
        rows.append({"id": metric["id"], "assessment": state})
    assessment = "BREACHED" if actions - {"BLOCK", "REJECT_NEW_REQUESTS"} else "INDETERMINATE" if "BLOCK" in actions else "WITHIN_DRAFT_LIMITS"
    return {"release_status": "HOLD", "assessment": assessment, "actions": sorted(actions), "metrics": rows}
