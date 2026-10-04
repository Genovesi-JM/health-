import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appointmentSlotsPath, appointmentWindow, availableSlots, createBookingAttempt, bookingStorageKey,
  restoreBookingAttempt, sendBookingAttempt, sendRecoverableBooking, definitiveBookingFailure,
  bookingConflict, appointmentDate, appointmentRange,
} from '../src/screens/appointmentAvailability.ts';

const now = Date.parse('2026-10-04T09:00:00Z');
const key = 'afad432c-b174-4f41-909a-2ed53e766e9d';
const slot = {
  id: 'slot-1', doctor_id: 'doctor-1', doctor_name: 'Médico Teste', specialty: 'clinica_geral',
  country: 'AO', timezone: 'Africa/Luanda', starts_at: '2026-10-05T09:00:00Z', ends_at: '2026-10-05T09:30:00Z', status: 'open',
};
const consultation = { id: 'consult-1', specialty: 'clinica_geral', country: 'AO', timezone: 'Africa/Luanda', status: 'requested', slot_id: slot.id };
function memoryStorage() {
  const values = new Map();
  const events = [];
  return {
    values, events,
    async setItemAsync(name, value) { events.push('saved'); values.set(name, value); },
    async deleteItemAsync(name) { events.push('cleared'); values.delete(name); },
  };
}

test('availability request uses country and canonical specialty with escaped query values', () => {
  assert.equal(appointmentSlotsPath('AO', 'clinica_geral'), '/api/v1/appointments/slots?country=AO&specialty=clinica_geral');
  assert.equal(appointmentSlotsPath('PT', 'cardio&x=1'), '/api/v1/appointments/slots?country=PT&specialty=cardio%26x%3D1');
});

test('bounded search windows cover all 180 publishable days without gaps', () => {
  const windows = Array.from({ length: 6 }, (_, page) => appointmentWindow(page, now));
  assert.equal(windows[0].from_at, '2026-10-04T00:00:00.000Z');
  assert.equal(windows[0].lastPage, 5);
  for (let page = 0; page < windows.length; page++) {
    const window = windows[page];
    assert.ok(Date.parse(window.to_at) - Date.parse(window.from_at) <= 31 * 86_400_000);
    if (page) assert.equal(window.from_at, windows[page - 1].to_at);
    assert.match(window.label, /\(UTC\)$/);
  }
  const finalDay = new Date(Math.floor(now / 86_400_000) * 86_400_000 + 180 * 86_400_000).toISOString();
  assert.ok(windows[5].from_at < finalDay && finalDay < windows[5].to_at);
});

test('window navigation is bounded and uses UTC intervals across seasonal clock changes', () => {
  const first = appointmentWindow(-1, now);
  assert.equal(first.page, 0);
  const last = appointmentWindow(99, now);
  assert.equal(last.page, last.lastPage);
  assert.equal(Date.parse(first.to_at) - Date.parse(first.from_at), 31 * 86_400_000);
  assert.equal(appointmentWindow(99, now, 7, 21).page, 3);
  assert.equal(appointmentWindow(0, now, 0, -1).lastPage, 5);
});

test('slot query carries the selected future window as offset-bearing timestamps', () => {
  const window = appointmentWindow(2, now);
  const url = new URL(appointmentSlotsPath('PT', 'pediatria', window), 'https://example.invalid');
  assert.equal(url.searchParams.get('country'), 'PT');
  assert.equal(url.searchParams.get('from_at'), window.from_at);
  assert.equal(url.searchParams.get('to_at'), window.to_at);
  assert.match(window.from_at, /Z$/);
});

test('available slots exclude stale, reserved, withdrawn and mismatched results and sort by instant', () => {
  const later = { ...slot, id: 'later', starts_at: '2026-10-06T08:00:00Z', ends_at: '2026-10-06T08:30:00Z' };
  const invalid = [
    { ...slot, status: 'reserved' }, { ...slot, status: 'withdrawn' },
    { ...slot, country: 'PT' }, { ...slot, specialty: 'pediatria' },
    { ...slot, starts_at: '2026-10-04T08:00:00Z' }, { ...slot, starts_at: 'not-a-date' },
    { ...slot, ends_at: slot.starts_at }, { ...slot, ends_at: 'invalid' },
  ];
  assert.deepEqual(availableSlots([later, ...invalid, slot], 'AO', 'clinica_geral', now), [slot, later]);
});

test('slot booking sends only the published slot identity, country and specialty', () => {
  assert.deepEqual(createBookingAttempt('AO', 'clinica_geral', slot, key, now), {
    key, payload: { country: 'AO', specialty: 'clinica_geral', slot_id: 'slot-1' },
  });
  const portugal = { ...slot, country: 'PT', timezone: 'Atlantic/Azores' };
  assert.equal(createBookingAttempt('PT', 'clinica_geral', portugal, key, now).payload.country, 'PT');
});

test('unscheduled queue is explicit and never supplies a fabricated doctor or timestamp', () => {
  assert.deepEqual(createBookingAttempt('AO', 'pediatria', undefined, key, now), {
    key, payload: { country: 'AO', specialty: 'pediatria', next_available: true },
  });
});

test('stale or mismatched selection is rejected before creating a booking request', () => {
  for (const candidate of [{ ...slot, status: 'reserved' }, { ...slot, country: 'PT' }, { ...slot, specialty: 'cardiologia' }]) {
    assert.throws(() => createBookingAttempt('AO', 'clinica_geral', candidate, key, now), /já não está disponível/);
  }
  assert.throws(() => createBookingAttempt('AO', 'clinica_geral', slot, key, Date.parse(slot.starts_at)), /já não está disponível/);
  assert.throws(() => createBookingAttempt('ES', 'clinica_geral', undefined, key, now), /Selecione/);
  assert.throws(() => createBookingAttempt('AO', 'unknown', undefined, key, now), /Selecione/);
});

test('each new request has a UUID key while retries restore the exact payload and key', () => {
  const first = createBookingAttempt('AO', 'clinica_geral', slot, undefined, now);
  const second = createBookingAttempt('AO', 'clinica_geral', slot, undefined, now);
  assert.match(first.key, /^[0-9a-f-]{36}$/);
  assert.notEqual(first.key, second.key);
  assert.deepEqual(restoreBookingAttempt(JSON.stringify(first)), first);
  const queue = createBookingAttempt('PT', 'pediatria', undefined, key, now);
  assert.deepEqual(restoreBookingAttempt(JSON.stringify(queue)), queue);
  assert.equal(restoreBookingAttempt(null), null);
});

test('corrupt or ambiguous saved attempts fail closed instead of becoming a fresh request', () => {
  const attempt = createBookingAttempt('AO', 'clinica_geral', slot, key, now);
  for (const value of ['bad-json', '{}', JSON.stringify({ ...attempt, key: 'bad-key' }),
    JSON.stringify({ ...attempt, payload: { country: 'ES', specialty: 'clinica_geral', next_available: true } }),
    JSON.stringify({ ...attempt, payload: { ...attempt.payload, next_available: true } }),
    JSON.stringify({ ...attempt, payload: { country: 'AO', specialty: 'clinica_geral' } }),
    JSON.stringify({ ...attempt, payload: { country: 'AO', specialty: 'clinica_geral', slot_id: '', next_available: true } })]) {
    assert.throws(() => restoreBookingAttempt(value), /pedido anterior/);
  }
});

test('pending requests are isolated by patient identity without storage key collisions', () => {
  assert.notEqual(bookingStorageKey('patient-one'), bookingStorageKey('patient-two'));
  assert.notEqual(bookingStorageKey('patient/one'), bookingStorageKey('patient_one'));
  assert.match(bookingStorageKey('patient/one'), /^[a-zA-Z0-9._-]+$/);
});

test('retry sends the same exact body and idempotency key and returns the server state', async () => {
  const calls = [];
  const api = { async post(path, payload, options) { calls.push({ path, payload, options }); return { data: consultation }; } };
  const attempt = createBookingAttempt('AO', 'clinica_geral', slot, key, now);
  assert.equal((await sendBookingAttempt(api, attempt)).status, 'requested');
  await sendBookingAttempt(api, restoreBookingAttempt(JSON.stringify(attempt)));
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[0].path, '/api/v1/consultations/book');
  assert.deepEqual(calls[0].options.headers, { 'Idempotency-Key': key });
});

test('booking is stored before POST and removed only after confirmed server response', async () => {
  const storage = memoryStorage();
  const attempt = createBookingAttempt('AO', 'clinica_geral', slot, key, now);
  const api = { async post() {
    assert.deepEqual(restoreBookingAttempt(storage.values.get(bookingStorageKey('patient'))), attempt);
    storage.events.push('posted');
    return { data: consultation };
  } };
  assert.deepEqual(await sendRecoverableBooking(api, storage, 'patient', attempt), consultation);
  assert.deepEqual(storage.events, ['saved', 'posted', 'cleared']);
  assert.equal(storage.values.size, 0);
});

test('local persistence failure cannot create a booking with an unrecoverable key', async () => {
  const api = { async post() { assert.fail('POST must not run'); } };
  const storage = { async setItemAsync() { throw new Error('storage unavailable'); }, async deleteItemAsync() {} };
  await assert.rejects(() => sendRecoverableBooking(api, storage, 'patient', createBookingAttempt('AO', 'clinica_geral', slot, key, now)), /storage unavailable/);
});

test('lost response retains key across restart and recovers the existing booking on retry', async () => {
  const storage = memoryStorage();
  const attempt = createBookingAttempt('AO', 'clinica_geral', slot, key, now);
  const calls = [];
  let first = true;
  const api = { async post(path, payload, options) {
    calls.push({ path, payload, options });
    if (first) { first = false; throw new Error('response lost after commit'); }
    return { data: consultation };
  } };
  await assert.rejects(() => sendRecoverableBooking(api, storage, 'patient', attempt), /response lost/);
  const restored = restoreBookingAttempt(storage.values.get(bookingStorageKey('patient')));
  assert.deepEqual(restored, attempt);
  assert.deepEqual(await sendRecoverableBooking(api, storage, 'patient', restored, true), consultation);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(storage.values.size, 0);
});

test('server conflicts clear the attempted reservation and allow a new published choice', async () => {
  const storage = memoryStorage();
  const failure = { response: { status: 409 } };
  const api = { async post() { throw failure; } };
  await assert.rejects(() => sendRecoverableBooking(api, storage, 'patient', createBookingAttempt('AO', 'clinica_geral', slot, key, now)), error => error === failure);
  assert.equal(storage.values.size, 0);
  assert.equal(bookingConflict(failure), true);
});

test('transient server failures preserve attempts, while definite rejections can unlock the form', async () => {
  for (const status of [400, 404, 409, 422]) assert.equal(definitiveBookingFailure({ response: { status } }), true);
  for (const status of [401, 403, 408, 429, 500, 502, 503, 504]) {
    const storage = memoryStorage();
    const failure = { response: { status } };
    assert.equal(definitiveBookingFailure(failure), false);
    await assert.rejects(() => sendRecoverableBooking({ async post() { throw failure; } }, storage, 'patient', createBookingAttempt('AO', 'clinica_geral', slot, key, now)));
    assert.equal(storage.values.size, 1);
  }
  assert.equal(definitiveBookingFailure(new Error('offline')), false);
  assert.equal(bookingConflict({ response: { status: 503 } }), false);
});

test('a storage cleanup failure preserves a successful attempt for idempotent recovery', async () => {
  const storage = memoryStorage();
  storage.deleteItemAsync = async () => { throw new Error('cannot clear'); };
  const attempt = createBookingAttempt('AO', 'clinica_geral', slot, key, now);
  await assert.rejects(() => sendRecoverableBooking({ async post() { return { data: consultation }; } }, storage, 'patient', attempt), /cannot clear/);
  assert.deepEqual(restoreBookingAttempt(storage.values.get(bookingStorageKey('patient'))), attempt);
});

test('validation or permission errors on an uncertain retry retain its original key', async () => {
  const attempt = createBookingAttempt('AO', 'clinica_geral', slot, key, now);
  for (const status of [400, 401, 403, 404, 422]) {
    const storage = memoryStorage();
    const failure = { response: { status } };
    assert.equal(definitiveBookingFailure(failure, true), false);
    await assert.rejects(() => sendRecoverableBooking({ async post() { throw failure; } }, storage, 'patient', attempt, true));
    assert.deepEqual(restoreBookingAttempt(storage.values.get(bookingStorageKey('patient'))), attempt);
  }
  assert.equal(definitiveBookingFailure({ response: { status: 409 } }, true), true);
});

test('appointment timestamps use the published timezone and respect Portugal seasonal offsets', () => {
  assert.match(appointmentDate('2026-01-15T09:00:00Z', 'Africa/Luanda'), /10:00 \(Africa\/Luanda\)/);
  assert.match(appointmentDate('2026-01-15T09:00:00Z', 'Europe/Lisbon'), /09:00 \(Europe\/Lisbon\)/);
  assert.match(appointmentDate('2026-07-15T09:00:00Z', 'Europe/Lisbon'), /10:00 \(Europe\/Lisbon\)/);
  assert.match(appointmentDate('2026-01-15T09:00:00Z', 'Atlantic/Azores'), /08:00 \(Atlantic\/Azores\)/);
  assert.match(appointmentDate('2026-07-15T09:00:00Z', 'Atlantic/Azores'), /09:00 \(Atlantic\/Azores\)/);
  assert.match(appointmentRange(slot), /10:00 \(Africa\/Luanda\).*10:30 \(Africa\/Luanda\)/);
});

test('missing or unsupported timezone falls back to explicitly labelled UTC, never device time', () => {
  assert.match(appointmentDate('2026-10-05T10:00:00+01:00'), /09:00 \(UTC\)/);
  assert.equal(appointmentDate('2026-10-05T10:00:00+01:00', 'Invalid/Zone'), '2026-10-05 09:00 (UTC)');
  assert.equal(appointmentDate(null), 'Por definir');
  assert.equal(appointmentDate('bad-time', 'Africa/Luanda'), 'Por definir');
});
