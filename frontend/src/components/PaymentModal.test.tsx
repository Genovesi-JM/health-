import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../api';
import { I18nProvider } from '../i18n/LanguageContext';
import { readPendingPayment, savePendingPayment } from '../utils/pendingPayment';
import type { PaymentReceipt, PendingPayment } from '../utils/pendingPayment';
import PaymentModal from './PaymentModal';
const identity = vi.hoisted(() => ({ owner: 'owner-A', token: 'token-A' }));
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() }, getSession: () => ({ userId: identity.owner, token: identity.token }) }));
const notFound = { response: { status: 404 } };
const methods = [{ id: 'multicaixa_express', label: 'Multicaixa Express', description: 'Referência', enabled: true }, { id: 'paypal', label: 'PayPal', description: 'Carteira', enabled: true }];
const saved: PendingPayment = { owner: 'owner-A', consultationId: 'visit-A', provider: 'multicaixa_express', key: '11111111-1111-4111-8111-111111111111' };
const makeReceipt = (key: string, fields: Partial<PaymentReceipt> = {}): PaymentReceipt => ({ payment_id: 'payment-A', request_key: key, provider: 'multicaixa_express', status: 'pending', dispatch_state: 'response_recorded', financial_review_status: 'not_required', financial_review_reason: null, consultation_paid: false, amount: 12345, currency: 'AOA', provider_reference: 'reference-A', ...fields });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function show(extra: Partial<React.ComponentProps<typeof PaymentModal>> = {}) {
  const props = { open: true, consultationId: 'visit-A', country: 'AO', onClose: vi.fn(), onPaid: vi.fn(), ...extra };
  const view = render(<I18nProvider><PaymentModal {...props} /></I18nProvider>);
  return { ...view, props, update: (next: Partial<typeof props>) => { Object.assign(props, next); view.rerender(<I18nProvider><PaymentModal {...props} /></I18nProvider>); } };
}
const select = async () => { await userEvent.click(await screen.findByRole('button', { name: /Multicaixa Express/ })); };
beforeEach(() => {
  vi.restoreAllMocks(); vi.resetAllMocks(); localStorage.clear(); identity.owner = 'owner-A'; identity.token = 'token-A';
  vi.mocked(api.get).mockImplementation(async url => { if (url.includes('payment-methods')) return { data: { methods } }; throw notFound; });
  vi.mocked(api.post).mockImplementation(async (_url, _body, config) => ({ data: makeReceipt(String(config?.headers?.['Idempotency-Key'])) }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('payment catalog and submission boundary', () => {
  it('shows discovery failure without inventing an enabled fallback', async () => {
    vi.mocked(api.get).mockRejectedValue(notFound); show();
    expect(await screen.findByText('Não foi possível carregar os métodos de pagamento.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Multicaixa Express/ })).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
  it('uses explicit PT/EUR discovery and keeps fresh Portugal checkout disabled', async () => {
    show({ country: 'PT' }); const button = await screen.findByRole('button', { name: /Multicaixa Express/ });
    expect(button).toBeDisabled(); expect(await screen.findByText(/cotação em EUR/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/v1/billing/payment-methods', expect.objectContaining({ params: { country: 'PT', currency: 'EUR', include_planned: true } }));
    expect(api.post).not.toHaveBeenCalled();
  });
  it('never defaults a consultation with unknown country to Angola', async () => {
    show({ country: null }); expect(await screen.findByText(/país desta consulta não está confirmado/)).toBeInTheDocument();
    expect(vi.mocked(api.get).mock.calls.some(([url]) => url.includes('payment-methods'))).toBe(false);
    expect(api.post).not.toHaveBeenCalled();
  });
  it('persists the owner, consultation, method and UUID before POST, with captured credentials', async () => {
    vi.mocked(api.post).mockImplementation(async (_url, body, config) => {
      const attempt = readPendingPayment('owner-A', 'visit-A'); expect(attempt).not.toBeNull();
      expect(body).toEqual({ consultation_id: 'visit-A', payment_method: attempt?.provider });
      expect(config?.headers).toEqual({ Authorization: 'Bearer token-A', 'Idempotency-Key': attempt?.key });
      return { data: makeReceipt(attempt!.key) };
    });
    show(); await select(); expect(await screen.findByText('reference-A')).toBeInTheDocument(); expect(api.post).toHaveBeenCalledTimes(1);
  });
  it('does not POST if durable storage fails', async () => {
    show(); await screen.findByRole('button', { name: /Multicaixa Express/ });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await select(); expect(api.post).not.toHaveBeenCalled(); expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
describe('unknown outcomes and recovery', () => {
  it.each([undefined, 401, 404, 409, 422, 500])('retains identity after %s and replays exactly after reopening', async status => {
    vi.mocked(api.post).mockRejectedValue(status ? { response: { status } } : new Error('network'));
    const view = show(); await select(); const original = readPendingPayment('owner-A', 'visit-A')!;
    expect(await screen.findByRole('alert')).toHaveTextContent('Não inicie outro pagamento');
    expect(screen.queryByRole('button', { name: /PayPal/ })).not.toBeInTheDocument();
    view.update({ open: false }); view.update({ open: true });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Recuperar o mesmo pedido' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Recuperar o mesmo pedido' }));
    expect(api.post).toHaveBeenLastCalledWith('/api/v1/billing/consultation/checkout', { consultation_id: 'visit-A', payment_method: original.provider }, { headers: { Authorization: 'Bearer token-A', 'Idempotency-Key': original.key } });
    expect(readPendingPayment('owner-A', 'visit-A')).toEqual(original);
  });
  it('clears only a structured noncommit response and offers explicit fresh selection', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { detail: { code: 'checkout_not_committed', request_key_committed: false, reason: 'quote_unavailable', message: 'Cotação indisponível.' } } } });
    show(); await select(); expect(await screen.findByText('Cotação indisponível.')).toBeInTheDocument();
    expect(readPendingPayment('owner-A', 'visit-A')).toBeNull(); expect(screen.getByRole('button', { name: /PayPal/ })).toBeEnabled();
  });
  it('discovers and restores an older server UUID/provider instead of starting another method', async () => {
    let statusCalls = 0;
    vi.mocked(api.get).mockImplementation(async (url, config) => {
      if (url.includes('payment-methods')) return { data: { methods } };
      if (++statusCalls === 1) throw notFound;
      if (statusCalls >= 3) expect(config?.params).toEqual({ request_key: saved.key });
      return { data: makeReceipt(saved.key, { provider: 'paypal' }) };
    });
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { detail: { code: 'checkout_not_committed', request_key_committed: false, reason: 'existing_payment_attempt', message: 'Existing request' } } } });
    show(); await select(); await waitFor(() => expect(readPendingPayment('owner-A', 'visit-A')?.key).toBe(saved.key));
    expect(readPendingPayment('owner-A', 'visit-A')?.provider).toBe('paypal');
    expect(screen.queryByRole('button', { name: /Multicaixa Express/ })).not.toBeInTheDocument(); expect(api.post).toHaveBeenCalledTimes(1);
  });
  it('keeps a legacy payment without a request UUID read-only', async () => {
    vi.mocked(api.get).mockImplementation(async url => ({ data: url.includes('payment-methods') ? { methods } : makeReceipt(saved.key, { request_key: null, dispatch_state: null, financial_review_status: 'unassessed' }) }));
    const view = show(); expect(await screen.findByText(/Não existe uma referência de pedido recuperável/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Recuperar o mesmo pedido' })).not.toBeInTheDocument(); expect(view.props.onPaid).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled();
  });
});
describe('financial receipt, currency and instruction rendering', () => {
  it.each(['required', 'unassessed'] as const)('does not mark a paid receipt applied during %s review', async review => {
    vi.mocked(api.post).mockImplementation(async (_url, _body, config) => ({ data: makeReceipt(String(config?.headers?.['Idempotency-Key']), { status: 'paid', consultation_paid: true, financial_review_status: review }) }));
    const view = show(); await select(); expect(await screen.findByText(/Pagamento em revisão financeira/)).toBeInTheDocument(); expect(view.props.onPaid).not.toHaveBeenCalled(); expect(readPendingPayment('owner-A', 'visit-A')).not.toBeNull();
  });
  it('only notifies paid for an applied, recorded and settled receipt', async () => {
    vi.mocked(api.post).mockImplementation(async (_url, _body, config) => ({ data: makeReceipt(String(config?.headers?.['Idempotency-Key']), { status: 'paid', consultation_paid: true }) }));
    const view = show(); await select(); expect(await screen.findByText('Pagamento confirmado')).toBeInTheDocument(); expect(view.props.onPaid).toHaveBeenCalledTimes(1); expect(readPendingPayment('owner-A', 'visit-A')).toBeNull();
  });
  it('keeps unknown failed results locked but releases a settled failed receipt', async () => {
    vi.mocked(api.post).mockImplementation(async (_url, _body, config) => ({ data: makeReceipt(String(config?.headers?.['Idempotency-Key']), { status: 'failed', dispatch_state: 'unknown' }) }));
    show(); await select(); expect(await screen.findByText(/Pagamento em revisão financeira/)).toBeInTheDocument();
    const key = readPendingPayment('owner-A', 'visit-A')!.key;
    vi.mocked(api.get).mockResolvedValue({ data: makeReceipt(key, { status: 'failed' }) });
    await userEvent.click(screen.getByRole('button', { name: 'Verificar estado' }));
    expect(await screen.findByText(/confirmou que este pedido falhou/)).toBeInTheDocument(); expect(readPendingPayment('owner-A', 'visit-A')).toBeNull();
  });
  it('shows server currency and reference while rejecting an unsafe redirect', async () => {
    vi.mocked(api.post).mockImplementation(async (_url, _body, config) => ({ data: makeReceipt(String(config?.headers?.['Idempotency-Key']), { provider: 'paypal', currency: 'EUR', redirect_url: 'javascript:alert(1)' }) }));
    show(); await userEvent.click(await screen.findByRole('button', { name: /PayPal/ }));
    expect(await screen.findByText(/123,45/)).toHaveTextContent('€'); expect(screen.getByText('reference-A')).toBeInTheDocument(); expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
describe('session and polling races', () => {
  it('ignores a checkout acknowledgement after closing', async () => {
    const response = deferred<{ data: PaymentReceipt }>(); vi.mocked(api.post).mockReturnValue(response.promise);
    const view = show(); await select(); const pending = readPendingPayment('owner-A', 'visit-A')!;
    view.update({ open: false }); await act(async () => response.resolve({ data: makeReceipt(pending.key, { status: 'paid', consultation_paid: true }) }));
    expect(view.props.onPaid).not.toHaveBeenCalled(); expect(readPendingPayment('owner-A', 'visit-A')).toEqual(pending);
  });
  it('does not expose or clean up an old account receipt after account replacement', async () => {
    const response = deferred<{ data: PaymentReceipt }>(); vi.mocked(api.post).mockReturnValue(response.promise);
    const view = show(); await select(); const pending = readPendingPayment('owner-A', 'visit-A')!;
    identity.owner = 'owner-B'; identity.token = 'token-B'; view.update({});
    await act(async () => response.resolve({ data: makeReceipt(pending.key, { status: 'paid', consultation_paid: true }) }));
    await screen.findByRole('button', { name: /Multicaixa Express/ });
    expect(view.props.onPaid).not.toHaveBeenCalled(); expect(screen.queryByText('reference-A')).not.toBeInTheDocument(); expect(readPendingPayment('owner-A', 'visit-A')).toEqual(pending); expect(readPendingPayment('owner-B', 'visit-A')).toBeNull();
  });
  it('never overlaps status polls, preserves references on failure, and stops after close', async () => {
    vi.useFakeTimers(); savePendingPayment(saved); let exactCalls = 0; const pending = deferred<{ data: PaymentReceipt }>();
    vi.mocked(api.get).mockImplementation(async (url, config) => {
      if (url.includes('payment-methods')) return { data: { methods } };
      expect(config?.params).toEqual({ request_key: saved.key });
      if (++exactCalls === 1) return { data: makeReceipt(saved.key) };
      return pending.promise;
    });
    const view = show(); await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('reference-A')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); }); expect(exactCalls).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Verificar estado' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(16000); }); expect(exactCalls).toBe(2);
    await act(async () => pending.reject(new Error('offline')));
    expect(screen.getByRole('alert')).toHaveTextContent('Não inicie outro pagamento'); expect(screen.getByText('reference-A')).toBeInTheDocument();
    view.update({ open: false }); await act(async () => { await vi.advanceTimersByTimeAsync(16000); }); expect(exactCalls).toBe(2); expect(view.props.onPaid).not.toHaveBeenCalled();
  });
});


describe('retained instructions and recovery restrictions', () => {
  it('preserves transfer details across exact replay and status failure, then clears display on access loss', async () => {
    const transfer = { ...saved, provider: 'iban_transfer' as const }; savePendingPayment(transfer);
    const base = makeReceipt(saved.key, { provider: 'iban_transfer' });
    vi.mocked(api.get).mockImplementation(async url => ({ data: url.includes('payment-methods') ? { methods } : base }));
    vi.mocked(api.post).mockResolvedValue({ data: { ...base, transfer_details: { bank_name: 'Configured bank', beneficiary: 'KAYA', iban: 'AO000000000000' } } });
    show(); await screen.findByText('reference-A');
    await userEvent.click(screen.getByRole('button', { name: 'Recuperar o mesmo pedido' }));
    expect(await screen.findByText('Configured bank')).toBeInTheDocument();
    vi.mocked(api.post).mockRejectedValue(new Error('offline'));
    await userEvent.click(screen.getByRole('button', { name: 'Recuperar o mesmo pedido' }));
    expect(screen.getByText('Configured bank')).toBeInTheDocument();
    vi.mocked(api.get).mockRejectedValue({ response: { status: 403 } });
    await userEvent.click(screen.getByRole('button', { name: 'Verificar estado' }));
    expect(screen.queryByText('Configured bank')).not.toBeInTheDocument(); expect(screen.queryByText('reference-A')).not.toBeInTheDocument();
    expect(readPendingPayment('owner-A', 'visit-A')).toEqual(transfer);
  });
  it('keeps an unavailable previous server attempt blocked after structured discovery is empty', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { detail: { code: 'checkout_not_committed', request_key_committed: false, reason: 'existing_payment_attempt', message: 'Existing attempt' } } } });
    show(); await select(); expect(await screen.findByText(/Não foi possível confirmar o pagamento existente/)).toBeInTheDocument();
    expect(readPendingPayment('owner-A', 'visit-A')).toBeNull(); expect(screen.queryByRole('button', { name: /PayPal/ })).not.toBeInTheDocument();
  });
  it('cannot create a fresh request from recovery-only historical consultation', async () => {
    show({ recoveryOnly: true }); expect(await screen.findByText(/Não existe um pagamento confirmado para mostrar/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /PayPal/ })).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
  });
  it('does not delete a newer saved UUID when an older terminal response arrives', async () => {
    const response = deferred<{ data: PaymentReceipt }>(); vi.mocked(api.post).mockReturnValue(response.promise);
    show(); await select(); const older = readPendingPayment('owner-A', 'visit-A')!;
    // Another tab has already replaced a positively settled request with a newer request.
    const storageKey = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)!).find(key => key.startsWith('kaya_pending_payment:'))!;
    const newer = { ...older, key: saved.key }; localStorage.setItem(storageKey, JSON.stringify(newer));
    await act(async () => response.resolve({ data: makeReceipt(older.key, { status: 'failed' }) }));
    expect(readPendingPayment('owner-A', 'visit-A')).toEqual(newer); expect(screen.queryByRole('button', { name: /PayPal/ })).not.toBeInTheDocument();
  });
});
