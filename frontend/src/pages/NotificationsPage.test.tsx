import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import api from '../api';
import NotificationsPage from './NotificationsPage';
import { I18nProvider } from '../i18n/LanguageContext';
import type { InboxNotification } from '../utils/notifications';
const auth = vi.hoisted(() => ({ user: { id: 'owner-1', role: 'patient' } as { id: string; role: string } | null }));
vi.mock('../AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));
const first: InboxNotification = { id: 'n-1', title: 'Consulta aceite', message: 'Abra os detalhes da consulta.', type: 'success', is_read: false, channel: 'in_app', read_at: null, created_at: '2026-10-04T08:00:00Z', related_entity_type: 'consultation', related_entity_id: 'visit-1' };
const second: InboxNotification = { ...first, id: 'n-2', title: 'Resumo disponível', is_read: true };
const capabilities = { channels: { in_app: true, email: false, sms: false, push: false }, read_is_care_acknowledgement: false };
const inbox = { items: [first], next_cursor: 'opaque-next', unread_count: 12 };
beforeEach(() => {
  vi.resetAllMocks(); auth.user = { id: 'owner-1', role: 'patient' };
  vi.mocked(api.get).mockImplementation(async url => ({ data: url.endsWith('/capabilities') ? capabilities : url.endsWith('/unread-count') ? { unread: 11 } : inbox }));
  vi.mocked(api.patch).mockResolvedValue({ data: { ...first, is_read: true, read_at: '2026-10-04T09:00:00Z' } });
});
function node() { return <MemoryRouter><I18nProvider><NotificationsPage /></I18nProvider></MemoryRouter>; }
function show() { return render(node()); }
describe('in-app notification inbox', () => {
  it('shows the global unread count and honestly reports unavailable external channels', async () => {
    show(); expect(await screen.findByText('12 por ler na sua conta')).toBeInTheDocument();
    expect(await screen.findByText('Email: indisponível · SMS: indisponível · Push: indisponível')).toBeInTheDocument();
    expect(screen.getByText(/Não confirma receção de cuidados/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir consultas' })).toHaveAttribute('href', '/consultations');
  });
  it('loads server pages using the opaque cursor, merging duplicates without losing existing rows', async () => {
    show(); await screen.findByText(first.title);
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [first, second], next_cursor: null, unread_count: 12 } });
    await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
    expect(await screen.findByText(second.title)).toBeInTheDocument();
    expect(screen.getAllByText(first.title)).toHaveLength(1);
    expect(api.get).toHaveBeenLastCalledWith('/api/v1/notifications/inbox', { params: { limit: 20, unread_only: false, cursor: 'opaque-next' } });
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
  });
  it('filters unread items on the server and starts a fresh cursor sequence', async () => {
    show(); await screen.findByText(first.title);
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [], next_cursor: null, unread_count: 0 } });
    await userEvent.click(screen.getByRole('button', { name: 'Por ler' }));
    expect(await screen.findByText('Sem notificações por ler.')).toBeInTheDocument();
    expect(api.get).toHaveBeenLastCalledWith('/api/v1/notifications/inbox', { params: { limit: 20, unread_only: true } });
    expect(screen.queryByText(first.title)).not.toBeInTheDocument();
  });
  it('keeps received messages and the last count visible when refresh fails', async () => {
    show(); await screen.findByText(first.title);
    vi.mocked(api.get).mockImplementation(async url => { if (url.endsWith('/capabilities')) return { data: capabilities }; throw new Error('Offline'); });
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar');
    expect(screen.getByText(first.title)).toBeInTheDocument(); expect(screen.getByText('12 por ler na sua conta')).toBeInTheDocument();
    expect(screen.queryByText('Ainda não existem notificações.')).not.toBeInTheDocument();
  });
  it('does not mark read optimistically or issue duplicate writes', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(api.patch).mockImplementation(() => new Promise(done => { resolve = done; }));
    show(); await screen.findByText(first.title);
    const row = screen.getByRole('article', { name: first.title });
    await userEvent.dblClick(within(row).getByRole('button', { name: `Marcar como lida: ${first.title}` }));
    expect(api.patch).toHaveBeenCalledTimes(1); expect(within(row).getByText(/Por ler/)).toBeInTheDocument();
    await act(async () => { resolve({ data: { ...first, is_read: true } }); });
    expect(within(row).getByText(/Lida/)).toBeInTheDocument();
    expect(await screen.findByText('11 por ler na sua conta')).toBeInTheDocument();
  });
  it('does not confuse an exhausted unread page with a globally empty inbox', async () => {
    show(); await screen.findByText(first.title);
    await userEvent.click(screen.getByRole('button', { name: 'Por ler' }));
    await screen.findByText(first.title);
    await userEvent.click(screen.getByRole('button', { name: `Marcar como lida: ${first.title}` }));
    expect(await screen.findByText('11 por ler na sua conta')).toBeInTheDocument();
    expect(screen.getByText('Sem mensagens nesta página. Atualize ou carregue mais notificações.')).toBeInTheDocument();
    expect(screen.queryByText('Sem notificações por ler.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Carregar mais' })).toBeEnabled();
  });
  it('surfaces a rejected read mutation and retains unread status', async () => {
    vi.mocked(api.patch).mockRejectedValue(new Error('Database unavailable'));
    show(); await screen.findByText(first.title);
    await userEvent.click(screen.getByRole('button', { name: `Marcar como lida: ${first.title}` }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível guardar a leitura');
    expect(screen.getByRole('button', { name: `Marcar como lida: ${first.title}` })).toBeEnabled();
    expect(screen.queryByText('Notificação marcada como lida.')).not.toBeInTheDocument();
  });
  it('does not mark rows read when read-all fails', async () => {
    vi.mocked(api.patch).mockRejectedValue(new Error('Unavailable'));
    show(); await screen.findByText(first.title);
    await userEvent.click(screen.getByRole('button', { name: 'Marcar todas como lidas' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível guardar a leitura');
    expect(screen.getByRole('button', { name: `Marcar como lida: ${first.title}` })).toBeInTheDocument();
    expect(screen.getByText('12 por ler na sua conta')).toBeInTheDocument();
  });
  it('shows an unavailable inbox instead of a false empty state on initial failure', async () => {
    vi.mocked(api.get).mockImplementation(async url => { if (url.endsWith('/capabilities')) return { data: capabilities }; throw new Error('Offline'); });
    show(); expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar');
    expect(screen.getByText('Total por ler indisponível.')).toBeInTheDocument();
    expect(screen.queryByText('Ainda não existem notificações.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar todas como lidas' })).toBeDisabled();
  });
  it('refreshes after read-all so a newly arrived notification stays unread', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { ok: true, updated_count: 12 } });
    show(); await screen.findByText(first.title);
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [{ ...first, is_read: true }, { ...second, is_read: false }], next_cursor: null, unread_count: 1 } });
    await userEvent.click(screen.getByRole('button', { name: 'Marcar todas como lidas' }));
    expect(await screen.findByText('1 por ler na sua conta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Marcar como lida: ${second.title}` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Marcar como lida: ${first.title}` })).not.toBeInTheDocument();
  });
  it('refreshes the inbox when the app regains focus', async () => {
    show(); await screen.findByText(first.title);
    vi.mocked(api.get).mockImplementation(async url => ({ data: url.endsWith('/capabilities') ? capabilities : { items: [second], next_cursor: null, unread_count: 0 } }));
    fireEvent(window, new Event('focus'));
    expect(await screen.findByText(second.title)).toBeInTheDocument();
    expect(screen.queryByText(first.title)).not.toBeInTheDocument();
  });
  it('hides old account items immediately and ignores a late old-account response', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementation(async url => url.endsWith('/capabilities') ? { data: capabilities } : new Promise(done => { resolve = done; }));
    const page = show();
    auth.user = { id: 'owner-2', role: 'doctor' };
    vi.mocked(api.get).mockImplementation(async url => ({ data: url.endsWith('/capabilities') ? capabilities : { items: [second], next_cursor: null, unread_count: 0 } }));
    page.rerender(node());
    expect(await screen.findByText(second.title)).toBeInTheDocument();
    await act(async () => { resolve({ data: inbox }); });
    expect(screen.queryByText(first.title)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir agenda' })).toHaveAttribute('href', '/doctor/agenda');
    auth.user = null; page.rerender(node()); expect(screen.queryByText(second.title)).not.toBeInTheDocument();
  });
});
