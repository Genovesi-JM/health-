import test from 'node:test';
import assert from 'node:assert/strict';
import { readingState, readingHelpers as h, scope, connection } from './readings-fixtures.mjs';
const form = { metric: 'weight', value: '72.5', unit: 'kg', notes: 'Self-entered' };
const plain = value => JSON.parse(JSON.stringify(value));

test('manual reading captures the chosen market and source without requiring optional device permission', async () => {
  const sent = [];
  const api = { get: async path => { assert.match(path, /country=PT&language=pt$/); return { data: readingState('PT', false) }; }, post: async (...args) => { sent.push(args); return { data: { id: 'reading' } }; } };
  await h.saveManualReading(api, scope('PT'), form);
  assert.deepEqual(plain(sent[0]), ['/api/v1/readings', { country: 'PT', consent_language: 'pt', reading_type: 'weight', source: 'manual', value: 72.5, unit: 'kg', notes: 'Self-entered' }]);
});
test('missing, stale, refused or withdrawn mandatory grant denies a new manual write while keeping personal history independent', async () => {
  for (const status of ['missing', 'stale', 'refused', 'withdrawn', 'unavailable']) {
    const state = readingState(); state.states[0] = { ...state.states[0], status, effective: false };
    const error = await h.saveManualReading({ get: async () => ({ data: state }), post: async () => assert.fail('No write allowed') }, scope('AO'), form).catch(error => error);
    assert.equal(h.readingConsentRequired(error), true); assert.equal(h.readingAccessLost(error), false);
  }
});
test('device authorization requires a separate current devices grant and never accepts another country', async () => {
  await assert.rejects(() => h.requireReadingConsent({ get: async () => ({ data: readingState('AO', false) }) }, scope('AO'), true), h.readingConsentRequired);
  await assert.rejects(() => h.requireReadingConsent({ get: async () => ({ data: readingState('PT') }) }, scope('AO'), true));
  for (const country of [undefined, '', 'BR']) assert.throws(() => h.readingScope(country));
});
test('a session change during consent lookup prevents the manual POST', async () => {
  let current = true;
  await assert.rejects(() => h.saveManualReading({ get: async () => { current = false; return { data: readingState() }; }, post: async () => assert.fail('Cannot post with new owner') }, scope('AO'), form, () => { if (!current) throw new Error('changed'); }), /changed/);
});
test('manual input is validated before any consent or write request', async () => {
  for (const patch of [{ value: '' }, { value: 'Infinity' }, { value: 'NaN' }, { unit: '' }, { metric: 'unknown' }]) {
    await assert.rejects(() => h.saveManualReading({ get: async () => assert.fail(), post: async () => assert.fail() }, scope('AO'), { ...form, ...patch }));
  }
});
test('stored connection has explicit bounded owner and market; legacy metadata never defaults to Angola', () => {
  assert.deepEqual(plain(h.parseHealthConnection(connection('A', 'PT'), 'A')), { ownerId: 'A', ...scope('PT') });
  for (const raw of ['A', JSON.stringify('A'), JSON.stringify({ ownerId: 'A' }), JSON.stringify({ ownerId: 'A', country: 'PT' }), connection('B'), JSON.stringify({ ownerId: 'A', country: 'AO', consent_language: 'en' })]) assert.equal(h.parseHealthConnection(raw, 'A'), null);
});
test('history accepts a legacy null market and errors do not fabricate empty history', () => {
  const row = { id: 'legacy', reading_type: 'weight', value: 70, unit: 'kg', measured_at: '2026-10-04T00:00:00Z', country: null, consent_language: null };
  assert.equal(h.parseReadings({ readings: [row] })[0].country, null);
  assert.equal(h.readingCountryName(null), 'País não registado'); assert.throws(() => h.parseReadings({}));
  assert.equal(h.readingAccessLost({ response: { status: 403 } }), true);
  assert.match(h.readingError({ response: { status: 409, data: { detail: { code: 'reading_scope_conflict' } } } }, 'fallback'), /outro país/);
});
test('an uncertain manual response never triggers an automatic second write or erases the input', async () => {
  let posts = 0; const input = { ...form };
  await assert.rejects(() => h.saveManualReading({ get: async () => ({ data: readingState() }), post: async () => { posts++; throw new Error('Network Error'); } }, scope('AO'), input), /histórico antes de repetir/);
  assert.equal(posts, 1); assert.deepEqual(input, form);
});
