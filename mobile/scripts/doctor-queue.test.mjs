import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../src/screens/doctorQueue.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace("'./consultationExpiry'", JSON.stringify(new URL('../src/screens/consultationExpiry.ts', import.meta.url).href));
const { openDisplayedQueueItem } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const item = { id: 'visit', patient_id: 'patient', status: 'requested', reschedule_revision: 3,
  request_expiry_state: 'open', requested_expires_at: '2099-01-01T12:00:00Z' };
test('accept and start send the displayed revision and return the patient only after acknowledgment', async () => {
  for (const [status, action] of [['requested', 'accept'], ['scheduled', 'start']]) {
    const calls = [];
    const patient = await openDisplayedQueueItem({ post: async (...args) => { calls.push(args); } }, { ...item, status }, async () => assert.fail('Unexpected refresh'));
    assert.equal(patient, 'patient');
    assert.deepEqual(calls, [[`/api/v1/doctor/queue/visit/${action}`, undefined, { params: { expected_revision: 3 } }]]);
  }
});
test('a missing or invalid revision never mutates even when an old card remains visible', async () => {
  for (const reschedule_revision of [undefined, null, -1, 1.5, NaN, '3']) {
    await assert.rejects(() => openDisplayedQueueItem({ post: async () => assert.fail('Unversioned mutation') },
      { ...item, reschedule_revision }, async () => {}), /Atualize a fila/);
  }
});
test('a concurrent reschedule conflict refreshes current cards but never retries acceptance automatically', async () => {
  let posts = 0; let refreshed = 0;
  await assert.rejects(() => openDisplayedQueueItem({ post: async () => { posts++; throw { response: { status: 409 } }; } },
    item, async () => { refreshed++; }), /Reveja a fila/);
  assert.equal(posts, 1); assert.equal(refreshed, 1);
});
test('active care opens without a new mutation; rejection or failed conflict refresh cannot report success', async () => {
  assert.equal(await openDisplayedQueueItem({ post: async () => assert.fail('Unexpected mutation') }, { ...item, status: 'in_progress', reschedule_revision: undefined }, async () => {}), 'patient');
  await assert.rejects(() => openDisplayedQueueItem({ post: async () => { throw new Error('Denied'); } }, item, async () => {}), /Denied/);
  await assert.rejects(() => openDisplayedQueueItem({ post: async () => { throw { response: { status: 409 } }; } }, item,
    async () => { throw new Error('Refresh failed'); }), /Refresh failed/);
});

test('expired, pending or unknown request deadlines cannot be accepted from an old queue card', async () => {
  for (const extra of [{ request_expiry_state: 'expiry_pending' }, { request_expiry_state: 'review_required' },
    { request_expiry_state: null }, { requested_expires_at: null }, { requested_expires_at: '2000-01-01T12:00:00Z' }, { status: 'expired' }]) {
    await assert.rejects(() => openDisplayedQueueItem({ post: async () => assert.fail('Due request cannot be accepted') },
      { ...item, ...extra }, async () => {}), /prazo ou estado/);
  }
});
