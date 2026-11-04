import { expect, it } from 'vitest';
import { requestCanCancel, requestCanProceed, requestExpiryMessage } from './requestExpiry';
it('allows only a current server-authorized request deadline, while scheduled care does not expire', () => {
  const item = { status: 'requested', request_expiry_state: 'open' as const, requested_expires_at: '2099-01-01T00:00:00Z' };
  expect(requestCanProceed(item)).toBe(true);
  for (const deadline of [null, '', 'invalid', '2000-01-01T00:00:00Z', '2099-01-01T00:00:00']) expect(requestCanProceed({ ...item, requested_expires_at: deadline })).toBe(false);
  for (const state of [null, 'review_required', 'expiry_pending', 'expired'] as const) expect(requestCanProceed({ ...item, request_expiry_state: state })).toBe(false);
  expect(requestCanProceed({ status: 'scheduled' })).toBe(true);
});
it('distinguishes a pending release from persisted expiry without promising a response time', () => {
  expect(requestCanCancel({ status: 'requested', request_expiry_state: 'expiry_pending' })).toBe(true);
  expect(requestCanCancel({ status: 'requested', request_expiry_state: 'review_required' })).toBe(false);
  expect(requestExpiryMessage({ status: 'requested', request_expiry_state: 'expiry_pending' })).toContain('a reserva ainda não foi confirmada como libertada');
  expect(requestExpiryMessage({ status: 'expired' })).toContain('encerrado pelo serviço');
  expect(requestExpiryMessage({ status: 'requested' })).toContain('verificação');
  expect(requestExpiryMessage({ status: 'requested', request_expiry_state: 'open', requested_expires_at: '2099-01-01T00:00:00Z' })).toContain('não garante uma resposta clínica');
});
