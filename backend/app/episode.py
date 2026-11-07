"""Care episode, queue, and clinician handoff (Phase 24). Domain-pure.

Patient intake, queue ownership, nurse/doctor handoff, consultation, and closure
are one explicit episode with bounded access. Concurrent claims produce exactly
one owner; a clinician sees only episodes permitted by current assignment and
privilege; an unfinished or failed handoff can never silently close the episode
or remove escalation visibility.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

STATES = {
    "requested", "triage_incomplete", "awaiting_review", "scheduled", "checked_in",
    "queued", "claimed", "in_progress", "handed_off", "completed", "cancelled",
    "no_show", "escalated", "closed",
}

# transition -> allowed actor roles
_TRANSITIONS: dict[tuple, frozenset] = {
    ("requested", "triage_incomplete"): frozenset({"system", "patient"}),
    ("requested", "awaiting_review"): frozenset({"system"}),
    ("awaiting_review", "scheduled"): frozenset({"nurse", "doctor", "coordinator"}),
    ("scheduled", "checked_in"): frozenset({"patient", "coordinator"}),
    ("checked_in", "queued"): frozenset({"system", "coordinator"}),
    ("queued", "claimed"): frozenset({"nurse", "doctor"}),
    ("claimed", "in_progress"): frozenset({"nurse", "doctor"}),
    ("in_progress", "handed_off"): frozenset({"nurse", "doctor"}),
    ("handed_off", "in_progress"): frozenset({"nurse", "doctor"}),
    ("in_progress", "completed"): frozenset({"doctor", "nurse"}),
    ("completed", "closed"): frozenset({"system", "coordinator"}),
    ("queued", "escalated"): frozenset({"nurse", "doctor", "system"}),
    ("in_progress", "escalated"): frozenset({"nurse", "doctor", "system"}),
    ("scheduled", "cancelled"): frozenset({"patient", "coordinator", "doctor"}),
    ("checked_in", "no_show"): frozenset({"system", "coordinator"}),
}


@dataclass
class TransitionResult:
    ok: bool
    reason: str
    allowed_next: tuple = ()


def allowed_next(src: str) -> tuple:
    return tuple(sorted(dst for (s, dst) in _TRANSITIONS if s == src))


def can_transition(src: str, dst: str, actor_role: str) -> TransitionResult:
    key = (src, dst)
    if key not in _TRANSITIONS:
        return TransitionResult(False, "impossible or stale transition", allowed_next(src))
    if actor_role not in _TRANSITIONS[key]:
        return TransitionResult(False, f"actor {actor_role} not permitted", allowed_next(src))
    return TransitionResult(True, "ok", allowed_next(dst))


# ── Atomic claim / lease ─────────────────────────────────────────────────────

class ClaimConflict(Exception):
    pass


class ClaimLedger:
    """At most one clinician owns an episode (production: DB conditional update).
    The loser gets an auditable ClaimConflict, never duplicate clinical work."""

    def __init__(self) -> None:
        self._owner: dict[str, str] = {}

    def claim(self, episode_id: str, clinician_id: str) -> None:
        cur = self._owner.get(episode_id)
        if cur is not None and cur != clinician_id:
            raise ClaimConflict(f"episode {episode_id} already claimed by another clinician")
        self._owner[episode_id] = clinician_id

    def reassign(self, episode_id: str, new_clinician_id: str, by_supervisor: bool) -> None:
        if not by_supervisor:
            raise ClaimConflict("reassignment requires a supervisor")
        self._owner[episode_id] = new_clinician_id

    def release_abandoned(self, episode_id: str) -> None:
        self._owner.pop(episode_id, None)

    def owner(self, episode_id: str) -> Optional[str]:
        return self._owner.get(episode_id)


# ── Queue visibility (bounded access) ────────────────────────────────────────

@dataclass
class ClinicianQueueContext:
    org_ids: frozenset
    facility_ids: frozenset
    services: frozenset
    on_shift: bool
    profession: str
    privileges: frozenset
    assigned_episode_ids: frozenset


@dataclass
class EpisodeRef:
    episode_id: str
    org_id: str
    facility_id: str
    service: str


def queue_visible(ep: EpisodeRef, ctx: ClinicianQueueContext) -> bool:
    """A clinician sees only in-scope episodes — never browses unrelated patients."""
    if not ctx.on_shift:
        return False
    if ep.org_id not in ctx.org_ids or ep.facility_id not in ctx.facility_ids:
        return False
    if ep.service not in ctx.services:
        return False
    if "clinical_read" not in ctx.privileges:
        return False
    return True


def can_view_after_handoff(ep_id: str, ctx: ClinicianQueueContext) -> bool:
    """After handoff or shift end, access is only via current assignment."""
    return ctx.on_shift and ep_id in ctx.assigned_episode_ids


# ── Handoff ──────────────────────────────────────────────────────────────────

@dataclass
class Handoff:
    from_clinician: str
    to_clinician: str
    summary: str                 # scoped content, not the entire record
    acknowledged: bool
    unresolved_tasks: tuple
    escalation_open: bool
    access_expires_for_sender: bool = True


def handoff_can_close_episode(h: Handoff) -> bool:
    """An unfinished or failed handoff cannot silently close the episode or hide
    escalation."""
    if not h.acknowledged:
        return False
    if h.unresolved_tasks:
        return False
    if h.escalation_open:
        return False
    return True


def escalation_visible(escalation_open: bool) -> bool:
    """Escalation visibility is preserved regardless of handoff/close state."""
    return escalation_open
