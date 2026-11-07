import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { patientCloseoutResponse } from '../src/screens/consultations.ts';
const source = ts.transpileModule(readFileSync(new URL('../src/screens/doctorConsultationCloseout.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace("'./consultations'", JSON.stringify(new URL('../src/screens/consultations.ts', import.meta.url).href));
const { doctorCloseoutResponse, loadDoctorCloseout, canRetainDoctorCloseout, InvalidDoctorCloseout } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const at = '2026-10-04T12:00:00Z';
const response = () => ({ consultation_id: 'older-visit', status: 'completed', closeout: {
  patient_summary: 'Corrected clinical summary not yet published', notes: { subjective: 'Current patient report', objective: null, assessment: 'Assessment', plan: 'Plan' },
  outcome: 'resolved', finalized_at: at, finalized_by: 'doctor-id', finalized_by_name: 'Original doctor', follow_up_required: false,
  follow_up: null, follow_up_instructions: null, current_revision: 1, current_is_published: false, current_digest: 'must-not-copy',
  original: { notes: { private: 'unused' } }, amendments: [{ revision: 1, author_name: 'Amending doctor', created_at: at, reason: 'Unused reason', digest: 'private' }],
  published_revision: 0, published_history: [{ revision: 0, patient_summary: 'Originally published summary', published_at: at, author_name: 'Original doctor' }],
} });

test('doctor reader separates current unpublished SOAP and summary from the last patient publication', () => {
  const data = response(); const result = doctorCloseoutResponse(data, 'older-visit');
  assert.equal(result.closeout.patient_summary, data.closeout.patient_summary);
  assert.equal(result.closeout.current_is_published, false); assert.equal(result.closeout.current_revision, 1);
  assert.equal(result.closeout.author_name, 'Amending doctor');
  assert.equal(result.closeout.notes.assessment, 'Assessment');
  assert.equal(result.closeout.published.patient_summary, 'Originally published summary');
  for (const key of ['original', 'amendments', 'current_digest', 'reason']) assert.equal(Object.hasOwn(result.closeout, key), false);
  assert.throws(() => patientCloseoutResponse(data, 'older-visit'), /verificar/);
});

test('an older doctor history entry opens by exact closeout ID without any patient-only metadata request', async () => {
  const paths = [];
  const result = await loadDoctorCloseout({ get: async path => { paths.push(path); return { data: response() }; } }, 'older-visit');
  assert.deepEqual(paths, ['/api/v1/consultations/older-visit/closeout']); assert.equal(result.consultation_id, 'older-visit');
  assert.deepEqual(doctorCloseoutResponse({ consultation_id: 'older-visit', status: 'cancelled', closeout: null }, 'older-visit'),
    { consultation_id: 'older-visit', status: 'cancelled', closeout: null });
});

test('invalid clinical attribution, identity or publication cannot become a verified record; access loss clears cache', () => {
  for (const mutate of [data => { data.consultation_id = 'other'; }, data => { data.closeout.current_revision = -1; },
    data => { data.closeout.current_is_published = true; }, data => { data.status = 'in_progress'; },
    data => { data.closeout.notes.assessment = {}; }, data => { data.closeout.amendments = []; },
    data => { data.closeout.published_history = []; }]) {
    const data = response(); mutate(data); assert.throws(() => doctorCloseoutResponse(data, 'older-visit'), InvalidDoctorCloseout);
  }
  assert.equal(canRetainDoctorCloseout(new InvalidDoctorCloseout()), false);
  for (const status of [401, 403, 404, 409]) assert.equal(canRetainDoctorCloseout({ response: { status } }), false);
  assert.equal(canRetainDoctorCloseout(new Error('Offline')), true);
});
