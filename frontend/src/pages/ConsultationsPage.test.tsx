import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import api from '../api';
import { I18nProvider } from '../i18n/LanguageContext';
import ConsultationsPage from './ConsultationsPage';

vi.mock('../api', () => ({ default: { get: vi.fn(), patch: vi.fn() }, getSession: () => ({ userId: 'patient-user' }) }));
vi.mock('../components/BookConsultationModal', () => ({ default: () => null }));
vi.mock('../components/PaymentModal', () => ({ default: () => null }));
vi.mock('../components/ChatModal', () => ({ default: () => null }));
vi.mock('../components/ReviewModal', () => ({ default: () => null }));
vi.mock('../components/TeleconsultationControl', () => ({ default: () => null }));
vi.mock('../components/ConsultationCloseout', () => ({ default: () => null }));
const visit = { id: 'visit-1', specialty: 'clinica_geral', patient_id: 'patient-1', status: 'scheduled', scheduled_at: '2026-12-01T08:00:00Z', timezone: 'Africa/Luanda', created_at: '2026-10-01T08:00:00Z', payment_status: 'unpaid' };
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.mocked(api.get).mockImplementation(async url => ({ data: url.endsWith('/me') ? [visit] : null }));
  vi.mocked(api.patch).mockResolvedValue({ data: { ...visit, status: 'cancelled' } });
});
function show() { return render(<MemoryRouter><I18nProvider><ConsultationsPage /></I18nProvider></MemoryRouter>); }
async function confirmation() {
  await userEvent.click(await screen.findByRole('button', { name: 'Cancelar consulta' }));
  return screen.getByRole('dialog', { name: 'Cancelar esta consulta?' });
}
describe('patient consultation cancellation', () => {
  it('waits for explicit confirmation and applies only the persisted server status', async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(api.patch).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    show(); const dialog = await confirmation(); expect(api.patch).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/Africa\/Luanda/)).toBeInTheDocument();
    await userEvent.dblClick(within(dialog).getByRole('button', { name: 'Confirmar cancelamento' }));
    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(api.patch).toHaveBeenCalledWith('/api/v1/consultations/visit-1', {});
    expect(screen.queryByText('Consulta cancelada.')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Manter consulta' })).toBeDisabled();
    finish({ data: { ...visit, status: 'cancelled' } });
    expect(await screen.findByRole('status')).toHaveTextContent('Consulta cancelada.');
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar consulta' })).not.toBeInTheDocument();
  });
  it('dismisses confirmation without issuing a cancellation', async () => {
    show(); const dialog = await confirmation();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Manter consulta' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancelar consulta' })).toBeEnabled();
  });
  it('leaves the existing appointment unchanged and shows a rejection', async () => {
    vi.mocked(api.patch).mockRejectedValue({ response: { status: 403, data: { detail: 'Cancelamento indisponível' } } });
    show(); const dialog = await confirmation();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar cancelamento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cancelamento indisponível');
    expect(screen.queryByText('Cancelada')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Confirmar cancelamento' })).toBeEnabled();
  });
  it('refreshes the actual consultation after a conflict and removes actions for active care', async () => {
    vi.mocked(api.patch).mockRejectedValue({ response: { status: 409 } });
    show(); const dialog = await confirmation();
    vi.mocked(api.get).mockResolvedValue({ data: [{ ...visit, status: 'in_progress' }] });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar cancelamento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A consulta mudou');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancelar consulta' })).not.toBeInTheDocument());
    expect(api.get).toHaveBeenLastCalledWith('/api/v1/consultations/me');
    expect(screen.queryByText('Consulta cancelada.')).not.toBeInTheDocument();
  });
  it('does not offer patient cancellation for care already in progress or completed', async () => {
    vi.mocked(api.get).mockImplementation(async url => ({ data: url.endsWith('/me') ? [{ ...visit, status: 'in_progress' }, { ...visit, id: 'visit-2', status: 'completed' }] : null }));
    show(); await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Cancelar consulta' })).not.toBeInTheDocument();
  });
  it('keeps cancellation unavailable if a conflict cannot be refreshed', async () => {
    vi.mocked(api.patch).mockRejectedValue({ response: { status: 409 } });
    show(); const dialog = await confirmation(); vi.mocked(api.get).mockRejectedValue(new Error('Offline'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar cancelamento' }));
    expect(await screen.findByText(/não foi possível atualizar a lista/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar consulta' })).not.toBeInTheDocument();
  });
});
