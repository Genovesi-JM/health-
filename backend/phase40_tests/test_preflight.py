"""Phase 40 pre-flight release gate: environment isolation, synthetic-only
staging, fail-closed go/no-go aggregation (release-board hold, non-green gates,
missing/agent sign-offs, and separation of duties all block).
"""
from __future__ import annotations

from app import preflight as PF


def _staging(**kw):
    base = dict(name="staging", database_url="postgres://stg", domain="staging.kaya",
                uses_synthetic_data=True, credentials_ref="kv/stg")
    base.update(kw)
    return PF.Environment(**base)


def _prod(**kw):
    base = dict(name="production", database_url="postgres://prod", domain="app.kaya",
                uses_synthetic_data=False, credentials_ref="kv/prod")
    base.update(kw)
    return PF.Environment(**base)


def _all_signoffs():
    people = {"clinical_safety": "Dr A", "legal": "L B", "privacy": "P C",
              "security": "S D", "accessibility": "A E", "operations": "O F"}
    return [PF.SignOff(role=r, approver=p) for r, p in people.items()]


def _green_gates():
    return {f"phase{n}": PF.GREEN for n in range(2, 40)}


# ── Environment isolation ────────────────────────────────────────────────────

def test_isolated_environments():
    assert PF.environments_isolated(_staging(), _prod())


def test_shared_db_not_isolated():
    assert not PF.environments_isolated(_staging(database_url="postgres://prod"), _prod())


def test_shared_domain_or_creds_not_isolated():
    assert not PF.environments_isolated(_staging(domain="app.kaya"), _prod())
    assert not PF.environments_isolated(_staging(credentials_ref="kv/prod"), _prod())


def test_staging_must_be_synthetic():
    assert PF.staging_data_is_synthetic(_staging())
    assert not PF.staging_data_is_synthetic(_staging(uses_synthetic_data=False))


# ── Sign-offs ────────────────────────────────────────────────────────────────

def test_signoff_validity():
    assert PF.signoff_valid(PF.SignOff("legal", "Counsel"))
    assert not PF.signoff_valid(PF.SignOff("legal", "agent"))
    assert not PF.signoff_valid(PF.SignOff("legal", "X", is_agent=True))
    assert not PF.signoff_valid(PF.SignOff("unknown_role", "X"))


def test_all_signoffs_present():
    assert PF.all_signoffs_present(_all_signoffs())
    assert not PF.all_signoffs_present(_all_signoffs()[:-1])   # missing operations


def test_separation_of_duties():
    good = _all_signoffs()
    assert PF.signoffs_separation_ok(good)
    dup = _all_signoffs()
    dup[1] = PF.SignOff(role="legal", approver="Dr A")         # same person as clinical_safety
    assert not PF.signoffs_separation_ok(dup)


# ── Full pre-flight ──────────────────────────────────────────────────────────

def test_go_when_everything_green():
    r = PF.preflight(_green_gates(), _staging(), _prod(), _all_signoffs(), release_board_hold=False)
    assert r.go, r.blocking


def test_hold_blocks():
    r = PF.preflight(_green_gates(), _staging(), _prod(), _all_signoffs(), release_board_hold=True)
    assert not r.go and any("HOLD" in b for b in r.blocking)


def test_external_or_unknown_gate_blocks():
    gates = _green_gates()
    gates["phase25"] = PF.EXTERNAL
    gates["phase99"] = PF.UNKNOWN
    r = PF.preflight(gates, _staging(), _prod(), _all_signoffs(), release_board_hold=False)
    assert not r.go
    assert any("phase25" in b for b in r.blocking)
    assert any("phase99" in b for b in r.blocking)


def test_missing_signoff_blocks():
    r = PF.preflight(_green_gates(), _staging(), _prod(), _all_signoffs()[:-2], release_board_hold=False)
    assert not r.go and any("missing sign-offs" in b for b in r.blocking)


def test_non_synthetic_staging_blocks():
    r = PF.preflight(_green_gates(), _staging(uses_synthetic_data=False), _prod(),
                     _all_signoffs(), release_board_hold=False)
    assert not r.go and any("synthetic" in b for b in r.blocking)


def test_no_gates_blocks():
    r = PF.preflight({}, _staging(), _prod(), _all_signoffs(), release_board_hold=False)
    assert not r.go and any("no phase gates" in b for b in r.blocking)
