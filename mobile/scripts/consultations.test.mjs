import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadPatientConsultation, canCancelConsultation, consultationNextStep,
  videoAvailabilityMessage, consultationDate, consultationError, canRetainConsultationAfterError, FOLLOW_UP_STATUS,
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
      if (path.endsWith('/me')) return { data: list };
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
    '/api/v1/consultations/me',
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
  const api = makeApi({ failed: { '/api/v1/consultations/me': new Error('Offline') } });
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
  assert.equal(canCancelConsultation('requested'), true);
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
