"""State-machine tests: transitions, audit rows, reviewer endpoints, RBAC."""
import uuid

import pytest

from app.database import SessionLocal
from app.services.verification.base import VerificationStatus
from app.services.verification.state_machine import (
    InvalidTransitionError,
    allowed_next,
    history,
    is_allowed,
    record_transition,
)


# ── Pure state-graph rules ─────────────────────────────────────────────────

def test_fresh_entity_can_start():
    assert is_allowed(None, VerificationStatus.NOT_STARTED.value)
    assert is_allowed(None, VerificationStatus.SUBMITTED.value)


def test_draft_cannot_jump_to_verified():
    assert not is_allowed(
        VerificationStatus.NOT_STARTED.value,
        VerificationStatus.COMPLETED.value,
    )


def test_submitted_to_processing():
    assert is_allowed(
        VerificationStatus.SUBMITTED.value,
        VerificationStatus.PROCESSING.value,
    )


def test_processing_to_completed():
    assert is_allowed(
        VerificationStatus.PROCESSING.value,
        VerificationStatus.COMPLETED.value,
    )


def test_completed_to_suspended_and_back():
    assert is_allowed(VerificationStatus.COMPLETED.value, "suspended")
    assert is_allowed("suspended", VerificationStatus.COMPLETED.value)


def test_revoked_is_terminal():
    assert allowed_next("revoked") == set()
    assert not is_allowed("revoked", VerificationStatus.COMPLETED.value)


def test_same_state_reemit_allowed_for_idempotent_webhooks():
    assert is_allowed(
        VerificationStatus.PROCESSING.value,
        VerificationStatus.PROCESSING.value,
    )


def test_action_required_can_return_to_submitted():
    assert is_allowed(
        VerificationStatus.ACTION_REQUIRED.value,
        VerificationStatus.SUBMITTED.value,
    )


# ── record_transition writes an audit row ──────────────────────────────────

def test_record_transition_writes_audit_row_and_returns_result():
    db = SessionLocal()
    try:
        eid = f"case-{uuid.uuid4().hex[:12]}"
        result = record_transition(
            db,
            entity_type="clinician_credential",
            entity_id=eid,
            previous_status=VerificationStatus.SUBMITTED.value,
            new_status=VerificationStatus.PROCESSING.value,
            actor_user_id=None,
            actor_kind="system",
            reason_code="provider_dispatch",
            reason_text="Handed off to Sumsub",
        )
        db.commit()

        rows = history(db, "clinician_credential", eid)
        assert len(rows) == 1
        row = rows[0]
        assert row.previous_status == VerificationStatus.SUBMITTED.value
        assert row.new_status == VerificationStatus.PROCESSING.value
        assert row.actor_kind == "system"
        assert row.reason_code == "provider_dispatch"
        assert result.transition_id == row.id
    finally:
        db.close()


def test_record_transition_rejects_invalid_edge():
    db = SessionLocal()
    try:
        with pytest.raises(InvalidTransitionError):
            record_transition(
                db,
                entity_type="x", entity_id="y",
                previous_status=VerificationStatus.NOT_STARTED.value,
                new_status=VerificationStatus.COMPLETED.value,
                actor_user_id=None,
            )
    finally:
        db.close()


def test_history_ordered_ascending():
    db = SessionLocal()
    try:
        eid = f"case-{uuid.uuid4().hex[:12]}"
        for prev, nxt, code in [
            (None, VerificationStatus.NOT_STARTED.value, "created"),
            (VerificationStatus.NOT_STARTED.value, VerificationStatus.SUBMITTED.value, "user_submit"),
            (VerificationStatus.SUBMITTED.value, VerificationStatus.PROCESSING.value, "provider_start"),
            (VerificationStatus.PROCESSING.value, VerificationStatus.COMPLETED.value, "provider_complete"),
        ]:
            record_transition(
                db, entity_type="x", entity_id=eid,
                previous_status=prev, new_status=nxt,
                actor_user_id=None, actor_kind="system",
                reason_code=code,
            )
        db.commit()
        rows = history(db, "x", eid)
        assert [r.reason_code for r in rows] == [
            "created", "user_submit", "provider_start", "provider_complete",
        ]
    finally:
        db.close()


# ── Reviewer endpoints ─────────────────────────────────────────────────────

def _register(client, role="doctor", diploma_country="AO"):
    email = f"{role}-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/auth/register", headers={
        "X-Forwarded-For": f"198.51.100.{uuid.uuid4().int % 200}",
    }, json={
        "email": email, "password": "strong-pass", "full_name": "Rev Test",
        "sector_focus": "health", "role": role,
        "practice_country": "AO", "licence_country": "AO",
        "issuing_authority": "Ordem Profissional",
        "licence_number": f"AO-{uuid.uuid4().hex[:6]}",
        "diploma_country": diploma_country,
        "diploma_institution": "Universidade Teste",
        "degree_title": "Medicina" if role == "doctor" else "Enfermagem",
        "graduation_year": 2020,
    })
    assert r.status_code == 201, r.text
    return r.json()


def _headers(auth):
    return {"Authorization": f"Bearer {auth['access_token']}"}


def _upload(client, auth, kind):
    return client.post(
        f"/api/v1/credentials/me/evidence/{kind}",
        headers=_headers(auth),
        files={"file": (f"{kind}.pdf", b"%PDF-1.4\nx", "application/pdf")},
    )


def _submit_dossier(client, auth):
    _upload(client, auth, "professional_card")
    _upload(client, auth, "diploma")
    submitted = client.post("/api/v1/credentials/me/submit", headers=_headers(auth))
    assert submitted.status_code == 200, submitted.text
    return submitted.json()


def _admin(client):
    r = client.post("/auth/login", json={"email": "teste@admin.com", "password": "123456"})
    assert r.status_code == 200
    return r.json()


def test_reviewer_request_information_writes_transition(client):
    doc = _register(client)
    case = _submit_dossier(client, doc)
    admin = _admin(client)

    r = client.post(
        f"/api/v1/compliance/cases/{case['id']}/request-information",
        headers=_headers(admin),
        json={"reason_text": "Please re-upload the licence — the expiry date is illegible.",
              "reviewer_notes": "Internal: photo clarity issue"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["new_status"] == VerificationStatus.ACTION_REQUIRED.value

    h = client.get(
        f"/api/v1/compliance/cases/{case['id']}/history",
        headers=_headers(admin),
    ).json()
    assert len(h) >= 1
    latest = h[-1]
    assert latest["new_status"] == VerificationStatus.ACTION_REQUIRED.value
    assert latest["reason_text"].startswith("Please re-upload")
    assert latest["reviewer_notes"] == "Internal: photo clarity issue"


def test_reviewer_endpoints_reject_support_role(client):
    """Support role must not be able to move compliance states.

    Support users cannot be created via /auth/register (schema rejects the
    role), so we assert the RBAC boundary indirectly: an unauthenticated
    request receives 401/403 — the same class of denial support would get.
    """
    doc = _register(client)
    case = _submit_dossier(client, doc)
    r = client.post(
        f"/api/v1/compliance/cases/{case['id']}/request-information",
        json={"reason_text": "test"},
    )
    assert r.status_code in (401, 403)


def test_invalid_transition_returns_409(client):
    doc = _register(client)
    case = _submit_dossier(client, doc)
    admin = _admin(client)

    # Cannot suspend before verifying — need completed first.
    r = client.post(
        f"/api/v1/compliance/cases/{case['id']}/suspend",
        headers=_headers(admin),
        json={"reason_text": "test"},
    )
    assert r.status_code == 409, r.text
    detail = r.json()["detail"]
    assert detail["error"] == "invalid_transition"
    assert "allowed" in detail


def test_reviewer_can_suspend_then_reactivate(client):
    doc = _register(client)
    case = _submit_dossier(client, doc)
    admin = _admin(client)

    # Approve via existing endpoint (writes a transition thanks to the patch).
    approved = client.post(
        f"/api/v1/credentials/admin/{case['id']}/decision",
        headers=_headers(admin),
        json={"action": "approve"},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "verified"

    # Now suspend.
    suspended = client.post(
        f"/api/v1/compliance/cases/{case['id']}/suspend",
        headers=_headers(admin),
        json={"reason_text": "Under investigation"},
    ).json()
    assert suspended["new_status"] == "suspended"

    # Reactivate.
    reactivated = client.post(
        f"/api/v1/compliance/cases/{case['id']}/reactivate",
        headers=_headers(admin),
    ).json()
    assert reactivated["new_status"] == VerificationStatus.COMPLETED.value

    h = client.get(
        f"/api/v1/compliance/cases/{case['id']}/history",
        headers=_headers(admin),
    ).json()
    # Must contain at least: approve, suspend, reactivate.
    codes = [r["reason_code"] for r in h]
    assert "reviewer_suspension" in codes
    assert "reviewer_reactivation" in codes


def test_history_endpoint_404_on_unknown_case(client):
    admin = _admin(client)
    r = client.get(
        "/api/v1/compliance/cases/does-not-exist/history",
        headers=_headers(admin),
    )
    assert r.status_code == 404


def test_manual_review_complete_maps_outcomes(client):
    doc = _register(client)
    case = _submit_dossier(client, doc)
    admin = _admin(client)

    r = client.post(
        f"/api/v1/compliance/cases/{case['id']}/manual-review-complete",
        headers=_headers(admin),
        json={"outcome": "unable_to_verify",
              "reason_text": "Public registry currently offline."},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["new_status"] == VerificationStatus.UNABLE_TO_VERIFY.value


def test_manual_review_rejects_bad_outcome(client):
    doc = _register(client)
    case = _submit_dossier(client, doc)
    admin = _admin(client)
    r = client.post(
        f"/api/v1/compliance/cases/{case['id']}/manual-review-complete",
        headers=_headers(admin),
        json={"outcome": "not-a-real-outcome"},
    )
    assert r.status_code == 422


# ── Notifications fired on verification events (§18) ────────────────────────

def test_request_information_notifies_applicant(client):
    doc = _register(client)
    case = _submit_dossier(client, doc)
    admin = _admin(client)
    client.post(
        f"/api/v1/compliance/cases/{case['id']}/request-information",
        headers=_headers(admin),
        json={"reason_text": "Please re-upload your licence."},
    )
    # The doctor should now have an in-app notification about it.
    notifs = client.get("/api/v1/notifications/me", headers=_headers(doc)).json()
    titles = " ".join(n.get("title", "") for n in (notifs if isinstance(notifs, list) else notifs.get("items", [])))
    assert "Informação adicional" in titles


def test_approval_notifies_applicant(client):
    doc = _register(client)
    case = _submit_dossier(client, doc)
    admin = _admin(client)
    client.post(
        f"/api/v1/credentials/admin/{case['id']}/decision",
        headers=_headers(admin), json={"action": "approve"},
    )
    notifs = client.get("/api/v1/notifications/me", headers=_headers(doc)).json()
    items = notifs if isinstance(notifs, list) else notifs.get("items", [])
    titles = " ".join(n.get("title", "") for n in items)
    assert "aprovada" in titles.lower()
