"""Secure clinical messaging (Phase 28). Domain-pure.

Patient–clinician messaging that cannot leak, misroute, or be spoofed, is not an
emergency channel, and never auto-executes a clinical directive from a message.

Enforced invariants:

  * Relationship-scoped. A message is sent only within a care thread the sender
    participates in, and the recipient is DERIVED from the thread — never chosen
    by the client — so PHI cannot be misrouted to a non-participant.
  * Sender authenticity. The claimed sender role must match the authenticated
    participant's role in the thread; a client cannot spoof another party.
  * Not an emergency channel. Every thread carries a non-emergency notice, and a
    message containing emergency red-flags yields a redirect-to-emergency
    directive; such a message is not treated as a clinical action.
  * No auto-acting on directives. A patient message is DATA, not a command:
    "stop my meds", "double the dose" is surfaced for clinician review and is
    never auto-executed.
  * Integrity. Sent messages are append-only (no silent edit/delete; a correction
    is a new message); read receipts are monotonic and server-timestamped.
  * Closed threads. Once the episode is closed, new messages are blocked.

Stdlib-only and importable without the app, so it is tested in place while the
app is held. The emergency red-flag list is an ILLUSTRATIVE safety net, not a
validated triage tool — a named clinical owner must review it.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

NON_EMERGENCY_NOTICE = (
    "Este canal não é para emergências. Em caso de emergência, ligue para os "
    "serviços de emergência locais ou dirija-se ao serviço de urgência mais próximo."
)


# ── Errors ───────────────────────────────────────────────────────────────────

class MessagingError(Exception):
    """A messaging-safety rule was violated (fail-closed)."""


class MessageImmutableError(MessagingError):
    """A sent message cannot be edited or deleted."""


class MisrouteError(MessagingError):
    """Attempted delivery to a non-participant."""


# ── Thread & participants ────────────────────────────────────────────────────

OPEN = "open"
CLOSED = "closed"


@dataclass(frozen=True)
class MessageThread:
    consultation_id: str
    patient_id: str
    clinician_id: str
    status: str = OPEN

    def participant_ids(self) -> frozenset:
        return frozenset({self.patient_id, self.clinician_id})

    def is_open(self) -> bool:
        return self.status == OPEN


@dataclass(frozen=True)
class Sender:
    user_id: str
    role: str                 # "patient" | "doctor" | "nurse" | ...


_CLINICIAN_ROLES = {"doctor", "nurse", "clinician", "midwife"}


def _expected_role(thread: MessageThread, user_id: str) -> Optional[str]:
    if user_id == thread.patient_id:
        return "patient"
    if user_id == thread.clinician_id:
        return "clinician"
    return None


def is_participant(thread: MessageThread, user_id: str) -> bool:
    return user_id in thread.participant_ids()


def sender_authentic(thread: MessageThread, sender: Sender) -> bool:
    """The claimed role must match the sender's actual place in the thread."""
    slot = _expected_role(thread, sender.user_id)
    if slot is None:
        return False
    if slot == "patient":
        return sender.role == "patient"
    return sender.role in _CLINICIAN_ROLES


def can_send(thread: MessageThread, sender: Sender) -> bool:
    """Send only within an open thread the sender authentically participates in."""
    return thread.is_open() and is_participant(thread, sender.user_id) and sender_authentic(thread, sender)


def resolve_recipient(thread: MessageThread, sender: Sender) -> str:
    """Recipient is DERIVED from the thread — the other participant — never chosen
    by the client. Misrouting is impossible by construction."""
    if not is_participant(thread, sender.user_id):
        raise MisrouteError("sender is not a thread participant")
    return thread.clinician_id if sender.user_id == thread.patient_id else thread.patient_id


def recipient_is_in_thread(thread: MessageThread, recipient_id: str) -> bool:
    return recipient_id in thread.participant_ids()


# ── Not an emergency channel ─────────────────────────────────────────────────

# ILLUSTRATIVE red-flags (multi-language, minimal). NOT a validated triage tool.
_EMERGENCY_PATTERNS = [
    r"\bchest pain\b", r"\bdor no peito\b",
    r"\bcan'?t breathe\b", r"\bnão consigo respirar\b", r"\bfalta de ar\b",
    r"\bsuicid", r"\bmatar-me\b", r"\bkill myself\b",
    r"\bstroke\b", r"\bavc\b",
    r"\bbleeding heavily\b", r"\bhemorragia\b",
    r"\bunconscious\b", r"\binconsciente\b",
    r"\banaphyla", r"\bsevere allergic\b",
]
_EMERGENCY_RE = re.compile("|".join(_EMERGENCY_PATTERNS), re.IGNORECASE)


def requires_emergency_redirect(text: str) -> bool:
    return bool(_EMERGENCY_RE.search(text or ""))


@dataclass(frozen=True)
class EmergencyDirective:
    redirect: bool
    notice: str = NON_EMERGENCY_NOTICE


def emergency_check(text: str) -> EmergencyDirective:
    """A message with emergency red-flags yields a redirect directive; it is
    surfaced to the user and NOT treated as a routine clinical action."""
    return EmergencyDirective(redirect=requires_emergency_redirect(text))


# ── No auto-acting on directives ─────────────────────────────────────────────

# ILLUSTRATIVE directive cues — a patient asking for a clinical change.
_DIRECTIVE_PATTERNS = [
    r"\bstop (my|the) \w+", r"\bpare (o|a|os|as) \w+",
    r"\b(double|increase|decrease|halve) (the|my) dose\b",
    r"\baument\w* a dose\b", r"\bdiminu\w* a dose\b",
    r"\bcancel (my|the) (prescription|appointment)\b",
    r"\brefill\b", r"\brenovar receita\b",
]
_DIRECTIVE_RE = re.compile("|".join(_DIRECTIVE_PATTERNS), re.IGNORECASE)


def patient_message_is_auto_actionable(text: str) -> bool:
    """ALWAYS False — a patient message is never auto-executed as a clinical
    action, regardless of content."""
    return False


def directive_requires_clinician_review(sender: Sender, text: str) -> bool:
    """A patient message that reads like a clinical directive must be routed to a
    clinician for a decision, not acted on automatically."""
    if sender.role != "patient":
        return False
    return bool(_DIRECTIVE_RE.search(text or ""))


# ── Message integrity: append-only, monotonic read receipts ──────────────────

@dataclass(frozen=True)
class Message:
    message_id: str
    thread_consultation_id: str
    sender_id: str
    sender_role: str
    recipient_id: str
    body: str
    created_at_epoch: int
    read_at_epoch: Optional[int] = None


def build_message(thread: MessageThread, sender: Sender, body: str,
                  now_epoch: int, message_id: str) -> Message:
    """Construct a message only for an authorized send, with the recipient derived
    server-side. Raises rather than silently misrouting or spoofing."""
    if not can_send(thread, sender):
        raise MessagingError("sender may not post to this thread")
    recipient = resolve_recipient(thread, sender)
    if not body or not body.strip():
        raise MessagingError("empty message")
    return Message(
        message_id=message_id, thread_consultation_id=thread.consultation_id,
        sender_id=sender.user_id, sender_role=sender.role, recipient_id=recipient,
        body=body, created_at_epoch=now_epoch,
    )


def mark_read(msg: Message, reader_id: str, now_epoch: int) -> Message:
    """Only the recipient marks read; read state is monotonic (never un-read)."""
    if reader_id != msg.recipient_id:
        raise MessagingError("only the recipient may mark a message read")
    if msg.read_at_epoch is not None:
        return msg                                   # idempotent, never reset
    from dataclasses import replace
    return replace(msg, read_at_epoch=now_epoch)


def edit_prohibited(msg: Message) -> None:
    raise MessageImmutableError("sent messages are append-only; send a correction instead")


def delete_prohibited(msg: Message) -> None:
    raise MessageImmutableError("sent messages are not deleted; send a correction instead")


# ── Read access ──────────────────────────────────────────────────────────────

def can_read_thread(thread: MessageThread, user_id: str) -> bool:
    """Only the two participants may read the thread — no one else, ever."""
    return is_participant(thread, user_id)
