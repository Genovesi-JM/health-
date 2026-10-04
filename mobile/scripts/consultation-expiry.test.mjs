import test from 'node:test';
import assert from 'node:assert/strict';
import { requestAllowsNewScheduleAction, consultationExpiryMessage } from '../src/screens/consultationExpiry.ts';
const now = Date.parse('2026-10-04T12:00:00Z');
const open = { status: 'requested', requested_expires_at: '2026-10-04T13:00:00Z', request_expiry_state: 'open' };
test('new schedule actions require a future verified deadline for requested consultations', () => {
  assert.equal(requestAllowsNewScheduleAction(open, now), true);
  for (const extra of [{ requested_expires_at: null }, { requested_expires_at: 'invalid' }, { requested_expires_at: '2026-10-04T12:00:00Z' },
    { request_expiry_state: null }, { request_expiry_state: 'expiry_pending' }, { request_expiry_state: 'review_required' }, { status: 'expired' }]) {
    assert.equal(requestAllowsNewScheduleAction({ ...open, ...extra }, now), false);
  }
  assert.equal(requestAllowsNewScheduleAction({ status: 'scheduled', request_expiry_state: null }, now), true);
  assert.equal(requestAllowsNewScheduleAction({ status: 'in_progress', request_expiry_state: null }, now), true);
});
test('copy distinguishes a reached deadline, required review and persisted expiration without promising release', () => {
  assert.equal(consultationExpiryMessage(open, { now }), null);
  const pending = consultationExpiryMessage({ ...open, request_expiry_state: 'expiry_pending' }, { now });
  assert.match(pending, /Aguarda confirmação/); assert.match(pending, /não deve ser considerada livre/);
  assert.match(consultationExpiryMessage({ ...open, request_expiry_state: 'review_required' }, { now }), /equipa deve confirmar/);
  assert.doesNotMatch(consultationExpiryMessage({ ...open, request_expiry_state: 'review_required' }, { now, clinician: true }), /cancelamento/);
  assert.match(consultationExpiryMessage({ status: 'expired' }, { now }), /pedido expirou/);
  assert.equal(consultationExpiryMessage({ status: 'scheduled', requested_expires_at: open.requested_expires_at }, { now }), null);
});
