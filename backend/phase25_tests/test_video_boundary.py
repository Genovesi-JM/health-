"""Phase 25 secure teleconsultation boundary: video disabled by default, no
public fallback, fail-closed token issuance, unguessable non-Kaya room ids,
recording off by default, waiting-room admission, authenticated idempotent
webhooks. A concrete provider adapter stays BLOCKED_EXTERNAL.
"""
from __future__ import annotations

import hashlib
import hmac
import re

import pytest

from app import video_boundary as V


# ── Enable gate: disabled by default, no public fallback ─────────────────────

def test_video_disabled_by_default():
    assert V.video_enabled(None, None) is False
    assert V.video_enabled("false", "https://approved.example") is False
    assert V.video_enabled("", "https://approved.example") is False


def test_video_requires_flag_and_base():
    assert V.video_enabled("true", "") is False          # no base → off
    assert V.video_enabled("true", None) is False
    assert V.video_enabled("true", "https://approved.example") is True


def test_no_public_fallback_when_base_unset():
    # An unset base can never resolve to a public room.
    with pytest.raises(V.VideoDisabledError):
        V.resolve_room_url(None, V.new_room_key(), "true")
    with pytest.raises(V.VideoDisabledError):
        V.resolve_room_url("", V.new_room_key(), "true")


def test_resolve_room_url_builds_only_when_enabled():
    key = V.new_room_key()
    url = V.resolve_room_url("https://approved.example/", key, "true")
    assert url == f"https://approved.example/{key}"
    with pytest.raises(V.VideoDisabledError):
        V.resolve_room_url("https://approved.example", key, "false")


# ── Unguessable, non-Kaya identifiers ────────────────────────────────────────

def test_room_key_is_unguessable_and_prefixed():
    k1, k2 = V.new_room_key(), V.new_room_key()
    assert k1 != k2
    assert k1.startswith("KAYA-")
    assert V._is_server_room_key(k1)


def test_room_key_independent_of_kaya_ids():
    key = V.new_room_key()
    assert V.room_key_is_independent_of(key, "consult-123", "patient-9", "appt-7")


def test_consultation_id_derived_room_rejected():
    # The old pattern KAYA-<consultation_id> must not pass as a server key.
    guessable = "KAYA-consult-123"
    assert not V._is_server_room_key(guessable)
    assert not V.room_key_is_independent_of("KAYA-consult-123", "consult-123")
    with pytest.raises(V.VideoBoundaryError):
        V.resolve_room_url("https://approved.example", guessable, "true")


def test_provider_session_id_is_opaque():
    a, b = V.new_provider_session_id(), V.new_provider_session_id()
    assert a != b and len(a) >= 24


# ── Token issuance fails closed ──────────────────────────────────────────────

def _ok_patient():
    return V.SessionContext(
        appointment_active=True, episode_open=True, identity_verified=True,
        mfa_satisfied=True, org_can_operate=True, consent_video_effective=True,
        role="patient", patient_authenticated=True,
    )


def _ok_doctor():
    return V.SessionContext(
        appointment_active=True, episode_open=True, identity_verified=True,
        mfa_satisfied=True, org_can_operate=True, consent_video_effective=True,
        role="doctor", clinician_privilege_ok=True,
    )


def test_default_context_denies_everything():
    assert not V.can_issue_token(V.SessionContext())


def test_full_context_can_issue():
    assert V.can_issue_token(_ok_patient())
    assert V.can_issue_token(_ok_doctor())


def test_any_missing_precondition_denies():
    for missing in ("appointment_active", "episode_open", "identity_verified",
                    "mfa_satisfied", "org_can_operate", "consent_video_effective"):
        ctx = V.SessionContext(**{**_ok_patient().__dict__, missing: False})
        assert not V.can_issue_token(ctx), missing
        with pytest.raises(V.TokenPreconditionError):
            V.issue_participant_token(ctx, V.new_room_key(), now_epoch=1000)


def test_clinician_without_privilege_denied():
    ctx = V.SessionContext(**{**_ok_doctor().__dict__, "clinician_privilege_ok": False})
    assert not V.can_issue_token(ctx)


def test_patient_not_authenticated_denied():
    ctx = V.SessionContext(**{**_ok_patient().__dict__, "patient_authenticated": False})
    assert not V.can_issue_token(ctx)


def test_missing_video_consent_denied():
    ctx = V.SessionContext(**{**_ok_patient().__dict__, "consent_video_effective": False})
    assert not V.can_issue_token(ctx)


# ── Token properties: short-lived, role-bound, recording off ─────────────────

def test_token_is_short_lived_and_role_bound():
    tok = V.issue_participant_token(_ok_patient(), V.new_room_key(), now_epoch=1000)
    assert tok.role == "patient"
    assert tok.expires_at_epoch == 1000 + 120
    assert V.token_valid(tok, 1100)
    assert not V.token_valid(tok, 2000)


def test_token_ttl_bounds_enforced():
    with pytest.raises(V.VideoBoundaryError):
        V.issue_participant_token(_ok_patient(), V.new_room_key(), now_epoch=0, ttl_seconds=0)
    with pytest.raises(V.VideoBoundaryError):
        V.issue_participant_token(_ok_patient(), V.new_room_key(), now_epoch=0, ttl_seconds=100000)


def test_recording_off_by_default():
    assert V.recording_default_enabled() is False
    tok = V.issue_participant_token(_ok_patient(), V.new_room_key(), now_epoch=1000)
    assert tok.recording_allowed is False
    tok2 = V.issue_participant_token(_ok_doctor(), V.new_room_key(), now_epoch=1000,
                                     recording_lawfully_enabled=True)
    assert tok2.recording_allowed is True


# ── Waiting room / admission ─────────────────────────────────────────────────

def test_only_staff_may_admit():
    patient = V.issue_participant_token(_ok_patient(), V.new_room_key(), now_epoch=1000)
    doctor = V.issue_participant_token(_ok_doctor(), V.new_room_key(), now_epoch=1000)
    assert not V.may_admit(patient)
    assert V.may_admit(doctor)


# ── Webhook auth + idempotency ───────────────────────────────────────────────

def test_webhook_signature_required():
    secret = b"provider-secret"
    body = b'{"event":"room.ended"}'
    good = hmac.new(secret, body, hashlib.sha256).hexdigest()
    assert V.verify_webhook(secret, body, good)
    assert not V.verify_webhook(secret, body, "deadbeef")
    assert not V.verify_webhook(secret, body, "")
    assert not V.verify_webhook(b"", body, good)


def test_webhook_idempotent():
    led = V.WebhookLedger()
    assert led.accept("evt-1")
    assert not led.accept("evt-1")      # replay ignored
    assert not led.accept("")
    assert led.accept("evt-2")


# ── Shipped provider is the disabled null provider ───────────────────────────

def test_disabled_provider_refuses_everything():
    p = V.DisabledVideoProvider()
    assert p.health() is False
    with pytest.raises(V.VideoDisabledError):
        p.create_session(V.new_room_key(), "eu")
    with pytest.raises(V.VideoDisabledError):
        p.mint_token(V.issue_participant_token(_ok_patient(), V.new_room_key(), now_epoch=1))
    with pytest.raises(V.VideoDisabledError):
        p.revoke(V.new_provider_session_id())


def test_adapter_is_blocked_external():
    assert V.ADAPTER_STATUS == "BLOCKED_EXTERNAL"
    assert "signed_dpa" in V.ADAPTER_RELEASE_REQUIREMENTS
    assert "clinical_fallback_plan" in V.ADAPTER_RELEASE_REQUIREMENTS


# ── Source scan: no public video base in shipped source ──────────────────────

def test_no_public_jitsi_in_source():
    import pathlib
    root = pathlib.Path(__file__).resolve().parents[1] / "app"
    hits = []
    pat = re.compile(r"['\"]https?://[^'\"]*jit\.si")   # a public jitsi URL literal
    for p in root.rglob("*.py"):
        text = p.read_text(encoding="utf-8", errors="ignore")
        for i, line in enumerate(text.splitlines(), 1):
            if pat.search(line):
                hits.append(f"{p.name}:{i}: {line.strip()}")
    assert not hits, "public jitsi URL literal present in app source:\n" + "\n".join(hits)
