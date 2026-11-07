/** Durable recovery contains opaque identifiers only; never persist payment or clinical details. */
export const paymentProviders = ['multicaixa_express', 'visa_mastercard', 'iban_transfer', 'paypal'] as const;
export type PaymentProvider = typeof paymentProviders[number];
export interface PendingPayment { owner: string; consultationId: string; provider: PaymentProvider; key: string }
export interface PaymentReceipt {
  payment_id: string;
  status: string;
  provider: string | null;
  request_key: string | null;
  dispatch_state: 'dispatching' | 'unknown' | 'response_recorded' | null;
  consultation_paid: boolean;
  financial_review_status: 'required' | 'not_required' | 'unassessed';
  financial_review_reason: string | null;
  amount?: number;
  currency?: string;
  provider_reference?: string;
  redirect_url?: string;
  instructions?: string;
  transfer_details?: Record<string, string | number>;
}
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;
export const isPaymentProvider = (value: unknown): value is PaymentProvider => paymentProviders.includes(value as PaymentProvider);
export const isPaymentKey = (value: unknown): value is string => typeof value === 'string' && uuid.test(value);
const keyFor = (owner: string, consultation: string) => {
  if (!identifier(owner) || !identifier(consultation)) throw new Error('Conta e consulta obrigatórias.');
  return `kaya_pending_payment:${encodeURIComponent(owner)}:${encodeURIComponent(consultation)}`;
};
function validAttempt(value: unknown, owner: string, consultation: string): value is PendingPayment {
  if (!value || typeof value !== 'object') return false;
  const item = value as PendingPayment;
  return item.owner === owner && item.consultationId === consultation && isPaymentProvider(item.provider) && isPaymentKey(item.key)
    && Object.keys(item).every(key => ['owner', 'consultationId', 'provider', 'key'].includes(key));
}
export function readPendingPayment(owner: string, consultation: string): PendingPayment | null {
  const raw = localStorage.getItem(keyFor(owner, consultation));
  if (raw === null) return null;
  if (raw.length > 1024) throw new Error('Referência de recuperação inválida.');
  const value: unknown = JSON.parse(raw);
  if (!validAttempt(value, owner, consultation)) throw new Error('Referência de recuperação inválida.');
  return value;
}
export function savePendingPayment(attempt: PendingPayment): void {
  if (!validAttempt(attempt, attempt.owner, attempt.consultationId)) throw new Error('Referência de recuperação inválida.');
  const existing = readPendingPayment(attempt.owner, attempt.consultationId);
  if (existing && (existing.key !== attempt.key || existing.provider !== attempt.provider)) throw new Error('Existe um pedido por confirmar.');
  localStorage.setItem(keyFor(attempt.owner, attempt.consultationId), JSON.stringify(attempt));
}
export function clearPendingPayment(attempt: PendingPayment): boolean {
  const saved = readPendingPayment(attempt.owner, attempt.consultationId);
  if (saved?.key !== attempt.key || saved.provider !== attempt.provider) return false;
  localStorage.removeItem(keyFor(attempt.owner, attempt.consultationId));
  return true;
}
export function checkoutNotCommitted(error: unknown): { reason: string; message: string } | null {
  const response = (error as { response?: { status?: number; data?: { detail?: Record<string, unknown> } } })?.response;
  const detail = response?.data?.detail;
  if (response?.status !== 409 || detail?.code !== 'checkout_not_committed' || detail.request_key_committed !== false
    || typeof detail.reason !== 'string' || typeof detail.message !== 'string') return null;
  return { reason: detail.reason, message: detail.message };
}
export function paymentOutcome(receipt: PaymentReceipt): 'paid' | 'failed' | 'pending' | 'review' {
  if (receipt.financial_review_status !== 'not_required') return 'review';
  if (receipt.dispatch_state === 'response_recorded') {
    if (receipt.status === 'paid' && receipt.consultation_paid) return 'paid';
    if (receipt.status === 'failed' && !receipt.consultation_paid) return 'failed';
  }
  if (receipt.status !== 'pending') return 'review';
  return 'pending';
}
/** Validate identity before accepting status or instructions from either recovery endpoint. */
export function parsePaymentReceipt(value: unknown, attempt?: PendingPayment | null): PaymentReceipt {
  if (!value || typeof value !== 'object') throw new Error('Resposta de pagamento inválida.');
  const data = value as Record<string, unknown>;
  if (!identifier(data.payment_id) || typeof data.status !== 'string'
    || !['paid', 'failed', 'pending', 'refunded'].includes(data.status)
    || !(data.provider === null || typeof data.provider === 'string')
    || !(data.request_key === null || isPaymentKey(data.request_key))
    || ![null, 'dispatching', 'unknown', 'response_recorded'].includes(data.dispatch_state as string | null)
    || typeof data.consultation_paid !== 'boolean'
    || !['required', 'not_required', 'unassessed'].includes(data.financial_review_status as string)
    || !(data.financial_review_reason == null || typeof data.financial_review_reason === 'string')
    || (attempt && (data.request_key !== attempt.key || data.provider !== attempt.provider))) throw new Error('Resposta de pagamento incompatível com o pedido.');
  const receipt: PaymentReceipt = {
    payment_id: data.payment_id, status: data.status, provider: data.provider as string | null,
    request_key: data.request_key as string | null, dispatch_state: data.dispatch_state as PaymentReceipt['dispatch_state'],
    consultation_paid: data.consultation_paid, financial_review_status: data.financial_review_status as PaymentReceipt['financial_review_status'],
    financial_review_reason: data.financial_review_reason as string | null ?? null,
  };
  if (data.amount !== undefined || data.currency !== undefined) {
    if (!Number.isSafeInteger(data.amount) || (data.amount as number) < 0 || typeof data.currency !== 'string' || !/^[A-Z]{3}$/.test(data.currency)) throw new Error('Montante de pagamento inválido.');
    receipt.amount = data.amount as number; receipt.currency = data.currency;
  }
  for (const key of ['provider_reference', 'redirect_url', 'instructions'] as const) {
    if (typeof data[key] === 'string') receipt[key] = data[key];
  }
  if (data.transfer_details && typeof data.transfer_details === 'object' && !Array.isArray(data.transfer_details)) {
    receipt.transfer_details = Object.fromEntries(Object.entries(data.transfer_details).filter(([, item]) => typeof item === 'string' || typeof item === 'number'));
  }
  return receipt;
}
export function formatPaymentAmount(amount: number, currency: string): string {
  if (!Number.isSafeInteger(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency)) throw new Error('Montante inválido.');
  // The payment API expresses amounts in hundredths for its supported currencies (AOA/EUR/USD/GBP/ZAR).
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(amount / 100);
}
export function paymentRedirect(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
