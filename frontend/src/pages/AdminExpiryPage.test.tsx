import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminExpiryPage from './AdminExpiryPage';
import { I18nProvider } from '../i18n/LanguageContext';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import api from '../api';
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>;
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>;

function renderPage() {
  return render(<I18nProvider><AdminExpiryPage /></I18nProvider>);
}

const ROWS = [
  { credential_id: 'c1', legal_name: 'Dr. Alpha', profession: 'doctor', licence_country: 'AO',
    licence_number: 'AO-1', issuing_authority: 'Ordem', status: 'verified', expiry_date: '2026-01-01', days_remaining: -5 },
  { credential_id: 'c2', legal_name: 'Dr. Soon', profession: 'doctor', licence_country: 'AO',
    licence_number: 'AO-2', issuing_authority: 'Ordem', status: 'verified', expiry_date: '2026-08-10', days_remaining: 7 },
  { credential_id: 'c3', legal_name: 'Dr. Later', profession: 'nurse', licence_country: 'PT',
    licence_number: 'PT-9', issuing_authority: 'OE', status: 'verified', expiry_date: '2026-10-01', days_remaining: 60 },
];

describe('AdminExpiryPage', () => {
  beforeEach(() => { mockGet.mockReset(); mockPost.mockReset(); });

  it('lists upcoming expiries with names + authorities', async () => {
    mockGet.mockResolvedValueOnce({ data: { cutoff_days: 90, total: 3, items: ROWS } });
    renderPage();
    await waitFor(() => expect(screen.getByText('Dr. Alpha')).toBeInTheDocument());
    expect(screen.getByText('Dr. Soon')).toBeInTheDocument();
    expect(screen.getByText('Dr. Later')).toBeInTheDocument();
    expect(screen.getByText(/Ordem — AO-1/)).toBeInTheDocument();
  });

  it('shows an "expired" badge for negative days and a day-count otherwise', async () => {
    mockGet.mockResolvedValueOnce({ data: { cutoff_days: 90, total: 3, items: ROWS } });
    renderPage();
    await waitFor(() => expect(screen.getByText(/expirado|expired/i)).toBeInTheDocument());
    // The 7-day row shows a "7 …" badge.
    expect(screen.getByText(/^7 /)).toBeInTheDocument();
  });

  it('shows an empty state when nothing is expiring', async () => {
    mockGet.mockResolvedValueOnce({ data: { cutoff_days: 90, total: 0, items: [] } });
    renderPage();
    await waitFor(() => expect(screen.getByText(/nenhum documento|no documents/i)).toBeInTheDocument());
  });

  it('run-scan posts to the scan endpoint and reloads', async () => {
    mockGet.mockResolvedValue({ data: { cutoff_days: 90, total: 0, items: [] } });
    mockPost.mockResolvedValueOnce({ data: { reminders_fired: 2, credentials_expired: 1 } });
    renderPage();
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    fireEvent.click(screen.getByText(/executar verificação|run scan/i));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/compliance/expiry/scan'));
  });

  it('changing the window re-queries with the new day count', async () => {
    mockGet.mockResolvedValue({ data: { cutoff_days: 30, total: 0, items: [] } });
    renderPage();
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '30' } });
    await waitFor(() => expect(mockGet.mock.calls.some(c => String(c[0]).includes('days=30'))).toBe(true));
  });
});
