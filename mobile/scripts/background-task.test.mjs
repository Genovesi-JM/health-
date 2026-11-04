import test from 'node:test';
import assert from 'node:assert/strict';
import { HEALTH_BACKGROUND_INTERVAL_MINUTES, runBackgroundHealthSync } from '../src/health/backgroundTaskPolicy.ts';

test('background minimum interval uses minutes for the maintained task API', () => {
  assert.equal(HEALTH_BACKGROUND_INTERVAL_MINUTES, 15);
});

test('a disconnected owner completes without health reads or uploads', async () => {
  assert.equal(await runBackgroundHealthSync(async () => null, async () => assert.fail('must not sync')), 'success');
});

test('successful sync, including no new data, completes for the connected owner', async () => {
  for (const result of [{ imported: 0, updated: 0 }, { imported: 2, updated: 1 }]) {
    const owners = [];
    assert.equal(await runBackgroundHealthSync(async () => 'patient-a', async (owner) => { owners.push(owner); return result; }), 'success');
    assert.deepEqual(owners, ['patient-a']);
  }
});

test('owner storage and sync failures report failure for OS rescheduling', async () => {
  assert.equal(await runBackgroundHealthSync(async () => { throw new Error('secure storage unavailable'); }, async () => assert.fail('must not sync')), 'failed');
  assert.equal(await runBackgroundHealthSync(async () => 'patient-a', async () => { throw new Error('sync unavailable'); }), 'failed');
});
