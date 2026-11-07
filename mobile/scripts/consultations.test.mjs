import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadPatientConsultation, canCancelConsultation, consultationNextStep,
  videoAvailabilityMessage, consultationDate, consultationError, canRetainConsultationAfterError, FOLLOW_UP_STATUS,
  patientCloseoutResponse, patientSummaryPublication,
} from '../src/screens/consultations.ts';

const published = {
  consultation_id: 'consultation-1', status: 'completed',
  closeout: {
    patient_summary: 'Resumo revisto pelo médico.', follow_up_instructions: 'Orientações do médico.',
    outcome: 'follow_up', finalized_at: '2026-10-04T10:00:00+00:00', finalized_by: 'doctor-user',
    finalized_by_name: 'Médico Teste', follow_up_required: true,
    follow_up: { id: 'task-1', assigned_user_id: 'nurse-user', assigned_name: 'Enfermeiro Teste', due_at: '2026-10-06T10:00:00+00:00', status: 'open' },
  },
};
const disabledVideo = { enabled: false, provider: null, recording_enabled: false, message: 'Videochamada indisponível.' };
const history = [{ id: 'consultation-1', specialty: 'clinica_geral', status: 'in_progress', started_at: '2026-10-04T09:00:00+00:00' }];

function makeApi({ result = published, list = history, capabilities = disabledVideo, failed = {} } = {}) {
  const paths = [];
  return {
    paths,
    get: async path => {
      paths.push(path);
      if (Object.hasOwn(failed, path)) throw failed[path];
      if (path.endsWith('/closeout')) return { data: result };
      if (path.includes('/me?consultation_id=')) return { data: list };
      if (path.endsWith('/capabilities')) return { data: capabilities };
      throw new Error(`Unexpected request: ${path}`);
    },
  };
}

test('patient detail reads published summary and clinician-owned followup without preparing or joining video', async () => {
  const api = makeApi();
  const detail = await loadPatientConsultation(api, 'consultation-1');
  assert.deepEqual(detail.result.closeout, published.closeout);
  assert.equal(detail.result.closeout.follow_up.assigned_name, 'Enfermeiro Teste');
  assert.equal(detail.result.closeout.follow_up.due_at, '2026-10-06T10:00:00+00:00');
  assert.equal(FOLLOW_UP_STATUS[detail.result.closeout.follow_up.status], 'Pendente');
  assert.deepEqual(api.paths.sort(), [
    '/api/v1/consultations/consultation-1/closeout',
    '/api/v1/consultations/me?consultation_id=consultation-1',
    '/api/v1/teleconsultations/capabilities',
  ]);
});

test('closeout status takes priority over stale list metadata', async () => {
  const detail = await loadPatientConsultation(makeApi(), 'consultation-1');
  assert.equal(detail.consultation.status, 'completed');
  assert.equal(canCancelConsultation(detail.consultation.status), false);
  assert.equal(history[0].status, 'in_progress');
});

test('capability failure does not hide an available summary or create video access', async () => {
  const api = makeApi({ failed: { '/api/v1/teleconsultations/capabilities': new Error('Offline') } });
  const detail = await loadPatientConsultation(api, 'consultation-1');
  assert.deepEqual(detail.result, published);
  assert.equal(detail.capabilities, null);
  assert.match(videoAvailabilityMessage(detail.capabilities), /Não foi possível confirmar/);
});

test('metadata failure preserves authorized closeout and marks missing schedule information', async () => {
  const api = makeApi({ failed: { '/api/v1/consultations/me?consultation_id=consultation-1': new Error('Offline') } });
  const detail = await loadPatientConsultation(api, 'consultation-1');
  assert.deepEqual(detail.result, published);
  assert.equal(detail.consultation, null);
  assert.equal(detail.metadataUnavailable, true);
});

test('older consultation outside latest history remains readable through owner-authorized closeout', async () => {
  const detail = await loadPatientConsultation(makeApi({ list: [] }), 'consultation-1');
  assert.equal(detail.consultation, null);
  assert.equal(detail.metadataUnavailable, false);
  assert.equal(detail.result.status, 'completed');
});

test('failed closeout access never falls back to stale list data or invents a summary', async () => {
  for (const status of [401, 403, 404, 500]) {
    const failure = { response: { status } };
    const api = makeApi({ failed: { '/api/v1/consultations/consultation-1/closeout': failure } });
    await assert.rejects(() => loadPatientConsultation(api, 'consultation-1'), error => error === failure);
  }
});

test('consultation identity must match response and path encodes the requested identifier', async () => {
  await assert.rejects(() => loadPatientConsultation(makeApi({ result: { ...published, consultation_id: 'another' } }), 'consultation-1'), /não corresponde/);
  const api = makeApi({ result: { ...published, consultation_id: 'consultation/one?x=1' } });
  await loadPatientConsultation(api, 'consultation/one?x=1');
  assert.equal(api.paths[0], '/api/v1/consultations/consultation%2Fone%3Fx%3D1/closeout');
  const empty = makeApi();
  await assert.rejects(() => loadPatientConsultation(empty, ' '), /não encontrada/);
  assert.deepEqual(empty.paths, []);
});

test('unpublished and legacy closeouts remain empty and never imply successful video', async () => {
  for (const status of ['requested', 'scheduled', 'in_progress', 'completed', 'cancelled']) {
    const detail = await loadPatientConsultation(makeApi({ result: { consultation_id: 'consultation-1', status, closeout: null } }), 'consultation-1');
    assert.equal(detail.result.closeout, null);
    assert.equal(detail.result.status, status);
    assert.equal(videoAvailabilityMessage(detail.capabilities), 'Videochamada indisponível.');
  }
});

test('client stays explicit about unavailable native video even if future server advertises it', () => {
  assert.match(videoAvailabilityMessage(null), /Não foi possível confirmar/);
  assert.match(videoAvailabilityMessage({ ...disabledVideo, message: '' }), /ainda não está disponível/);
  assert.match(videoAvailabilityMessage({ ...disabledVideo, enabled: true, message: 'Join now' }), /ainda não estão disponíveis nesta versão/);
});

test('only pending and scheduled consultations offer patient cancellation', () => {
  assert.equal(canCancelConsultation('requested', 'open'), true);
  assert.equal(canCancelConsultation('requested', 'expiry_pending'), true);
  for (const state of [undefined, null, 'review_required', 'expired']) assert.equal(canCancelConsultation('requested', state), false);
  assert.equal(canCancelConsultation('scheduled'), true);
  for (const status of ['in_progress', 'completed', 'cancelled', 'no_show', 'unknown', '']) assert.equal(canCancelConsultation(status), false);
  assert.match(consultationNextStep('requested'), /ainda não está confirmado/);
  assert.match(consultationNextStep('in_progress'), /concluir o registo clínico/);
  assert.match(consultationNextStep('unknown'), /Atualize/);
});

test('dates handle missing data and preserve the timestamp instant for either market', () => {
  assert.equal(consultationDate(null), 'Por definir');
  assert.equal(consultationDate('invalid'), 'Por definir');
  assert.equal(consultationDate('2026-10-04T10:00:00+01:00'), consultationDate('2026-10-04T09:00:00Z'));
});

test('errors accept readable server details without rendering validation objects or raw network errors', () => {
  assert.equal(consultationError({ response: { data: { detail: 'Consulta indisponível.' } } }, 'Tente novamente.'), 'Consulta indisponível.');
  for (const error of [null, new Error('Raw token URL'), { response: { data: { detail: [{ msg: 'Invalid' }] } } }]) {
    assert.equal(consultationError(error, 'Tente novamente.'), 'Tente novamente.');
  }
});

test('access changes and integrity conflicts clear a previously visible summary while offline errors mark it stale', () => {
  for (const status of [401, 403, 404, 409]) assert.equal(canRetainConsultationAfterError({ response: { status } }), false);
  for (const error of [null, new Error('Offline'), { response: { status: 503 } }]) assert.equal(canRetainConsultationAfterError(error), true);
});

const updatedSummary = {
  ...published,
  closeout: {
    ...published.closeout,
    patient_summary: 'Resumo corrigido e publicado.',
    published_revision: 3,
    published_history: [
      { revision: 0, patient_summary: published.closeout.patient_summary, published_at: published.closeout.finalized_at, author_name: 'Médico inicial' },
      { revision: 3, patient_summary: 'Resumo corrigido e publicado.', published_at: '2026-10-05T15:30:00Z', author_name: 'Médica da correção' },
    ],
  },
};

test('latest patient summary and attribution come from the explicitly published revision', async () => {
  const detail = await loadPatientConsultation(makeApi({ result: updatedSummary }), 'consultation-1');
  assert.equal(detail.result.closeout.patient_summary, 'Resumo corrigido e publicado.');
  assert.deepEqual(patientSummaryPublication(detail.result.closeout), {
    author_name: 'Médica da correção', published_at: '2026-10-05T15:30:00Z',
  });
  assert.equal(detail.result.closeout.finalized_by_name, 'Médico Teste');
  assert.deepEqual(detail.result.closeout.published_history.map(entry => entry.revision), [0, 3]);
});

test('patient closeout allowlist excludes accidentally returned clinical fields at every level', async () => {
  const privateFields = {
    current_digest: 'PRIVATE_DIGEST', current_revision: 4, current_is_published: false,
    original: { subjective: 'PRIVATE_ORIGINAL' },
    amendments: [{ patient_summary: 'PRIVATE_UNPUBLISHED', reason: 'PRIVATE_REASON' }],
    subjective: 'PRIVATE_SOAP', objective: 'PRIVATE_SOAP', assessment: 'PRIVATE_SOAP', plan: 'PRIVATE_SOAP',
    reason: 'PRIVATE_REASON',
  };
  const response = {
    ...updatedSummary, ...privateFields,
    closeout: {
      ...updatedSummary.closeout, ...privateFields,
      follow_up: { ...updatedSummary.closeout.follow_up, ...privateFields },
      published_history: updatedSummary.closeout.published_history.map(entry => ({ ...entry, ...privateFields })),
    },
  };
  const detail = await loadPatientConsultation(makeApi({ result: response }), 'consultation-1');
  assert.deepEqual(detail.result, updatedSummary);
  assert.doesNotMatch(JSON.stringify(detail.result), /PRIVATE_|current_digest|current_revision|current_is_published|amendments|subjective|objective|assessment|reason/);
  assert.equal(response.closeout.current_revision, 4, 'Do not mutate the received server object');
});

test('published history orders revisions without requiring private intervening amendments', () => {
  const result = patientCloseoutResponse({
    ...updatedSummary,
    closeout: { ...updatedSummary.closeout, published_history: [...updatedSummary.closeout.published_history].reverse() },
  }, 'consultation-1');
  assert.deepEqual(result.closeout.published_history.map(entry => entry.revision), [0, 3]);
});

test('legacy published summaries keep original attribution without fabricating a revision', () => {
  const result = patientCloseoutResponse(published, 'consultation-1');
  assert.deepEqual(result, published);
  assert.equal(result.closeout.published_history, undefined);
  assert.deepEqual(patientSummaryPublication(result.closeout), {
    author_name: 'Médico Teste', published_at: published.closeout.finalized_at,
  });
});

test('inconsistent publication evidence clears cached summaries instead of exposing an unverified version', () => {
  const base = updatedSummary.closeout;
  const variants = [
    { ...base, published_revision: 2 },
    { ...base, published_revision: undefined },
    { ...base, published_history: [] },
    { ...base, published_history: [base.published_history[1]] },
    { ...base, published_history: [...base.published_history, base.published_history[1]] },
    { ...base, patient_summary: 'An unpublished correction must not replace the patient summary.' },
    { ...base, published_history: [base.published_history[0], { ...base.published_history[1], published_at: '2026-10-05T15:30:00' }] },
    { ...base, published_history: [...base.published_history, { ...base.published_history[1], revision: 4, patient_summary: 'Not published' }] },
  ];
  for (const closeout of variants) {
    assert.throws(() => patientCloseoutResponse({ ...updatedSummary, closeout }, 'consultation-1'), error => {
      assert.equal(canRetainConsultationAfterError(error), false);
      return /resumo publicado/.test(error.message);
    });
  }
});
