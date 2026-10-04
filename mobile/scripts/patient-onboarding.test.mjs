import test from 'node:test';
import assert from 'node:assert/strict';
import {
  patientDataForDraft, validatePatientStep, patientDraftComplete, submitPatientDraft,
  REQUIRED_PATIENT_CONSENTS,
} from '../src/screens/patientOnboarding.ts';

const identity = { email: 'patient@example.test', full_name: 'Ana Teste' };
const validPayload = (country = 'AO') => ({
  '1': { language: 'pt', channel: 'email' },
  '2': { email: identity.email, phone: '+244 900 000 111' },
  '3': { full_name: 'Ana Teste', dob: '1990-05-20', sex: 'female' },
  '4': { country, city: country === 'AO' ? 'Luanda' : 'Porto' },
  '5': { blood_type: 'O+', allergies: 'penicilina, marisco', chronic: 'hipertensão' },
  '6': { ec_name: 'Pessoa de Teste', ec_phone: '+244900000222', ec_consent: true },
  '7': { catalog_country: country, catalog_language: 'pt', consent_expected_revision: 0, consent_acceptances: REQUIRED_PATIENT_CONSENTS.map((purpose, index) => ({ document_id: `doc-${index}`, version: 1, content_hash: 'a'.repeat(64), country, language: 'pt' })) },
  '8': {},
});
const draft = (overrides = {}) => ({ id: 'draft-1', role: 'patient', status: 'draft', completion_status: 'incomplete', current_step: 8,
  total_steps: 8, completed_steps: [1, 2, 3, 4, 5, 6, 7], data: validPayload(), ...overrides });
const complete = () => draft({ status: 'submitted', completion_status: 'complete', completed_steps: [1, 2, 3, 4, 5, 6, 7, 8] });

test('new drafts have eight steps without inventing health information or accepted consent', () => {
  const data = patientDataForDraft(identity, undefined);
  assert.equal(Object.keys(data).length, 8);
  assert.deepEqual(data['5'], {});
  assert.equal(data['4'].country, 'AO');
  assert.equal(data['2'].email, identity.email);
  assert.equal(data['3'].full_name, identity.full_name);
  assert.deepEqual(data['7'].consent_acceptances, []);
  assert.equal(data['7'].catalog_country, 'AO');
  assert.equal(data['7'].catalog_language, 'pt');
});

test('resuming preserves saved answers, explicit false choices and untouched health fields', () => {
  const saved = validPayload('PT');
  saved['2'].email = 'old@example.test';
  saved['3'].full_name = 'Nome guardado';
  saved['7'].c_family_share = false;
  const result = patientDataForDraft(identity, saved);
  assert.equal(result['4'].country, 'PT');
  assert.equal(result['3'].full_name, 'Nome guardado');
  assert.equal(result['2'].email, identity.email);
  assert.deepEqual(result['5'], saved['5']);
  assert.deepEqual(result['7'].consent_acceptances, saved['7'].consent_acceptances);
  assert.equal(result['7'].c_family_share, undefined);
  result['3'].full_name = 'Edited';
  assert.equal(saved['3'].full_name, 'Nome guardado');
});

test('legacy boolean declarations are discarded and never converted to exact consent references', () => {
  const stored = validPayload(); stored['7'] = { c_terms: true, c_privacy: true, c_health: true, c_telemedicine: true, c_medical_disclaimer: true, consent_version: 'patient-onboarding-v1' };
  const resumed = patientDataForDraft(identity, stored);
  assert.deepEqual(resumed['7'].consent_acceptances, []);
  assert.equal(resumed['7'].c_terms, undefined);
  assert.notEqual(validatePatientStep(7, resumed, identity), null);
});

test('Angola and Portugal payloads match the eight-step server contract', () => {
  for (const country of ['AO', 'PT']) {
    const payload = validPayload(country);
    for (let step = 1; step <= 8; step++) assert.equal(validatePatientStep(step, payload, identity, '2026-10-04'), null);
    payload['5'] = {};
    assert.equal(validatePatientStep(5, payload, identity), null);
  }
});

test('account email, dates, country and SMS contact fail before submission', () => {
  const checks = [
    [2, 'email', 'another@example.test'], [3, 'dob', '1990-02-30'], [3, 'dob', '2027-01-01'], [4, 'country', 'ES'],
  ];
  for (const [step, key, value] of checks) {
    const payload = validPayload(); payload[String(step)][key] = value;
    assert.notEqual(validatePatientStep(step, payload, identity, '2026-10-04'), null);
  }
  const payload = validPayload(); payload['1'].channel = 'sms'; payload['2'].phone = '';
  assert.notEqual(validatePatientStep(2, payload, identity), null);
  payload['2'].phone = '+351 (910) 000-111';
  assert.equal(validatePatientStep(2, payload, identity), null);
});

test('exact five approved references, matching market, hash/version and revision are required independently of optional choices', () => {
  for (const alteration of [fields => fields.consent_acceptances.pop(), fields => fields.consent_acceptances[0].content_hash = 'wrong',
    fields => fields.consent_acceptances[0].version = 0, fields => fields.consent_acceptances[0].country = 'PT',
    fields => fields.catalog_country = 'PT', fields => fields.consent_expected_revision = -1,
    fields => fields.consent_acceptances[1] = fields.consent_acceptances[0], fields => fields.c_marketing = true]) {
    const payload = validPayload(); alteration(payload['7']); assert.notEqual(validatePatientStep(7, payload, identity), null);
  }
  const payload = validPayload(); payload['6'].ec_consent = 'true'; assert.notEqual(validatePatientStep(6, payload, identity), null);
});

test('an old frozen draft is not proof that profile and consent completion occurred', () => {
  assert.equal(patientDraftComplete(draft({ status: 'submitted' })), false);
  assert.equal(patientDraftComplete(complete()), true);
});

test('submit saves the final step and atomically submits only the scoped patient draft', async () => {
  const calls = [];
  const api = {
    get: async url => { calls.push(['get', url]); return { data: { draft: draft() } }; },
    put: async (url, body) => { calls.push(['put', url, body]); return { data: draft() }; },
    post: async url => { calls.push(['post', url]); return { data: complete() }; },
  };
  assert.equal(patientDraftComplete(await submitPatientDraft(api, {})), true);
  assert.deepEqual(calls, [
    ['get', '/api/v1/onboarding/status?role=patient'],
    ['put', '/api/v1/onboarding/steps/8?role=patient', { data: {}, completed: true }],
    ['post', '/api/v1/onboarding/submit?role=patient'],
  ]);
});

test('retry after a lost completion response never tries to edit a frozen draft', async () => {
  let committed = false;
  let puts = 0;
  let submits = 0;
  const api = {
    get: async () => ({ data: { draft: committed ? complete() : draft() } }),
    put: async () => { puts++; return { data: draft() }; },
    post: async () => { submits++; committed = true; throw new Error('Response lost after commit'); },
  };
  await assert.rejects(() => submitPatientDraft(api, {}), /Response lost/);
  assert.equal(patientDraftComplete(await submitPatientDraft(api, {})), true);
  assert.equal(puts, 1);
  assert.equal(submits, 1);
});

test('save or submit errors never report a completed profile', async () => {
  let submits = 0;
  const api = {
    get: async () => ({ data: { draft: draft() } }),
    put: async () => { throw new Error('Save failed'); },
    post: async () => { submits++; return { data: draft() }; },
  };
  await assert.rejects(() => submitPatientDraft(api, {}), /Save failed/);
  assert.equal(submits, 0);
  api.put = async () => ({ data: draft() });
  await assert.rejects(() => submitPatientDraft(api, {}), /confirmar/);
});

test('a session-bound onboarding client prevents a later profile mutation after ownership changes during status lookup', async () => {
  let owner = 'A'; const expected = owner; let writes = 0;
  const assertCurrent = () => { if (owner !== expected) throw new Error('Session changed'); };
  const api = { get: async () => { owner = 'B'; return {data: {draft:draft()}}; },
    put: async () => {assertCurrent(); writes++;}, post: async () => {assertCurrent(); writes++;} };
  await assert.rejects(() => submitPatientDraft(api, {}), /Session changed/); assert.equal(writes, 0);
});
