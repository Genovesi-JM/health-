import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import { I18nProvider } from '../i18n/LanguageContext';
import DoctorsListPage from './DoctorsListPage';

vi.mock('../api', () => ({ default: { get: vi.fn() } }));
const doctor = { id: 'doctor', display_name: 'Médica de exemplo', slug: 'ana-exemplo', specialization: 'clinica_geral',
  practice_country: 'AO', location_city: 'Lisboa', price_min: 10000, price_max: 20000 };
beforeEach(() => vi.resetAllMocks());
function show(path = '/medicos') { return render(<MemoryRouter initialEntries={[path]}><I18nProvider><DoctorsListPage /></I18nProvider></MemoryRouter>); }

it('prioritizes Angola, sends the market to the service, and preserves it in profile links', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: [doctor] }); show();
  await screen.findByText(doctor.display_name);
  expect(screen.getByLabelText('País de atendimento')).toHaveValue('AO');
  expect(api.get).toHaveBeenCalledExactlyOnceWith('/api/v1/doctors/', { params: { country: 'AO' } });
  expect(screen.getByText('Exercício confirmado em Angola')).toBeInTheDocument();
  expect(screen.getByText(/Kz/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Médica de exemplo/ })).toHaveAttribute('href', '/medicos/ana-exemplo?country=AO');
});

it('uses the Portugal deep link and never presents unqualified legacy prices as Kz or euros', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: [{ ...doctor, practice_country: 'PT', location_city: 'Luanda' },
    { ...doctor, id: 'unknown', display_name: 'País desconhecido', practice_country: null }] });
  show('/medicos?country=PT'); await screen.findByText(doctor.display_name);
  expect(api.get).toHaveBeenCalledWith('/api/v1/doctors/', { params: { country: 'PT' } });
  expect(screen.getByText('Exercício confirmado em Portugal')).toBeInTheDocument();
  expect(screen.getByText('País de exercício não confirmado')).toBeInTheDocument();
  expect(screen.queryByText(/Kz|EUR|€/)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Médica de exemplo/ })).toHaveAttribute('href', '/medicos/ana-exemplo?country=PT');
});

it('ignores late Angola results after a market change and composes existing filters with the country', async () => {
  let finishAngola!: (value: unknown) => void;
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finishAngola = resolve; }))
    .mockResolvedValue({ data: [{ ...doctor, practice_country: 'PT', display_name: 'Resultado Portugal' }] });
  show(); fireEvent.change(screen.getByLabelText('País de atendimento'), { target: { value: 'PT' } });
  await screen.findByText('Resultado Portugal');
  await act(async () => { finishAngola({ data: [doctor] }); });
  expect(screen.queryByText(doctor.display_name)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
  const specialty = screen.getAllByRole('combobox')[1];
  fireEvent.change(specialty, { target: { value: 'cardiologia' } });
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/api/v1/doctors/', { params: { country: 'PT', specialty: 'cardiologia' } }));
});

it('filters names locally without downloading the directory again on every keystroke', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: [doctor] }); show(); await screen.findByText(doctor.display_name);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Sem correspondência' } });
  expect(screen.queryByText(doctor.display_name)).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '  médica  ' } });
  expect(screen.getByText(doctor.display_name)).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledOnce();
});

it('shows a retriable failure without claiming the chosen country has no doctors', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ data: [{ ...doctor, practice_country: 'PT' }] });
  show('/medicos?country=PT'); await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await screen.findByText(doctor.display_name);
  expect(api.get).toHaveBeenLastCalledWith('/api/v1/doctors/', { params: { country: 'PT' } });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
