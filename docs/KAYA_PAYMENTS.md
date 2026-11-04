# Kaya payments and billing integrity

**Clinical release: HOLD. Payments remain the last launch integration.** No real
provider was enabled and no charge, refund or settlement was made during local
development. The default API entrypoint is informational. Existing adapters in
`backend/app/services/payments.py` and the operational `health_billing` router are
separate from the Phase 38 domain model below; passing its tests does not prove
that the operational router enforces every domain-model release condition.

## Phase 38 domain-model invariants

`backend/app/payments.py` is a domain-pure boundary with a refusing null provider.
These are tested model properties, not a certification of a configured gateway:

- **Disabled by default.** `payments_enabled` requires an operator flag AND an
  approved provider AND a DPA — all three.
- **No card data on our servers.** `assert_no_card_data` / `contains_card_data`
  reject any Luhn-valid PAN-shaped value or card/CVV key (PCI: card data goes
  directly to the provider, never through us).
- **Server-authoritative money.** `Money` is an integer minor unit in a supported
  currency (AOA); floats, negatives, and unsupported currencies are refused.
  `authoritative_amount` always uses the server quote; a mismatched client-claimed
  amount is ignored (and `client_amount_matches` flags the mismatch).
- **No charge without a confirmed, committed service.** `charge_allowed` requires
  service confirmed, booking committed, payer authenticated, consent to charge,
  and a positive amount.
- **Idempotent charge/refund.** `PaymentLedger` replays a charge idempotency key
  with no double execution; a refund never exceeds the captured amount and a
  replayed refund key does not double-apply.
- **Refusing provider.** This domain module's provider is `DisabledPaymentProvider`
  (refuses everything); `ADAPTER_STATUS = BLOCKED_EXTERNAL`. The separate legacy
  integration module contains adapters that still require reviewed adoption.

## Operational recovery and care-state separation — 4 October 2026

The synthetic operational router now requires a UUID `Idempotency-Key` for
`POST /api/v1/billing/consultation/checkout`. An owner-scoped, body-bound payment
attempt and its audit event commit before the adapter is called. Only the request
that creates the attempt dispatches it. Replaying the same key returns that
attempt's current state, including after the consultation changes; it never
dispatches again. An unresolved earlier attempt prevents another provider/key
from creating a second attempt for the consultation.

A lost or unsuccessful adapter response remains `unknown` and requires financial
review. Available provider reference/status/error-code evidence is retained;
private error text is hashed. A missing result, transport error, or 404 does not
prove that no payment was created. Only the structured
`checkout_not_committed` response with `request_key_committed:false`, produced
after the locked identity lookup, establishes that this particular key did not
commit. It does not erase an earlier attempt belonging to a different key.

Owner status lookup accepts `request_key` to recover exactly one attempt. Checkout
and status responses distinguish the financial receipt from its application to
care using `consultation_paid`, `financial_review_status` and
`financial_review_reason`. A receipt can be paid while the consultation remains
closed, overdue or otherwise ineligible. Such receipts are retained for review;
callbacks never reopen care or reserve a slot. Duplicate/out-of-order observations
cannot downgrade an already paid receipt to failed or restore a refunded receipt
to paid. Refund observations remain subject to explicit reconciliation; this is
not an implemented refund or settlement service.

The web flow saves only owner, consultation, provider and UUID before sending.
Ambiguous failures preserve that identity, including after closing the modal or
care changing status. Recovery remains accessible from historical/paid rows.
Old-session responses cannot update a new account. Method-discovery failures
offer a retry rather than inventing a gateway. The interface refreshes the
consultation only after the server confirms both `consultation_paid:true` and
`financial_review_status:not_required`; payment is never presented as clinician
acceptance.

Fresh checkout checks current ownership, professional authority, market and care
state. The current server price is still the legacy fixed 5,000,000 AOA minor
units (50,000 AOA), **not an approved commercial quote**. Portugal checkout is
disabled pending a reviewed EUR quote; no currency conversion is inferred.
Discovery also reports unavailable/unconfigured methods honestly. Bank transfer
requires configured recipient details and a valid IBAN checksum; the previous
hardcoded beneficiary account is no longer a fallback. No provider credentials
were supplied or enabled by this work.

Bank-transfer references now use the full attempt UUID, remain stable for an
exact replay and differ across attempts for the same order. A provider/reference
lookup that matches more than one retained legacy row fails for review before
applying a receipt; status checks repeat this check after a provider await. This
is not a guarantee of an external provider's reference contract.

Signed provider-event contracts, amount/reference matching, external sandbox
journeys, operator-reviewed quotes, charge consent, refunds, disputes, settlement
and tax/invoice adoption remain payment-launch work. These local recovery checks
do not certify a production gateway or make the default HOLD API operational.

## Domain tests — `backend/phase38_tests/test_payments.py` (16)

Disabled by default + flag/provider/DPA gate; PAN and CVV-key rejection; non-card
payload ok; integer-minor/negative/unsupported-currency rejection;
server-authoritative amount; charge preconditions (all-hold and each-missing);
zero-amount denied; idempotent charge (single execute); bounded idempotent refund;
refund-cannot-exceed-capture; unknown-charge refund rejected; disabled provider
refuses and is BLOCKED_EXTERNAL.

## Human intervention / external gates (BLOCKED_EXTERNAL / owner-bound)

- **Provider + PCI (BLOCKED_EXTERNAL).** A real payment provider may be wired only
  after a signed provider DPA, a decided PCI scope/SAQ, a settlement/payout model,
  a refund/dispute policy, tax/invoicing rules, and currency/FX approval — all by
  named finance/legal owners. The agent must never enable payments or charge money.
- **R03 payments sub-source** remains open until the above lands; the boundary and
  disabled provider are in place.
- **Clinical release stays HOLD.**
