"""Payments and billing integrity (Phase 38). Domain-pure.

Money movement is fail-closed and DISABLED by default. The agent is not
authorized to charge money; this module ships no live charging path — only the
enforced boundary and a refusing null provider. Even when a real provider is
later approved, the rules here keep charges server-authoritative, idempotent, free
of card data, and impossible without a confirmed service.

Enforced invariants:

  * Disabled by default. `payments_enabled` needs an operator flag AND an approved
    provider AND a DPA — all three.
  * No card data on our servers. `assert_no_card_data` rejects any PAN/CVV-shaped
    material (PCI: card data goes directly to the provider, never through us).
  * Amounts are server-authoritative integer minor units in a supported currency;
    a client-claimed amount never overrides the server quote.
  * No charge without a confirmed, committed service.
  * Idempotent charge/refund; a refund never exceeds the captured amount and is
    never double-applied.

Stdlib-only and importable without the app.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Optional

# ── Errors ───────────────────────────────────────────────────────────────────

class PaymentError(Exception):
    """A payment-integrity rule was violated (fail-closed)."""


class PaymentsDisabled(PaymentError):
    """Payments are not enabled/approved."""


class CardDataRejected(PaymentError):
    """Card data must never reach our servers."""


# ── Enable gate ──────────────────────────────────────────────────────────────

def payments_enabled(enabled_flag: Optional[str], provider_approved: bool,
                     dpa_in_place: bool) -> bool:
    flag_on = bool(enabled_flag) and enabled_flag.strip().lower() in {"true", "1", "yes", "on"}
    return flag_on and bool(provider_approved) and bool(dpa_in_place)


# ── No card data ─────────────────────────────────────────────────────────────

_PAN_RE = re.compile(r"\b(?:\d[ -]?){13,19}\b")
_CVV_KEY_RE = re.compile(r"(?i)\b(cvv|cvc|card[_-]?number|pan)\b")


def contains_card_data(payload) -> bool:
    """Detect a PAN-shaped value or a card/CVV key anywhere in the payload."""
    def scan(v) -> bool:
        if isinstance(v, dict):
            for k, val in v.items():
                if isinstance(k, str) and _CVV_KEY_RE.search(k):
                    return True
                if scan(val):
                    return True
            return False
        if isinstance(v, (list, tuple)):
            return any(scan(x) for x in v)
        if isinstance(v, str):
            digits = re.sub(r"[ -]", "", v)
            if digits.isdigit() and 13 <= len(digits) <= 19 and _luhn(digits):
                return True
        return False
    return scan(payload)


def _luhn(number: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(number)):
        d = ord(ch) - 48
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def assert_no_card_data(payload) -> None:
    if contains_card_data(payload):
        raise CardDataRejected("card data must go directly to the provider, never to our servers")


# ── Money (integer minor units, supported currency) ──────────────────────────

SUPPORTED_CURRENCIES = frozenset({"AOA"})     # Angolan Kwanza; expand only with owner approval


@dataclass(frozen=True)
class Money:
    amount_minor: int          # smallest currency unit (never a float)
    currency: str

    def __post_init__(self):
        if not isinstance(self.amount_minor, int):
            raise PaymentError("amount must be an integer minor unit, not a float")
        if self.amount_minor < 0:
            raise PaymentError("amount cannot be negative")
        if self.currency not in SUPPORTED_CURRENCIES:
            raise PaymentError(f"unsupported currency: {self.currency}")


def authoritative_amount(server_quote: Money, client_claimed_minor: Optional[int]) -> Money:
    """The server quote is authoritative. A mismatched client-claimed amount is
    ignored (and should be alerted), never charged."""
    return server_quote


def client_amount_matches(server_quote: Money, client_claimed_minor: Optional[int]) -> bool:
    return client_claimed_minor is not None and client_claimed_minor == server_quote.amount_minor


# ── Charge preconditions ─────────────────────────────────────────────────────

@dataclass(frozen=True)
class ChargeContext:
    service_confirmed: bool = False       # the service was booked/confirmed
    booking_committed: bool = False       # the booking transaction committed
    payer_authenticated: bool = False
    consent_to_charge: bool = False


def charge_allowed(ctx: ChargeContext, amount: Money) -> tuple[bool, tuple]:
    reasons: list[str] = []
    if not ctx.service_confirmed:
        reasons.append("service not confirmed")
    if not ctx.booking_committed:
        reasons.append("booking not committed")
    if not ctx.payer_authenticated:
        reasons.append("payer not authenticated")
    if not ctx.consent_to_charge:
        reasons.append("no consent to charge")
    if amount.amount_minor <= 0:
        reasons.append("amount must be positive")
    return (not reasons, tuple(reasons))


# ── Idempotent charge / refund ledger ────────────────────────────────────────

class PaymentLedger:
    """Idempotent charges and refunds. A repeated idempotency key returns the
    original result (no double charge). A refund never exceeds the captured amount
    and cannot be double-applied."""

    def __init__(self) -> None:
        self._charges: dict[str, dict] = {}          # idem_key -> {txn_id, amount, refunded}
        self._refunds: set[str] = set()

    def charge(self, idem_key: str, txn_id: str, amount: Money,
               execute: Callable[[], None] | None = None) -> dict:
        if idem_key in self._charges:
            return self._charges[idem_key]           # replay: original result, no re-execute
        if execute:
            execute()
        rec = {"txn_id": txn_id, "amount_minor": amount.amount_minor,
               "currency": amount.currency, "refunded_minor": 0}
        self._charges[idem_key] = rec
        return rec

    def refund(self, charge_idem_key: str, refund_idem_key: str, amount_minor: int) -> dict:
        if refund_idem_key in self._refunds:
            return self._charges[charge_idem_key]    # replay: no double refund
        rec = self._charges.get(charge_idem_key)
        if rec is None:
            raise PaymentError("cannot refund an unknown charge")
        if amount_minor <= 0:
            raise PaymentError("refund must be positive")
        if rec["refunded_minor"] + amount_minor > rec["amount_minor"]:
            raise PaymentError("refund exceeds captured amount")
        rec["refunded_minor"] += amount_minor
        self._refunds.add(refund_idem_key)
        return rec


# ── Shipped provider is the disabled null provider ───────────────────────────

@dataclass
class DisabledPaymentProvider:
    reason: str = "payment provider not approved (BLOCKED_EXTERNAL)"

    def charge(self, *a, **k):
        raise PaymentsDisabled(self.reason)

    def refund(self, *a, **k):
        raise PaymentsDisabled(self.reason)

    def health(self) -> bool:
        return False


ADAPTER_STATUS = "BLOCKED_EXTERNAL"
ADAPTER_RELEASE_REQUIREMENTS = (
    "signed_provider_dpa",
    "pci_scope_and_saq",
    "settlement_and_payout_model",
    "refund_and_dispute_policy",
    "tax_and_invoicing_rules",
    "currency_and_fx_approval",
)
