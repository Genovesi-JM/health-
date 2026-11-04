import { webcrypto } from 'node:crypto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import PatientPrescriptionRequestPage from './PatientPrescriptionRequestPage';
import DoctorPrescriptionsPage from './DoctorPrescriptionsPage';
import { readingsConsentState } from '../utils/readingConsent.test-fixtures';
import { decisionBody, decisionReceipt, renewalBody, renewalKey, renewalPending, renewalRow } from '../utils/prescriptionRenewals.test-fixtures';
import { readPendingRenewal, savePendingRenewal } from '../utils/prescriptionRenewals';

const identity = vi.hoisted(() => ({ userId: 'owner-A', token: 'token-A' }));
vi.mock('../api', () => ({ getSession: () => ({ ...identity }), default: { get: vi.fn(), post: vi.fn() } }));
const response = (data: unknown) => Promise.resolve({ data });
const page = (items = [renewalRow()], next_cursor: string | null = null) => ({ items, next_cursor });
const doctor = { id: 'doctor-A', display_name: 'Médico sintético', practice_country: 'AO' };
const tree = (kind = 'patient') => <MemoryRouter>{kind === 'patient' ? <PatientPrescriptionRequestPage /> : <DoctorPrescriptionsPage />}</MemoryRouter>;
function deferred() { let resolve!: (value: { data: unknown }) => void; let reject!: (failure: unknown) => void; const promise = new Promise<{ data: unknown }>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
async function fillPatient() {
  await waitFor(() => expect(screen.getByLabelText('Médico')).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText('Médico'), { target: { value: 'doctor-A' } });
  fillPatientText();
}
function fillPatientText() {
  for (const [label, value] of Object.entries({ Medicamento: renewalBody.medication_name, Dose: renewalBody.dose, Frequência: renewalBody.frequency, Motivo: renewalBody.reason })) fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
async function fillDoctor() {
  fireEvent.click(await screen.findByRole('button', { name: `Rever decisão — ${renewalBody.medication_name}` }));
  fillDoctorText();
}
function fillDoctorText() {
  fireEvent.change(screen.getByLabelText('Ação'), { target: { value: 'approve' } });
  fireEvent.change(screen.getByLabelText('Nota clínica'), { target: { value: decisionBody.doctor_note } });
}
beforeEach(() => {
  vi.restoreAllMocks(); vi.resetAllMocks(); localStorage.clear(); vi.stubGlobal('crypto', webcrypto); identity.userId = 'owner-A'; identity.token = 'token-A';
  vi.mocked(api.get).mockImplementation((url, config) => {
    if (url.includes('consent-state')) return response(readingsConsentState((config?.params as { country: 'AO' | 'PT' }).country));
    if (url === '/api/v1/doctors/') return response([doctor]);
    return response(page());
  });
  vi.mocked(api.post).mockImplementation(async (_url, body, config) => ({ data: renewalRow({ ...body, request_key: String(config?.headers?.['Idempotency-Key']) }) }));
});
it('requires an explicit doctor and sends trimmed exact request with Portugal scope after current consent', async () => {
  vi.mocked(api.get).mockImplementation((url, config) => url.includes('consent-state') ? response(readingsConsentState('PT')) : url === '/api/v1/doctors/' ? response([{ ...doctor, practice_country: (config?.params as { country: string }).country }]) : response(page([])));
  render(tree()); await waitFor(() => expect(screen.getByLabelText('Médico')).not.toBeDisabled()); expect(screen.getByLabelText('Médico')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('País do pedido'), { target: { value: 'PT' } }); await fillPatient();
  fireEvent.change(screen.getByLabelText('Medicamento'), { target: { value: `  ${renewalBody.medication_name}  ` } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido para avaliação' }));
  await screen.findByText('Pedido confirmado. Estado atual: Pendente.');
  expect(api.post).toHaveBeenCalledWith('/api/v1/prescription-requests', { ...renewalBody, country: 'PT' }, { headers: { Authorization: 'Bearer token-A', 'Idempotency-Key': expect.any(String) } });
  expect(api.get).toHaveBeenCalledWith('/api/v1/compliance/consent-state', { headers: { Authorization: 'Bearer token-A' }, params: { country: 'PT', language: 'pt' } });
  expect(readPendingRenewal('owner-A', 'creation')).toBeNull();
});
it('preserves personal history and draft when new consent is unavailable; transmits no clinical body', async () => {
  const state = readingsConsentState(); state.available = false;
  vi.mocked(api.get).mockImplementation(url => url.includes('consent-state') ? response(state) : url === '/api/v1/doctors/' ? response([doctor]) : response(page()));
  render(tree()); await fillPatient(); fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido para avaliação' }));
  await screen.findByText(/Reveja os consentimentos atuais/); expect(api.post).not.toHaveBeenCalled(); expect(readPendingRenewal('owner-A', 'creation')).toBeNull();
  expect(screen.getByRole('heading', { name: renewalBody.medication_name })).toBeInTheDocument(); expect(screen.getByLabelText('Motivo')).toHaveValue(renewalBody.reason);
});
it('keeps an uncertain UUID through reload and lookup404; only exact reentry can replay without new consent', async () => {
  vi.mocked(api.post).mockRejectedValue(new Error('lost response'));
  const view = render(tree()); await fillPatient(); fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido para avaliação' }));
  await screen.findByText(/lost response/); const saved = readPendingRenewal('owner-A', 'creation')!; expect(saved).not.toBeNull();
  expect(localStorage.getItem('kaya_pending_renewal:creation:owner-A')).not.toContain(renewalBody.medication_name); expect(screen.getByLabelText('Medicamento')).toBeDisabled();
  view.unmount(); vi.mocked(api.get).mockImplementation(url => url.includes('/requests/') ? Promise.reject({ response: { status: 404 } }) : url === '/api/v1/doctors/' ? response([]) : response(page([])));
  render(tree()); expect(screen.getByLabelText('Medicamento')).toHaveValue(''); fireEvent.click(screen.getByRole('button', { name: 'Verificar pedido guardado' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Verificar pedido guardado' })).not.toBeDisabled()); expect(readPendingRenewal('owner-A', 'creation')?.key).toBe(saved.key);
  fillPatientText(); fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'different body' } }); fireEvent.click(screen.getByRole('button', { name: 'Repetir o mesmo pedido' }));
  await screen.findByText(/O texto não coincide/); expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: renewalBody.reason } });
  vi.mocked(api.post).mockResolvedValue({ data: { ...decisionReceipt().request, request_key: saved.key } }); fireEvent.click(screen.getByRole('button', { name: 'Repetir o mesmo pedido' }));
  await screen.findByText('Pedido confirmado. Estado atual: Aprovado.'); expect(vi.mocked(api.post).mock.calls[1][2]?.headers?.['Idempotency-Key']).toBe(saved.key); expect(readPendingRenewal('owner-A', 'creation')).toBeNull();
  expect(vi.mocked(api.get).mock.calls.filter(([url]) => url.includes('consent-state'))).toHaveLength(1);
});
it('does not POST if metadata cannot be durably saved', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); }); render(tree()); await fillPatient();
  fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido para avaliação' })); await screen.findByText(/Não foi possível guardar a referência/); expect(api.post).not.toHaveBeenCalled();
});
it('does not reserve or transmit A request when account changes while consent is pending', async () => {
  const gate = deferred(); vi.mocked(api.get).mockImplementation(url => url.includes('consent-state') ? gate.promise : url === '/api/v1/doctors/' ? response([doctor]) : response(page([])));
  const view = render(tree()); await fillPatient(); fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido para avaliação' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('consent-state'), expect.anything()));
  identity.userId = 'owner-B'; identity.token = 'token-B'; view.rerender(tree()); await act(async () => gate.resolve({ data: readingsConsentState() }));
  expect(api.post).not.toHaveBeenCalled(); expect(readPendingRenewal('owner-A', 'creation')).toBeNull(); expect(screen.getByLabelText('Medicamento')).toHaveValue('');
});
it('does not clear A recovery or show A result after account change during POST', async () => {
  const result = deferred(); vi.mocked(api.post).mockReturnValue(result.promise); const view = render(tree()); await fillPatient(); fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido para avaliação' }));
  await waitFor(() => expect(api.post).toHaveBeenCalled()); const saved = readPendingRenewal('owner-A', 'creation')!;
  identity.userId = 'owner-B'; identity.token = 'token-B'; view.rerender(tree()); await act(async () => result.resolve({ data: renewalRow({ request_key: saved.key }) }));
  expect(readPendingRenewal('owner-A', 'creation')).toEqual(saved); expect(screen.queryByText(/Pedido confirmado/)).not.toBeInTheDocument();
});
it('invalidates a pending history response when sibling doctor discovery loses authority', async () => {
  const history = deferred(); vi.mocked(api.get).mockImplementation(url => url === '/api/v1/doctors/' ? Promise.reject({ response: { status: 403 } }) : history.promise);
  render(tree()); await screen.findByText(/O acesso precisa de nova confirmação/); await act(async () => history.resolve({ data: page() }));
  expect(screen.queryByRole('heading', { name: renewalBody.medication_name })).not.toBeInTheDocument(); expect(screen.queryByLabelText('Medicamento')).not.toBeInTheDocument();
});
it('sends clinician decision UUID once, waits for server receipt and removes the decided pending row', async () => {
  const result = deferred(); vi.mocked(api.post).mockReturnValue(result.promise); render(tree('doctor')); await fillDoctor();
  const submit = screen.getByRole('button', { name: 'Confirmar decisão' }); fireEvent.click(submit); fireEvent.click(submit);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1)); expect(screen.queryByRole('region', { name: 'Decisão confirmada' })).not.toBeInTheDocument();
  const saved = readPendingRenewal('owner-A', 'decision')!; expect(localStorage.getItem('kaya_pending_renewal:decision:owner-A')).not.toContain(decisionBody.doctor_note!);
  expect(api.post).toHaveBeenCalledWith('/api/v1/doctor/prescription-requests/request-1/decide', decisionBody, { headers: { Authorization: 'Bearer token-A', 'Idempotency-Key': saved.key } });
  await act(async () => result.resolve({ data: decisionReceipt(saved.key) })); await screen.findByText('Decisão confirmada. Estado atual: Aprovado.');
  expect(screen.getByText('O registo da receita foi criado na Kaya.')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: /Rever decisão/ })).not.toBeInTheDocument(); expect(readPendingRenewal('owner-A', 'decision')).toBeNull();
});
it('recovers a saved clinician decision independently of empty pending list and blank clinical draft', async () => {
  savePendingRenewal(await renewalPending('decision'));
  vi.mocked(api.get).mockImplementation(url => url.includes('/decisions/') ? response(decisionReceipt()) : response(page([])));
  render(tree('doctor')); expect(screen.getByLabelText('Nota clínica')).toHaveValue(''); expect(screen.getByLabelText('Ação')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Verificar decisão guardada' })); await screen.findByText('Decisão confirmada. Estado atual: Aprovado.');
  expect(api.post).not.toHaveBeenCalled(); expect(readPendingRenewal('owner-A', 'decision')).toBeNull();
});
it('retains clinician recovery when a mismatched effective dose is returned', async () => {
  savePendingRenewal(await renewalPending('decision')); const receipt = decisionReceipt();
  vi.mocked(api.get).mockImplementation(url => url.includes('/decisions/') ? response({ ...receipt, decision: { ...receipt.decision, dose: 'wrong dose' } }) : response(page([])));
  render(tree('doctor')); fireEvent.click(screen.getByRole('button', { name: 'Verificar decisão guardada' }));
  await screen.findByText(/Não foi possível validar/); expect(readPendingRenewal('owner-A', 'decision')?.key).toBe(renewalKey); expect(screen.queryByRole('region', { name: 'Decisão confirmada' })).not.toBeInTheDocument();
});
it('releases a clinician request only with locked noncommit proof and requires a fresh selection', async () => {
  vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { detail: { code: 'renewal_not_committed', request_key_committed: false, message: 'Não registado por revisão atual.' } } } });
  render(tree('doctor')); await fillDoctor(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar decisão' }));
  await screen.findByText('Não registado por revisão atual.'); await screen.findByRole('button', { name: /Rever decisão/ });
  expect(readPendingRenewal('owner-A', 'decision')).toBeNull(); expect(screen.queryByLabelText('Ação')).not.toBeInTheDocument();
});
it('does not offer an action for legacy scope and does not request a global patient clinical view', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: page([renewalRow({ country: null, consent_language: null, decision_state: 'legacy_review_required', request_key: null })]) });
  render(tree('doctor')); await screen.findByText(/Registo anterior: requer revisão explícita/); expect(screen.queryByRole('button', { name: /Rever decisão/ })).not.toBeInTheDocument();
  expect(vi.mocked(api.get).mock.calls.every(([url]) => url === '/api/v1/doctor/prescription-requests/page')).toBe(true);
});
