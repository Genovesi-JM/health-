import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../api';
import ConsentManager from './ConsentManager';
import { readPendingConsent, savePendingConsent } from '../utils/consent';
import type { PendingConsent } from '../utils/consent';
import { syntheticEvent, syntheticPending, syntheticReceipt, syntheticState } from '../utils/consent.test-fixtures';
const identity = vi.hoisted(() => ({ userId: 'owner-A', token: 'token-A' }));
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() }, getSession: () => ({ ...identity }) }));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const tree = () => <MemoryRouter><ConsentManager /></MemoryRouter>;
const show = () => render(tree());
const title = 'Documento sintético privacy_policy';
async function grant() { fireEvent.click(await screen.findByRole('checkbox', { name: `Li a versão 1 de ${title}.` })); fireEvent.click(screen.getByRole('button', { name: `Aceitar — ${title}` })); }
beforeEach(() => {
  vi.restoreAllMocks(); vi.resetAllMocks(); localStorage.clear(); identity.userId = 'owner-A'; identity.token = 'token-A';
  vi.mocked(api.get).mockImplementation(async (url, options) => ({ data: url.includes('history') ? { items: [], next_cursor: null } : syntheticState((options?.params as { country?: string } | undefined)?.country === 'PT' ? 'PT' : 'AO') }));
  vi.mocked(api.post).mockImplementation(async (_url, body, options) => ({ data: syntheticReceipt({ owner: identity.userId, key: String(options?.headers?.['Idempotency-Key']), payload: body as PendingConsent['payload'] }) }));
});
afterEach(cleanup);
describe('versioned consent decisions', () => {
  it('shows approved plain text and never preselects a new decision', async () => {
    const view = show(); const checkbox = await screen.findByRole('checkbox', { name: `Li a versão 1 de ${title}.` });
    expect(checkbox).not.toBeChecked(); expect(screen.getByRole('button', { name: `Aceitar — ${title}` })).toBeDisabled();
    expect(view.container.querySelector('img')).toBeNull(); expect(screen.getByText(/Texto de teste privacy_policy/)).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(api.post).not.toHaveBeenCalled();
  });
  it('renders an empty approved catalog honestly without making a grant', async () => {
    const empty = syntheticState(); empty.available = false; empty.states = empty.states.map(item => ({ ...item, status: 'unavailable', document: null }));
    vi.mocked(api.get).mockResolvedValue({ data: empty }); show();
    await screen.findByText(/Ainda não há um conjunto completo/); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Consultar o meu histórico' })).toHaveAttribute('href', '/consultations');
  });
  it('persists exact references before POST and renders the authoritative receipt', async () => {
    vi.mocked(api.post).mockImplementation(async (_url, payload, config) => {
      const pending = readPendingConsent(identity.userId)!; expect(payload).toEqual(pending.payload);
      expect(config?.headers).toEqual({ Authorization: 'Bearer token-A', 'Idempotency-Key': pending.key }); return { data: syntheticReceipt(pending) };
    });
    show(); await grant(); await screen.findByText(/Decisão registada/);
    expect(readPendingConsent(identity.userId)).toBeNull(); expect(screen.getByRole('button', { name: `Retirar — ${title}` })).toBeEnabled();
  });
  it.each([undefined, 401, 403, 404, 409, 422, 500])('keeps uncertain identity after %s and after missing recovery', async status => {
    vi.mocked(api.post).mockRejectedValue(status ? { response: { status } } : new Error('lost response'));
    const view = show(); await grant(); await screen.findByText(/O resultado ainda não foi confirmado/); const pending = readPendingConsent(identity.userId)!;
    view.unmount(); vi.mocked(api.get).mockImplementation(async url => { if (url.includes('consent-requests')) throw { response: { status: 404 } }; return { data: syntheticState() }; });
    show(); fireEvent.click(await screen.findByRole('button', { name: 'Verificar decisão guardada' })); await screen.findByText(/O resultado ainda não foi confirmado/);
    expect(readPendingConsent(identity.userId)).toEqual(pending); fireEvent.click(screen.getByRole('button', { name: 'Repetir a mesma decisão' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2)); expect(vi.mocked(api.post).mock.calls[1][1]).toEqual(pending.payload);
    expect(vi.mocked(api.post).mock.calls[1][2]?.headers?.['Idempotency-Key']).toBe(pending.key);
  });
  it('keeps a later withdrawal in current state when recovering the older grant', async () => {
    const pending = syntheticPending(); savePendingConsent(pending);
    vi.mocked(api.get).mockImplementation(async url => ({ data: url.includes('consent-requests') ? syntheticReceipt(pending, true) : url.includes('history') ? { items: [], next_cursor: null } : syntheticState() }));
    show(); fireEvent.click(await screen.findByRole('button', { name: 'Verificar decisão guardada' }));
    await screen.findByText(/Finalidade: privacy_policy · Retirado/); expect(screen.getByRole('checkbox', { name: `Li a versão 1 de ${title}.` })).not.toBeChecked();
    expect(api.post).not.toHaveBeenCalled(); expect(readPendingConsent(identity.userId)).toBeNull();
  });
  it('permits withdrawal of the retained reference when the document has retired', async () => {
    const state = syntheticState('AO', 1); state.available = false; state.states[0] = { ...state.states[0], status: 'unavailable', document: null, latest_event: syntheticEvent() };
    vi.mocked(api.get).mockResolvedValue({ data: state }); vi.mocked(api.post).mockRejectedValue(new Error('offline'));
    show(); fireEvent.click(await screen.findByRole('button', { name: 'Retirar — privacy_policy' }));
    await waitFor(() => expect(api.post).toHaveBeenCalled()); expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ action: 'withdraw', document_id: 'AO-privacy_policy', expected_revision: 1 });
  });
  it('does not POST without storage and does not call an unsuccessful write saved', async () => {
    show(); await screen.findByRole('checkbox', { name: `Li a versão 1 de ${title}.` });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); }); await grant();
    await screen.findByText(/Nenhuma nova decisão foi enviada/); expect(api.post).not.toHaveBeenCalled();
  });
  it('ignores a late receipt after account replacement and retains A recovery', async () => {
    const late = deferred<{ data: ReturnType<typeof syntheticReceipt> }>(); vi.mocked(api.post).mockReturnValue(late.promise);
    const view = show(); await grant(); const pending = readPendingConsent('owner-A')!;
    identity.userId = 'owner-B'; identity.token = 'token-B'; view.rerender(tree());
    await act(async () => late.resolve({ data: syntheticReceipt(pending) }));
    expect(readPendingConsent('owner-A')).toEqual(pending); expect(readPendingConsent('owner-B')).toBeNull(); expect(screen.queryByText(/Decisão registada/)).not.toBeInTheDocument();
  });
  it('preserves loaded history on pagination failure and sends the cursor', async () => {
    vi.mocked(api.get).mockImplementation(async (url, config) => {
      if (!url.includes('history')) return { data: syntheticState() };
      if ((config?.params as { cursor?: string } | undefined)?.cursor) throw new Error('offline'); return { data: { items: [syntheticEvent()], next_cursor: 'opaque-next' } };
    });
    show(); fireEvent.click(screen.getByRole('button', { name: 'Atualizar histórico' })); await screen.findByText(/Aceitação · privacy_policy/);
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais decisões' })); await screen.findByText(/Não foi possível carregar o histórico/);
    expect(screen.getByText(/Aceitação · privacy_policy/)).toBeInTheDocument(); expect(api.get).toHaveBeenCalledWith('/api/v1/compliance/consent-history/page', expect.objectContaining({ params: { limit: 20, cursor: 'opaque-next' } }));
  });
  it('invalidates a pending action acknowledgement when history access is denied, and requires explicit restoration', async () => {
    let denyHistory = false;
    vi.mocked(api.get).mockImplementation(async url => {
      if (!url.includes('history')) return { data: syntheticState() };
      if (denyHistory) throw { response: { status: 403 } };
      return { data: { items: [syntheticEvent()], next_cursor: null } };
    });
    const late = deferred<{ data: ReturnType<typeof syntheticReceipt> }>(); vi.mocked(api.post).mockReturnValue(late.promise);
    show(); fireEvent.click(screen.getByRole('button', { name: 'Atualizar histórico' })); await screen.findByText(/Aceitação · privacy_policy/);
    await grant(); const pending = readPendingConsent('owner-A')!;
    denyHistory = true; fireEvent.click(screen.getByRole('button', { name: 'Atualizar histórico' })); await screen.findByText(/O acesso deixou de estar autorizado/);
    expect(screen.queryByText(/Aceitação · privacy_policy/)).not.toBeInTheDocument(); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await act(async () => late.resolve({ data: syntheticReceipt(pending) }));
    expect(readPendingConsent('owner-A')).toEqual(pending); expect(screen.queryByText(/Decisão registada/)).not.toBeInTheDocument();
    fireEvent.focus(window); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar consentimentos' })); await screen.findAllByRole('checkbox');
    expect(screen.queryByText(/Aceitação · privacy_policy/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verificar decisão guardada' })).toBeEnabled();
  });
  it('does not repopulate evidence from a late history page after state access is denied', async () => {
    let denyState = false; const late = deferred<{ data: { items: ReturnType<typeof syntheticEvent>[]; next_cursor: null } }>();
    vi.mocked(api.get).mockImplementation(async url => {
      if (url.includes('history')) return late.promise;
      if (denyState) throw { response: { status: 401 } };
      return { data: syntheticState() };
    });
    show(); await screen.findAllByRole('checkbox'); fireEvent.click(screen.getByRole('button', { name: 'Atualizar histórico' }));
    denyState = true; fireEvent.click(screen.getByRole('button', { name: 'Atualizar consentimentos' })); await screen.findByText(/O acesso deixou de estar autorizado/);
    await act(async () => late.resolve({ data: { items: [syntheticEvent()], next_cursor: null } }));
    expect(screen.queryByText(/Aceitação · privacy_policy/)).not.toBeInTheDocument(); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
