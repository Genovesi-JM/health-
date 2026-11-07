import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as patientDocuments from '../src/screens/patientDocuments.ts';

const source = ts.transpileModule(readFileSync(new URL('../src/services/documentUploadRecovery.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
runInNewContext(source, { exports, require: name => {
  assert.equal(name, '../screens/patientDocuments'); return patientDocuments;
} });
const { readPendingUpload, recoveryStorageKey, sendRecoverableUpload, recoverCommittedUpload, discardPendingUpload } = exports;
const upload = { key: '12345678-1234-4234-8234-123456789012', file: { uri: 'file:///cache/exam.pdf', name: 'exam.pdf', type: 'application/pdf' }, size: 100, country: 'AO', consent_language: 'pt' };
const otherUpload = { ...upload, key: '22345678-1234-4234-8234-123456789012', file: { ...upload.file, uri: 'file:///cache/second.pdf' } };
const document = { id: 'document-1', original_filename: 'exam.pdf', content_type: 'application/pdf', size_bytes: 100,
  version: 1, status: 'pending_processing', scan_status: 'pending', extracted_text: null, reviewed_text: null };
const makeForm = () => ({ values: {}, append(key, value) { this.values[key] = value; } });
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function storageFixture() {
  const values = new Map();
  return { values, storage: { getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); }, deleteItemAsync: async key => { values.delete(key); } } };
}
const snapshot = value => JSON.parse(JSON.stringify(value));
async function until(check) { for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(resolve => setImmediate(resolve)); } assert.fail('Expected checkpoint was not reached'); }

test('persists the minimal owner-scoped consent and exact request before sending, then replays after restart and auth failures', async () => {
  const { storage, values } = storageFixture(); const calls = [];
  const api = { post: async (path, body, options) => {
    const stored = JSON.parse(values.get(recoveryStorageKey('A')));
    assert.equal(stored.upload.key, upload.key); assert.equal(stored.consent, true);
    calls.push({ path, body: body.values, options });
    if (calls.length === 1) throw new Error('Response lost after commit');
    if (calls.length <= 3) throw { response: { status: calls.length === 2 ? 401 : 403 } };
    return { data: document };
  } };
  await assert.rejects(() => sendRecoverableUpload(api, storage, 'A', upload, true, makeForm));
  for (let i = 0; i < 2; i++) {
    const restored = await readPendingUpload(storage, 'A');
    await assert.rejects(() => sendRecoverableUpload(api, storage, 'A', restored.upload, restored.consent, makeForm));
  }
  const restored = await readPendingUpload(storage, 'A');
  assert.deepEqual(snapshot(restored), { ownerId: 'A', upload, consent: true });
  assert.equal(await readPendingUpload(storage, 'B'), null);
  assert.equal(await sendRecoverableUpload(api, storage, 'A', restored.upload, restored.consent, makeForm), document);
  assert.equal(await readPendingUpload(storage, 'A'), null);
  for (const call of calls) assert.deepEqual(snapshot(call), snapshot(calls[0]));
});

test('never sends before consent and durable storage, and cannot replace a reserved UUID or its payload', async () => {
  const { storage } = storageFixture(); let calls = 0;
  const api = { post: async () => { calls++; throw new Error('Unknown outcome'); } };
  await assert.rejects(() => sendRecoverableUpload(api, storage, 'A', upload, false, makeForm), /Autorize/);
  const write = storage.setItemAsync;
  storage.setItemAsync = async () => { throw new Error('SecureStore unavailable'); };
  await assert.rejects(() => sendRecoverableUpload(api, storage, 'A', upload, true, makeForm), /SecureStore/);
  assert.equal(calls, 0);
  storage.setItemAsync = write;
  await assert.rejects(() => sendRecoverableUpload(api, storage, 'A', upload, true, makeForm));
  for (const replacement of [otherUpload, { ...upload, file: { ...upload.file, uri: otherUpload.file.uri } }]) {
    await assert.rejects(() => sendRecoverableUpload(api, storage, 'A', replacement, true, makeForm), /envio por confirmar/);
  }
  assert.equal(calls, 1);
  assert.equal((await readPendingUpload(storage, 'A')).upload.key, upload.key);
});

test('every later validation/conflict error keeps the original request and 404 lookup is not absence proof', async () => {
  const { storage } = storageFixture();
  for (const status of [undefined, 400, 404, 409, 413, 415, 422, 429, 500]) {
    const error = status ? { response: { status } } : new Error('Offline');
    await assert.rejects(() => sendRecoverableUpload({ post: async () => { throw error; } }, storage, 'A', upload, true, makeForm));
    const pending = await readPendingUpload(storage, 'A');
    assert.equal(pending.upload.key, upload.key);
    assert.equal(await recoverCommittedUpload({ get: async () => { throw { response: { status: 404 } }; } }, storage, 'A', pending), null);
    assert.equal((await readPendingUpload(storage, 'A')).upload.key, upload.key);
  }
});

test('positive lookup recovers with no cached-file read or POST and retains reference on auth, transport or invalid responses', async () => {
  const { storage } = storageFixture();
  await assert.rejects(() => sendRecoverableUpload({ post: async () => { throw new Error('Lost'); } }, storage, 'A', upload, true, makeForm));
  const pending = await readPendingUpload(storage, 'A');
  for (const status of [401, 403, 500]) {
    await assert.rejects(() => recoverCommittedUpload({ get: async () => { throw { response: { status } }; } }, storage, 'A', pending));
    assert.equal((await readPendingUpload(storage, 'A')).upload.key, upload.key);
  }
  await assert.rejects(() => recoverCommittedUpload({ get: async () => ({ data: {} }) }, storage, 'A', pending), /confirmar/);
  const recovered = await recoverCommittedUpload({ get: async path => {
    assert.equal(path, `/api/v1/patient-documents/requests/${upload.key}`); return { data: document };
  } }, storage, 'A', pending);
  assert.equal(recovered, document);
  assert.equal(await readPendingUpload(storage, 'A'), null);
});

test('a late acknowledgment cannot delete a newer request after explicit local discard', async () => {
  const { storage } = storageFixture(); const response = deferred(); let started = false;
  const first = sendRecoverableUpload({ post: async () => { started = true; return response.promise; } }, storage, 'A', upload, true, makeForm);
  await until(() => started);
  assert.equal(await discardPendingUpload(storage, 'A', upload.key), true);
  await assert.rejects(() => sendRecoverableUpload({ post: async () => { throw new Error('Second response lost'); } }, storage, 'A', otherUpload, true, makeForm));
  response.resolve({ data: document }); await first;
  assert.equal((await readPendingUpload(storage, 'A')).upload.key, otherUpload.key);
  assert.equal(await discardPendingUpload(storage, 'A', upload.key), false);
  assert.equal((await readPendingUpload(storage, 'A')).upload.key, otherUpload.key);
});

test('serialized delayed deletion finishes before a new reservation, including failed deletion', async () => {
  for (const failure of [false, true]) {
    const { storage, values } = storageFixture();
    await assert.rejects(() => sendRecoverableUpload({ post: async () => { throw new Error('Lost'); } }, storage, 'A', upload, true, makeForm));
    const deletion = deferred(); let deleting = false; let posted = false;
    storage.deleteItemAsync = async key => { deleting = true; await deletion.promise; values.delete(key); if (failure) throw new Error('Delete failed after effect'); };
    const clearing = discardPendingUpload(storage, 'A', upload.key).catch(error => error);
    await until(() => deleting);
    const replacement = sendRecoverableUpload({ post: async () => { posted = true; throw new Error('Lost newer'); } }, storage, 'A', otherUpload, true, makeForm).catch(error => error);
    await new Promise(resolve => setImmediate(resolve)); assert.equal(posted, false);
    deletion.resolve(); await clearing; await replacement;
    assert.equal(posted, true);
    assert.equal((await readPendingUpload(storage, 'A')).upload.key, otherUpload.key);
  }
});

test('rejects wrong-owner and unbounded or clinical-text records without deleting evidence', async () => {
  const { storage, values } = storageFixture(); const key = recoveryStorageKey('A');
  for (const entry of [
    { ownerId: 'B', upload, consent: true }, { ownerId: 'A', upload, consent: false },
    { ownerId: 'A', upload: { ...upload, reviewed_text: 'private text' }, consent: true },
    { ownerId: 'A', upload: { ...upload, file: { ...upload.file, uri: 'https://remote.invalid/a.pdf' } }, consent: true },
    { ownerId: 'A', upload: { ...upload, file: { ...upload.file, name: 'x'.repeat(256) } }, consent: true },
    { ownerId: 'A', upload: { ...upload, size: 10_485_761 }, consent: true },
  ]) {
    values.set(key, JSON.stringify(entry));
    await assert.rejects(() => readPendingUpload(storage, 'A'));
    assert.equal(values.get(key), JSON.stringify(entry));
  }
});

test('a session-bound API refuses to send A file after login changes during storage', async () => {
  const { storage } = storageFixture(); const writing = deferred(); let started = false; let owner = 'A'; let sent = false;
  const set = storage.setItemAsync;
  storage.setItemAsync = async (...args) => { started = true; await writing.promise; await set(...args); };
  const versionOwner = owner;
  const api = { post: async () => { if (owner !== versionOwner) throw new Error('Session changed'); sent = true; return { data: document }; } };
  const pending = sendRecoverableUpload(api, storage, 'A', upload, true, makeForm).catch(error => error);
  await until(() => started); owner = 'B'; writing.resolve(); await pending;
  assert.equal(sent, false);
  assert.equal(await readPendingUpload(storage, 'B'), null);
  assert.equal((await readPendingUpload(storage, 'A')).upload.key, upload.key);
});

test('legacy pending upload without market remains readable and lookup-recoverable but cannot be silently rewritten or resent', async () => {
  const {storage,values}=storageFixture(); const legacy={...upload}; delete legacy.country; delete legacy.consent_language;
  values.set(recoveryStorageKey('A'),JSON.stringify({ownerId:'A',upload:legacy,consent:true}));
  const pending=await readPendingUpload(storage,'A'); assert.equal(pending.upload.country,undefined);
  await assert.rejects(() => sendRecoverableUpload({post:async()=>assert.fail('Legacy upload resent')},storage,'A',pending.upload,true,makeForm),/não inclui país/);
  await assert.rejects(() => sendRecoverableUpload({post:async()=>assert.fail('Old key market rewritten')},storage,'A',{...legacy,country:'PT',consent_language:'pt'},true,makeForm),/envio por confirmar/);
  assert.equal(await recoverCommittedUpload({get:async()=>({data:document})},storage,'A',pending),document);
  assert.equal(await readPendingUpload(storage,'A'),null);
});
test('country and consent language stay immutable through uncertain upload retry', async () => {
  const {storage}=storageFixture(); const calls=[]; const api={post:async(path,body)=>{calls.push(body.values);throw new Error('offline');}};
  await assert.rejects(()=>sendRecoverableUpload(api,storage,'A',upload,true,makeForm));
  const pending=await readPendingUpload(storage,'A');
  await assert.rejects(()=>sendRecoverableUpload(api,storage,'A',{...pending.upload,country:'PT'},true,makeForm),/envio por confirmar/);
  await assert.rejects(()=>sendRecoverableUpload(api,storage,'A',pending.upload,true,makeForm));
  assert.deepEqual(snapshot(calls[0]),snapshot(calls[1])); assert.equal(calls[1].country,'AO'); assert.equal(calls[1].consent_language,'pt');
});
