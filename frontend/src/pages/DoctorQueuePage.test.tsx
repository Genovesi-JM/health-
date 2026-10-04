import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../i18n/LanguageContext';
import api from '../api';
import DoctorQueuePage from './DoctorQueuePage';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../components/PatientReadingsPanel', () => ({ default: () => null }));
vi.mock('../components/TriagePhotoReview', () => ({ default: () => null }));

beforeEach(() => vi.clearAllMocks());

function renderQueue(status: string) {
  vi.mocked(api.get).mockImplementation(async (url) => ({ data:
    url === '/api/v1/doctor/queue' ? [{
      id: 'consult-1', patient_name: 'Paciente de teste', specialty: 'clinica_geral',
      status, created_at: '2026-10-04T10:00:00Z', scheduled_at: '2026-10-06T10:00:00Z',
    }] : { items: [] },
  }));
  render(<MemoryRouter><I18nProvider><DoctorQueuePage /></I18nProvider></MemoryRouter>);
}

describe('doctor queue lifecycle actions', () => {
  it('accepts a request without treating it as an already scheduled visit', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'scheduled' } });
    renderQueue('requested');
    await userEvent.click(await screen.findByRole('button', { name: 'Aceitar pedido' }));
    expect(api.post).toHaveBeenCalledWith('/api/v1/doctor/queue/consult-1/accept');
  });

  it('starts a scheduled consultation through the start endpoint', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'in_progress' } });
    renderQueue('scheduled');
    await userEvent.click(await screen.findByRole('button', { name: 'Iniciar' }));
    expect(api.post).toHaveBeenCalledWith('/api/v1/doctor/queue/consult-1/start');
  });

  it('surfaces an action failure instead of silently hiding it', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Conflict'));
    renderQueue('requested');
    await userEvent.click(await screen.findByRole('button', { name: 'Aceitar pedido' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível atualizar');
  });
});
