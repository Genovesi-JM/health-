import { beforeEach, describe, expect, it, vi } from 'vitest';
import { allConsentEffective, clearPendingConsent, consentNotCommitted, parseConsentReceipt, parseConsentState, readPendingConsent, savePendingConsent } from './consent';
import { syntheticPending, syntheticReceipt, syntheticState } from './consent.test-fixtures';
beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
describe('consent request identity and evidence', () => {
  it('keeps an exact owner-scoped payload across reload and never grants from that record', () => {
    const pending = syntheticPending(); savePendingConsent(pending);
    expect(readPendingConsent('owner-A')).toEqual(pending); expect(readPendingConsent('owner-B')).toBeNull();
    expect(allConsentEffective(syntheticState())).toBe(false);
  });
  it('refuses replacement and only removes a matching UUID', () => {
    const first = syntheticPending(); savePendingConsent(first);
    const second = { ...first, key: '22222222-2222-4222-8222-222222222222' };
    expect(() => savePendingConsent(second)).toThrow(); expect(clearPendingConsent(second)).toBe(false);
    expect(readPendingConsent(first.owner)).toEqual(first); expect(clearPendingConsent(first)).toBe(true);
  });
  it('surfaces failed storage before callers can submit', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => savePendingConsent(syntheticPending())).toThrow('quota');
  });
  it.each([{ owner: 'other' }, { payload: { ...syntheticPending().payload, content: 'copied text' } }, { key: 'invalid' }])('rejects malformed stored identity %j', change => {
    localStorage.setItem('kaya_pending_consent:owner-A', JSON.stringify({ ...syntheticPending(), ...change }));
    expect(() => readPendingConsent('owner-A')).toThrow();
  });
  it('accepts an old grant receipt with current withdrawn state without renewing it', () => {
    const result = parseConsentReceipt(syntheticReceipt(syntheticPending(), true), syntheticPending());
    expect(result.event.action).toBe('grant'); expect(result.state.states[0].status).toBe('withdrawn'); expect(allConsentEffective(result.state)).toBe(false);
  });
  it.each(['withdraw', 'refuse'] as const)('honors a later %s in another language without reviving an old Portuguese grant', action => {
    const receipt = syntheticReceipt(syntheticPending(), true);
    receipt.state.states[0].status = action === 'withdraw' ? 'withdrawn' : 'refused';
    receipt.state.states[0].latest_event = { ...receipt.state.states[0].latest_event!, language: 'en', action };
    const result = parseConsentReceipt(receipt, syntheticPending());
    expect(result.state.states[0].effective).toBe(false); expect(result.state.states[0].latest_event?.language).toBe('en');
    receipt.state.states[0].latest_event.action = 'grant';
    expect(() => parseConsentReceipt(receipt, syntheticPending())).toThrow();
  });
  it.each(['request_key', 'version', 'content_hash', 'country', 'document_id'] as const)('rejects a receipt for a different %s', field => {
    const receipt = syntheticReceipt(); receipt.event = { ...receipt.event, [field]: field === 'version' ? 2 : 'different' };
    expect(() => parseConsentReceipt(receipt, syntheticPending())).toThrow();
  });
  it('rejects an effective claim without the exact retained grant and mismatched market', () => {
    const state = syntheticState(); state.states[0].effective = true;
    expect(() => parseConsentState(state, 'AO')).toThrow(); expect(() => parseConsentState(syntheticState('PT'), 'AO')).toThrow();
  });
  it('releases only explicit post-lookup noncommit evidence', () => {
    for (const status of [400, 401, 403, 404, 409, 422, 500]) expect(consentNotCommitted({ response: { status } })).toBeNull();
    expect(consentNotCommitted({ response: { status: 409, data: { detail: { code: 'consent_not_committed', request_key_committed: false, message: 'Reveja.' } } } })).toBe('Reveja.');
  });
});
