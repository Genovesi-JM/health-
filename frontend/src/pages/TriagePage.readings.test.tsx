import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import { I18nProvider } from '../i18n/LanguageContext';
import TriagePage from './TriagePage';
import { readingsConsentState } from '../utils/readingConsent.test-fixtures';
import { connectBluetooth, readBluetoothVitals, scanBluetooth } from '../utils/deviceApi';
const identity = vi.hoisted(() => ({ userId: 'owner-A', token: 'token-A' }));
vi.mock('../api', () => ({ getSession: () => ({ ...identity }), default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../components/TriagePhotoGuide', () => ({ default: () => null }));
vi.mock('../utils/deviceApi', async importOriginal => ({ ...await importOriginal<typeof import('../utils/deviceApi')>(),
  isBluetoothAvailable: () => true, scanBluetooth: vi.fn(), connectBluetooth: vi.fn(), readBluetoothVitals: vi.fn() }));
const tree = () => <MemoryRouter><I18nProvider><TriagePage /></I18nProvider></MemoryRouter>;
const device = { id: 'device-A', name: 'Dispositivo sintético', type: 'bluetooth' as const, status: 'connected' as const };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
async function startView() { const view = render(tree()); fireEvent.click((await screen.findAllByRole('button', { name: 'Nova Triagem' }))[0]); return view; }
async function connectDevice() {
  fireEvent.click(screen.getByRole('button', { name: 'Bluetooth' }));
  fireEvent.click(screen.getByRole('button', { name: 'Verificar consentimentos para Bluetooth' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Procurar via Bluetooth' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Ligar' }));
  await screen.findByRole('button', { name: 'Ler valores' });
}
beforeEach(() => {
  vi.resetAllMocks(); identity.userId = 'owner-A'; identity.token = 'token-A';
  vi.mocked(api.get).mockImplementation(async (url, options) => ({ data: url.includes('consent-state') ? readingsConsentState((options?.params as { country: 'AO' | 'PT' }).country) : [] }));
  vi.mocked(api.post).mockResolvedValue({ data: { triage_id: 'triage-A', questions: [] } });
  vi.mocked(scanBluetooth).mockResolvedValue([device]); vi.mocked(connectBluetooth).mockResolvedValue(device);
  vi.mocked(readBluetoothVitals).mockResolvedValue({ systolic: 125, diastolic: 81, source: 'bluetooth', readAt: '2026-10-04T12:00:00Z' });
});
it('requires a separate device grant before the browser chooser or any reading', async () => {
  vi.mocked(api.get).mockImplementation(async url => ({ data: url.includes('consent-state') ? readingsConsentState('AO', false) : [] }));
  await startView(); fireEvent.click(screen.getByRole('button', { name: 'Bluetooth' })); fireEvent.click(screen.getByRole('button', { name: 'Verificar consentimentos para Bluetooth' }));
  await screen.findByText(/antes de importar ou recolher medições/); expect(scanBluetooth).not.toHaveBeenCalled(); expect(readBluetoothVitals).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled();
});
it('requires a fresh click after preflight and sends captured device scope with triage', async () => {
  await startView(); fireEvent.change(screen.getByLabelText('País deste novo pedido'), { target: { value: 'PT' } }); await connectDevice();
  fireEvent.click(screen.getByRole('button', { name: 'Ler valores' })); await screen.findByText('SBP: 125 mmHg');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Sintomas do próprio titular' } }); fireEvent.click(screen.getByRole('button', { name: 'Iniciar Triagem' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/triage/start', expect.objectContaining({ country: 'PT', consent_language: 'pt', vital_signs: expect.objectContaining({ systolic: 125, source: 'bluetooth' }) }), { headers: { Authorization: 'Bearer token-A' } }));
  expect(vi.mocked(api.get).mock.calls.filter(([url]) => url.includes('consent-state'))).toHaveLength(3);
});
it('drops a late device result when the selected market changes', async () => {
  const pending = deferred<Awaited<ReturnType<typeof readBluetoothVitals>>>(); vi.mocked(readBluetoothVitals).mockReturnValue(pending.promise);
  await startView(); await connectDevice(); fireEvent.click(screen.getByRole('button', { name: 'Ler valores' })); await waitFor(() => expect(readBluetoothVitals).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText('País deste novo pedido'), { target: { value: 'PT' } });
  await act(async () => pending.resolve({ systolic: 177, source: 'bluetooth', readAt: '2026-10-04T12:00:00Z' })); expect(screen.queryByText('SBP: 177 mmHg')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Sintomas do próprio titular' } }); fireEvent.click(screen.getByRole('button', { name: 'Iniciar Triagem' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/triage/start', expect.objectContaining({ country: 'PT', vital_signs: undefined }), expect.anything()));
});
it('does not reclassify collected device values as manual when switching input mode', async () => {
  await startView(); await connectDevice(); fireEvent.click(screen.getByRole('button', { name: 'Ler valores' })); await screen.findByText('SBP: 125 mmHg');
  fireEvent.click(screen.getByRole('button', { name: 'Inserção manual' })); expect(screen.queryByText('SBP: 125 mmHg')).not.toBeInTheDocument(); expect(screen.getByRole('status')).toHaveTextContent('medições do dispositivo foram removidas');
});
it('does not acquire a device after the account changes during consent preflight', async () => {
  const pending = deferred<{ data: unknown }>(); vi.mocked(api.get).mockImplementation(url => url.includes('consent-state') ? pending.promise : Promise.resolve({ data: [] }));
  const view = await startView(); fireEvent.click(screen.getByRole('button', { name: 'Bluetooth' })); fireEvent.click(screen.getByRole('button', { name: 'Verificar consentimentos para Bluetooth' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('consent-state'), expect.anything())); identity.userId = 'owner-B'; identity.token = 'token-B'; view.rerender(tree());
  await act(async () => pending.resolve({ data: readingsConsentState() })); expect(scanBluetooth).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'Procurar via Bluetooth' })).not.toBeInTheDocument();
});
it('does not chain completion under a later account after answers were sent by A', async () => {
  const pending = deferred<{ data: unknown }>();
  vi.mocked(api.post).mockImplementation((url) => url.endsWith('/answers') ? pending.promise : Promise.resolve({ data: { triage_id: 'triage-A', questions: [] } }));
  const view = await startView(); fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Sintomas do próprio titular' } }); fireEvent.click(screen.getByRole('button', { name: 'Iniciar Triagem' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Submeter Respostas' })); await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2)); identity.userId = 'owner-B'; identity.token = 'token-B'; view.rerender(tree());
  await act(async () => pending.resolve({ data: {} })); expect(api.post).toHaveBeenCalledTimes(2);
  expect(vi.mocked(api.post).mock.calls[1][2]?.headers).toEqual({ Authorization: 'Bearer token-A' });
});
