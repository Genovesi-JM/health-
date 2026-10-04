import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import { I18nProvider } from '../i18n/LanguageContext';
import TeleconsultationControl from './TeleconsultationControl';
import { approvedServerVideoRoom } from '../utils/video';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ user: { id: 'current-user' } }) }));
vi.mock('../utils/video', () => ({ approvedServerVideoRoom: vi.fn((url: string) => url) }));
const session = { id: 'session-1', consultation_id: 'visit-1', reschedule_revision: 3, provider: 'Private provider', provider_mode: 'production', status: 'in_progress', preflight: {}, preflight_complete: true,
  participants: [{ role: 'doctor', user_id: 'current-user', checked_in_at: '2026-10-04T10:00:00Z' }], provider_notice: 'Fornecedor configurado.' };
function server(enabled = false, item: typeof session | null = session) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.endsWith('/capabilities')) return { data: { enabled, message: 'Integração de vídeo ainda indisponível.' } };
    if (item) return { data: item };
    throw { response: { status: 404 } };
  });
}
function show(role: 'doctor' | 'patient' | 'nurse' = 'doctor', props = {}) { return render(<I18nProvider><TeleconsultationControl consultationId="visit-1" role={role} {...props} /></I18nProvider>); }
beforeEach(() => { vi.resetAllMocks(); vi.mocked(approvedServerVideoRoom).mockImplementation(url => url); server(); });

describe('teleconsultation capability and readiness', () => {
  it('shows the actual unavailable capability without allowing a fake start or camera access', async () => {
    show(); await screen.findByText('Vídeo indisponível');
    expect(screen.getByText('Integração de vídeo ainda indisponível.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entrar na sala' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Testar câmara e microfone' })).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
  it('does not offer preparation while the provider is unavailable and the room is absent', async () => {
    server(false, null); show(); await screen.findByText('Vídeo indisponível');
    expect(screen.queryByRole('button', { name: 'Preparar sala' })).not.toBeInTheDocument();
  });
  it('fails closed on a capability read error and lets the user retry', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Offline')); show();
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar');
    expect(screen.getByText('Vídeo indisponível')).toBeInTheDocument();
    server(true); fireEvent.click(screen.getByRole('button', { name: 'Atualizar preparação' }));
    await screen.findByRole('button', { name: 'Entrar na sala' });
  });
  it('labels preview data and performs no real calls or simulated live transitions', async () => {
    show('doctor', { preview: true });
    expect(screen.getByText(/Pré-visualização com dados de demonstração/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciar teleconsulta' })).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled();
  });
  it('requires the current participant rather than another doctor to have checked in', async () => {
    server(true, { ...session, participants: [{ ...session.participants[0], user_id: 'another-doctor' }] }); show();
    expect(await screen.findByRole('button', { name: 'Entrar na sala' })).toBeDisabled();
  });
  it('requires explicit patient consent and a self-reported connection assessment', async () => {
    const tracks = [{ readyState: 'live', stop: vi.fn() }, { readyState: 'live', stop: vi.fn() }];
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => tracks, getVideoTracks: () => [tracks[0]], getAudioTracks: () => [tracks[1]] }) } });
    server(true, { ...session, participants: [] }); vi.mocked(api.post).mockResolvedValue({ data: session }); show('patient');
    fireEvent.click(await screen.findByRole('button', { name: 'Testar câmara e microfone' })); await screen.findByRole('button', { name: 'Dispositivo pronto' });
    const checkin = screen.getByRole('button', { name: 'Fazer check-in' }); expect(checkin).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Como está a sua ligação? (avaliação sua)'), { target: { value: 'fair' } }); expect(checkin).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(checkin);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/teleconsultations/visit-1/check-in', { camera_ready: true, microphone_ready: true, network_quality: 'fair', consent_confirmed: true }, { params: { expected_revision: 3 } }));
    expect(tracks.every(track => track.stop.mock.calls.length === 1)).toBe(true);
  });
  it('binds a saved checklist and start request to the displayed appointment revision', async () => {
    server(true, { ...session, status: 'waiting' });
    vi.mocked(api.put).mockResolvedValue({ data: session });
    const nurse = show('nurse');
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar checklist' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/teleconsultations/visit-1/preflight', { preflight_note: undefined }, { params: { expected_revision: 3 } }));
    nurse.unmount();
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { detail: 'A marcação mudou. Atualize a consulta.' } } });
    show('doctor');
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar teleconsulta' }));
    await screen.findByRole('alert');
    expect(api.post).toHaveBeenCalledWith('/api/v1/teleconsultations/visit-1/start', undefined, { params: { expected_revision: 3 } });
    expect(api.post).not.toHaveBeenCalledWith('/api/v1/teleconsultations/visit-1/join');
  });
  it('does not hand an unapproved URL to an iframe callback', async () => {
    server(true); const onEnterRoom = vi.fn(); vi.mocked(api.post).mockResolvedValue({ data: { room_url: 'javascript:bad()' } });
    vi.mocked(approvedServerVideoRoom).mockImplementation(() => { throw new Error('Unsafe URL'); }); show('doctor', { onEnterRoom });
    fireEvent.click(await screen.findByRole('button', { name: 'Entrar na sala' })); await screen.findByRole('alert'); expect(onEnterRoom).not.toHaveBeenCalled();
  });
  it('gives a deliberate link after join so popup blocking does not hide the room', async () => {
    server(true); vi.mocked(api.post).mockResolvedValue({ data: { room_url: 'https://video.example/private-room' } }); show();
    fireEvent.click(await screen.findByRole('button', { name: 'Entrar na sala' }));
    expect(await screen.findByRole('link', { name: 'Abrir sala de vídeo' })).toHaveAttribute('href', 'https://video.example/private-room');
  });
});
