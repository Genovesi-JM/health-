import test from 'node:test';
import assert from 'node:assert/strict';
import {
  preparePhotoUpload, sendDocumentUpload, newUploadKey, canProcessDocument, canReviewDocument,
  startDocumentReview, reconcileDocumentReview, reviewPayload, saveDocumentReview, manualReviewMessage,
  DOCUMENT_TEXT_LIMIT, DOCUMENT_MAX_BYTES, preparePdfUpload, selectPdfUpload, validateDocumentUpload,
  documentTypeAvailable, documentUploadLimit, validateCachedDocumentUpload,
  documentMetadata, loadDocumentPage, mergeDocumentPage, documentAccessLost, documentCursorExpired,
} from '../src/screens/patientDocuments.ts';

const LIMIT = 10_485_760;
const capabilities = { upload_enabled: true, max_bytes: LIMIT, accepted_types: ['application/pdf', 'image/jpeg', 'image/png'], extraction: 'pdf_text' };
const pdf = { uri: 'file:///cache/exame.pdf', name: 'Exame.PDF', mimeType: 'application/pdf', size: 1234 };
const document = (extra = {}) => ({
  id: 'document-1', original_filename: 'exame.pdf', content_type: 'application/pdf', size_bytes: 100,
  status: 'ready_for_review', scan_status: 'clean', version: 2, extraction_method: 'pdf_text',
  extracted_text: 'Resultado extraído', reviewed_text: null, created_at: '2026-10-04T12:00:00Z',
  reviewed_at: null, error_code: null, ...extra,
});

test('exact upload replay rejects a missing or changed cache without changing the reserved request', () => {
  const selected = preparePdfUpload(pdf, capabilities, pdf.size, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  const before = JSON.stringify(selected);
  validateCachedDocumentUpload(selected, pdf.size);
  for (const size of [0, -1, Number.NaN, pdf.size + 1, LIMIT + 1]) {
    assert.throws(() => validateCachedDocumentUpload(selected, size), /temporário/);
    assert.equal(JSON.stringify(selected), before);
  }
});

test('document pages load only metadata and encode opaque cursors without sending text into list state', async () => {
  const paths = [];
  const api = { get: async path => { paths.push(path); return { data: { items: [document()], next_cursor: 'next/+==' } }; } };
  const first = await loadDocumentPage(api);
  await loadDocumentPage({ get: async path => { paths.push(path); return { data: { items: [], next_cursor: null } }; } }, first.next_cursor);
  assert.deepEqual(paths, ['/api/v1/patient-documents/page?limit=20', '/api/v1/patient-documents/page?limit=20&cursor=next%2F%2B%3D%3D']);
  assert.equal(Object.hasOwn(first.items[0], 'extracted_text'), false);
  assert.equal(Object.hasOwn(first.items[0], 'reviewed_text'), false);
  assert.equal(first.items[0].id, 'document-1');
});

test('overlapping pages deduplicate without replacing newer metadata or the active edited review', () => {
  const original = document({ version: 4 });
  const review = { ...startDocumentReview(original), text: 'A minha correção' };
  const prior = [documentMetadata(original)];
  const merged = mergeDocumentPage(prior, [document({ version: 2 }), document({ id: 'older-document' })]);
  assert.equal(merged.length, 2); assert.equal(merged[0].version, 4);
  assert.deepEqual(prior, [documentMetadata(original)]);
  assert.equal(review.text, 'A minha correção'); assert.equal(review.document.version, 4);
  assert.equal(Object.hasOwn(merged[1], 'extracted_text'), false);
});

test('failed or invalid pages preserve caller list and cursor; expired cursor requires explicit refresh', async () => {
  const state = { items: [documentMetadata(document())], next_cursor: 'opaque', review: 'Ainda a corrigir' };
  const before = structuredClone(state);
  for (const data of [null, [], { items: [], next_cursor: 'opaque' }, { items: [null], next_cursor: null }, { items: [], next_cursor: 4 }]) {
    await assert.rejects(() => loadDocumentPage({ get: async () => ({ data }) }, state.next_cursor));
  }
  await assert.rejects(() => loadDocumentPage({ get: async () => { throw { response: { status: 422 } }; } }, state.next_cursor));
  assert.deepEqual(state, before);
  assert.equal(documentCursorExpired({ response: { status: 422 } }), true);
  assert.equal(documentCursorExpired({ response: { status: 503 } }), false);
  assert.equal(documentAccessLost({ response: { status: 401 } }), true);
  assert.equal(documentAccessLost({ response: { status: 403 } }), true);
  assert.equal(documentAccessLost({ response: { status: 500 } }), false);
});

test('native picker accepts only JPG/PNG and rejects HEIC, PDF and oversized photos', () => {
  assert.equal(preparePhotoUpload({ uri: 'file:///photo.png', mimeType: 'image/png', fileSize: LIMIT }, LIMIT).file.type, 'image/png');
  assert.equal(preparePhotoUpload({ uri: 'file:///photo', fileName: 'Exame.JPEG' }, LIMIT).file.type, 'image/jpeg');
  for (const mimeType of ['image/heic', 'application/pdf', 'image/gif']) {
    assert.throws(() => preparePhotoUpload({ uri: 'file:///photo.jpg', mimeType }, LIMIT), /JPG ou PNG/);
  }
  assert.throws(() => preparePhotoUpload({ uri: 'file:///photo.jpg', fileSize: LIMIT + 1 }, LIMIT), /10 MB/);
  assert.throws(() => preparePhotoUpload({ uri: 'file:///photo.jpg', fileSize: 0 }, LIMIT), /10 MB/);
  assert.throws(() => preparePhotoUpload({ uri: 'file:///unknown' }, LIMIT), /JPG ou PNG/);
});

test('PDF selection accepts explicit or inferred PDF type and a local file at the 10 MiB boundary', () => {
  const upload = preparePdfUpload({ ...pdf, name: 'folder/Exame.PDF', mimeType: undefined }, capabilities, LIMIT, 'stable-key');
  assert.deepEqual(upload, { key: 'stable-key', file: { uri: pdf.uri, name: 'Exame.PDF', type: 'application/pdf' }, size: LIMIT });
  assert.equal(preparePdfUpload(pdf, capabilities).file.type, 'application/pdf');
});

test('PDF selection rejects mismatched MIME, non-PDF names, missing bytes and inaccessible files', () => {
  for (const asset of [
    { ...pdf, mimeType: 'image/png' }, { ...pdf, mimeType: 'application/octet-stream' },
    { ...pdf, name: 'exame.exe' }, { ...pdf, uri: 'https://example.test/document.pdf' },
    { ...pdf, uri: 'content://document.pdf' }, { ...pdf, size: undefined },
    { ...pdf, size: 0 }, { ...pdf, size: NaN }, { ...pdf, size: -1 },
    { ...pdf, size: LIMIT + 1 }, { ...pdf, size: 1.5 },
  ]) assert.throws(() => preparePdfUpload(asset, capabilities));
});

test('PDF upload obeys a lower server limit and never accepts a raised limit above 10 MiB', () => {
  assert.equal(documentUploadLimit({ ...capabilities, max_bytes: LIMIT * 4 }), DOCUMENT_MAX_BYTES);
  assert.throws(() => preparePdfUpload(pdf, { ...capabilities, max_bytes: 1000 }));
  assert.throws(() => preparePdfUpload({ ...pdf, size: LIMIT + 1 }, { ...capabilities, max_bytes: LIMIT * 4 }));
  for (const caps of [null, { ...capabilities, max_bytes: NaN }, { ...capabilities, max_bytes: -1 },
    { ...capabilities, upload_enabled: false }, { ...capabilities, accepted_types: ['image/png'] },
    { ...capabilities, accepted_types: null }]) {
    assert.equal(documentTypeAvailable(caps, 'application/pdf'), false);
    assert.throws(() => preparePdfUpload(pdf, caps));
  }
});

test('cancelled PDF picker does not replace selection, consent, key or review edits', async () => {
  const state = { upload: preparePhotoUpload({ uri: 'file:///photo.jpg' }, LIMIT), consent: true, review: 'A minha correção' };
  const before = structuredClone(state);
  const replacement = await selectPdfUpload(capabilities, async () => ({ canceled: true, assets: null }), () => { throw new Error('Unexpected stat'); });
  if (replacement) { state.upload = replacement; state.consent = false; }
  assert.deepEqual(state, before);
});

test('PDF picker failure or invalid selection preserves draft and can be corrected on the next selection', async () => {
  const state = { upload: preparePdfUpload(pdf, capabilities), consent: true, review: 'Texto corrigido' };
  const before = structuredClone(state);
  const replace = async (pick, stat = () => 1234) => {
    const selected = await selectPdfUpload(capabilities, pick, stat);
    if (selected) { state.upload = selected; state.consent = false; }
  };
  await assert.rejects(() => replace(async () => { throw new Error('Provider unavailable'); }));
  await assert.rejects(() => replace(async () => ({ canceled: false, assets: [] })));
  await assert.rejects(() => replace(async () => ({ canceled: false, assets: [pdf] }), () => LIMIT + 1));
  await assert.rejects(() => replace(async () => ({ canceled: false, assets: [pdf] }), () => { throw new Error('File missing'); }));
  assert.deepEqual(state, before);
  await replace(async () => ({ canceled: false, assets: [{ ...pdf, name: 'Correção.pdf', size: undefined }] }));
  assert.equal(state.upload.file.name, 'Correção.pdf');
  assert.equal(state.upload.size, 1234);
  assert.notEqual(state.upload.key, before.upload.key);
  assert.equal(state.consent, false);
  assert.equal(state.review, before.review);
});

test('actual cached PDF bytes determine size and a disabled capability never opens the picker', async () => {
  await assert.rejects(() => selectPdfUpload(capabilities,
    async () => ({ canceled: false, assets: [{ ...pdf, size: 1 }] }), () => LIMIT + 1));
  await assert.rejects(() => selectPdfUpload({ ...capabilities, upload_enabled: false },
    async () => { assert.fail('Picker must remain closed'); }, () => 1));
  const upload = preparePdfUpload(pdf, capabilities);
  assert.throws(() => validateDocumentUpload(upload, { ...capabilities, accepted_types: ['image/png'] }));
});

test('PDF retry sends the same private multipart file and key, with explicit processing consent', async () => {
  const upload = preparePdfUpload(pdf, capabilities);
  const requests = [];
  const api = { post: async (path, body, options) => {
    requests.push({ path, body, options });
    if (requests.length === 1) throw new Error('Response lost');
    return { data: document({ status: 'pending_processing' }) };
  } };
  const makeForm = () => ({ values: {}, append(key, value) { this.values[key] = value; } });
  await assert.rejects(() => sendDocumentUpload(api, upload, false, makeForm), /Autorize/);
  assert.equal(requests.length, 0);
  await assert.rejects(() => sendDocumentUpload(api, upload, true, makeForm), /Response lost/);
  await sendDocumentUpload(api, upload, true, makeForm);
  for (const request of requests) {
    assert.equal(request.path, '/api/v1/patient-documents');
    assert.deepEqual(request.body.values.file, upload.file);
    assert.equal(request.body.values.processing_consent, 'true');
    assert.equal(request.options.headers['Idempotency-Key'], upload.key);
  }
});

test('upload key is a UUID and remains stable for retries after an uncertain upload', async () => {
  const attempts = [];
  const upload = preparePhotoUpload({ uri: 'file:///photo.jpg', fileName: 'exame.jpg' }, LIMIT);
  assert.match(upload.key, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.notEqual(newUploadKey(), upload.key);
  const api = { post: async (url, body, options) => {
    attempts.push({ url, body, options });
    if (attempts.length === 1) throw new Error('Response lost');
    return { data: document({ status: 'pending_processing' }) };
  } };
  const makeForm = () => ({ values: {}, append(key, value) { this.values[key] = value; } });
  await assert.rejects(() => sendDocumentUpload(api, upload, true, makeForm), /Response lost/);
  assert.equal((await sendDocumentUpload(api, upload, true, makeForm)).status, 'pending_processing');
  assert.equal(attempts.length, 2);
  for (const attempt of attempts) {
    assert.equal(attempt.url, '/api/v1/patient-documents');
    assert.equal(attempt.options.headers['Idempotency-Key'], upload.key);
    assert.equal(attempt.options.headers['Content-Type'], 'multipart/form-data');
    assert.equal(attempt.body.values.processing_consent, 'true');
    assert.deepEqual(attempt.body.values.file, upload.file);
  }
});

test('upload without explicit processing consent never calls the API', async () => {
  let called = false;
  const api = { post: async () => { called = true; return { data: document() }; } };
  await assert.rejects(() => sendDocumentUpload(api, preparePhotoUpload({ uri: 'file:///photo.jpg' }, LIMIT), false), /Autorize/);
  assert.equal(called, false);
});

test('review is available only for clean, reviewable documents', () => {
  for (const status of ['ready_for_review', 'needs_manual_review']) {
    assert.equal(canReviewDocument(document({ status })), true);
    assert.equal(canReviewDocument(document({ status, scan_status: 'error' })), false);
    assert.equal(canReviewDocument(document({ status, scan_status: 'infected' })), false);
  }
  for (const status of ['pending_processing', 'processing_failed', 'confirmed', 'rejected', 'blocked']) {
    assert.equal(canReviewDocument(document({ status })), false);
  }
});

test('retry processing is available after scanner failure but never after confirmation', () => {
  assert.equal(canProcessDocument(document({ status: 'pending_processing', scan_status: 'pending' })), true);
  assert.equal(canProcessDocument(document({ status: 'processing_failed', scan_status: 'error' })), true);
  for (const status of ['ready_for_review', 'needs_manual_review', 'confirmed', 'rejected', 'blocked']) {
    assert.equal(canProcessDocument(document({ status })), false);
  }
});

test('manual review starts empty rather than inventing OCR and uses patient review when saved', () => {
  assert.equal(startDocumentReview(document({ extracted_text: null, status: 'needs_manual_review' })).text, '');
  assert.equal(startDocumentReview(document({ reviewed_text: 'Texto corrigido', status: 'confirmed' })).text, 'Texto corrigido');
  assert.equal(startDocumentReview(document({ reviewed_text: '' })).text, '');
});

test('confirmation requires nonempty bounded text while rejection can be empty', () => {
  const draft = startDocumentReview(document());
  assert.deepEqual(reviewPayload(draft, 'confirm'), { version: 2, decision: 'confirm', text: 'Resultado extraído' });
  assert.throws(() => reviewPayload({ ...draft, text: '  ' }, 'confirm'), /Introduza/);
  assert.throws(() => reviewPayload({ ...draft, text: 'x'.repeat(DOCUMENT_TEXT_LIMIT + 1) }, 'confirm'), /100 000/);
  assert.equal(reviewPayload({ ...draft, text: '' }, 'reject').text, '');
});

test('successful review sends the current revision and reports success only after server response', async () => {
  const edited = { ...startDocumentReview(document()), text: 'Correção do doente' };
  let received;
  const api = {
    put: async (path, data) => { received = { path, data }; return { data: document({ status: 'confirmed', version: 3, reviewed_text: edited.text }) }; },
    get: async () => { throw new Error('Unexpected read'); },
  };
  const result = await saveDocumentReview(api, edited, 'confirm');
  assert.deepEqual(received, { path: '/api/v1/patient-documents/document-1/review', data: { version: 2, decision: 'confirm', text: edited.text } });
  assert.equal(result.saved, true);
  assert.equal(result.draft.document.status, 'confirmed');
  assert.equal(result.draft.text, edited.text);
});

test('conflicting review fetches the latest revision but preserves unsaved patient edits', async () => {
  const edited = { ...startDocumentReview(document()), text: 'A minha correção' };
  let writes = 0;
  const api = {
    put: async () => { writes++; throw { response: { status: 409 } }; },
    get: async () => ({ data: document({ version: 3, extracted_text: 'Outro texto' }) }),
  };
  const result = await saveDocumentReview(api, edited, 'confirm');
  assert.equal(result.saved, false);
  assert.equal(result.draft.text, edited.text);
  assert.equal(result.draft.document.version, 3);
  assert.equal(result.draft.conflict, true);
  assert.equal(writes, 1);
  assert.throws(() => reviewPayload(result.draft, 'confirm'), /Compare/);
  assert.equal(reviewPayload({ ...result.draft, conflict: false }, 'confirm').version, 3);
});

test('a review completed elsewhere cannot be silently overwritten after conflict', async () => {
  const edited = { ...startDocumentReview(document()), text: 'Alteração local' };
  const api = {
    put: async () => { throw { response: { status: 409 } }; },
    get: async () => ({ data: document({ version: 3, status: 'confirmed', reviewed_text: 'Já confirmado' }) }),
  };
  const result = await saveDocumentReview(api, edited, 'confirm');
  assert.equal(result.draft.text, 'Alteração local');
  assert.equal(result.draft.document.reviewed_text, 'Já confirmado');
  assert.equal(result.saved, false);
  assert.throws(() => reviewPayload({ ...result.draft, conflict: false }, 'confirm'), /já não/);
});

test('retry after a lost committed review recovers only the matching saved result', async () => {
  const edited = { ...startDocumentReview(document()), text: '  Texto revisto  ' };
  let writes = 0;
  let committed = false;
  const api = {
    put: async () => {
      writes++;
      if (committed) throw { response: { status: 409 } };
      committed = true;
      throw new Error('Response lost after commit');
    },
    get: async () => ({ data: document({ version: 3, status: 'confirmed', reviewed_text: 'Texto revisto' }) }),
  };
  await assert.rejects(() => saveDocumentReview(api, edited, 'confirm'), /Response lost/);
  const result = await saveDocumentReview(api, edited, 'confirm');
  assert.equal(result.saved, true);
  assert.equal(result.draft.conflict, false);
  assert.equal(result.draft.text, 'Texto revisto');
  assert.equal(writes, 2);
});

test('failed saves and failed conflict reloads preserve the caller draft and never report success', async () => {
  const edited = { ...startDocumentReview(document()), text: 'Alteração ainda local' };
  const snapshot = structuredClone(edited);
  const api = {
    put: async () => { throw new Error('Offline'); },
    get: async () => { throw new Error('Reload failed'); },
  };
  await assert.rejects(() => saveDocumentReview(api, edited, 'confirm'), /Offline/);
  api.put = async () => { throw { response: { status: 409 } }; };
  await assert.rejects(() => saveDocumentReview(api, edited, 'confirm'), /Reload failed/);
  assert.deepEqual(edited, snapshot);
});

test('reconciliation cannot substitute another patient document', () => {
  assert.throws(() => reconcileDocumentReview(startDocumentReview(document()), document({ id: 'another-id' })), /não corresponde/);
});

test('partial PDF extraction warns to check all pages rather than treating text as complete', () => {
  assert.match(manualReviewMessage(document({ error_code: 'partial_text_requires_ocr' })), /incompleto.*todas as páginas/);
  assert.match(manualReviewMessage(document({ error_code: 'ocr_required' })), /transcreva apenas/);
  assert.match(manualReviewMessage(document({ error_code: 'page_limit' })), /original completo/);
});
