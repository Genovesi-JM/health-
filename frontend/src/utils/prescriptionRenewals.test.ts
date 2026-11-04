import { webcrypto, createHash } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { canDecideRenewal, clearPendingRenewal, mergeRenewalRows, parseCreationReceipt, parseDecisionReceipt, readPendingRenewal, renewalDigest, renewalNotCommitted, savePendingRenewal, verifyCreationReceipt, verifyDecisionReceipt } from './prescriptionRenewals';
import { decisionBody, decisionReceipt, renewalBody, renewalKey, renewalPending, renewalRow } from './prescriptionRenewals.test-fixtures';
beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); vi.stubGlobal('crypto', webcrypto); });
it('hashes exact canonical UTF8 content, including nulls, with standard SHA256', async () => {
  const body = { ...renewalBody, reason: '🩺 ação É' }; const sorted = Object.fromEntries(Object.entries(body).sort(([a], [b]) => a.localeCompare(b)));
  expect(await renewalDigest(body)).toBe(createHash('sha256').update(JSON.stringify(sorted)).digest('hex'));
  expect(await renewalDigest({ ...body, dose: null })).not.toBe(await renewalDigest(body));
});
it('persists only bounded identifiers, scope and hash, with per-owner isolation', async () => {
  const attempt = await renewalPending(); savePendingRenewal(attempt);
  const raw = localStorage.getItem('kaya_pending_renewal:creation:owner-A')!;
  expect(JSON.parse(raw)).toEqual(attempt); for (const text of [renewalBody.medication_name, renewalBody.reason!, renewalBody.dose!]) expect(raw).not.toContain(text);
  expect(readPendingRenewal('owner-A', 'creation')).toEqual(attempt); expect(readPendingRenewal('owner-B', 'creation')).toBeNull(); expect(readPendingRenewal('owner-A', 'decision')).toBeNull();
});
it('blocks overwrite and does not let stale cleanup erase another UUID', async () => {
  const original = await renewalPending(); const later = { ...original, key: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
  savePendingRenewal(later); expect(() => savePendingRenewal(original)).toThrow('outro pedido'); expect(clearPendingRenewal(original)).toBe(false); expect(readPendingRenewal('owner-A', 'creation')).toEqual(later);
});
it('fails closed if storage contains clinical text or malformed metadata', async () => {
  const attempt = await renewalPending();
  localStorage.setItem('kaya_pending_renewal:creation:owner-A', JSON.stringify({ ...attempt, medication_name: 'must never persist' }));
  expect(() => readPendingRenewal('owner-A', 'creation')).toThrow();
});
it('surfaces unavailable storage before a request can be reserved', async () => {
  const attempt = await renewalPending(); vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); }); expect(() => savePendingRenewal(attempt)).toThrow('quota');
});
it.each([404, 409, 422, 500])('does not interpret ordinary %s as no-commit proof', status => {
  expect(renewalNotCommitted({ response: { status, data: { detail: 'failed' } } })).toBe(false);
});
it('accepts only the explicit locked noncommit signal', () => {
  expect(renewalNotCommitted({ response: { status: 409, data: { detail: { code: 'renewal_not_committed', request_key_committed: false } } } })).toBe(true);
  expect(renewalNotCommitted({ response: { status: 404, data: { detail: { code: 'renewal_not_committed', request_key_committed: false } } } })).toBe(false);
});
it('verifies creation identity and original body even after the current request was decided', async () => {
  const attempt = await renewalPending(); const row = decisionReceipt().request;
  expect((await verifyCreationReceipt(row, attempt)).status).toBe('approved');
  expect(() => parseCreationReceipt({ ...row, doctor_id: 'other' }, attempt)).toThrow();
  await expect(verifyCreationReceipt({ ...row, medication_name: 'different medicine' }, attempt)).rejects.toThrow();
});
it('requires the atomic prescription record for an approved decision receipt', async () => {
  const attempt = await renewalPending('decision'); const result = decisionReceipt();
  expect((await verifyDecisionReceipt(result, attempt)).request.status).toBe('approved');
  expect(() => parseDecisionReceipt({ ...result, request: { ...result.request, standalone_prescription_id: null }, decision: { ...result.decision, standalone_prescription_id: null } }, attempt)).toThrow();
  expect(() => parseDecisionReceipt({ ...result, decision: { ...result.decision, request_key: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } }, attempt)).toThrow();
});
it('checks the exact original clinician note before clearing a saved decision', async () => {
  const attempt = await renewalPending('decision'); const receipt = decisionReceipt(renewalKey, { ...decisionBody, doctor_note: 'another note' });
  await expect(verifyDecisionReceipt(receipt, attempt)).rejects.toThrow();
});
it('fails closed for historical unknown scope and preserves a newer revision across pages', () => {
  const old = renewalRow(); const current = decisionReceipt().request;
  expect(canDecideRenewal(renewalRow({ country: null, consent_language: null, request_key: null, decision_state: 'legacy_review_required' }))).toBe(false);
  expect(mergeRenewalRows([current], [old])).toEqual([current]);
});

it.each(['dose', 'frequency'] as const)('rejects a decision receipt with mismatched effective %s', async field => {
  const attempt = await renewalPending('decision'); const receipt = decisionReceipt();
  await expect(verifyDecisionReceipt({ ...receipt, decision: { ...receipt.decision, [field]: 'different value' } }, attempt)).rejects.toThrow();
});
it('requires nonempty final dose and frequency for approval and checks adjusted effective values', async () => {
  const attempt = await renewalPending('decision'); const receipt = decisionReceipt();
  await expect(verifyDecisionReceipt({ ...receipt, request: { ...receipt.request, dose: null }, decision: { ...receipt.decision, dose: null } }, attempt)).rejects.toThrow();
  const body = { ...decisionBody, action: 'adjust' as const, adjusted_dose: 'Adjusted synthetic dose' };
  const adjusted = decisionReceipt(renewalKey, body); const pending = await renewalPending('decision', body);
  expect((await verifyDecisionReceipt(adjusted, pending)).decision.dose).toBe(body.adjusted_dose);
  await expect(verifyDecisionReceipt({ ...adjusted, decision: { ...adjusted.decision, dose: renewalBody.dose } }, pending)).rejects.toThrow();
});
