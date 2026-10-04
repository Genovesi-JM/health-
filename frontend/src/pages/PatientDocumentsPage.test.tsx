import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import PatientDocumentsPage from './PatientDocumentsPage';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
const BASE = '/api/v1/patient-documents';
const capabilities = { upload_enabled: true, max_bytes: 10485760, accepted_types: ['application/pdf', 'image/jpeg', 'image/png'], extraction: 'pdf_text' };
const fixture = (updates: Record<string, unknown> = {}) => ({ id: 'doc-1', original_filename: 'analise.pdf', content_type: 'application/pdf', size_bytes: 1024,
  status: 'ready_for_review', scan_status: 'clean', version: 2, extraction_method: 'pdf_text', extracted_text: 'Resultado original: 12', reviewed_text: null,
  created_at: '2026-10-04T10:00:00Z', reviewed_at: null, error_code: null, ...updates });
function setGet(documents = [fixture()], capabilityUpdates = {}) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `${BASE}/capabilities`) return { data: { ...capabilities, ...capabilityUpdates } };
    if (url === BASE) return { data: documents };
    if (url === `${BASE}/doc-1`) return { data: documents[0] };
    throw new Error(`Unexpected GET ${url}`);
  });
}
async function show() { render(<PatientDocumentsPage />); await screen.findByRole('heading', { name: 'Adicionar documento' }); }
function pick(file = new File(['%PDF-1.7 test'], 'novo.pdf', { type: 'application/pdf', lastModified: 10 })) { fireEvent.change(screen.getByLabelText('Ficheiro'), { target: { files: [file] } }); }
function upload() { fireEvent.click(screen.getByRole('button', { name: 'Enviar e ler documento' })); }
function confirm() { fireEvent.click(screen.getByRole('button', { name: 'Confirmar texto revisto' })); }
function edit(text: string) { fireEvent.change(screen.getByLabelText('Texto para rever'), { target: { value: text } }); }
beforeEach(() => { vi.resetAllMocks(); setGet(); });

describe('patient document persistence and review', () => {
  it('keeps existing documents readable when uploads are unavailable', async () => {
    setGet([fixture()], { upload_enabled: false }); await show();
    expect(screen.getByLabelText('Ficheiro')).toBeDisabled();
    expect(screen.getByText(/O envio de documentos está temporariamente indisponível/)).toBeInTheDocument();
    expect(screen.getByLabelText('Texto para rever')).toHaveValue('Resultado original: 12');
    expect(api.post).not.toHaveBeenCalled();
  });
  it('validates type and size before transmitting a file', async () => {
    await show(); pick(new File(['bad'], 'bad.html', { type: 'text/html' }));
    expect(screen.getByRole('alert')).toHaveTextContent('PDF, JPG ou PNG');
    pick(new File([new Uint8Array(10485761)], 'large.pdf', { type: 'application/pdf' }));
    expect(screen.getByRole('alert')).toHaveTextContent('10 MB'); expect(api.post).not.toHaveBeenCalled();
  });
  it('requires consent, saves once, and processes the acknowledged revision', async () => {
    setGet([]); vi.mocked(api.post).mockResolvedValueOnce({ data: fixture({ status: 'pending_processing', scan_status: 'pending', version: 1, extracted_text: null }) }).mockResolvedValueOnce({ data: fixture() });
    await show(); pick(); expect(screen.getByRole('button', { name: 'Enviar e ler documento' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox')); upload(); await screen.findByLabelText('Texto para rever');
    const [url, form, config] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe(BASE); expect((form as FormData).get('processing_consent')).toBe('true');
    expect(((form as FormData).get('file') as File).name).toBe('novo.pdf');
    expect(config?.headers?.['Idempotency-Key']).toEqual(expect.any(String));
    expect(api.post).toHaveBeenNthCalledWith(2, `${BASE}/doc-1/process`, { version: 1 });
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
  it('reuses an upload key after a lost response without claiming success', async () => {
    setGet([]); vi.mocked(api.post).mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ data: fixture() });
    await show(); pick(); fireEvent.click(screen.getByRole('checkbox')); upload(); await screen.findByRole('alert');
    expect(screen.getByText('Selecionado: novo.pdf')).toBeInTheDocument(); expect(screen.queryByText('Documento guardado.')).not.toBeInTheDocument();
    const key = vi.mocked(api.post).mock.calls[0][2]?.headers?.['Idempotency-Key']; upload(); await screen.findByLabelText('Texto para rever');
    expect(vi.mocked(api.post).mock.calls[1][2]?.headers?.['Idempotency-Key']).toBe(key);
  });
  it('keeps the chosen file, consent and retry key after invalid or cancelled selection', async () => {
    setGet([]); vi.mocked(api.post).mockRejectedValue(new Error('Lost response'));
    await show(); pick(); fireEvent.click(screen.getByRole('checkbox')); upload(); await screen.findByRole('alert');
    const key = vi.mocked(api.post).mock.calls[0][2]?.headers?.['Idempotency-Key'];
    pick(new File(['bad'], 'bad.html', { type: 'text/html' }));
    fireEvent.change(screen.getByLabelText('Ficheiro'), { target: { files: [] } });
    expect(screen.getByText('Selecionado: novo.pdf')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
    upload(); await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.post).mock.calls[1][2]?.headers?.['Idempotency-Key']).toBe(key);
  });
  it('requires separate consent when replacing the chosen document', async () => {
    await show(); pick(); fireEvent.click(screen.getByRole('checkbox'));
    pick(new File(['%PDF replacement'], 'outro.pdf', { type: 'application/pdf' }));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Enviar e ler documento' })).toBeDisabled();
  });
  it('does not start another operation after an upload resolves for an unmounted account view', async () => {
    setGet([]);
    let finish: (value: unknown) => void = () => {};
    vi.mocked(api.post).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<PatientDocumentsPage />); await screen.findByRole('heading', { name: 'Adicionar documento' });
    pick(); fireEvent.click(screen.getByRole('checkbox')); upload();
    await waitFor(() => expect(api.post).toHaveBeenCalledOnce()); view.unmount();
    await act(async () => { finish({ data: fixture({ status: 'pending_processing' }) }); });
    expect(api.post).toHaveBeenCalledOnce();
  });
  it('does not download private bytes after the owning account view unmounts', async () => {
    const createUrl = vi.fn(); Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
    let finish: (value: unknown) => void = () => {};
    const view = render(<PatientDocumentsPage />); await screen.findByRole('heading', { name: 'Adicionar documento' });
    vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: 'Descarregar original' }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(`${BASE}/doc-1/download`, { responseType: 'blob' }));
    view.unmount(); await act(async () => { finish({ data: new Blob(['private content']) }); });
    expect(createUrl).not.toHaveBeenCalled();
  });
  it('retains uploaded files after processing failure and retries only reading', async () => {
    setGet([]); vi.mocked(api.post).mockResolvedValueOnce({ data: fixture({ status: 'pending_processing', scan_status: 'pending', version: 1, extracted_text: null }) })
      .mockRejectedValueOnce(new Error('Scanner unavailable')).mockResolvedValueOnce({ data: fixture() });
    await show(); pick(); fireEvent.click(screen.getByRole('checkbox')); upload();
    expect(await screen.findByRole('alert')).toHaveTextContent('O documento está guardado');
    fireEvent.click(screen.getByRole('button', { name: 'Ler documento' })); await screen.findByLabelText('Texto para rever');
    expect(api.post).toHaveBeenNthCalledWith(3, `${BASE}/doc-1/process`, { version: 1 });
    expect(vi.mocked(api.post).mock.calls.filter(call => call[0] === BASE)).toHaveLength(1);
  });
  it('permits manual transcription without claiming image OCR', async () => {
    setGet([fixture({ status: 'needs_manual_review', extracted_text: null, extraction_method: null, content_type: 'image/jpeg' })]); await show();
    expect(screen.getByText(/Não foi possível obter texto automaticamente/)).toBeInTheDocument();
    expect(screen.getByLabelText('Texto para rever')).toHaveValue(''); expect(screen.getByRole('button', { name: 'Confirmar texto revisto' })).toBeDisabled();
    edit('Texto transcrito'); expect(screen.getByRole('button', { name: 'Confirmar texto revisto' })).toBeEnabled(); expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
  });
  it('warns about omitted pages when only partial PDF text is available', async () => {
    setGet([fixture({ status: 'needs_manual_review', error_code: 'partial_text_requires_ocr', extracted_text: 'Primeira página' })]); await show();
    expect(screen.getByText(/Só parte do documento pôde ser lida/)).toBeInTheDocument();
    expect(screen.getByLabelText('Texto para rever')).toHaveValue('Primeira página');
    expect(screen.queryByText(/Não foi possível obter texto automaticamente/)).not.toBeInTheDocument();
  });
  it('shows a loading failure without falsely declaring the list empty and permits retry', async () => {
    vi.mocked(api.get).mockImplementationOnce(async () => ({ data: capabilities })).mockRejectedValueOnce(new Error('Offline'));
    await show(); expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os documentos');
    expect(screen.queryByText('Ainda não há documentos guardados.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar documentos' })); await screen.findByLabelText('Texto para rever');
  });
  it('confirms only after acknowledgment and preserves edits after failure', async () => {
    vi.mocked(api.put).mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ data: fixture({ status: 'confirmed', version: 3, reviewed_text: 'Texto corrigido' }) });
    await show(); edit('Texto corrigido'); confirm(); await screen.findByRole('alert');
    expect(screen.getByLabelText('Texto para rever')).toHaveValue('Texto corrigido'); expect(screen.queryByText('O texto revisto foi guardado.')).not.toBeInTheDocument();
    confirm(); await screen.findByText('O texto revisto foi guardado.');
    expect(api.put).toHaveBeenNthCalledWith(1, `${BASE}/doc-1/review`, { version: 2, decision: 'confirm', text: 'Texto corrigido' });
    expect(vi.mocked(api.put).mock.calls[1]).toEqual(vi.mocked(api.put).mock.calls[0]); expect(screen.queryByLabelText('Texto para rever')).not.toBeInTheDocument();
  });
  it('reloads a conflicting revision and preserves the patient text', async () => {
    setGet([fixture({ version: 4, extracted_text: 'Texto da sessão atual' })]);
    vi.mocked(api.get).mockImplementationOnce(async () => ({ data: capabilities })).mockImplementationOnce(async () => ({ data: [fixture()] }));
    vi.mocked(api.put).mockRejectedValueOnce({ response: { status: 409 } }).mockResolvedValueOnce({ data: fixture({ status: 'confirmed', version: 5, reviewed_text: 'Minha correção' }) });
    await show(); edit('Minha correção'); confirm(); expect(await screen.findByRole('alert')).toHaveTextContent('O documento mudou noutra sessão');
    expect(screen.getByLabelText('Texto para rever')).toHaveValue('Minha correção'); expect(screen.getByText('Texto da sessão atual')).toBeInTheDocument();
    confirm(); await screen.findByText('O texto revisto foi guardado.'); expect(api.put).toHaveBeenLastCalledWith(`${BASE}/doc-1/review`, { version: 4, decision: 'confirm', text: 'Minha correção' });
  });
  it('preserves local edits when switching documents or refreshing', async () => {
    setGet([fixture(), fixture({ id: 'doc-2', original_filename: 'outro.pdf', extracted_text: 'Outro texto' })]); await show(); edit('Revisão em curso');
    fireEvent.click(screen.getByRole('button', { name: /outro.pdf/ })); expect(screen.getByLabelText('Texto para rever')).toHaveValue('Outro texto');
    fireEvent.click(screen.getByRole('button', { name: /analise.pdf/ })); expect(screen.getByLabelText('Texto para rever')).toHaveValue('Revisão em curso');
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar documentos' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Atualizar documentos' })).toBeEnabled()); expect(screen.getByLabelText('Texto para rever')).toHaveValue('Revisão em curso');
  });
  it('persists rejection without confirming document content', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: fixture({ status: 'rejected', version: 3 }) }); await show(); fireEvent.click(screen.getByRole('button', { name: 'Rejeitar leitura' }));
    await screen.findByText('A leitura foi rejeitada. O documento original foi mantido.');
    expect(api.put).toHaveBeenCalledWith(`${BASE}/doc-1/review`, { version: 2, decision: 'reject', text: 'Resultado original: 12' });
    expect(screen.queryByRole('button', { name: 'Confirmar texto revisto' })).not.toBeInTheDocument();
  });
  it('blocks reading, review, and download of a quarantined original', async () => {
    setGet([fixture({ status: 'blocked', scan_status: 'infected', extracted_text: null })]); await show();
    expect(screen.getByRole('button', { name: 'Descarregar original' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Ler documento' })).not.toBeInTheDocument(); expect(screen.queryByLabelText('Texto para rever')).not.toBeInTheDocument();
  });
  it('downloads authenticated bytes and revokes the temporary URL', async () => {
    const createUrl = vi.fn(() => 'blob:private-document'); const revokeUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl }); Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeUrl });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); await show();
    const bytes = new Blob(['%PDF'], { type: 'application/pdf' }); vi.mocked(api.get).mockResolvedValueOnce({ data: bytes });
    fireEvent.click(screen.getByRole('button', { name: 'Descarregar original' })); await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(api.get).toHaveBeenLastCalledWith(`${BASE}/doc-1/download`, { responseType: 'blob' }); expect(createUrl).toHaveBeenCalledWith(bytes);
    await waitFor(() => expect(revokeUrl).toHaveBeenCalledWith('blob:private-document'), { timeout: 1500 }); click.mockRestore();
  });
});
