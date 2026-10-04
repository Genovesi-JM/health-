import type { RequestExpiry } from '../types';
import { formatAppointmentTime } from './appointments';

export function requestCanCancel(item: RequestExpiry & { status: string }): boolean {
  return item.status === 'scheduled' || (item.status === 'requested'
    && ['open', 'expiry_pending'].includes(item.request_expiry_state || ''));
}

export function requestCanProceed(item: RequestExpiry & { status: string }, now = Date.now()): boolean {
  if (item.status !== 'requested') return true;
  return item.request_expiry_state === 'open' && typeof item.requested_expires_at === 'string'
    && /(?:Z|[+-]\d\d:\d\d)$/.test(item.requested_expires_at)
    && Number.isFinite(Date.parse(item.requested_expires_at)) && Date.parse(item.requested_expires_at) > now;
}

export function requestExpiryMessage(item: RequestExpiry & { status: string; timezone?: string | null }): string | null {
  if (item.status === 'expired') return 'O prazo terminou e o pedido foi encerrado pelo serviço. Pode escolher um novo horário.';
  if (item.status !== 'requested') return null;
  if (item.request_expiry_state === 'review_required' || !item.request_expiry_state) return 'Este pedido requer verificação da equipa antes de ser aceite ou alterado.';
  if (!requestCanProceed(item)) return 'O prazo de aceitação terminou. A atualização do pedido está pendente; a reserva ainda não foi confirmada como libertada.';
  return `Prazo para aceitação: ${formatAppointmentTime(item.requested_expires_at!, item.timezone || 'UTC')}. Este prazo não garante uma resposta clínica.`;
}
