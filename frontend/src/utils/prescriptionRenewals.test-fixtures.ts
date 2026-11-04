import { renewalActionStatus, renewalDigest } from './prescriptionRenewals';
import type { PendingRenewal, RenewalCreate, RenewalDecisionBody, RenewalRequest } from './prescriptionRenewals';
export const renewalKey = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const renewalBody: RenewalCreate = { doctor_id: 'doctor-A', country: 'AO', consent_language: 'pt', medication_name: 'Medicamento sintético', dose: 'Dose sintética', frequency: 'Frequência sintética', reason: 'Motivo privado sintético' };
export const decisionBody: RenewalDecisionBody = { action: 'approve', expected_revision: 0, doctor_note: 'Nota clínica privada sintética', adjusted_dose: null, adjusted_frequency: null };
export function renewalRow(overrides: Partial<RenewalRequest> = {}): RenewalRequest {
  return { id: 'request-1', patient_id: 'patient-1', ...renewalBody, status: 'pending', request_key: renewalKey, revision: 0,
    decision_state: 'pending', decision_id: null, standalone_prescription_id: null, doctor_note: null, adjusted_dose: null, adjusted_frequency: null,
    patient_name: 'Paciente sintético', doctor_name: 'Médico sintético', created_at: '2026-10-04T12:00:00+00:00', decided_at: null, ...overrides };
}
export async function renewalPending(kind: 'creation' | 'decision' = 'creation', body: RenewalCreate | RenewalDecisionBody = kind === 'creation' ? renewalBody : decisionBody): Promise<PendingRenewal> {
  return { owner: 'owner-A', kind, key: renewalKey, digest: await renewalDigest(body), country: 'AO', consent_language: 'pt', target: kind === 'creation' ? 'doctor-A' : 'request-1' };
}
export function decisionReceipt(key = renewalKey, body = decisionBody) {
  const status = renewalActionStatus[body.action]; const prescription = ['approved', 'adjusted'].includes(status) ? 'prescription-1' : null;
  const request = renewalRow({ status, revision: 1, decision_state: 'decided', decision_id: 'decision-1', standalone_prescription_id: prescription,
    doctor_note: body.doctor_note, adjusted_dose: body.adjusted_dose, adjusted_frequency: body.adjusted_frequency, decided_at: '2026-10-04T13:00:00Z' });
  return { request, decision: { id: 'decision-1', request_id: request.id, request_key: key, action: status, revision: 1, country: 'AO', consent_language: 'pt',
    medication_name: request.medication_name, dose: request.adjusted_dose ?? request.dose, frequency: request.adjusted_frequency ?? request.frequency,
    doctor_note: request.doctor_note, standalone_prescription_id: prescription, decided_at: request.decided_at } };
}
