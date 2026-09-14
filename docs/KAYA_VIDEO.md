# Kaya secure teleconsultation provider boundary (Phase 25)

A video capability whose **failure must never expose or misroute a clinical
session**. Video is disabled by default and fails closed on every axis. A real
provider adapter is **BLOCKED_EXTERNAL** until the release gate approves a DPA,
data region/transfer basis, security review, accessibility review, retention
schedule, clinical fallback plan, and — if recording is ever enabled — a lawful
basis for it.

## What changed

- **No public fallback.** The `meet.jit.si` default and the client-derived
  `KAYA-<consultation_id>` room name are removed from source
  (`frontend/src/utils/video.ts`, `backend/app/routers/teleconsultation.py`). A
  scanner test (`phase25_tests` + the `.py` app scan) fails the build if a public
  jitsi URL literal reappears in `backend/app`.
- **Disabled by default, enforced server-side.** `GET .../join` returns **503**
  unless `VIDEO_ENABLED=true` **and** `VIDEO_BASE_URL` is configured on the
  server. No client value, query parameter, or env in the browser can turn video
  on or choose a room.
- **Server-authoritative rooms.** The room a participant enters is decided by the
  backend, which returns a full `room_url` built from an **unguessable,
  server-issued room key** (`KAYA-` + `secrets.token_urlsafe(24)`). The key is
  **not** a Kaya consultation, appointment, or patient id, so a guessed or leaked
  Kaya id can never address a live room. The client (`DoctorAgendaPage`) now calls
  the join endpoint and opens the returned URL; it never constructs a room from an
  id, and `openServerVideoRoom` refuses any URL outside the approved base.
- **Recording off by default**, everywhere (`recording_default_enabled()` is
  `False`; the join response hard-codes `recording_enabled: False`).

## Canonical policy — `backend/app/video_boundary.py`

Domain-pure (stdlib only, importable without the app), so it is tested in place
while the app is held. It is the single source of truth for the boundary:

- `video_enabled(flag, base)` — on only when the operator flag is truthy **and**
  an approved base is set. Unset/empty/any client-influenced value → off. No
  public default exists.
- `resolve_room_url(base, room_key, flag)` — builds a URL only when enabled and
  only from a server-issued key; raises otherwise.
- `new_room_key()` / `new_provider_session_id()` — unguessable identifiers,
  unrelated to Kaya ids. `room_key_is_independent_of(key, *kaya_ids)` proves a key
  reveals no Kaya id.
- `SessionContext` + `issue_participant_token(...)` — **fail-closed** token
  issuance. A token is minted only when *all* preconditions hold: active
  appointment, open episode, verified identity, MFA, operating organization,
  effective video-specific consent, and role checks (clinicians must be
  privileged; patients must be authenticated). Any missing precondition raises
  `TokenPreconditionError`. Tokens are short-lived (≤ 900 s, default 120 s) and
  role-bound.
- Waiting room / admission — participants enter a waiting room; only staff tokens
  (`can_admit`) may admit. No auto-join.
- `verify_webhook(secret, body, sig)` — HMAC-SHA256, constant-time; unsigned or
  mismatched events rejected. `WebhookLedger.accept(event_id)` gives at-most-once
  processing (replays ignored).
- `VideoProvider` (Protocol) — the provider-neutral interface a real adapter must
  implement: `create_session`, `mint_token`, `revoke`, `health`. The **only**
  provider that ships is `DisabledVideoProvider`, which refuses everything, so a
  misconfiguration fails closed instead of reaching for a public server.
- `ADAPTER_STATUS = "BLOCKED_EXTERNAL"` with `ADAPTER_RELEASE_REQUIREMENTS`
  enumerating the evidence a real adapter needs.

## Tests — `backend/phase25_tests/test_video_boundary.py` (23, all passing)

Cover: disabled-by-default; no public fallback when base unset; a
consultation-id-derived room is rejected; unguessable non-Kaya ids; default
context denies everything and every single missing precondition denies token
issuance; short-lived role-bound tokens with TTL bounds; recording off by
default; only staff may admit; webhook signature required and idempotent; the
shipped provider refuses everything; adapter is BLOCKED_EXTERNAL; and a source
scan that no public jitsi URL literal remains in `backend/app`.

Frontend: the operational-hold contract test (`src/phase1/egress.test.ts`) still
passes — `openVideoRoom` throws the phase-1 hold ("information only") before any
window can open, and `tsc --noEmit` is clean.

## Human intervention / external gates (still required)

- **NAMED provider decision.** A concrete adapter (Twilio/Vonage/Daily/LiveKit/…)
  may be wired in **only** after a signed **DPA**, a decided **data
  region/transfer** basis, a **security review**, an **accessibility review**, a
  **retention schedule**, and a **clinical fallback plan** are approved and dated
  by their owners through the release board. The agent must never self-approve
  this or set `VIDEO_ENABLED=true` in any shared environment.
- **Recording lawful basis.** Recording stays OFF; enabling it needs a documented
  lawful basis and patient information/consent decided by a named owner.
- **Runtime adoption verification.** `video_boundary.py` is canonical policy; a
  harness-verified task must confirm the held join/prepare endpoints consume it
  (token preconditions, admission, webhook verification) once a provider is
  approved. The join endpoint's server-side 503 gate and unguessable key are
  wired today; the token/admission/webhook flow ships as enforced policy awaiting
  an approved adapter.
- **Clinical release stays HOLD.**
