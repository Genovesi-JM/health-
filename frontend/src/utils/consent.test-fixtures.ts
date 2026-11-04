import { REQUIRED_CONSENT_PURPOSES } from './consent';
import type { ConsentCountry, ConsentDocument, ConsentEvent, ConsentState, PendingConsent } from './consent';
export const consentKey = '11111111-1111-4111-8111-111111111111';
export const syntheticDocuments = (country: ConsentCountry = 'AO'): ConsentDocument[] => REQUIRED_CONSENT_PURPOSES.map(purpose => ({
  id: `${country}-${purpose}`, document_key: `${country}:pt:${purpose}`, version: 1, content_hash: 'a'.repeat(64), country, language: 'pt',
  purpose, kind: 'clinical_consent', required: true, title: `Documento sintético ${purpose}`, content: `Texto de teste ${purpose} <img src=x onerror=alert(1)>`,
  approved_source: 'SYNTHETIC TEST FIXTURE ONLY', effective_from: '2026-01-01T00:00:00+00:00', effective_to: null,
}));
export const syntheticState = (country: ConsentCountry = 'AO', revision = 0): ConsentState => ({ country, language: 'pt', available: true, revision,
  required_purposes: [...REQUIRED_CONSENT_PURPOSES], states: syntheticDocuments(country).map(document => ({ purpose: document.purpose, status: 'missing', effective: false, document, latest_event: null })) });
export const syntheticPending = (owner = 'owner-A'): PendingConsent => ({ owner, key: consentKey, payload: {
  document_id: 'AO-privacy_policy', version: 1, content_hash: 'a'.repeat(64), country: 'AO', language: 'pt', action: 'grant', expected_revision: 0,
} });
export const syntheticEvent = (pending = syntheticPending(), overrides: Partial<ConsentEvent> = {}): ConsentEvent => ({
  id: 'event-A', sequence: pending.payload.expected_revision + 1, ...pending.payload, purpose: 'privacy_policy', created_at: '2026-10-04T12:00:00+00:00', request_key: pending.key, ...overrides,
});
export function syntheticReceipt(pending = syntheticPending(), laterWithdrawal = false) {
  const event = syntheticEvent(pending);
  const state = syntheticState(pending.payload.country, laterWithdrawal ? 2 : event.sequence);
  state.states[0] = { ...state.states[0], status: laterWithdrawal ? 'withdrawn' : 'granted', effective: !laterWithdrawal,
    latest_event: laterWithdrawal ? syntheticEvent(pending, { id: 'later-withdrawal', sequence: 2, action: 'withdraw' }) : event };
  return { event, revision: state.revision, state };
}
