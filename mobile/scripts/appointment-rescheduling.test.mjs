import test from 'node:test';
import assert from 'node:assert/strict';
import { canRescheduleConsultation, createRescheduleAttempt, rescheduleSlots, rescheduleSlotsPath,
  rescheduleStorageKey, restoreRescheduleAttempt, rescheduleNotCommitted, sendRecoverableReschedule,
  loadRescheduleConsultation } from '../src/screens/appointmentRescheduling.ts';
const now = Date.parse('2026-10-04T12:00:00Z');
const consultation = { id: 'consultation-1', doctor_id: 'doctor-1', specialty: 'clinica_geral', country: 'AO', status: 'scheduled', slot_id: 'old-slot', reschedule_revision: 0, payment_status: 'pending' };
const slot = { id: 'new-slot', doctor_id: 'doctor-1', doctor_name: 'Médico', specialty: 'clinica_geral', country: 'AO', timezone: 'Africa/Luanda', starts_at: '2026-10-05T13:00:00Z', ends_at: '2026-10-05T13:30:00Z', status: 'open' };
const uuid = 'aaaa0000-0000-4000-8000-000000000001';
const makeAttempt = () => createRescheduleAttempt(consultation, slot, uuid, now);
const store = () => { const values = new Map(); return { values, getItemAsync: async key => values.get(key) ?? null, setItemAsync: async (key, value) => { values.set(key, value); }, deleteItemAsync: async key => { values.delete(key); } }; };
const committed = extra => ({ ...consultation, status: 'requested', reschedule_revision: 1, slot_id: slot.id, ...extra });
const rejection = (status, detail = 'Conflict') => ({ response: { status, data: { detail } } });

test('rescheduling permits only a known same-doctor market and an eligible unpaid lifecycle revision', () => {
  assert.equal(canRescheduleConsultation(consultation), true);
  for (const extra of [{ status: 'in_progress' }, { status: 'completed' }, { country: null }, { doctor_id: null },
    { reschedule_revision: undefined }, { reschedule_revision: -1 }, { reschedule_revision: 1.5 }, { payment_status: 'paid' }, { payment_id: 'payment' }]) {
    assert.equal(canRescheduleConsultation({ ...consultation, ...extra }), false);
    assert.throws(() => createRescheduleAttempt({ ...consultation, ...extra }, slot, uuid, now));
  }
});

test('replacement slots exclude old, mismatched doctor/country, reserved and elapsed slots', () => {
  const rejected = [{ id: 'old-slot' }, { doctor_id: 'other' }, { country: 'PT' }, { status: 'reserved' },
    { starts_at: '2026-10-04T11:00:00Z' }, { ends_at: slot.starts_at }].map(extra => ({ ...slot, ...extra }));
  assert.deepEqual(rescheduleSlots([slot, ...rejected], consultation, now), [slot]);
  for (const item of rejected) assert.throws(() => createRescheduleAttempt(consultation, item, uuid, now));
  const path = rescheduleSlotsPath({ ...consultation, doctor_id: 'doctor/+1' }, { from_at: '2026-10-04T00:00:00Z', to_at: '2026-11-04T00:00:00Z' });
  assert.match(path, /doctor_id=doctor%2F%2B1/); assert.match(path, /country=AO/); assert.match(path, /from_at=/);
});

test('restoration retains past-slot exact retry payload and isolates owner and consultation storage keys', () => {
  const attempt = makeAttempt();
  assert.deepEqual(restoreRescheduleAttempt(JSON.stringify(attempt), consultation.id), attempt);
  assert.equal(restoreRescheduleAttempt(null, consultation.id), null);
  assert.notEqual(rescheduleStorageKey('a_b', 'c'), rescheduleStorageKey('a', 'b_c'));
  assert.notEqual(rescheduleStorageKey('owner-A', 'c'), rescheduleStorageKey('owner-B', 'c'));
  for (const extra of [{ consultationId: 'other' }, { key: 'not-a-uuid' }, { payload: { ...attempt.payload, expected_revision: '0' } },
    { payload: { ...attempt.payload, extra: true } }, { selected: { ...attempt.selected, starts_at: 2000 } },
    { selected: { ...attempt.selected, starts_at: '2026-10-05T13:00:00' } },
    { selected: { ...attempt.selected, ends_at: attempt.selected.starts_at } }]) assert.throws(() => restoreRescheduleAttempt(JSON.stringify({ ...attempt, ...extra }), consultation.id));
  const withUnexpectedText = { ...attempt, selected: { ...attempt.selected, private_text: 'Must not persist' } };
  assert.deepEqual(restoreRescheduleAttempt(JSON.stringify(withUnexpectedText), consultation.id), attempt);
});

test('targeted refresh requires exactly the requested consultation', async () => {
  let path;
  assert.equal((await loadRescheduleConsultation({ get: async value => { path = value; return { data: [consultation] }; } }, consultation.id)).id, consultation.id);
  assert.equal(path, '/api/v1/consultations/me?consultation_id=consultation-1');
  for (const data of [[], [consultation, consultation], [{ ...consultation, id: 'other' }]]) await assert.rejects(() => loadRescheduleConsultation({ get: async () => ({ data }) }, consultation.id));
});

test('request is saved before POST and storage failure never changes a reservation', async () => {
  const attempt = makeAttempt(); const storage = store(); let posts = 0;
  const api = { post: async (path, payload, options) => {
    posts++; assert.equal(path, '/api/v1/consultations/consultation-1/reschedule');
    assert.deepEqual(payload, { slot_id: 'new-slot', expected_revision: 0 });
    assert.equal(options.headers['Idempotency-Key'], uuid);
    assert.deepEqual(JSON.parse(await storage.getItemAsync(rescheduleStorageKey('owner', consultation.id))), attempt);
    return { data: committed() };
  } };
  assert.equal((await sendRecoverableReschedule(api, storage, 'owner', attempt)).kind, 'success');
  assert.equal(storage.values.size, 0);
  await assert.rejects(() => sendRecoverableReschedule(api, { ...storage, setItemAsync: async () => { throw new Error('Storage unavailable'); } }, 'owner', attempt));
  assert.equal(posts, 1);
});

test('lost response, generic conflict, authentication and later validation preserve exact retry across reopen', async () => {
  const attempt = makeAttempt(); const storage = store(); const key = rescheduleStorageKey('owner', consultation.id);
  for (const failure of [new Error('Network'), rejection(503), rejection(409), rejection(401), rejection(403), rejection(404), rejection(422)]) {
    await assert.rejects(() => sendRecoverableReschedule({ post: async () => { throw failure; } }, storage, 'owner', attempt));
    assert.deepEqual(restoreRescheduleAttempt(await storage.getItemAsync(key), consultation.id), attempt);
  }
  const result = await sendRecoverableReschedule({ post: async () => ({ data: committed({ status: 'completed', reschedule_revision: 4, slot_id: 'later-move' }) }) }, storage, 'owner', restoreRescheduleAttempt(await storage.getItemAsync(key), consultation.id));
  assert.equal(result.consultation.status, 'completed'); assert.equal(result.consultation.slot_id, 'later-move');
  assert.equal(storage.values.size, 0);
});

test('only structured locked noncommit proof unlocks another selection', async () => {
  const detail = { code: 'reschedule_not_committed', request_key_committed: false, message: 'O horário foi ocupado.' };
  assert.equal(rescheduleNotCommitted(rejection(409, detail)), true);
  for (const error of [rejection(400, detail), rejection(409), rejection(409, { ...detail, request_key_committed: true }), rejection(409, { ...detail, code: 'other' })]) assert.equal(rescheduleNotCommitted(error), false);
  const storage = store();
  const result = await sendRecoverableReschedule({ post: async () => { throw rejection(409, detail); } }, storage, 'owner', makeAttempt());
  assert.deepEqual(result, { kind: 'not_committed', message: detail.message }); assert.equal(storage.values.size, 0);
});

test('failed successful-result cleanup retains request and malformed success cannot drop recovery', async () => {
  const storage = store(); const attempt = makeAttempt();
  const cannotClear = { ...storage, deleteItemAsync: async () => { throw new Error('Storage failed'); } };
  await assert.rejects(() => sendRecoverableReschedule({ post: async () => ({ data: committed() }) }, cannotClear, 'owner', attempt));
  assert.equal(storage.values.size, 1);
  for (const data of [{ ...committed(), id: 'other' }, { ...committed(), reschedule_revision: 0 }]) {
    await assert.rejects(() => sendRecoverableReschedule({ post: async () => ({ data }) }, storage, 'owner', attempt));
    assert.equal(storage.values.size, 1);
  }
});

test('old successful or noncommitted replies cannot clear a newer saved UUID', async () => {
  for (const noncommitted of [false, true]) {
    const storage = store(); const attempt = makeAttempt(); let finish; let sent;
    const requestSent = new Promise(resolve => { sent = resolve; });
    const request = sendRecoverableReschedule({ post: () => { sent(); return new Promise((resolve, reject) => {
      finish = () => noncommitted ? reject(rejection(409, { code: 'reschedule_not_committed', request_key_committed: false })) : resolve({ data: committed() });
    }); } }, storage, 'owner', attempt);
    await requestSent;
    const newer = { ...attempt, key: 'bbbb0000-0000-4000-8000-000000000002' };
    await storage.setItemAsync(rescheduleStorageKey('owner', consultation.id), JSON.stringify(newer));
    finish(); await request;
    assert.deepEqual(JSON.parse(await storage.getItemAsync(rescheduleStorageKey('owner', consultation.id))), newer);
  }
});

test('another pending key or a mutated body cannot overwrite a saved reschedule', async () => {
  const storage = store(); const attempt = makeAttempt(); const key = rescheduleStorageKey('owner', consultation.id);
  await storage.setItemAsync(key, JSON.stringify(attempt));
  const api = { post: async () => { assert.fail('No POST while a different attempt is pending'); } };
  for (const changed of [{ ...attempt, key: 'bbbb0000-0000-4000-8000-000000000002' }, { ...attempt, payload: { ...attempt.payload, expected_revision: 2 } }]) {
    await assert.rejects(() => sendRecoverableReschedule(api, storage, 'owner', changed));
    assert.deepEqual(JSON.parse(await storage.getItemAsync(key)), attempt);
  }
});
