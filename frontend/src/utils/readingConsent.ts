import api from '../api';
import { isConsentCountry, parseConsentState, REQUIRED_CONSENT_PURPOSES } from './consent';
import type { ConsentCountry } from './consent';

export interface ReadingScope { country: ConsentCountry; consent_language: 'pt' }

/** A visible form choice supplies scope; a profile never supplies authority. */
export function readingScope(country: unknown): ReadingScope {
  if (!isConsentCountry(country)) throw new Error('Escolha Angola ou Portugal para estas medições.');
  return { country, consent_language: 'pt' };
}

export function isReadingConsentDenial(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('response' in error)) return false;
  const response = error.response as { status?: unknown; data?: { detail?: { code?: unknown } } } | undefined;
  return response?.status === 403 && response.data?.detail?.code === 'consent_required';
}

/** Preflight limits acquisition/transmission; every server write checks again. */
export async function checkReadingConsent(
  scope: ReadingScope,
  options: { device: boolean; current: () => boolean; headers: { Authorization: string } },
): Promise<void> {
  if (!options.current()) throw new Error('A sessão mudou. Reabra a página antes de enviar medições.');
  const response = await api.get('/api/v1/compliance/consent-state', {
    headers: options.headers, params: { country: scope.country, language: scope.consent_language },
  });
  if (!options.current()) throw new Error('A sessão ou o país mudou. Reveja as medições antes de continuar.');
  const state = parseConsentState(response.data, scope.country, scope.consent_language);
  const purposes = [...REQUIRED_CONSENT_PURPOSES, ...(options.device ? ['devices'] : [])];
  if (!state.available || purposes.some(purpose => !state.states.some(item => item.purpose === purpose && item.effective))) {
    throw new Error(options.device
      ? 'Reveja os consentimentos deste país, incluindo a decisão separada para dispositivos, antes de importar ou recolher medições.'
      : 'Reveja os consentimentos deste país antes de guardar novas medições. O histórico continua disponível.');
  }
}
