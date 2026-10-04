import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkoutNotCommitted, clearPendingPayment, formatPaymentAmount, parsePaymentReceipt, paymentOutcome, paymentRedirect, readPendingPayment, savePendingPayment } from './pendingPayment';
import type { PaymentReceipt, PendingPayment } from './pendingPayment';
const attempt: PendingPayment = { owner: 'owner-A', consultationId: 'visit-A', provider: 'multicaixa_express', key: '11111111-1111-4111-8111-111111111111' };
const receipt: PaymentReceipt = { payment_id: 'payment-A', provider: attempt.provider, request_key: attempt.key, status: 'pending', dispatch_state: 'response_recorded', financial_review_status: 'not_required', financial_review_reason: null, consultation_paid: false };
beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
describe('durable payment identity', () => {
  it('stores identifiers only and reads only the owning account and consultation', () => {
    savePendingPayment(attempt);
    expect(readPendingPayment(attempt.owner, attempt.consultationId)).toEqual(attempt);
    expect(readPendingPayment('owner-B', attempt.consultationId)).toBeNull();
    expect(readPendingPayment(attempt.owner, 'visit-B')).toBeNull();
    expect(Object.keys(JSON.parse(localStorage.getItem(localStorage.key(0)!)!))).toEqual(['owner', 'consultationId', 'provider', 'key']);
  });
  it('cannot replace an unresolved provider/key, or clear a newer identity from an old reply', () => {
    savePendingPayment(attempt);
    const newer = { ...attempt, provider: 'paypal' as const, key: '22222222-2222-4222-8222-222222222222' };
    expect(() => savePendingPayment(newer)).toThrow();
    expect(clearPendingPayment(attempt)).toBe(true); savePendingPayment(newer);
    expect(clearPendingPayment(attempt)).toBe(false);
    expect(readPendingPayment(attempt.owner, attempt.consultationId)).toEqual(newer);
  });
  it('fails closed on corrupt or oversized recovery records', () => {
    savePendingPayment(attempt); const key = localStorage.key(0)!;
    for (const bad of ['not-json', JSON.stringify({ ...attempt, owner: 'owner-B' }), JSON.stringify({ ...attempt, card: 'must not persist' }), 'x'.repeat(1025)]) {
      localStorage.setItem(key, bad); expect(() => readPendingPayment(attempt.owner, attempt.consultationId)).toThrow();
    }
  });
  it('does not hide storage failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => savePendingPayment(attempt)).toThrow('quota');
  });
  it('recognizes only explicit locked noncommit proof', () => {
    for (const status of [401, 404, 422, 500]) expect(checkoutNotCommitted({ response: { status } })).toBeNull();
    expect(checkoutNotCommitted({ response: { status: 409, data: { detail: 'conflict' } } })).toBeNull();
    const detail = { code: 'checkout_not_committed', request_key_committed: false, reason: 'existing_payment_attempt', message: 'Recover the earlier attempt' };
    expect(checkoutNotCommitted({ response: { status: 409, data: { detail } } })).toEqual({ reason: detail.reason, message: detail.message });
    expect(checkoutNotCommitted({ response: { status: 409, data: { detail: { ...detail, request_key_committed: true } } } })).toBeNull();
  });
});
describe('authoritative receipt', () => {
  it.each([
    [{ status: 'paid', consultation_paid: true }, 'paid'],
    [{ status: 'paid', consultation_paid: false }, 'review'],
    [{ status: 'paid', consultation_paid: true, financial_review_status: 'required' }, 'review'],
    [{ status: 'paid', consultation_paid: true, financial_review_status: 'unassessed' }, 'review'],
    [{ status: 'paid', consultation_paid: true, dispatch_state: 'unknown' }, 'review'],
    [{ status: 'failed' }, 'failed'],
    [{ status: 'failed', dispatch_state: 'dispatching' }, 'review'],
    [{ status: 'failed', financial_review_status: 'required' }, 'review'],
    [{ status: 'refunded' }, 'review'],
    [{ status: 'pending', dispatch_state: 'unknown' }, 'pending'],
  ] as const)('classifies %j as %s', (fields, expected) => { expect(paymentOutcome({ ...receipt, ...fields })).toBe(expected); });
  it('rejects another UUID/provider and malformed monetary data', () => {
    expect(parsePaymentReceipt(receipt, attempt)).toEqual(receipt);
    expect(() => parsePaymentReceipt({ ...receipt, request_key: crypto.randomUUID() }, attempt)).toThrow();
    expect(() => parsePaymentReceipt({ ...receipt, provider: 'paypal' }, attempt)).toThrow();
    expect(() => parsePaymentReceipt({ ...receipt, amount: -1, currency: 'EUR' }, attempt)).toThrow();
    expect(() => parsePaymentReceipt({ ...receipt, amount: 100, currency: 'bad!' }, attempt)).toThrow();
  });
  it('formats the server currency and accepts only absolute HTTPS redirects', () => {
    expect(formatPaymentAmount(12345, 'EUR')).toContain('123,45');
    expect(formatPaymentAmount(12345, 'EUR')).toContain('€');
    expect(formatPaymentAmount(12345, 'USD')).not.toContain('Kz');
    expect(paymentRedirect('https://checkout.example/pay?id=1')).toBe('https://checkout.example/pay?id=1');
    for (const url of ['javascript:alert(1)', 'data:text/html,x', '//checkout.example/pay', 'http://checkout.example/pay', 'https://user:pass@checkout.example/pay']) expect(paymentRedirect(url)).toBeNull();
  });
});
