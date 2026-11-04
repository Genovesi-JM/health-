import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import { I18nProvider } from '../i18n/LanguageContext';
import DoctorLivePage from './DoctorLivePage';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../components/TeleconsultationControl', () => ({ default: ({ onEnterRoom }: { onEnterRoom: (url: string) => void }) => <button onClick={() => onEnterRoom('https://video.example/private-room')}>Entrar sala teste</button> }));
const appointment = { id: 'visit-1', patient: 'Paciente teste', time: '12:00', status: 'in_progress', type: 'teleconsulta' };
beforeEach(() => {
  vi.resetAllMocks(); vi.mocked(api.get).mockImplementation(async url => ({ data: url.endsWith('/agenda/today') ? [appointment] : { consultation_id: 'visit-1', status: 'in_progress', closeout: null } }));
});
async function enterRoom() {
  render(<I18nProvider><DoctorLivePage /></I18nProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Preparar consulta' }));
  await screen.findByLabelText('Avaliação clínica (interna)');
  fireEvent.click(screen.getByRole('button', { name: 'Entrar sala teste' }));
}
describe('doctor video and clinical closure', () => {
  it('ends video separately while retaining the clinician draft for completion', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} }); await enterRoom();
    fireEvent.change(screen.getByLabelText('Avaliação clínica (interna)'), { target: { value: 'Rascunho clínico' } });
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar vídeo' }));
    await waitFor(() => expect(screen.queryByTitle('Teleconsulta — Paciente teste')).not.toBeInTheDocument());
    expect(api.post).toHaveBeenCalledWith('/api/v1/teleconsultations/visit-1/complete');
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Avaliação clínica (interna)')).toHaveValue('Rascunho clínico');
    expect(screen.getByRole('button', { name: 'Concluir e publicar resumo' })).toBeDisabled();
  });
  it('shows an ending failure and does not pretend that the video ended', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Offline')); await enterRoom();
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar vídeo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar o encerramento');
    expect(screen.getByTitle('Teleconsulta — Paciente teste')).toBeInTheDocument();
  });
  it('does not promote cancelled or completed agenda rows as the next video appointment', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ ...appointment, status: 'cancelled' }] });
    render(<I18nProvider><DoctorLivePage /></I18nProvider>);
    await screen.findByText('Paciente teste');
    expect(screen.queryByRole('button', { name: 'Preparar consulta' })).not.toBeInTheDocument();
  });
});
