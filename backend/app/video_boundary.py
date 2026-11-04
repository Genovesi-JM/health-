"""Secure teleconsultation provider boundary (Phase 25). Domain-pure.

A video capability whose *failure* must never expose or misroute a clinical
session. This module is the canonical policy for that boundary; it is stdlib-only
and importable without the FastAPI app, so it is tested in-place while the app is
held.

Design invariants enforced here:

  * Video is DISABLED by default. It activates only when an operator sets
    ``VIDEO_ENABLED=true`` *and* names an approved provider base server-side. No
    client value, query parameter, or public fallback (e.g. meet.jit.si) can
    turn it on or choose a room.
  * A participant token is issued only after every clinical precondition holds:
    an active appointment/episode, verified identity with MFA, an operating
    organization, the required clinical privilege (for clinicians), an
    authenticated patient (for patients), and an effective, video-specific
    consent. Any missing precondition fails CLOSED.
  * Provider session identifiers are unguessable and are NOT Kaya consultation,
    appointment, or patient identifiers, so a leaked or guessed Kaya id can never
    address a live room.
  * Recording is OFF unless explicitly and lawfully enabled; the default carries
    no recording.
  * Tokens are short-lived and role-bound; participants enter through a waiting
    room and are admitted, never auto-joined.
  * Inbound provider webhooks are authenticated (signature) and idempotent.

A real provider adapter (Twilio, Vonage, Daily, LiveKit, …) stays
BLOCKED_EXTERNAL until a DPA, data-region/transfer basis, security review,
accessibility review, retention schedule, and a clinical fallback plan are
approved through the release gate. This module deliberately ships NO network
adapter — only the enforced boundary and a disabled null provider.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass, field
from typing import Optional, Protocol

# ── Server-side enable gate ──────────────────────────────────────────────────

_TRUE = {"true", "1", "yes", "on"}


def video_enabled(enabled_flag: Optional[str], provider_base: Optional[str]) -> bool:
    """Video is on only when the operator flag is truthy AND an approved provider
    base is configured. Empty / unset / any client-influenced value → disabled.
    There is no public default: an unset base can never resolve to meet.jit.si or
    any other open room."""
    if enabled_flag is None:
        return False
    if enabled_flag.strip().lower() not in _TRUE:
        return False
    if not provider_base or not provider_base.strip():
        return False
    return True


def resolve_room_url(provider_base: Optional[str], server_room_key: str,
                     enabled_flag: Optional[str]) -> str:
    """Build a room URL only when video is enabled and the room key is a
    server-issued key. Never derives a room from a Kaya id and never falls back
    to a public base."""
    if not video_enabled(enabled_flag, provider_base):
        raise VideoDisabledError("video is disabled: no approved provider configured")
    if not server_room_key or not server_room_key.strip():
        raise VideoDisabledError("missing server-issued room key")
    if not _is_server_room_key(server_room_key):
        raise VideoBoundaryError("room key is not a server-issued unguessable key")
    base = provider_base.rstrip("/")  # type: ignore[union-attr]
    return f"{base}/{server_room_key}"


# ── Errors ───────────────────────────────────────────────────────────────────

class VideoBoundaryError(Exception):
    """A precondition for issuing/using a video session was not met."""


class VideoDisabledError(VideoBoundaryError):
    """Video is not enabled/approved for use."""


class TokenPreconditionError(VideoBoundaryError):
    """A clinical precondition for token issuance failed (fail-closed)."""


# ── Unguessable, non-Kaya session identifiers ────────────────────────────────

_ROOM_PREFIX = "KAYA-"          # display prefix only; the entropy follows
_MIN_ENTROPY_CHARS = 24


def new_room_key() -> str:
    """A fresh, unguessable room key. NOT derived from any Kaya identifier."""
    return f"{_ROOM_PREFIX}{secrets.token_urlsafe(24)}"


def new_provider_session_id() -> str:
    """An opaque provider-session id, unrelated to Kaya consultation/patient ids."""
    return secrets.token_urlsafe(32)


def _is_server_room_key(key: str) -> bool:
    """A server room key must carry real entropy and must not equal or embed a
    caller-supplied Kaya id verbatim (guessable)."""
    body = key[len(_ROOM_PREFIX):] if key.startswith(_ROOM_PREFIX) else key
    return len(body) >= _MIN_ENTROPY_CHARS and body.strip() == body


def room_key_is_independent_of(server_room_key: str, *kaya_ids: str) -> bool:
    """True when the room key does not reveal any Kaya identifier — a guessed
    consultation/patient/appointment id must never address the room."""
    body = server_room_key[len(_ROOM_PREFIX):] if server_room_key.startswith(_ROOM_PREFIX) else server_room_key
    for kid in kaya_ids:
        if kid and kid in body:
            return False
    return True


# ── Token issuance preconditions (fail-closed) ───────────────────────────────

@dataclass(frozen=True)
class SessionContext:
    """Everything that must be true, right now, for a participant to receive a
    room token. Booleans default to the SAFE (denying) value."""
    appointment_active: bool = False       # a real, in-window appointment/episode
    episode_open: bool = False             # the care episode is open (not closed/cancelled)
    identity_verified: bool = False        # subject identity established
    mfa_satisfied: bool = False            # MFA present for the role that requires it
    org_can_operate: bool = False          # operating authority active for the org
    consent_video_effective: bool = False  # video-specific consent, effective now
    # role-specific:
    role: str = ""                         # "patient" | "doctor" | "nurse" | ...
    clinician_privilege_ok: bool = False   # privileged for this service (clinicians)
    patient_authenticated: bool = False    # the patient is the authenticated subject


_CLINICIAN_ROLES = {"doctor", "nurse", "clinician", "midwife"}


def _precondition_failures(ctx: SessionContext) -> list[str]:
    fails: list[str] = []
    if not ctx.appointment_active:
        fails.append("no active appointment")
    if not ctx.episode_open:
        fails.append("episode not open")
    if not ctx.identity_verified:
        fails.append("identity not verified")
    if not ctx.mfa_satisfied:
        fails.append("mfa not satisfied")
    if not ctx.org_can_operate:
        fails.append("organization cannot operate")
    if not ctx.consent_video_effective:
        fails.append("video consent not effective")
    if not ctx.role:
        fails.append("no role")
    if ctx.role in _CLINICIAN_ROLES and not ctx.clinician_privilege_ok:
        fails.append("clinician not privileged")
    if ctx.role == "patient" and not ctx.patient_authenticated:
        fails.append("patient not authenticated")
    return fails


def can_issue_token(ctx: SessionContext) -> bool:
    return not _precondition_failures(ctx)


@dataclass(frozen=True)
class ParticipantToken:
    room_key: str
    role: str
    expires_at_epoch: int
    can_admit: bool          # only staff may admit from the waiting room
    recording_allowed: bool  # False unless lawfully enabled
    token: str = field(repr=False, default="")


def issue_participant_token(
    ctx: SessionContext,
    server_room_key: str,
    now_epoch: int,
    ttl_seconds: int = 120,
    recording_lawfully_enabled: bool = False,
) -> ParticipantToken:
    """Mint a short-lived, role-bound token — only if every precondition holds.
    Raises TokenPreconditionError (fail-closed) otherwise. The token grants entry
    to a waiting room; only staff roles may admit participants; recording stays
    OFF unless explicitly and lawfully enabled."""
    fails = _precondition_failures(ctx)
    if fails:
        raise TokenPreconditionError("; ".join(fails))
    if not _is_server_room_key(server_room_key):
        raise VideoBoundaryError("room key is not a server-issued unguessable key")
    if ttl_seconds <= 0 or ttl_seconds > 900:
        raise VideoBoundaryError("token ttl out of bounds")
    return ParticipantToken(
        room_key=server_room_key,
        role=ctx.role,
        expires_at_epoch=now_epoch + ttl_seconds,
        can_admit=ctx.role in _CLINICIAN_ROLES,
        recording_allowed=bool(recording_lawfully_enabled),
        token=secrets.token_urlsafe(32),
    )


def token_valid(tok: ParticipantToken, now_epoch: int) -> bool:
    return now_epoch < tok.expires_at_epoch


# ── Recording default ────────────────────────────────────────────────────────

def recording_default_enabled() -> bool:
    """Recording is OFF by default, everywhere."""
    return False


# ── Waiting room / admission ─────────────────────────────────────────────────

def may_admit(admitter: ParticipantToken) -> bool:
    """Only a staff token may admit a waiting participant into the room."""
    return admitter.can_admit


# ── Webhook authentication + idempotency ─────────────────────────────────────

def verify_webhook(secret: bytes, body: bytes, signature_hex: str) -> bool:
    """Provider webhooks must carry a valid HMAC-SHA256 signature. Unsigned or
    mismatched events are rejected (constant-time compare)."""
    if not secret or not signature_hex:
        return False
    expected = hmac.new(secret, body, hashlib.sha256).hexdigest()
    try:
        return hmac.compare_digest(expected, signature_hex.strip().lower())
    except Exception:
        return False


class WebhookLedger:
    """At-most-once processing of provider events by event id."""

    def __init__(self) -> None:
        self._seen: set[str] = set()

    def accept(self, event_id: str) -> bool:
        """True the first time an event id is seen; False on any replay."""
        if not event_id or event_id in self._seen:
            return False
        self._seen.add(event_id)
        return True


# ── Provider interface (no network adapter ships here) ───────────────────────

class VideoProvider(Protocol):
    """Provider-neutral interface. A concrete adapter is BLOCKED_EXTERNAL until
    DPA, region/transfer basis, security, accessibility, retention, and clinical
    fallback evidence are approved through the release gate."""

    def create_session(self, room_key: str, region: str) -> str: ...
    def mint_token(self, tok: ParticipantToken) -> str: ...
    def revoke(self, provider_session_id: str) -> None: ...
    def health(self) -> bool: ...


@dataclass
class DisabledVideoProvider:
    """The only provider that ships: it refuses everything. Selecting no approved
    provider leaves this in place, so a misconfiguration fails closed rather than
    silently reaching for a public server."""
    reason: str = "video provider not approved (BLOCKED_EXTERNAL)"

    def create_session(self, room_key: str, region: str) -> str:
        raise VideoDisabledError(self.reason)

    def mint_token(self, tok: ParticipantToken) -> str:
        raise VideoDisabledError(self.reason)

    def revoke(self, provider_session_id: str) -> None:
        raise VideoDisabledError(self.reason)

    def health(self) -> bool:
        return False


# What a real adapter must satisfy before it may be wired in (documented, not code).
ADAPTER_RELEASE_REQUIREMENTS = (
    "signed_dpa",
    "data_region_and_transfer_basis",
    "security_review",
    "accessibility_review",
    "retention_schedule",
    "clinical_fallback_plan",
    "recording_lawful_basis_if_enabled",
)

ADAPTER_STATUS = "BLOCKED_EXTERNAL"
