# Kaya payments & billing integrity (Phase 38)

Money movement is fail-closed and **disabled by default**. The agent is not
authorized to charge money; `backend/app/payments.py` (domain-pure) ships no live
charging path — only the enforced boundary and a refusing null provider.

## Invariants enforced

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
- **Refusing provider.** The only shipped provider is `DisabledPaymentProvider`
  (refuses everything); `ADAPTER_STATUS = BLOCKED_EXTERNAL`.

## Tests — `backend/phase38_tests/test_payments.py` (16, all passing)

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
