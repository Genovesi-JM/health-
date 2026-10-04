import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import api from '../api';
import { I18nProvider } from '../i18n/LanguageContext';
import ConsultationsPage from './ConsultationsPage';
const capture = vi.hoisted(() => ({ props: null as null | { open: boolean; country: string | null; recoveryOnly: boolean; onPaid: () => void } }));
vi.mock('../api', () => ({ default: { get: vi.fn(), patch: vi.fn() }, getSession: () => ({ userId: 'patient-user' }) }));
vi.mock('../components/PaymentModal', () => ({ default: (props: typeof capture.props) => { capture.props = props; return null; } }));
vi.mock('../components/BookConsultationModal', () => ({ default: () => null }));
vi.mock('../components/ChatModal', () => ({ default: () => null }));
vi.mock('../components/ReviewModal', () => ({ default: () => null }));
vi.mock('../components/TeleconsultationControl', () => ({ default: () => null }));
vi.mock('../components/ConsultationCloseout', () => ({ default: () => null }));
const visit = { id: 'visit-1', specialty: 'clinica_geral', patient_id: 'patient-1', status: 'scheduled', country: 'PT', scheduled_at: '2026-12-01T08:00:00Z', timezone: 'Europe/Lisbon', created_at: '2026-10-01T08:00:00Z', payment_status: 'unpaid' };
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); capture.props = null; vi.mocked(api.get).mockImplementation(async url => ({ data: url.endsWith('/me/page') ? { items: [visit], next_cursor: null } : null })); });
const show = () => render(<MemoryRouter><I18nProvider><ConsultationsPage /></I18nProvider></MemoryRouter>);
describe('consultation payment integration', () => {
  it('passes the consultation country and refreshes authoritative state rather than marking paid optimistically', async () => {
    show(); fireEvent.click(await screen.findByRole('button', { name: /Pagar/ }));
    expect(capture.props).toMatchObject({ open: true, country: 'PT', recoveryOnly: false });
    const before = vi.mocked(api.get).mock.calls.filter(([url]) => url.endsWith('/me/page')).length;
    await act(async () => capture.props!.onPaid());
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.filter(([url]) => url.endsWith('/me/page')).length).toBe(before + 1));
    expect(await screen.findByRole('button', { name: /Pagar/ })).toBeInTheDocument();
    expect(capture.props?.open).toBe(false); expect(screen.queryByText('Pago')).not.toBeInTheDocument();
  });
  it.each(['paid', 'cancelled', 'completed', 'expired'])('keeps recovery reachable for %s while disabling fresh checkout', async state => {
    vi.mocked(api.get).mockImplementation(async url => ({ data: url.endsWith('/me/page') ? { items: [{ ...visit, ...(state === 'paid' ? { payment_status: 'paid' } : { status: state }) }], next_cursor: null } : null }));
    show(); fireEvent.click(await screen.findByRole('button', { name: 'Verificar pagamento' }));
    expect(capture.props).toMatchObject({ open: true, country: 'PT', recoveryOnly: true });
  });
});
