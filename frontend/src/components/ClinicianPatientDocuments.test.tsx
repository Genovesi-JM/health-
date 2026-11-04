import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import ClinicianPatientDocuments from './ClinicianPatientDocuments';
import type { PatientDocument } from '../utils/patientDocuments';

const auth = vi.hoisted(() => ({ user: { id: 'doctor-A', role: 'doctor' } }));
vi.mock('../AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
const BASE = '/api/v1/patient-documents';
const document = (id = 'one'): PatientDocument => ({ id, original_filename: `${id}.pdf`, content_type: 'application/pdf', size_bytes: 1024,
  status: 'confirmed', scan_status: 'clean', version: 3, extraction_method: 'pdf_text', extracted_text: 'Machine extract', reviewed_text: `Patient confirmed ${id}`,
  created_at: '2026-10-04T12:00:00Z', reviewed_at: '2026-10-04T13:00:00Z', error_code: null });
const metadata = (id = 'one') => { const item: Partial<PatientDocument> = { ...document(id) }; delete item.extracted_text; delete item.reviewed_text; return item; };
beforeEach(() => {
  vi.resetAllMocks(); auth.user = { id: 'doctor-A', role: 'doctor' };
  vi.mocked(api.get).mockImplementation(async (url, config) => {
    const cursor = (config?.params as { cursor?: string } | undefined)?.cursor;
    if (url.endsWith('/page')) return { data: { items: [metadata(cursor ? 'two' : 'one')], next_cursor: cursor ? null : 'older' } };
    return { data: document(url.split('/').pop()) };
  });
});
async function show() { const view = render(<ClinicianPatientDocuments patientId="patient-A" />); await screen.findByRole('button', { name: /one.pdf/ }); return view; }
async function open() { fireEvent.click(screen.getByRole('button', { name: /one.pdf/ })); await screen.findByText('Patient confirmed one'); }

it('opens on-demand clinical reading without offering patient or clinician mutation controls', async () => {
  await show();
  expect(api.get).toHaveBeenCalledOnce();
  expect(api.get).toHaveBeenCalledWith(`${BASE}/patients/patient-A/page`, { params: { limit: 20 } });
  expect(screen.queryByText('Patient confirmed one')).not.toBeInTheDocument();
  await open();
  expect(api.get).toHaveBeenLastCalledWith(`${BASE}/one`);
  const reader = within(screen.getByRole('article', { name: 'Documento aberto' }));
  expect(reader.getByRole('heading', { name: 'Texto confirmado pelo paciente' })).toBeInTheDocument();
  expect(reader.queryByRole('textbox')).not.toBeInTheDocument();
  expect(reader.getAllByRole('button').map(button => button.textContent)).toEqual(['Descarregar original']);
  expect(api.post).not.toHaveBeenCalled(); expect(api.put).not.toHaveBeenCalled();
});

it('keeps loaded rows and open content after pagination failure, then appends the next page', async () => {
  await show(); await open();
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Carregar mais documentos' })); await screen.findByRole('alert');
  expect(screen.getByText('Patient confirmed one')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Carregar mais documentos' }));
  await screen.findByRole('button', { name: /two.pdf/ });
  expect(screen.getByRole('button', { name: /one.pdf/ })).toBeInTheDocument();
  expect(api.get).toHaveBeenLastCalledWith(`${BASE}/patients/patient-A/page`, { params: { limit: 20, cursor: 'older' } });
});

it('offers restart after an invalid cursor without falsely reporting no documents', async () => {
  await show();
  vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 422 } });
  fireEvent.click(screen.getByRole('button', { name: 'Carregar mais documentos' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Recomeçar lista' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Recomeçar lista' })).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: /one.pdf/ })).toBeInTheDocument();
  expect(screen.queryByText('Não há documentos disponíveis para consulta clínica.')).not.toBeInTheDocument();
});

it('reports denied access without an empty-list claim and clears previously disclosed text', async () => {
  await show(); await open();
  vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 403, data: { detail: 'Relação clínica não autorizada.' } } });
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar documentos do paciente' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Relação clínica não autorizada.');
  expect(screen.queryByText('Patient confirmed one')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /one.pdf/ })).not.toBeInTheDocument();
  expect(screen.queryByText('Não há documentos disponíveis para consulta clínica.')).not.toBeInTheDocument();
});

it('removes an open document if its clean scan status is revoked', async () => {
  await show(); await open();
  vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 409, data: { detail: 'Verificação de segurança pendente.' } } });
  fireEvent.click(screen.getByRole('button', { name: /one.pdf/ })); await screen.findByRole('alert');
  expect(screen.queryByText('Patient confirmed one')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Descarregar original' })).not.toBeInTheDocument();
});

it.each(['patient', 'account'])('ignores detail from an earlier %s scope', async scope => {
  const view = await show();
  let finish!: (value: { data: PatientDocument }) => void;
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: /one.pdf/ }));
  if (scope === 'account') auth.user = { id: 'doctor-B', role: 'doctor' };
  view.rerender(<ClinicianPatientDocuments patientId={scope === 'patient' ? 'patient-B' : 'patient-A'} />);
  await act(async () => finish({ data: document() }));
  await screen.findByRole('button', { name: /one.pdf/ });
  expect(screen.queryByText('Patient confirmed one')).not.toBeInTheDocument();
});

it('does not download bytes arriving after the owning patient view unmounts', async () => {
  const create = vi.fn(); Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
  const view = await show(); await open();
  let finish!: (value: { data: Blob }) => void;
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Descarregar original' }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(`${BASE}/one/download`, { responseType: 'blob' }));
  view.unmount(); await act(async () => finish({ data: new Blob(['Private original']) }));
  expect(create).not.toHaveBeenCalled();
});
