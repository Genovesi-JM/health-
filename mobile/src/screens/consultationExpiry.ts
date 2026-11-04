export type ConsultationExpiry = {
  status: string;
  requested_expires_at?: string | null;
  expired_at?: string | null;
  request_expiry_state?: 'open' | 'expiry_pending' | 'review_required' | 'expired' | null;
};

export function requestAllowsNewScheduleAction(item: ConsultationExpiry, now = Date.now()): boolean {
  if (item.status !== 'requested') return item.status === 'scheduled' || item.status === 'in_progress';
  return item.request_expiry_state === 'open' && typeof item.requested_expires_at === 'string' &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(item.requested_expires_at) &&
    Number.isFinite(Date.parse(item.requested_expires_at)) && Date.parse(item.requested_expires_at) > now;
}

export function consultationExpiryMessage(item: ConsultationExpiry, options: { now?: number; clinician?: boolean } = {}): string | null {
  const now = options.now ?? Date.now();
  if (item.status === 'expired') return options.clinician ? 'O pedido expirou sem confirmação de atendimento.' : 'O pedido expirou. Não houve confirmação de atendimento; pode consultar o histórico e pedir outra consulta.';
  if (item.status !== 'requested') return null;
  if (item.request_expiry_state === 'review_required' || !item.request_expiry_state || !item.requested_expires_at ||
      !/(?:Z|[+-]\d{2}:\d{2})$/.test(item.requested_expires_at) ||
      !Number.isFinite(Date.parse(item.requested_expires_at))) {
    return 'Este pedido precisa de revisão da equipa antes de ser aceite ou mudar de horário. O estado e a reserva continuam por confirmar.' +
      (options.clinician ? '' : ' A equipa deve confirmar as opções disponíveis.');
  }
  if (item.request_expiry_state !== 'open' || Date.parse(item.requested_expires_at) <= now) {
    return 'O prazo do pedido foi atingido. Aguarda confirmação da expiração pelo serviço; a reserva ainda não deve ser considerada livre.' +
      (options.clinician ? ' Atualize a fila para confirmar o estado.' : ' Pode atualizar ou cancelar o pedido.');
  }
  return null;
}
