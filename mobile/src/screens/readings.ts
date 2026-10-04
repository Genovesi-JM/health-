import { consentQuery, parseConsentState, REQUIRED_CONSENT_PURPOSES } from './consents';
import type { ConsentCountry } from './consents';

export type ReadingScope = { country: ConsentCountry; consent_language: 'pt' };
export type HealthConnection = ReadingScope & { ownerId: string };
export type Reading = {
  id: string; reading_type: string; value: number | null; unit: string | null; measured_at: string;
  source?: string | null; device_brand?: string | null; device_model?: string | null; notes?: string | null;
  country?: string | null; consent_language?: string | null;
};
type ReadingApi = { get(path: string): Promise<{ data: unknown }>; post(path: string, body: unknown): Promise<{ data: unknown }> };
export const READING_METRICS = ['heart_rate', 'glucose', 'weight', 'temperature', 'oxygen_saturation'] as const;

export function readingScope(country: unknown, language: unknown = 'pt'): ReadingScope {
  if ((country !== 'AO' && country !== 'PT') || language !== 'pt') throw new Error('Escolha Angola ou Portugal e confirme os documentos em Português.');
  return { country, consent_language: 'pt' };
}
export const readingCountryName = (country: string | null | undefined): string => country === 'AO' ? 'Angola' : country === 'PT' ? 'Portugal' : 'País não registado';
export function parseHealthConnection(raw: string | null, owner?: string | number): HealthConnection | null {
  if (!raw || raw.length > 512) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || typeof data.ownerId !== 'string' || !data.ownerId || data.ownerId.length > 128
      || data.consent_language !== 'pt' || (owner !== undefined && data.ownerId !== String(owner))
      || Object.keys(data).some(key => !['ownerId', 'country', 'consent_language'].includes(key))) return null;
    return { ownerId: data.ownerId, ...readingScope(data.country, data.consent_language) };
  } catch { return null; }
}
export function readingConsentRequired(failure: unknown): boolean {
  return (failure as { response?: { data?: { detail?: { code?: string } } } })?.response?.data?.detail?.code === 'consent_required';
}
export function readingAccessLost(failure: unknown): boolean {
  const status = (failure as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403 && !readingConsentRequired(failure);
}
export function readingError(failure: unknown, fallback: string): string {
  const detail = (failure as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (readingConsentRequired(failure)) return 'Reveja e registe os consentimentos atuais para este país. A sincronização exige também a autorização opcional de dispositivos. O histórico continua disponível.';
  if (detail && typeof detail === 'object' && 'code' in detail && detail.code === 'reading_scope_conflict') return 'Uma destas medições já pertence a outro país ou tem país desconhecido. A sincronização foi interrompida; não altere o país para repetir a mesma importação.';
  if (typeof detail === 'string') return detail;
  return failure instanceof Error ? failure.message : fallback;
}
export async function requireReadingConsent(api: Pick<ReadingApi, 'get'>, input: ReadingScope, devices: boolean, assertCurrent = () => {}): Promise<void> {
  const scope = readingScope(input.country, input.consent_language);
  assertCurrent();
  const response = await api.get(`/api/v1/compliance/consent-state${consentQuery(scope.country)}`);
  assertCurrent();
  const state = parseConsentState(response.data, scope.country);
  const required = [...REQUIRED_CONSENT_PURPOSES, ...(devices ? ['devices'] : [])];
  if (!state.available || required.some(purpose => !state.states.some(item => item.purpose === purpose && item.effective))) {
    throw { response: { status: 403, data: { detail: { code: 'consent_required', country: scope.country, language: scope.consent_language } } } };
  }
}
export async function saveManualReading(api: ReadingApi, input: ReadingScope, form: { metric: string; value: string; unit: string; notes: string }, assertCurrent = () => {}) {
  const scope = readingScope(input.country, input.consent_language);
  if (!READING_METRICS.includes(form.metric as typeof READING_METRICS[number]) || !form.value.trim() || !Number.isFinite(Number(form.value))) throw new Error('Introduza um valor numérico válido.');
  if (!form.unit.trim() || form.unit.trim().length > 20) throw new Error('Indique a unidade da medição (até 20 caracteres).');
  const body = { ...scope, reading_type: form.metric, source: 'manual', value: Number(form.value), unit: form.unit.trim(), notes: form.notes.trim() || null };
  await requireReadingConsent(api, scope, false, assertCurrent);
  assertCurrent();
  let response;
  try { response = await api.post('/api/v1/readings', body); }
  catch (failure) {
    assertCurrent();
    const status = (failure as { response?: { status?: number } })?.response?.status;
    if (!status || status >= 500 || status === 408) throw new Error('Não foi possível confirmar a medição. Consulte o histórico antes de repetir para evitar um duplicado.');
    throw failure;
  }
  assertCurrent(); return response.data;
}
export function parseReadings(value: unknown): Reading[] {
  const rows = (value as { readings?: unknown })?.readings;
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row.id !== 'string' || typeof row.reading_type !== 'string' || typeof row.measured_at !== 'string'
    || !Number.isFinite(Date.parse(row.measured_at)) || !(row.value === null || typeof row.value === 'number' && Number.isFinite(row.value)))) throw new Error('Não foi possível verificar as medições recebidas.');
  return rows;
}
