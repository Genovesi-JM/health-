import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import { I18nProvider } from '../i18n/LanguageContext';
import PublicDoctorPage from './PublicDoctorPage';

vi.mock('../api', () => ({ default: { get: vi.fn() } }));
const doctor = { display_name: 'Ana Exemplo', slug: 'ana', specialization: 'clinica_geral', practice_country: 'AO',
  consultation_types: ['teleconsulta'], price_min: 10000, price_max: 20000, location_city: 'Lisboa' };
beforeEach(() => vi.resetAllMocks());
function show(path = '/medicos/ana') { return render(<MemoryRouter initialEntries={[path]}><I18nProvider>
  <Link to="/medicos/beatriz?country=PT">Outro perfil</Link><Routes><Route path="/medicos/:slug" element={<PublicDoctorPage />} /></Routes>
</I18nProvider></MemoryRouter>); }

it.each(['PT', null])('labels the authoritative country %s and suppresses ambiguous prices', async country => {
  vi.mocked(api.get).mockResolvedValue({ data: { ...doctor, practice_country: country, location_city: 'Luanda' } });
  show('/medicos/ana?country=PT'); await screen.findByRole('heading', { name: doctor.display_name });
  expect(api.get).toHaveBeenCalledExactlyOnceWith('/api/v1/doctors/by-slug/ana', { params: { country: 'PT' } });
  expect(screen.getByText(country === 'PT' ? 'Exercício confirmado em Portugal' : 'País de exercício não confirmado')).toBeInTheDocument();
  expect(screen.queryByText(/Kz|EUR|€/)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Todos os médicos/ })).toHaveAttribute('href', '/medicos?country=PT');
});

it('uses Angola by default and displays legacy Kz only for explicitly confirmed Angola practice', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: doctor }); show();
  await screen.findByRole('heading', { name: doctor.display_name });
  expect(api.get).toHaveBeenCalledWith('/api/v1/doctors/by-slug/ana', { params: { country: 'AO' } });
  expect(screen.getByText('Exercício confirmado em Angola')).toBeInTheDocument();
  expect(screen.getByText(/Kz/)).toBeInTheDocument();
});

it('clears the previous profile immediately on slug changes and ignores its late response', async () => {
  let finishOld!: (value: unknown) => void;
  let finishNew!: (value: unknown) => void;
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { finishNew = resolve; }));
  show(); fireEvent.click(screen.getByRole('link', { name: 'Outro perfil' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await act(async () => { finishNew({ data: { ...doctor, display_name: 'Beatriz Atual', practice_country: 'PT' } }); });
  await screen.findByRole('heading', { name: 'Beatriz Atual' });
  await act(async () => { finishOld({ data: doctor }); });
  expect(screen.queryByRole('heading', { name: doctor.display_name })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Beatriz Atual' })).toBeInTheDocument();
});

it('resets a previous404 when the patient chooses another country', async () => {
  vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 404 } }).mockResolvedValueOnce({ data: { ...doctor, practice_country: 'PT' } });
  show(); await screen.findByText('Este perfil não está disponível para atendimento em Angola.');
  fireEvent.change(screen.getByLabelText('País de atendimento'), { target: { value: 'PT' } });
  await screen.findByRole('heading', { name: doctor.display_name });
  expect(screen.queryByText(/não está disponível/)).not.toBeInTheDocument();
  expect(api.get).toHaveBeenLastCalledWith('/api/v1/doctors/by-slug/ana', { params: { country: 'PT' } });
});

it('does not show the previous doctor after a network failure for the next profile and permits retry', async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ data: doctor }).mockRejectedValueOnce(new Error('Network failed'))
    .mockResolvedValueOnce({ data: { ...doctor, display_name: 'Beatriz Recuperada', practice_country: 'PT' } });
  show(); await screen.findByRole('heading', { name: doctor.display_name });
  fireEvent.click(screen.getByRole('link', { name: 'Outro perfil' }));
  expect(screen.queryByRole('heading', { name: doctor.display_name })).not.toBeInTheDocument();
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o perfil');
  expect(screen.queryByText(/não está disponível para atendimento/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await screen.findByRole('heading', { name: 'Beatriz Recuperada' });
});
