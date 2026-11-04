export const REQUIRED_CONSENT_PURPOSES = ['privacy_policy', 'telemedicine_consent', 'terms_of_service', 'health_data_processing', 'medical_disclaimer'] as const;
export type ConsentCountry = 'AO' | 'PT';
export type ConsentReference = { document_id: string; version: number; content_hash: string; country: ConsentCountry; language: 'pt' };
export type ConsentDocument = { id: string; document_key: string; version: number; content_hash: string; country: ConsentCountry; language: 'pt'; purpose: string; kind: string; required: boolean; title: string; content: string; approved_source: string; effective_from: string; effective_to: string | null };
export type ConsentCatalog = { country: ConsentCountry; language: 'pt'; available: boolean; required_purposes: string[]; unavailable_purposes: string[]; documents: ConsentDocument[] };
export type ConsentAction = 'grant' | 'refuse' | 'withdraw';
export type ConsentEvent = Omit<ConsentReference, 'language'> & { language: string; id: string; sequence: number; purpose: string; action: ConsentAction; created_at: string; request_key: string | null };
export type ConsentPurposeState = { purpose: string; status: 'granted' | 'missing' | 'withdrawn' | 'refused' | 'stale' | 'unavailable'; effective: boolean; document: ConsentDocument | null; latest_event: ConsentEvent | null };
export type ConsentState = { country: ConsentCountry; language: 'pt'; available: boolean; revision: number; required_purposes: string[]; states: ConsentPurposeState[] };
export type ConsentPayload = ConsentReference & { action: ConsentAction; expected_revision: number };
export type ConsentAttempt = { ownerId: string; key: string; payload: ConsentPayload };
export type ConsentReceipt = { event: ConsentEvent; revision: number; state: ConsentState };
export type ConsentHistory = { items: ConsentEvent[]; next_cursor: string | null };
export type ConsentStorage = { getItemAsync(key: string): Promise<string | null>; setItemAsync(key: string, value: string): Promise<void>; deleteItemAsync(key: string): Promise<void> };
export type ConsentApi = { get(path: string): Promise<{ data: unknown }>; post(path: string, body: unknown, options: { headers: Record<string, string> }): Promise<{ data: unknown }> };
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const hash = /^[a-f0-9]{64}$/;
const obj = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max = 256): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const integer = (value: unknown, min = 0): value is number => Number.isSafeInteger(value) && (value as number) >= min;
const utc = (value: unknown): value is string => typeof value === 'string' && /(?:Z|\+00:00)$/.test(value) && Number.isFinite(Date.parse(value));
const countryValid = (value: unknown): value is ConsentCountry => value === 'AO' || value === 'PT';
const invalid = (): never => { throw new Error('Não foi possível verificar os consentimentos recebidos. Atualize antes de decidir.'); };
const purposes = (value: unknown): string[] => {
  if (!Array.isArray(value) || !value.every(item => text(item)) || new Set(value).size !== value.length) return invalid();
  return value;
};
function scope(value: Record<string, unknown>, country: ConsentCountry): void { if (value.country !== country || value.language !== 'pt') invalid(); }
export function consentDocument(value: unknown, country: ConsentCountry): ConsentDocument {
  const data = obj(value); scope(data, country);
  if (!text(data.id) || !text(data.document_key) || !integer(data.version, 1) || typeof data.content_hash !== 'string' || !hash.test(data.content_hash)
    || !text(data.purpose) || !text(data.kind) || typeof data.required !== 'boolean' || !text(data.title, 1000) || !text(data.content, 500_000)
    || !text(data.approved_source, 2000) || !utc(data.effective_from) || !(data.effective_to === null || utc(data.effective_to))) return invalid();
  return { id: data.id, document_key: data.document_key, version: data.version, content_hash: data.content_hash, country, language: 'pt', purpose: data.purpose,
    kind: data.kind, required: data.required, title: data.title, content: data.content, approved_source: data.approved_source, effective_from: data.effective_from, effective_to: data.effective_to as string | null };
}
export function consentReference(value: ConsentDocument | ConsentEvent): ConsentReference {
  if (value.language !== 'pt') return invalid();
  return { document_id: 'document_id' in value ? value.document_id : value.id, version: value.version, content_hash: value.content_hash, country: value.country, language: value.language };
}
function parseReference(value: unknown): ConsentReference {
  const data = obj(value);
  if (!text(data.document_id) || !integer(data.version, 1) || typeof data.content_hash !== 'string' || !hash.test(data.content_hash) || !countryValid(data.country) || data.language !== 'pt') return invalid();
  return { document_id: data.document_id, version: data.version, content_hash: data.content_hash, country: data.country, language: 'pt' };
}
export function parseConsentCatalog(value: unknown, country: ConsentCountry): ConsentCatalog {
  const data = obj(value); scope(data, country);
  const required = purposes(data.required_purposes); const unavailable = purposes(data.unavailable_purposes);
  if (typeof data.available !== 'boolean' || !Array.isArray(data.documents) || required.length !== 5 || REQUIRED_CONSENT_PURPOSES.some(item => !required.includes(item))) return invalid();
  const documents = data.documents.map(item => consentDocument(item, country));
  if (new Set(documents.map(item => item.purpose)).size !== documents.length || documents.some(item => item.required !== required.includes(item.purpose))) return invalid();
  if (data.available && (unavailable.length || required.some(purpose => !documents.some(item => item.purpose === purpose)))) return invalid();
  return { country, language: 'pt', available: data.available, required_purposes: required, unavailable_purposes: unavailable, documents };
}
export function parseConsentEvent(value: unknown): ConsentEvent {
  const data = obj(value);
  if (!text(data.document_id) || !integer(data.version, 1) || typeof data.content_hash !== 'string' || !hash.test(data.content_hash)
    || !countryValid(data.country) || typeof data.language !== 'string' || !/^[a-z]{2}(-[A-Z]{2})?$/.test(data.language)) return invalid();
  const ref = { document_id: data.document_id, version: data.version, content_hash: data.content_hash, country: data.country, language: data.language };
  if (!text(data.id) || !integer(data.sequence, 1) || !text(data.purpose) || !['grant', 'refuse', 'withdraw'].includes(String(data.action)) || !utc(data.created_at)
    || !(data.request_key === null || typeof data.request_key === 'string' && uuid.test(data.request_key))) return invalid();
  return { ...ref, id: data.id, sequence: data.sequence, purpose: data.purpose, action: data.action as ConsentAction, created_at: data.created_at, request_key: data.request_key as string | null };
}
export function parseConsentState(value: unknown, country: ConsentCountry): ConsentState {
  const data = obj(value); scope(data, country); const required = purposes(data.required_purposes);
  if (typeof data.available !== 'boolean' || !integer(data.revision) || !Array.isArray(data.states) || required.length !== 5 || REQUIRED_CONSENT_PURPOSES.some(item => !required.includes(item))) return invalid();
  const states = data.states.map(value => {
    const item = obj(value);
    if (!text(item.purpose) || !['granted', 'missing', 'withdrawn', 'refused', 'stale', 'unavailable'].includes(String(item.status)) || typeof item.effective !== 'boolean') return invalid();
    const document = item.document === null ? null : consentDocument(item.document, country);
    const latest = item.latest_event === null ? null : parseConsentEvent(item.latest_event);
    if ((document && document.purpose !== item.purpose) || (latest && (latest.purpose !== item.purpose || latest.country !== country || latest.sequence > (data.revision as number)))) return invalid();
    if (latest && latest.language !== 'pt' && (item.effective || !['withdraw', 'refuse'].includes(latest.action))) return invalid();
    if (item.effective && (item.status !== 'granted' || !document || !latest || latest.action !== 'grant' || latest.document_id !== document.id || latest.content_hash !== document.content_hash || latest.version !== document.version)) return invalid();
    return { purpose: item.purpose, status: item.status as ConsentPurposeState['status'], effective: item.effective, document, latest_event: latest };
  });
  if (new Set(states.map(item => item.purpose)).size !== states.length || required.some(purpose => !states.some(item => item.purpose === purpose))) return invalid();
  return { country, language: 'pt', available: data.available, revision: data.revision, required_purposes: required, states };
}
export function parseConsentHistory(value: unknown, previousCursor: string | null = null): ConsentHistory {
  const data = obj(value);
  if (!Array.isArray(data.items) || data.items.length > 100 || !(data.next_cursor === null || text(data.next_cursor, 4096)) || previousCursor && data.next_cursor === previousCursor) return invalid();
  const items = data.items.map(parseConsentEvent);
  if (new Set(items.map(item => item.id)).size !== items.length) return invalid();
  return { items, next_cursor: data.next_cursor as string | null };
}
export function consentQuery(country: ConsentCountry): string { return `?country=${country}&language=pt`; }
export async function requireCurrentCareConsent(api: Pick<ConsentApi, 'get'>, country: ConsentCountry, assertCurrent = () => {}): Promise<void> {
  if (!countryValid(country)) return invalid();
  assertCurrent();
  const response = await api.get(`/api/v1/compliance/consent-state${consentQuery(country)}`);
  assertCurrent();
  const state = parseConsentState(response.data, country);
  const missing = REQUIRED_CONSENT_PURPOSES.filter(purpose => !state.states.some(item => item.purpose === purpose && item.effective));
  if (!state.available || missing.length) throw { response: { status: 403, data: { detail: {
    code: 'consent_required', country, language: 'pt', missing_purposes: missing,
    message: 'Reveja e registe os consentimentos atuais deste país antes de enviar um novo pedido. O histórico e a recuperação de pedidos anteriores continuam disponíveis.',
  } } } };
}
export function newConsentAttempt(ownerId: string, reference: ConsentReference, action: ConsentAction, revision: number, key?: string): ConsentAttempt {
  const generated = key ?? globalThis.crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => { const value = Math.floor(Math.random() * 16); return (char === 'x' ? value : (value & 3) | 8).toString(16); });
  return validateAttempt({ ownerId, key: generated, payload: { ...reference, action, expected_revision: revision } }, ownerId);
}
function validateAttempt(value: unknown, ownerId: string): ConsentAttempt {
  const data = obj(value); const payload = obj(data.payload); const reference = parseReference(payload);
  if (!text(ownerId, 128) || data.ownerId !== ownerId || typeof data.key !== 'string' || !uuid.test(data.key) || !integer(payload.expected_revision)
    || !['grant', 'refuse', 'withdraw'].includes(String(payload.action)) || Object.keys(data).some(key => !['ownerId', 'key', 'payload'].includes(key))
    || Object.keys(payload).some(key => !['document_id', 'version', 'content_hash', 'country', 'language', 'action', 'expected_revision'].includes(key))) return invalid();
  return { ownerId, key: data.key, payload: { ...reference, action: payload.action as ConsentAction, expected_revision: payload.expected_revision } };
}
export function consentStorageKey(ownerId: string): string { if (!text(ownerId, 128)) return invalid(); return `kaya_consent_${Array.from(ownerId).map(item => item.codePointAt(0)!.toString(16)).join('_')}`; }
const queues = new WeakMap<ConsentStorage, Map<string, Promise<unknown>>>();
function serialized<T>(storage: ConsentStorage, key: string, operation: () => Promise<T>): Promise<T> {
  let queue = queues.get(storage); if (!queue) { queue = new Map(); queues.set(storage, queue); }
  const result = (queue.get(key) ?? Promise.resolve()).catch(() => undefined).then(operation); queue.set(key, result);
  void result.finally(() => { if (queue!.get(key) === result) queue!.delete(key); }).catch(() => undefined);
  return result;
}
async function readStored(storage: ConsentStorage, owner: string): Promise<ConsentAttempt | null> {
  const raw = await storage.getItemAsync(consentStorageKey(owner)); if (raw === null) return null;
  if (raw.length > 2048) return invalid(); return validateAttempt(JSON.parse(raw), owner);
}
export function readConsentAttempt(storage: ConsentStorage, owner: string): Promise<ConsentAttempt | null> { return serialized(storage, consentStorageKey(owner), () => readStored(storage, owner)); }
export function clearConsentAttempt(storage: ConsentStorage, attempt: ConsentAttempt, assertCurrent = () => {}): Promise<boolean> {
  return serialized(storage, consentStorageKey(attempt.ownerId), async () => {
    assertCurrent(); const current = await readStored(storage, attempt.ownerId); assertCurrent();
    if (current?.key !== attempt.key) return false;
    await storage.deleteItemAsync(consentStorageKey(attempt.ownerId)); return true;
  });
}
export function consentNotCommitted(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { detail?: Record<string, unknown> } } })?.response;
  return response?.status === 409 && response.data?.detail?.code === 'consent_not_committed' && response.data.detail.request_key_committed === false;
}
export function parseConsentReceipt(value: unknown, attempt: ConsentAttempt): ConsentReceipt {
  const data = obj(value); const event = parseConsentEvent(data.event); const state = parseConsentState(data.state, attempt.payload.country);
  if (!integer(data.revision, 1) || data.revision < event.sequence || state.revision !== data.revision || event.request_key !== attempt.key
    || Object.entries(attempt.payload).some(([key, value]) => key !== 'expected_revision' && event[key as keyof ConsentEvent] !== value)) return invalid();
  return { event, revision: data.revision, state };
}
/** Supply an API wrapper bound to the captured auth generation. The action may wait on SecureStore. */
export async function submitConsent(api: ConsentApi, storage: ConsentStorage, attempt: ConsentAttempt, assertCurrent = () => {}): Promise<ConsentReceipt> {
  const checked = validateAttempt(attempt, attempt.ownerId); const key = consentStorageKey(attempt.ownerId);
  await serialized(storage, key, async () => {
    assertCurrent(); const current = await readStored(storage, attempt.ownerId); assertCurrent();
    if (current && JSON.stringify(current) !== JSON.stringify(checked)) throw new Error('Existe uma decisão por confirmar. Recupere o pedido original antes de decidir novamente.');
    await storage.setItemAsync(key, JSON.stringify(checked)); assertCurrent();
  });
  let receipt: ConsentReceipt;
  try {
    assertCurrent(); const result = await api.post('/api/v1/compliance/consent', checked.payload, { headers: { 'Idempotency-Key': checked.key } });
    assertCurrent(); receipt = parseConsentReceipt(result.data, checked);
  } catch (failure) {
    assertCurrent(); if (consentNotCommitted(failure)) await clearConsentAttempt(storage, checked, assertCurrent);
    throw failure;
  }
  try { await clearConsentAttempt(storage, checked, assertCurrent); } catch { /* A positive lookup can finish cleanup later. */ }
  assertCurrent(); return receipt;
}
export async function recoverConsent(api: ConsentApi, storage: ConsentStorage, attempt: ConsentAttempt, assertCurrent = () => {}): Promise<ConsentReceipt | null> {
  assertCurrent();
  try {
    const result = await api.get(`/api/v1/compliance/consent-requests/${encodeURIComponent(attempt.key)}`); assertCurrent();
    const receipt = parseConsentReceipt(result.data, attempt);
    try { await clearConsentAttempt(storage, attempt, assertCurrent); } catch { /* Preserve exact identity. */ }
    assertCurrent(); return receipt;
  } catch (failure) { assertCurrent(); if ((failure as { response?: { status?: number } })?.response?.status === 404) return null; throw failure; }
}
export const CONSENT_STATUS: Record<ConsentPurposeState['status'], string> = { granted: 'Autorizado', missing: 'Sem decisão', withdrawn: 'Retirado', refused: 'Recusado', stale: 'Versão desatualizada', unavailable: 'Documento indisponível' };
export const CONSENT_ACTION: Record<ConsentAction, string> = { grant: 'Autorizar', refuse: 'Recusar', withdraw: 'Retirar autorização' };

/** Revoke visible evidence as soon as any parallel read denies access, without waiting for slow siblings. */
export async function observeConsentRead<T>(request: Promise<T>, current: () => boolean, deny: () => void): Promise<T> {
  try { return await request; }
  catch (failure) {
    const status = (failure as { response?: { status?: number } })?.response?.status;
    if (current() && (status === 401 || status === 403)) deny();
    throw failure;
  }
}
