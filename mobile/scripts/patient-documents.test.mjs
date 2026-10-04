import test from 'node:test';
import assert from 'node:assert/strict';
import {
  preparePhotoUpload, sendDocumentUpload, newUploadKey, canProcessDocument, canReviewDocument,
  startDocumentReview, reconcileDocumentReview, reviewPayload, saveDocumentReview, manualReviewMessage,
  DOCUMENT_TEXT_LIMIT,
} from '../src/screens/patientDocuments.ts';

const LIMIT = 10_485_760;
const document = (extra = {}) => ({
  id: 'document-1', original_filename: 'exame.pdf', content_type: 'application/pdf', size_bytes: 100,
  status: 'ready_for_review', scan_status: 'clean', version: 2, extraction_method: 'pdf_text',
  extracted_text: 'Resultado extraído', reviewed_text: null, created_at: '2026-10-04T12:00:00Z',
  reviewed_at: null, error_code: null, ...extra,
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
