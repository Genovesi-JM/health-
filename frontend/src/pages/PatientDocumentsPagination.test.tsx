import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import PatientDocumentsPage from './PatientDocumentsPage';
import type { PatientDocument } from '../utils/patientDocuments';

const auth = vi.hoisted(() => ({ user: { id: 'patient-A', role: 'patient' } }));
vi.mock('../AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
const BASE = '/api/v1/patient-documents';
const capabilities = { upload_enabled: true, max_bytes: 10485760, accepted_types: ['application/pdf'] };
const document = (id: string): PatientDocument => ({ id, original_filename: `${id}.pdf`, content_type: 'application/pdf', size_bytes: 1024, country: 'AO', consent_language: 'pt',
  status: 'ready_for_review', scan_status: 'clean', version: 2, extraction_method: 'pdf_text', extracted_text: `Private text ${id}`, reviewed_text: null,
  created_at: '2026-10-04T10:00:00Z', reviewed_at: null, error_code: null });
const metadata = (id: string) => { const result: Partial<PatientDocument> = { ...document(id) }; delete result.extracted_text; delete result.reviewed_text; return result; };
function setup() {
  vi.mocked(api.get).mockImplementation(async (url, config) => {
    const cursor = (config?.params as { cursor?: string } | undefined)?.cursor;
    if (url === `${BASE}/capabilities`) return { data: capabilities };
    if (url === `${BASE}/page`) return { data: cursor
      ? { items: [metadata('one'), metadata('two')], next_cursor: null }
      : { items: [metadata('one')], next_cursor: 'older' } };
    return { data: document(url.split('/').pop()!) };
  });
}
async function show() { const view = render(<MemoryRouter><PatientDocumentsPage /></MemoryRouter>); await screen.findByRole('button', { name: /one.pdf/ }); return view; }
async function open(id = 'one') { fireEvent.click(screen.getByRole('button', { name: new RegExp(`${id}.pdf`) })); await screen.findByLabelText('Texto para rever'); }
beforeEach(() => { vi.resetAllMocks(); auth.user = { id: 'patient-A', role: 'patient' }; setup(); });

it('loads metadata first, appends deduplicated older pages, and fetches text only on open', async () => {
  await show();
  expect(screen.queryByLabelText('Texto para rever')).not.toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Carregar mais documentos' }));
  await screen.findByRole('button', { name: /two.pdf/ });
  expect(screen.getAllByRole('button', { name: /one.pdf/ })).toHaveLength(1);
  expect(api.get).toHaveBeenLastCalledWith(`${BASE}/page`, { params: { limit: 20, cursor: 'older' } });
  await open('two');
  expect(screen.getByLabelText('Texto para rever')).toHaveValue('Private text two');
  expect(api.get).toHaveBeenLastCalledWith(`${BASE}/two`);
  expect(screen.queryByRole('button', { name: 'Carregar mais documentos' })).not.toBeInTheDocument();
});

it('retains the open text and patient edits through failed pagination and refresh', async () => {
  await show(); await open();
  fireEvent.change(screen.getByLabelText('Texto para rever'), { target: { value: 'My unsaved revision' } });
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Carregar mais documentos' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Texto para rever')).toHaveValue('My unsaved revision');
  expect(screen.getByRole('button', { name: /one.pdf/ })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar documentos' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Atualizar documentos' })).toBeEnabled());
  expect(screen.getByLabelText('Texto para rever')).toHaveValue('My unsaved revision');
  expect(api.get).toHaveBeenLastCalledWith(`${BASE}/one`);
});

it('can restart an expired cursor without losing the selected review draft', async () => {
  await show(); await open();
  fireEvent.change(screen.getByLabelText('Texto para rever'), { target: { value: 'Keep this draft' } });
  vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 422 } });
  fireEvent.click(screen.getByRole('button', { name: 'Carregar mais documentos' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Recomeçar lista' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Recomeçar lista' })).not.toBeInTheDocument());
  expect(screen.getByLabelText('Texto para rever')).toHaveValue('Keep this draft');
  expect(api.get).toHaveBeenCalledWith(`${BASE}/page`, { params: { limit: 20 } });
});

it('preserves an uncertain upload and its exact key through page failure and refresh', async () => {
  await show();
  const file = new File(['%PDF synthetic'], 'upload.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText('Ficheiro'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('checkbox'));
  vi.mocked(api.post).mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ data: document('uploaded') });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar e ler documento' })); await screen.findByRole('alert');
  const key = vi.mocked(api.post).mock.calls[0][2]?.headers?.['Idempotency-Key'];
  expect(screen.getByLabelText('Ficheiro')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Ficheiro'), { target: { files: [new File(['%PDF replacement'], 'replacement.pdf', { type: 'application/pdf' })] } });
  expect(screen.getByText('Selecionado: upload.pdf')).toBeInTheDocument();
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Pagination unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Carregar mais documentos' })); await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar documentos' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Atualizar documentos' })).toBeEnabled());
  expect(screen.getByText('Selecionado: upload.pdf')).toBeInTheDocument(); expect(screen.getByRole('checkbox')).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Enviar e ler documento' })); await screen.findByLabelText('Texto para rever');
  expect(vi.mocked(api.post).mock.calls[1][2]?.headers?.['Idempotency-Key']).toBe(key);
  expect((vi.mocked(api.post).mock.calls[1][1] as FormData).get('file')).toBe(file);
  expect(screen.getByLabelText('Ficheiro')).toBeEnabled();
});

it('keeps an uncertain upload reserved after a later pre-replay validation rejection', async () => {
  await show();
  const file = new File(['%PDF synthetic'], 'upload.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText('Ficheiro'), { target: { files: [file] } }); fireEvent.click(screen.getByRole('checkbox'));
  vi.mocked(api.post).mockRejectedValueOnce(new Error('Lost response')).mockRejectedValueOnce({ response: { status: 422 } }).mockResolvedValueOnce({ data: document('uploaded') });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar e ler documento' })); await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Enviar e ler documento' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar e ler documento' })).toBeEnabled());
  expect(screen.getByLabelText('Ficheiro')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Enviar e ler documento' })); await screen.findByLabelText('Texto para rever');
  const calls = vi.mocked(api.post).mock.calls;
  expect(calls[1][2]).toEqual(calls[0][2]); expect(calls[2][2]).toEqual(calls[0][2]);
});

it('allows correcting a file rejected definitively on its first submission', async () => {
  await show();
  fireEvent.change(screen.getByLabelText('Ficheiro'), { target: { files: [new File(['invalid'], 'upload.pdf', { type: 'application/pdf' })] } });
  fireEvent.click(screen.getByRole('checkbox')); vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 422 } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar e ler documento' })); await screen.findByRole('alert');
  expect(screen.getByLabelText('Ficheiro')).toBeEnabled();
});

it('discards private detail arriving after the authenticated account changes', async () => {
  const view = await show();
  let finish!: (value: { data: PatientDocument }) => void;
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: /one.pdf/ }));
  auth.user = { id: 'patient-B', role: 'patient' };
  view.rerender(<MemoryRouter><PatientDocumentsPage /></MemoryRouter>);
  await act(async () => finish({ data: document('one') }));
  await screen.findByRole('button', { name: /one.pdf/ });
  expect(screen.queryByLabelText('Texto para rever')).not.toBeInTheDocument();
  expect(screen.queryByText('Private text one')).not.toBeInTheDocument();
});

it('clears server-loaded text on an authoritative account permission rejection', async () => {
  await show(); await open();
  vi.mocked(api.get).mockResolvedValueOnce({ data: capabilities }).mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar documentos' }));
  await screen.findByRole('alert');
  expect(screen.queryByLabelText('Texto para rever')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /one.pdf/ })).not.toBeInTheDocument();
  expect(screen.queryByText('Ainda não há documentos guardados.')).not.toBeInTheDocument();
});
