import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import { I18nProvider } from '../i18n/LanguageContext';
import FamilyPage from './FamilyPage';
import TriagePage from './TriagePage';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('../components/TriagePhotoGuide', () => ({ default: () => null }));
beforeEach(() => { vi.resetAllMocks(); vi.mocked(api.get).mockResolvedValue({ data: [] }); });
function show(state?: unknown) {
  return render(<MemoryRouter initialEntries={[{ pathname: '/triage', state }]}><I18nProvider><TriagePage /></I18nProvider></MemoryRouter>);
}

it.each([{ id: 'child', is_minor: true }, { id: 'adult-relative', is_minor: false }, null, 'malformed', { id: 123 }])(
  'blocks stale dependent context instead of silently starting as the account holder: %j', context => {
    show({ dependent: context });
    expect(screen.getByRole('alert')).toHaveTextContent('em nome de outra pessoa não está disponível');
    expect(screen.queryByRole('button', { name: 'Iniciar Triagem' })).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled();
  },
);

it('allows explicit adult self intake without family selectors or guardian controls', async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { triage_id: 'self-triage', questions: [] } });
  show();
  fireEvent.click((await screen.findAllByRole('button', { name: 'Nova Triagem' }))[0]);
  expect(screen.getByRole('note')).toHaveTextContent('próprio titular adulto');
  expect(screen.queryByText('Estou a responder como pai/mãe ou responsável')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Sintomas do próprio titular' } });
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar Triagem' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/triage/start', {
    chief_complaint: 'Sintomas do próprio titular', age_group: 'adult', category: 'general', answered_by_guardian: false,
    vital_signs: undefined,
  }));
  expect(vi.mocked(api.get).mock.calls.some(([path]) => path === '/api/v1/family/me')).toBe(false);
});

it('keeps family profile records separate from unsupported delegated triage', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: [{ id: 'child', full_name: 'Familiar sintético', relationship: 'filho',
    date_of_birth: '2020-01-01', is_minor: true, emergency_contact: false, created_at: '2026-10-04T10:00:00Z' }] });
  render(<MemoryRouter><I18nProvider><FamilyPage /></I18nProvider></MemoryRouter>);
  await screen.findByText('Familiar sintético');
  expect(screen.getByText('Triagem para familiares indisponível.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Triagem' })).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});
