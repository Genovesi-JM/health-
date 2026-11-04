import test from 'node:test';
import assert from 'node:assert/strict';
import { consultationPagePath, loadConsultationPage, mergeConsultationPages, createConsultationPager, createClinicalFeedGuard } from '../src/screens/consultationPages.ts';
const item = (id, revision = 0, status = 'requested') => ({ id, reschedule_revision: revision, status });
const page = (items, next_cursor = null) => ({ get: async () => ({ data: { items, next_cursor } }) });
const fail = status => ({ get: async () => { throw { response: { status } }; } });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const setup = () => { const states = []; const pager = createConsultationPager(state => states.push(state)); pager.activate('A:patient:all'); return { pager, states }; };

test('patient and clinician routes send bounded pages, the selected view and an encoded opaque cursor', async () => {
  assert.equal(consultationPagePath('patient', 'past', 'abc/+='), '/api/v1/consultations/me/page?limit=20&view=past&cursor=abc%2F%2B%3D');
  assert.equal(consultationPagePath('doctor-history', 'upcoming', null), '/api/v1/doctor/consultations/page?limit=20&view=upcoming');
  assert.equal(consultationPagePath('doctor-queue', 'all', null), '/api/v1/doctor/queue/page?limit=20');
  for (const data of [[], {}, { items: [], next_cursor: '' }, { items: [null], next_cursor: null }, { items: [item('a')], next_cursor: 'repeated' }]) {
    await assert.rejects(() => loadConsultationPage({ get: async () => ({ data }) }, 'patient', 'all', 'repeated'));
  }
});

test('page traversal retains server order, deduplicates overlaps and cannot overwrite a newer revision', async () => {
  const { pager } = setup();
  await pager.load(page([item('a', 2), item('b')], 'second'), 'patient', 'all');
  await pager.load(page([item('a', 1), item('b', 1), item('c')], 'third'), 'patient', 'all', true);
  assert.deepEqual(pager.snapshot().items, [item('a', 2), item('b', 1), item('c')]);
  assert.equal(pager.snapshot().nextCursor, 'third');
  assert.equal(pager.snapshot().loadingMore, false);
  assert.deepEqual(mergeConsultationPages([item('a', 2)], [item('a', 0)]), [item('a', 2)]);
});

test('retryable page failures preserve rows and cursor while expired cursors require explicit restart', async () => {
  const { pager } = setup();
  await pager.load(page([item('a')], 'second'), 'patient', 'all');
  for (const status of [500, 429, undefined]) {
    await pager.load(fail(status), 'patient', 'all', true);
    assert.deepEqual(pager.snapshot().items, [item('a')]); assert.equal(pager.snapshot().nextCursor, 'second');
  }
  await pager.load(fail(422), 'patient', 'all', true);
  assert.equal(pager.snapshot().restartRequired, true);
  await pager.load({ get: async () => assert.fail('Expired cursor cannot retry implicitly') }, 'patient', 'all', true);
  await pager.load(page([item('fresh')]), 'patient', 'all');
  assert.equal(pager.snapshot().restartRequired, false); assert.equal(pager.snapshot().nextCursor, null);
  assert.deepEqual(pager.snapshot().items, [item('fresh')]);
});

test('a late page cannot append after refresh or leak into a replacement account or view', async () => {
  const { pager } = setup(); await pager.load(page([item('a')], 'second'), 'patient', 'all');
  const delayed = deferred(); const pending = pager.load({ get: () => delayed.promise }, 'patient', 'all', true);
  await pager.load(page([item('current')]), 'patient', 'all');
  delayed.resolve({ data: { items: [item('stale')], next_cursor: null } }); await pending;
  assert.deepEqual(pager.snapshot().items, [item('current')]);
  for (const scope of ['A:patient:past', 'B:patient:all']) {
    const response = deferred(); const old = pager.load({ get: () => response.promise }, 'patient', 'all');
    pager.deactivate(); pager.activate(scope);
    assert.deepEqual(pager.snapshot().items, []);
    response.resolve({ data: { items: [item('private-old')], next_cursor: null } }); await old;
    assert.deepEqual(pager.snapshot().items, []); assert.equal(pager.snapshot().scope, scope);
  }
});

test('loss of access clears server data and initial failure never reports an empty successful inbox', async () => {
  const { pager } = setup(); await pager.load(fail(500), 'patient', 'all');
  assert.equal(pager.snapshot().loaded, false); assert.ok(pager.snapshot().error);
  for (const status of [401, 403]) {
    await pager.load(page([item('private')], 'next'), 'patient', 'all');
    await pager.load(fail(status), 'patient', 'all', true);
    assert.deepEqual(pager.snapshot().items, []); assert.equal(pager.snapshot().nextCursor, null);
    assert.equal(pager.snapshot().loaded, false); assert.match(pager.snapshot().error, /acesso/);
  }
});

test('acknowledged cancellation removes an active-view row and leaves history/all views truthful', async () => {
  const { pager } = setup(); await pager.load(page([item('a')]), 'patient', 'upcoming');
  pager.update(item('a', 0, 'cancelled'), 'upcoming'); assert.deepEqual(pager.snapshot().items, []);
  await pager.load(page([item('a')]), 'patient', 'all');
  pager.update(item('a', 1, 'cancelled'), 'all'); assert.equal(pager.snapshot().items[0].status, 'cancelled');
});

test('a page requested before acknowledged cancellation cannot restore the cancelled row', async () => {
  const { pager } = setup(); await pager.load(page([item('a')], 'next'), 'patient', 'upcoming');
  const response = deferred(); const pending = pager.load({ get: () => response.promise }, 'patient', 'upcoming', true);
  pager.update(item('a', 0, 'cancelled'), 'upcoming');
  response.resolve({ data: { items: [item('a')], next_cursor: null } }); await pending;
  assert.deepEqual(pager.snapshot().items, []); assert.equal(pager.snapshot().loadingMore, false);
});

test('a paged queue denial clears every clinical feed and prevents an older dashboard response restoring patients', async () => {
  let escalations = ['private patient and summary']; let dashboard = { patients: 3 }; let pager;
  const guard = createClinicalFeedGuard(() => { escalations = []; dashboard = null; pager.clearAccess(); });
  pager = createConsultationPager(() => {}, () => guard.deny()); pager.activate('doctor-A');
  await pager.load(page([item('queue-patient')], 'next'), 'doctor-queue', 'all');
  const version = guard.version(); const delayed = deferred();
  const oldFeed = delayed.promise.then(() => { if (guard.current(version)) { escalations = ['stale private patient']; dashboard = { patients: 5 }; } });
  await pager.load(fail(403), 'doctor-queue', 'all', true);
  assert.equal(guard.isDenied(), true); assert.deepEqual(escalations, []); assert.equal(dashboard, null);
  assert.deepEqual(pager.snapshot().items, []); assert.equal(pager.snapshot().accessLost, true);
  delayed.resolve(); await oldFeed;
  assert.deepEqual(escalations, []); assert.equal(dashboard, null); assert.equal(guard.recover(version), false);
});

test('dashboard or escalation access loss also clears queue and invalidates its parallel next page', async () => {
  let pager; const guard = createClinicalFeedGuard(() => pager.clearAccess());
  pager = createConsultationPager(() => {}, () => guard.deny()); pager.activate('doctor-A');
  await pager.load(page([item('queue-patient')], 'next'), 'doctor-queue', 'all');
  const delayed = deferred(); const oldQueue = pager.load({ get: () => delayed.promise }, 'doctor-queue', 'all', true);
  guard.deny();
  delayed.resolve({ data: { items: [item('must-not-return')], next_cursor: null } }); await oldQueue;
  assert.deepEqual(pager.snapshot().items, []); assert.equal(pager.snapshot().accessLost, true);
  assert.equal(guard.isDenied(), true);
});

test('transient feed errors preserve rows, and only a current recovery can lift the access guard', async () => {
  let escalations = ['authorized patient']; let pager;
  const guard = createClinicalFeedGuard(() => { escalations = []; pager.clearAccess(); });
  pager = createConsultationPager(() => {}, () => guard.deny()); pager.activate('doctor-A');
  await pager.load(page([item('a')], 'next'), 'doctor-queue', 'all');
  await pager.load(fail(500), 'doctor-queue', 'all', true);
  assert.equal(guard.isDenied(), false); assert.deepEqual(escalations, ['authorized patient']); assert.deepEqual(pager.snapshot().items, [item('a')]);
  guard.deny(); const current = guard.version();
  await pager.load(page([item('fresh-authorized')]), 'doctor-queue', 'all');
  assert.equal(pager.snapshot().accessLost, false); assert.equal(guard.isDenied(), true);
  assert.equal(guard.recover(current), true); assert.equal(guard.isDenied(), false);
});
