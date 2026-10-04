import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import { I18nProvider } from '../i18n/LanguageContext';
import PatientReadingsPage from './PatientReadingsPage';
import { readingsConsentState } from '../utils/readingConsent.test-fixtures';
const identity = vi.hoisted(() => ({ userId: 'owner-A', token: 'token-A' }));
vi.mock('../api', () => ({ getSession: () => ({ ...identity }), default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
const reading = { id: 'reading-1', reading_type: 'temperature', value: 37, unit: 'C', measured_at: '2026-10-04T09:00:00Z', source: 'manual', notes: 'Medição anterior', country: null };
const tree = () => <MemoryRouter><I18nProvider><PatientReadingsPage /></I18nProvider></MemoryRouter>;
const show = () => render(tree());
function deferred() { let resolve!: (value: { data: unknown }) => void; const promise = new Promise<{ data: unknown }>(done => { resolve = done; }); return { promise, resolve }; }
async function fillManual() {
  fireEvent.click(await screen.findByRole('button', { name: 'Nova Medição' }));
  fireEvent.change(screen.getByLabelText('Sistólica (mmHg) *'), { target: { value: '120' } });
  fireEvent.change(screen.getByLabelText('Diastólica (mmHg) *'), { target: { value: '80' } });
}
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar Medição' }));
const pick = () => fireEvent.change(screen.getByLabelText('Ficheiro CSV'), { target: { files: [new File(['Date,Weight\n2026-10-01,70'], 'sintetico.csv', { type: 'text/csv' })] } });
const importFile = () => fireEvent.click(screen.getByRole('button', { name: 'Importar ficheiro selecionado' }));
beforeEach(() => {
  vi.restoreAllMocks(); vi.resetAllMocks(); identity.userId = 'owner-A'; identity.token = 'token-A';
  vi.mocked(api.get).mockImplementation(async (url, config) => ({ data: url.includes('consent-state')
    ? readingsConsentState((config?.params as { country: 'AO' | 'PT' }).country) : { readings: [reading], total: 1 } }));
  vi.mocked(api.post).mockResolvedValue({ data: { imported: 1, skipped: 0, errors: [] } }); vi.mocked(api.delete).mockResolvedValue({ data: null });
});
it('sends manual readings with explicit Portugal scope and captured session', async () => {
  show(); await fillManual(); fireEvent.change(screen.getByLabelText('País das novas medições'), { target: { value: 'PT' } }); submit();
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  expect(api.post).toHaveBeenCalledWith('/api/v1/readings', expect.objectContaining({ country: 'PT', consent_language: 'pt', source: 'manual', systolic: 120, diastolic: 80 }), { headers: { Authorization: 'Bearer token-A' } });
  expect(screen.getByRole('link', { name: 'Rever consentimentos' })).toHaveAttribute('href', '/consents?country=PT');
});
it('keeps history readable and deletable when new processing consent is withdrawn', async () => {
  const state = readingsConsentState(); state.states[0] = { ...state.states[0], status: 'withdrawn', effective: false, latest_event: { ...state.states[0].latest_event!, action: 'withdraw' } };
  vi.mocked(api.get).mockImplementation(async url => ({ data: url.includes('consent-state') ? state : { readings: [reading], total: 1 } }));
  vi.spyOn(window, 'confirm').mockReturnValue(true); show(); await screen.findByText('Medição anterior'); await fillManual(); submit();
  await screen.findByText(/O histórico continua disponível/); expect(api.post).not.toHaveBeenCalled(); expect(screen.getByText('Medição anterior')).toBeInTheDocument();
  expect(screen.getByLabelText('Sistólica (mmHg) *')).toHaveValue(120);
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar medição' })); await waitFor(() => expect(api.delete).toHaveBeenCalled());
  expect(vi.mocked(api.get).mock.calls.filter(([url]) => url.includes('consent-state'))).toHaveLength(1);
});
it('requires the separate device grant before transmitting CSV and retains its selection', async () => {
  vi.mocked(api.get).mockImplementation(async url => ({ data: url.includes('consent-state') ? readingsConsentState('AO', false) : { readings: [reading], total: 1 } }));
  show(); await screen.findByText('Medição anterior'); pick(); importFile(); await screen.findByText(/antes de importar ou recolher medições/);
  expect(api.post).not.toHaveBeenCalled(); expect(screen.getByText('Ficheiro selecionado: sintetico.csv')).toBeInTheDocument(); expect(screen.getByText('Medição anterior')).toBeInTheDocument();
});
it('includes country and language in CSV multipart and preserves file on scope conflict', async () => {
  vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { detail: { code: 'reading_scope_conflict', message: 'A medição pertence a outro âmbito.' } } } });
  show(); pick(); fireEvent.change(screen.getByLabelText('País das novas medições'), { target: { value: 'PT' } }); importFile(); await screen.findByText('A medição pertence a outro âmbito.');
  const [url, body, config] = vi.mocked(api.post).mock.calls[0]; expect(url).toBe('/api/v1/readings/import'); expect((body as FormData).get('country')).toBe('PT'); expect((body as FormData).get('consent_language')).toBe('pt');
  expect(config?.headers).toEqual({ Authorization: 'Bearer token-A', 'Content-Type': 'multipart/form-data' }); expect(screen.getByText('Ficheiro selecionado: sintetico.csv')).toBeInTheDocument();
});
it('does not send A readings after an account change while preflight is pending', async () => {
  const pending = deferred(); vi.mocked(api.get).mockImplementation(url => url.includes('consent-state') ? pending.promise : Promise.resolve({ data: { readings: [reading], total: 1 } }));
  const view = show(); await fillManual(); submit(); await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('consent-state'), expect.anything()));
  identity.userId = 'owner-B'; identity.token = 'token-B'; view.rerender(tree());
  await act(async () => pending.resolve({ data: readingsConsentState() })); expect(api.post).not.toHaveBeenCalled(); expect(screen.queryByLabelText('Sistólica (mmHg) *')).not.toBeInTheDocument();
});
it('does not transmit a selected CSV after unmount during preflight', async () => {
  const pending = deferred(); vi.mocked(api.get).mockImplementation(url => url.includes('consent-state') ? pending.promise : Promise.resolve({ data: { readings: [], total: 0 } }));
  const view = show(); pick(); importFile(); await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('consent-state'), expect.anything())); view.unmount();
  await act(async () => pending.resolve({ data: readingsConsentState() })); expect(api.post).not.toHaveBeenCalled();
});
it('ignores an old-filter reply and preserves current rows on refresh failure', async () => {
  const pending = deferred(); let first = true;
  vi.mocked(api.get).mockImplementation(async (_url, config) => {
    if (first) { first = false; return pending.promise; }
    return { data: { readings: [{ ...reading, notes: 'Filtro atual' }], total: 1, selected: config?.params } };
  });
  show(); await waitFor(() => expect(api.get).toHaveBeenCalled()); fireEvent.click(screen.getByRole('button', { name: 'Glicose' })); await screen.findByText('Filtro atual');
  await act(async () => pending.resolve({ data: { readings: [{ ...reading, notes: 'Resposta antiga' }], total: 1 } })); expect(screen.queryByText('Resposta antiga')).not.toBeInTheDocument();
  vi.mocked(api.get).mockRejectedValue(new Error('offline')); fireEvent.click(screen.getByRole('button', { name: 'Atualizar histórico' })); await screen.findByRole('alert'); expect(screen.getByText('Filtro atual')).toBeInTheDocument();
});
it('does not claim success or erase the draft after an unknown POST result', async () => {
  vi.mocked(api.post).mockRejectedValue(new Error('lost response')); show(); await fillManual(); submit(); await screen.findByText(/a medição pode já estar guardada/);
  expect(screen.getByLabelText('Sistólica (mmHg) *')).toHaveValue(120); expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it.each([0, 2])('reports CSV row errors with %s successful imports and retains selection', async imported => {
  vi.mocked(api.post).mockResolvedValue({ data: { imported, skipped: 1, errors: ['Linha 3: data inválida.', 'Linha 4: peso inválido.'] } });
  show(); pick(); importFile();
  const alert = await screen.findByRole('alert'); expect(alert).toHaveTextContent(`${imported} medições importadas; 1 linhas ignoradas.`);
  expect(alert).toHaveTextContent('Linha 3: data inválida.'); expect(alert).toHaveTextContent('Linha 4: peso inválido.');
  expect(screen.getByText('Ficheiro selecionado: sintetico.csv')).toBeInTheDocument(); expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('invalidates a pending consent preflight when a sibling history read denies authority', async () => {
  let deny!: (reason: unknown) => void;
  const history = new Promise<{ data: unknown }>((_resolve, reject) => { deny = reject; });
  const consent = deferred();
  vi.mocked(api.get).mockImplementation(url => url.includes('consent-state') ? consent.promise : history);
  show(); await fillManual(); submit(); await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('consent-state'), expect.anything()));
  await act(async () => deny({ response: { status: 403 } }));
  await screen.findByText(/O acesso precisa de nova confirmação/);
  await act(async () => consent.resolve({ data: readingsConsentState() })); expect(api.post).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Sistólica (mmHg) *')).toHaveValue(120); expect(screen.getByRole('button', { name: 'Guardar Medição' })).toBeDisabled();
  vi.mocked(api.get).mockResolvedValue({ data: { readings: [reading], total: 1 } });
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar histórico' })); await screen.findByText('Medição anterior'); expect(screen.getByRole('button', { name: 'Guardar Medição' })).toBeEnabled();
});

it('preserves personal history when the server withdraws consent after preflight', async () => {
  vi.mocked(api.post).mockRejectedValue({ response: { status: 403, data: { detail: { code: 'consent_required', message: 'Reveja os consentimentos atuais.' } } } });
  show(); await screen.findByText('Medição anterior'); await fillManual(); submit(); await screen.findByText('Reveja os consentimentos atuais.');
  expect(screen.getByText('Medição anterior')).toBeInTheDocument(); expect(screen.queryByText(/O acesso precisa de nova confirmação/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('Sistólica (mmHg) *')).toHaveValue(120);
});
