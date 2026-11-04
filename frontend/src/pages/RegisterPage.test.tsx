import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RegisterPage from './RegisterPage';

const { post, login, refreshUser, t } = vi.hoisted(() => ({
  post: vi.fn(), login: vi.fn(), refreshUser: vi.fn(), t: (key: string) => key,
}));
vi.mock('../api', () => ({ default: { post } }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ login, refreshUser }) }));
vi.mock('../i18n/LanguageContext', () => ({ useT: () => ({ t }) }));
vi.mock('../components/LanguageSelector', () => ({ default: () => null }));

function mount() {
  return render(<MemoryRouter initialEntries={['/register']}><Routes>
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/onboarding/patient" element={<div>Complete patient profile</div>} />
    <Route path="/professional-verification" element={<div>Complete professional dossier</div>} />
  </Routes></MemoryRouter>);
}

function fillAccount() {
  fireEvent.change(screen.getByPlaceholderText('João Silva'), { target: { value: 'Synthetic Patient' } });
  fireEvent.change(screen.getByPlaceholderText('utilizador@empresa.com'), { target: { value: 'synthetic@example.test' } });
  fireEvent.change(screen.getByPlaceholderText('register.password_placeholder'), { target: { value: 'SyntheticPass42!' } });
  fireEvent.change(screen.getByPlaceholderText('register.confirm_placeholder'), { target: { value: 'SyntheticPass42!' } });
}

describe('registration handoff', () => {
  beforeEach(() => {
    post.mockReset(); login.mockReset(); refreshUser.mockReset();
    post.mockResolvedValue({ data: { access_token: 'synthetic-token', user: { role: 'patient' } } });
    refreshUser.mockResolvedValue({ role: 'patient', patient_onboarding_complete: false });
  });

  it('creates an account, refreshes identity, then opens the consent/profile journey', async () => {
    const { container } = mount();
    fillAccount();
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByText('Complete patient profile')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ role: 'patient' }));
    expect(login).toHaveBeenCalledOnce();
    expect(refreshUser).toHaveBeenCalledOnce();
    expect(login.mock.invocationCallOrder[0]).toBeLessThan(refreshUser.mock.invocationCallOrder[0]);
  });

  it('retries profile loading without attempting to create the account twice', async () => {
    refreshUser.mockRejectedValueOnce(new Error('Temporary network failure'));
    const { container } = mount();
    fillAccount();
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByText(/A conta foi criada/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('utilizador@empresa.com')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar para o perfil' }));
    expect(await screen.findByText('Complete patient profile')).toBeInTheDocument();
    expect(post).toHaveBeenCalledOnce();
    expect(login).toHaveBeenCalledOnce();
    expect(refreshUser).toHaveBeenCalledTimes(2);
  });

  it('keeps a new professional on the application journey', async () => {
    const { container } = mount();
    fillAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Médico/a' }));
    for (const [placeholder, value] of [
      ['Autoridade emissora / Ordem profissional *', 'Synthetic Authority'],
      ['Número da cédula ou licença profissional *', 'SYN-123'],
      ['Instituição do diploma *', 'Synthetic University'],
      ['Título do curso / grau *', 'Medicine'],
    ]) fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
    refreshUser.mockResolvedValue({ role: 'patient', professional_application: { profession: 'doctor', status: 'draft' } });
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByText('Complete professional dossier')).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ role: 'doctor', practice_country: 'AO' }));
    expect(login.mock.calls[0][0].user.role).toBe('patient');
  });

  it('prevents duplicate requests while registration is pending', async () => {
    let resolve!: (value: unknown) => void;
    post.mockReturnValue(new Promise(value => { resolve = value; }));
    const { container } = mount();
    fillAccount();
    fireEvent.submit(container.querySelector('form')!);
    fireEvent.submit(container.querySelector('form')!);
    expect(post).toHaveBeenCalledOnce();
    resolve({ data: { access_token: 'synthetic-token', user: { role: 'patient' } } });
    await waitFor(() => expect(screen.getByText('Complete patient profile')).toBeInTheDocument());
  });
});
