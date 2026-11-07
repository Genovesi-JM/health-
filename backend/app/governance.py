"""Machine-checkable governance for Kaya's safety-led transformation.

This module turns the governance model (RACI, risk taxonomy, change control,
release board) into fail-closed evaluators. It imports no clinical settings,
no database, and no request context; it carries no secrets or health data.

Core invariants enforced here:
- A code commit alone can never represent an approval.
- The release board defaults to HOLD and fails closed on missing, expired,
  contradictory, environment-mismatched, or unknown evidence; an open P0
  stops the release.
- Risk acceptance is explicit, expiring, and attributable, and is unavailable
  to the change author (and to the coding agent) for high-impact risks. P0 is
  never acceptable.
- The evidence index is append-only: existing records are never rewritten,
  only superseded by new appended records.
"""
from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from typing import Any, Iterable, Optional


GOVERNANCE_PATH = Path(__file__).with_name("kaya_governance.json")
MAX_GOVERNANCE_BYTES = 1_000_000

# Best-effort tripwires so governance records never carry secrets or health data.
_SECRET_MARKERS = re.compile(
    r"(?i)(BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|password\s*[:=]|secret\s*[:=]|bearer\s+[A-Za-z0-9._-]{12,})"
)
# Target genuine patient-data identifiers, not governance vocabulary. A policy
# that says "must not diagnose" is not health data; a person's record is.
_HEALTH_MARKERS = re.compile(
    r"(?i)(date of birth|\bDOB\b|blood type|\bICD-?10\b|\bMRN\b|\bNHS number\b|patient (?:name|diagnos\w*|record|id)\b)"
)


class GovernanceError(ValueError):
    """Any missing or invalid governance input must fail closed."""


def _require(condition: bool, message: str = "Governance input is invalid") -> None:
    if not condition:
        raise GovernanceError(message)


def _reject_nonfinite(value: str) -> None:  # pragma: no cover - defensive
    raise GovernanceError("Non-finite JSON constants are not allowed")


def _unique_object(pairs: list[tuple[str, Any]]) -> dict:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise GovernanceError(f"Duplicate governance key: {key}")
        result[key] = value
    return result


def load_governance(path: Path = GOVERNANCE_PATH) -> dict[str, Any]:
    """Load and structurally validate the governance policy, or fail closed."""
    try:
        raw = path.read_bytes()
    except OSError as exc:
        raise GovernanceError("Governance policy is unavailable") from exc
    _require(0 < len(raw) <= MAX_GOVERNANCE_BYTES, "Governance policy size is invalid")
    try:
        data = json.loads(
            raw.decode("utf-8"),
            object_pairs_hook=_unique_object,
            parse_constant=_reject_nonfinite,
        )
    except (ValueError, UnicodeDecodeError) as exc:
        raise GovernanceError("Governance policy is not valid JSON") from exc
    _require(isinstance(data, dict), "Governance policy must be an object")
    for section in ("roles", "raci", "risk_taxonomy", "change_control", "release_board", "separation_of_duties"):
        _require(section in data, f"Governance policy missing section: {section}")
    return data


def _parse_date(value: Any) -> date:
    _require(isinstance(value, str) and value, "A required date is missing")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise GovernanceError(f"Invalid date: {value!r}") from exc


def _nonempty_str(value: Any) -> bool:
    return isinstance(value, str) and value.strip() != ""


# ── Change control ───────────────────────────────────────────────────────────

def required_reviewers(category: str, governance: Optional[dict] = None) -> dict[str, Any]:
    """Return required reviewer/approver roles for a change category.

    An unknown category fails closed rather than defaulting to 'no review'.
    """
    gov = governance or load_governance()
    categories = gov["change_control"]["categories"]
    if category not in categories:
        raise GovernanceError(f"Unknown change category: {category!r}")
    entry = categories[category]
    approver = entry["required_approver"]
    _require(approver != gov["separation_of_duties"]["coding_agent_role"],
             "The coding agent may not be an approver")
    return {"required_reviewers": list(entry["required_reviewers"]), "required_approver": approver}


# ── Risk acceptance ──────────────────────────────────────────────────────────

def validate_risk_acceptance(acceptance: dict[str, Any], *, today: Optional[date] = None,
                             governance: Optional[dict] = None) -> None:
    """Raise unless a residual-risk acceptance is explicit, unexpired,
    attributable, independent of the change author for high impact, and never
    a P0. Silence means valid."""
    gov = governance or load_governance()
    today = today or date.today()
    tax = gov["risk_taxonomy"]

    _require(isinstance(acceptance, dict), "Risk acceptance must be an object")
    for field in tax["acceptance_required_fields"]:
        _require(field in acceptance and _nonempty_str(str(acceptance.get(field, ""))),
                 f"Risk acceptance missing field: {field}")

    severity = acceptance["residual_severity"]
    _require(severity in tax["severity_scale"], f"Unknown residual severity: {severity!r}")
    if severity == "P0" or tax.get("p0_acceptance_prohibited"):
        _require(severity != "P0", "P0 risk can never be accepted; it must be closed")

    decision = _parse_date(acceptance["decision_date"])
    expiry = _parse_date(acceptance["expiry_date"])
    _require(decision <= today, "Risk acceptance decision date is in the future")
    _require(expiry > today, "Risk acceptance has expired")

    role = acceptance["accepted_by_role"]
    _require(role in gov["roles"], f"Unknown accepting role: {role!r}")
    _require(not gov["roles"][role].get("approval_prohibited"),
             "This role may not accept risk")
    _require(role != gov["separation_of_duties"]["coding_agent_role"],
             "The coding agent may not accept risk")

    high_impact = severity in gov["separation_of_duties"]["high_impact_severities"]
    if high_impact:
        _require(acceptance["accepted_by_person"] != acceptance["change_author"],
                 "High-impact risk cannot be accepted by the change author")


# ── Release board ────────────────────────────────────────────────────────────

_COMMIT_ONLY = re.compile(r"^[0-9a-f]{7,40}$")


def release_decision(submission: dict[str, Any], *, today: Optional[date] = None,
                     governance: Optional[dict] = None) -> str:
    """Return GO, LIMITED_GO, HOLD, or STOP. Fails closed to HOLD; an open P0
    returns STOP. Missing evidence never defaults to approval."""
    gov = governance or load_governance()
    today = today or date.today()
    board = gov["release_board"]
    default = board["default_verdict"]
    if not isinstance(submission, dict):
        return default

    # An open P0 stops everything, regardless of gate state.
    open_p0 = submission.get("open_p0")
    if open_p0:  # truthy: True or a non-empty list of P0 ids
        return board["stop_verdict"]

    environment = submission.get("environment")
    if not _nonempty_str(environment):
        return default

    gates = submission.get("gates")
    if not isinstance(gates, dict):
        return default

    all_approved = True
    for gate_id in board["gate_ids"]:
        gate = gates.get(gate_id)
        if not isinstance(gate, dict):
            return default  # missing_gate

        status = gate.get("status")
        if status not in board["allowed_gate_status"]:
            return default  # unknown_status

        if status == "REJECTED":
            return default  # a rejection is never GO
        if status in ("OPEN",):
            all_approved = False
            continue
        if status == "NOT_APPLICABLE":
            continue

        # status == APPROVED — demand real, current, correctly-scoped human evidence.
        if status != board["approved_status"]:
            all_approved = False
            continue

        approver_person = gate.get("approver_person")
        approver_role = gate.get("approver_role")
        evidence_link = gate.get("evidence_link")

        # A code commit alone can never represent an approval.
        if not _nonempty_str(approver_person):
            return default  # commit_only / missing human approver
        if not _nonempty_str(evidence_link) or _COMMIT_ONLY.match(str(evidence_link).strip()):
            return default  # missing_evidence / commit_only_approval

        # Correct authority: the approver's role must own the gate.
        expected_owner = board["gate_owner"].get(gate_id)
        if approver_role != expected_owner:
            return default  # contradictory / wrong authority

        # Environment must match the submission.
        if gate.get("evidence_environment") != environment:
            return default  # environment_mismatch

        # Evidence must be unexpired.
        expiry = gate.get("expiry_date")
        try:
            if _parse_date(expiry) < today:
                return default  # expired_evidence
        except GovernanceError:
            return default  # missing/invalid expiry

        # Explicit contradiction marker.
        if gate.get("contradictory"):
            return default

    if not all_approved:
        return default  # some gate still OPEN → HOLD

    # Every required gate is APPROVED or NOT_APPLICABLE with valid evidence.
    requested = submission.get("requested_verdict", "GO")
    if requested == "LIMITED_GO" and _nonempty_str(submission.get("limited_scope")):
        return "LIMITED_GO"
    return "GO"


# ── Append-only evidence index ───────────────────────────────────────────────

_EVIDENCE_FIELDS = (
    "id", "requirement", "code_ref", "test_ref", "build_digest",
    "environment", "reviewer_role", "decision_date", "status",
)


def validate_evidence_record(record: dict[str, Any], governance: Optional[dict] = None) -> None:
    """Raise unless an evidence record is complete and free of secrets/health data."""
    gov = governance or load_governance()
    _require(isinstance(record, dict), "Evidence record must be an object")
    for field in _EVIDENCE_FIELDS:
        _require(field in record and _nonempty_str(str(record.get(field, ""))),
                 f"Evidence record missing field: {field}")
    role = record["reviewer_role"]
    _require(role in gov["roles"], f"Unknown reviewer role: {role!r}")
    blob = json.dumps(record, ensure_ascii=False)
    _require(not _SECRET_MARKERS.search(blob), "Evidence record may contain a secret")
    _require(not _HEALTH_MARKERS.search(blob), "Evidence record may contain health data")
    if record.get("supersedes") is not None:
        _require(_nonempty_str(str(record["supersedes"])), "supersedes must be an id or null")


def verify_append_only(previous: Iterable[str], current: Iterable[str]) -> None:
    """Raise if any previously-recorded evidence line was changed or removed.

    Append-only means the new log must extend the old one without rewriting it.
    """
    prev = list(previous)
    curr = list(current)
    _require(len(curr) >= len(prev), "Evidence index shrank; append-only violated")
    for i, line in enumerate(prev):
        _require(curr[i] == line, f"Evidence line {i} was modified; append-only violated")


class EvidenceIndex:
    """In-memory append-only decision & evidence index.

    Ties requirement → code → test → build digest → environment → reviewer →
    decision date → supersession. Existing ids are immutable; a change is
    recorded by appending a superseding record.
    """

    def __init__(self, governance: Optional[dict] = None) -> None:
        self._governance = governance or load_governance()
        self._records: list[dict[str, Any]] = []
        self._ids: set[str] = set()
        self._superseded: set[str] = set()

    def append(self, record: dict[str, Any]) -> None:
        validate_evidence_record(record, self._governance)
        rid = record["id"]
        if rid in self._ids:
            raise GovernanceError(f"Evidence id already exists (immutable): {rid}")
        supersedes = record.get("supersedes")
        if supersedes is not None:
            if supersedes not in self._ids:
                raise GovernanceError(f"Cannot supersede unknown id: {supersedes}")
            self._superseded.add(supersedes)
        self._records.append(dict(record))
        self._ids.add(rid)

    def active(self) -> list[dict[str, Any]]:
        return [r for r in self._records if r["id"] not in self._superseded]

    def all_records(self) -> list[dict[str, Any]]:
        return list(self._records)

    def as_lines(self) -> list[str]:
        return [json.dumps(r, ensure_ascii=False, sort_keys=True) for r in self._records]


# ── Self check ───────────────────────────────────────────────────────────────

def governance_self_check(governance: Optional[dict] = None) -> dict[str, Any]:
    """Structural integrity check usable by tests and CI. Never returns secrets."""
    gov = governance or load_governance()
    blob = json.dumps(gov, ensure_ascii=False)
    _require(not _SECRET_MARKERS.search(blob), "Governance policy may contain a secret")
    _require(not _HEALTH_MARKERS.search(blob), "Governance policy may contain health data")

    roles = gov["roles"]
    # Every RACI accountable role and gate owner must be a defined role.
    for entry in gov["raci"]:
        _require(entry["accountable"] in roles, f"RACI accountable role undefined: {entry['accountable']}")
    for gate_id, owner in gov["release_board"]["gate_owner"].items():
        _require(owner in roles, f"Gate owner undefined for {gate_id}: {owner}")
    _require(gov["release_board"]["default_verdict"] == "HOLD", "Release board must default to HOLD")
    _require(gov["risk_taxonomy"].get("p0_acceptance_prohibited") is True, "P0 must be non-acceptable")
    _require(roles[gov["separation_of_duties"]["coding_agent_role"]].get("approval_prohibited") is True,
             "Coding agent must be approval-prohibited")
    return {
        "roles": len(roles),
        "raci_functions": len(gov["raci"]),
        "gates": len(gov["release_board"]["gate_ids"]),
        "change_categories": len(gov["change_control"]["categories"]),
    }
