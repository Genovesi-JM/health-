import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../src/screens/selfTriage.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { startSelfTriage } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const draft = { country: 'AO', consent_language: 'pt', chief_complaint: 'My symptoms', category: 'general', age_group: 'adult', answered_by_guardian: false };
test('self adult triage sends its own explicit context and returns only the server acknowledgment', async () => {
  const calls = [];
  const response = { data: { triage_id: 'self-session' } };
  assert.equal(await startSelfTriage({ post: async (...args) => { calls.push(args); return response; } }, draft), response);
  assert.deepEqual(calls, [['/api/v1/triage/start', draft]]);
});
test('stale pediatric, guardian and every unrecognized subject selector never send a request', async () => {
  for (const change of [{ age_group: 'pediatric' }, { age_group: 'unknown' }, { answered_by_guardian: true },
    { dependent_id: 'child' }, { patient_id: 'other' }, { subject: {} }, { dependent_id: null }, { dependent_id: 123 }]) {
    await assert.rejects(() => startSelfTriage({ post: async () => assert.fail('Non-self request sent') }, { ...draft, ...change }), /não está disponível/);
  }
});

test('self triage never infers an unconfirmed service country or consent language', async () => {
  for (const change of [{country: undefined}, {country:'ES'}, {consent_language:undefined}, {consent_language:'en'}]) {
    await assert.rejects(() => startSelfTriage({post: async () => assert.fail('Unscoped triage sent')}, {...draft, ...change}), /Selecione explicitamente/);
  }
});
