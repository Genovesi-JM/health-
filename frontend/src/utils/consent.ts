/** Document contents come only from the approved server catalog. Stored requests are references, not grants. */
export type ConsentCountry = 'AO' | 'PT';
export type ConsentAction = 'grant' | 'refuse' | 'withdraw';
export interface ConsentDocument {
  id: string; document_key: string; version: number; content_hash: string;
  country: ConsentCountry; language: string; purpose: string; kind: string; required: boolean;
  title: string; content: string; approved_source: string; effective_from: string; effective_to: string | null;
}
export interface ConsentEvent {
  id: string; sequence: number; document_id: string; purpose: string; version: number; content_hash: string;
  country: ConsentCountry; language: string; action: ConsentAction; created_at: string; request_key: string;
}
export interface ConsentPurposeState {
  purpose: string; status: 'granted' | 'missing' | 'withdrawn' | 'refused' | 'stale' | 'unavailable';
  effective: boolean; document: ConsentDocument | null; latest_event: ConsentEvent | null;
}
export interface ConsentState {
  country: ConsentCountry; language: string; available: boolean; revision: number;
  required_purposes: string[]; states: ConsentPurposeState[];
}
export interface ConsentCatalog {
  country: ConsentCountry; language: string; available: boolean; required_purposes: string[];
  unavailable_purposes: string[]; documents: ConsentDocument[];
}
export type ConsentReference = Pick<ConsentDocument, 'version' | 'content_hash' | 'country' | 'language'> & { document_id: string };
export type ConsentPayload = ConsentReference & { action: ConsentAction; expected_revision: number };
export interface PendingConsent { owner: string; key: string; payload: ConsentPayload }
export interface ConsentReceipt { event: ConsentEvent; revision: number; state: ConsentState }
export interface ConsentHistory { items: ConsentEvent[]; next_cursor: string | null }
export const REQUIRED_CONSENT_PURPOSES = ['privacy_policy', 'telemedicine_consent', 'terms_of_service', 'health_data_processing', 'medical_disclaimer'] as const;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown, max = 256): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
export const isConsentCountry = (value: unknown): value is ConsentCountry => value === 'AO' || value === 'PT';
const action = (value: unknown): value is ConsentAction => ['grant', 'refuse', 'withdraw'].includes(value as string);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => string(item)) && new Set(value).size === value.length;
const requiredPurposes = (value: unknown): value is string[] => strings(value) && REQUIRED_CONSENT_PURPOSES.every(purpose => value.includes(purpose));
const fail = (): never => { throw new Error('Não foi possível validar a resposta de consentimento. Atualize antes de decidir.'); };
function scope(value: Record<string, unknown>, country: ConsentCountry, language: string) {
  if (value.country !== country || value.language !== language) fail();
}
function document(value: unknown, country: ConsentCountry, language: string): ConsentDocument {
  if (!object(value)) return fail();
  scope(value, country, language);
  if (!['id', 'document_key', 'content_hash', 'purpose', 'kind', 'title', 'approved_source', 'effective_from'].every(key => string(value[key], key === 'title' || key === 'approved_source' ? 2000 : 256))
    || !integer(value.version) || value.version < 1 || typeof value.content !== 'string' || !value.content.trim() || value.content.length > 1000000 || typeof value.required !== 'boolean'
    || !(value.effective_to === null || string(value.effective_to))) return fail();
  return value as unknown as ConsentDocument;
}
function event(value: unknown): ConsentEvent {
  if (!object(value) || !['id', 'document_id', 'purpose', 'content_hash', 'language', 'created_at'].every(key => string(value[key]))
    || !integer(value.version) || value.version < 1 || !isConsentCountry(value.country) || !integer(value.sequence) || value.sequence < 1 || !action(value.action) || !uuid(value.request_key)) return fail();
  return value as unknown as ConsentEvent;
}
export function parseConsentCatalog(value: unknown, country: ConsentCountry, language = 'pt'): ConsentCatalog {
  if (!object(value)) return fail();
  scope(value, country, language);
  if (typeof value.available !== 'boolean' || !requiredPurposes(value.required_purposes) || !strings(value.unavailable_purposes) || !Array.isArray(value.documents)) return fail();
  const documents = value.documents.map(item => document(item, country, language));
  if (new Set(documents.map(item => item.id)).size !== documents.length || new Set(documents.map(item => item.purpose)).size !== documents.length
    || (value.available && value.required_purposes.some(purpose => !documents.some(item => item.purpose === purpose && item.required)))) return fail();
  return { ...value, documents } as unknown as ConsentCatalog;
}
export function parseConsentState(value: unknown, country: ConsentCountry, language = 'pt'): ConsentState {
  if (!object(value)) return fail();
  scope(value, country, language);
  if (typeof value.available !== 'boolean' || !integer(value.revision) || !requiredPurposes(value.required_purposes) || !Array.isArray(value.states)) return fail();
  const states: ConsentPurposeState[] = value.states.map(item => {
    if (!object(item) || !string(item.purpose) || !['granted', 'missing', 'withdrawn', 'refused', 'stale', 'unavailable'].includes(item.status as string)
      || typeof item.effective !== 'boolean') return fail();
    const doc = item.document === null ? null : document(item.document, country, language);
    const latest = item.latest_event === null ? null : event(item.latest_event);
    const crossLanguageDenial = latest && latest.language !== language && !item.effective && ['withdraw', 'refuse'].includes(latest.action);
    if ((doc && doc.purpose !== item.purpose) || (latest && (latest.purpose !== item.purpose || latest.country !== country || (latest.language !== language && !crossLanguageDenial) || latest.sequence > (value.revision as number)))
      || (item.effective && (item.status !== 'granted' || !doc || !latest || latest.action !== 'grant' || latest.document_id !== doc.id || latest.version !== doc.version || latest.content_hash !== doc.content_hash))) return fail();
    return { ...item, document: doc, latest_event: latest } as unknown as ConsentPurposeState;
  });
  if (new Set(states.map(item => item.purpose)).size !== states.length || value.required_purposes.some(purpose => !states.some(item => item.purpose === purpose))) return fail();
  return { ...value, states } as unknown as ConsentState;
}
export function parseConsentReceipt(value: unknown, pending: PendingConsent): ConsentReceipt {
  if (!object(value) || !integer(value.revision)) return fail();
  const received = event(value.event);
  const state = parseConsentState(value.state, pending.payload.country, pending.payload.language);
  if (received.request_key !== pending.key || value.revision !== state.revision || received.sequence > state.revision
    || (['document_id', 'version', 'content_hash', 'country', 'language', 'action'] as const).some(key => received[key] !== pending.payload[key])) return fail();
  return { event: received, revision: value.revision, state };
}
export function parseConsentHistory(value: unknown): ConsentHistory {
  if (!object(value) || !Array.isArray(value.items) || !(value.next_cursor === null || string(value.next_cursor, 10000))) return fail();
  return { items: value.items.map(event), next_cursor: value.next_cursor as string | null };
}
export const consentReference = (doc: ConsentDocument): ConsentReference => ({ document_id: doc.id, version: doc.version, content_hash: doc.content_hash, country: doc.country, language: doc.language });
export const allConsentEffective = (state: ConsentState): boolean => state.available && state.required_purposes.every(purpose => state.states.some(item => item.purpose === purpose && item.effective));
const storageKey = (owner: string) => { if (!string(owner, 128)) throw new Error('Inicie sessão para recuperar o pedido.'); return `kaya_pending_consent:${encodeURIComponent(owner)}`; };
function validPending(value: unknown, owner: string): value is PendingConsent {
  if (!object(value) || value.owner !== owner || !uuid(value.key) || !object(value.payload)
    || Object.keys(value).some(key => !['owner', 'key', 'payload'].includes(key))) return false;
  const body = value.payload;
  return ['document_id', 'content_hash'].every(key => string(body[key])) && integer(body.version) && body.version >= 1 && isConsentCountry(body.country) && body.language === 'pt'
    && action(body.action) && integer(body.expected_revision)
    && Object.keys(body).every(key => ['document_id', 'version', 'content_hash', 'country', 'language', 'action', 'expected_revision'].includes(key));
}
export function readPendingConsent(owner: string): PendingConsent | null {
  const raw = localStorage.getItem(storageKey(owner));
  if (raw === null) return null;
  if (raw.length > 2048) throw new Error('A referência de consentimento guardada não é válida.');
  const parsed: unknown = JSON.parse(raw);
  if (!validPending(parsed, owner)) throw new Error('A referência de consentimento guardada não é válida.');
  return parsed;
}
export function savePendingConsent(pending: PendingConsent): void {
  if (!validPending(pending, pending.owner)) throw new Error('Pedido de consentimento inválido.');
  const previous = readPendingConsent(pending.owner);
  if (previous && JSON.stringify(previous) !== JSON.stringify(pending)) throw new Error('Recupere o pedido anterior antes de decidir novamente.');
  localStorage.setItem(storageKey(pending.owner), JSON.stringify(pending));
}
export function clearPendingConsent(pending: PendingConsent): boolean {
  const previous = readPendingConsent(pending.owner);
  if (!previous || previous.key !== pending.key) return false;
  localStorage.removeItem(storageKey(pending.owner));
  return true;
}
export function consentNotCommitted(error: unknown): string | null {
  const response = (error as { response?: { status?: number; data?: { detail?: Record<string, unknown> } } })?.response;
  const detail = response?.data?.detail;
  return response?.status === 409 && detail?.code === 'consent_not_committed' && detail.request_key_committed === false && typeof detail.message === 'string' ? detail.message : null;
}
