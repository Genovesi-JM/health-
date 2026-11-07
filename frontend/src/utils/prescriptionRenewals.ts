import { isConsentCountry, type ConsentCountry } from './consent';

export type RenewalAction = 'approve' | 'adjust' | 'consult_requested' | 'exams_requested' | 'reject';
export const renewalActions: RenewalAction[] = ['approve', 'adjust', 'consult_requested', 'exams_requested', 'reject'];
export const renewalStatusLabels: Record<string, string> = { pending: 'Pendente', approved: 'Aprovado', adjusted: 'Ajustado', consult_requested: 'Consulta solicitada', exams_requested: 'Exames solicitados', rejected: 'Recusado' };
export const renewalActionLabels: Record<RenewalAction, string> = { approve: 'Aprovar', adjust: 'Ajustar', consult_requested: 'Solicitar consulta', exams_requested: 'Solicitar exames', reject: 'Recusar' };
export const renewalActionStatus: Record<RenewalAction, string> = { approve: 'approved', adjust: 'adjusted', consult_requested: 'consult_requested', exams_requested: 'exams_requested', reject: 'rejected' };
export type RenewalCreate = { doctor_id: string; country: ConsentCountry; consent_language: 'pt'; medication_name: string; dose: string | null; frequency: string | null; reason: string | null };
export type RenewalDecisionBody = { action: RenewalAction; expected_revision: number; doctor_note: string | null; adjusted_dose: string | null; adjusted_frequency: string | null };
export interface RenewalRequest {
  id: string; patient_id: string; doctor_id: string; medication_name: string; dose: string | null; frequency: string | null; reason: string | null;
  status: string; country: ConsentCountry | null; consent_language: string | null; request_key: string | null; revision: number;
  decision_id: string | null; standalone_prescription_id: string | null; decision_state: 'pending' | 'decided' | 'legacy_review_required';
  doctor_note: string | null; adjusted_dose: string | null; adjusted_frequency: string | null;
  patient_name?: string | null; doctor_name?: string | null; created_at: string; decided_at: string | null;
}
export interface RenewalPage { items: RenewalRequest[]; next_cursor: string | null }
export interface RenewalDecision {
  id: string; request_id: string; request_key: string; action: string; revision: number; country: ConsentCountry; consent_language: string;
  medication_name: string; dose: string | null; frequency: string | null; doctor_note: string | null; standalone_prescription_id: string | null; decided_at: string;
}
export interface PendingRenewal {
  owner: string; kind: 'creation' | 'decision'; key: string; digest: string; country: ConsentCountry; consent_language: 'pt'; target: string;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
const optionalText = (value: unknown, max: number): value is string | null => value === null || text(value, max);
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
const date = (value: unknown): value is string => typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
const invalid = (): never => { throw new Error('Não foi possível validar o pedido recebido. Atualize antes de continuar.'); };
export const renewalCountryName = (value: unknown) => value === 'AO' ? 'Angola' : value === 'PT' ? 'Portugal' : 'País não registado';
export const canDecideRenewal = (request: RenewalRequest) => request.status === 'pending' && request.decision_state === 'pending' && request.revision === 0 && isConsentCountry(request.country) && request.consent_language === 'pt';
export function parseRenewalRequest(value: unknown): RenewalRequest {
  if (!object(value) || !['id', 'patient_id', 'doctor_id'].every(key => id(value[key])) || !text(value.medication_name, 300) || !value.medication_name
    || !['dose', 'frequency', 'adjusted_dose', 'adjusted_frequency'].every(key => optionalText(value[key], 100))
    || !['reason', 'doctor_note'].every(key => optionalText(value[key], 4000)) || !Object.hasOwn(renewalStatusLabels, String(value.status))
    || !(value.country === null || isConsentCountry(value.country)) || !optionalText(value.consent_language, 10)
    || !(value.request_key === null || uuid(value.request_key)) || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0
    || !['pending', 'decided', 'legacy_review_required'].includes(String(value.decision_state))
    || !(value.decision_id === null || id(value.decision_id)) || !(value.standalone_prescription_id === null || id(value.standalone_prescription_id))
    || !date(value.created_at) || !(value.decided_at === null || date(value.decided_at))) return invalid();
  return value as unknown as RenewalRequest;
}
export function parseRenewalPage(value: unknown): RenewalPage {
  if (!object(value) || !Array.isArray(value.items) || value.items.length > 100 || !(value.next_cursor === null || text(value.next_cursor, 10000))) return invalid();
  return { items: value.items.map(parseRenewalRequest), next_cursor: value.next_cursor as string | null };
}
export function parseCreationReceipt(value: unknown, attempt: PendingRenewal): RenewalRequest {
  const request = parseRenewalRequest(value);
  if (attempt.kind !== 'creation' || request.request_key !== attempt.key || request.doctor_id !== attempt.target || request.country !== attempt.country || request.consent_language !== attempt.consent_language) return invalid();
  return request;
}
export function parseDecisionReceipt(value: unknown, attempt: PendingRenewal): { decision: RenewalDecision; request: RenewalRequest } {
  if (!object(value) || !object(value.decision)) return invalid();
  const decision = value.decision;
  const request = parseRenewalRequest(value.request);
  if (attempt.kind !== 'decision' || !id(decision.id) || decision.request_id !== attempt.target || decision.request_key !== attempt.key || decision.revision !== 1
    || decision.country !== attempt.country || decision.consent_language !== attempt.consent_language || !date(decision.decided_at)
    || !text(decision.medication_name, 300) || !optionalText(decision.dose, 100) || !optionalText(decision.frequency, 100) || !optionalText(decision.doctor_note, 4000)
    || !Object.values(renewalActionStatus).includes(String(decision.action)) || !(decision.standalone_prescription_id === null || id(decision.standalone_prescription_id))
    || request.id !== attempt.target || request.decision_id !== decision.id || request.status !== decision.action || request.revision !== decision.revision
    || request.country !== attempt.country || request.consent_language !== attempt.consent_language || request.decision_state !== 'decided'
    || request.standalone_prescription_id !== decision.standalone_prescription_id
    || (['approved', 'adjusted'].includes(String(decision.action)) && !decision.standalone_prescription_id)) return invalid();
  return { decision: decision as unknown as RenewalDecision, request };
}
export async function verifyCreationReceipt(value: unknown, attempt: PendingRenewal): Promise<RenewalRequest> {
  const row = parseCreationReceipt(value, attempt);
  const digest = await renewalDigest({ country: attempt.country, consent_language: 'pt', doctor_id: row.doctor_id,
    medication_name: row.medication_name, dose: row.dose, frequency: row.frequency, reason: row.reason });
  if (digest !== attempt.digest) return invalid();
  return row;
}
export async function verifyDecisionReceipt(value: unknown, attempt: PendingRenewal): Promise<{ decision: RenewalDecision; request: RenewalRequest }> {
  const receipt = parseDecisionReceipt(value, attempt);
  const action = renewalActions.find(item => renewalActionStatus[item] === receipt.decision.action)!;
  const digest = await renewalDigest({ action, expected_revision: 0, doctor_note: receipt.request.doctor_note,
    adjusted_dose: receipt.request.adjusted_dose, adjusted_frequency: receipt.request.adjusted_frequency });
  const effectiveDose = action === 'adjust' ? receipt.request.adjusted_dose ?? receipt.request.dose : receipt.request.dose;
  const effectiveFrequency = action === 'adjust' ? receipt.request.adjusted_frequency ?? receipt.request.frequency : receipt.request.frequency;
  if (digest !== attempt.digest || receipt.decision.doctor_note !== receipt.request.doctor_note
    || receipt.decision.medication_name !== receipt.request.medication_name
    || receipt.decision.dose !== effectiveDose || receipt.decision.frequency !== effectiveFrequency
    || (['approve', 'adjust'].includes(action) && (!effectiveDose?.trim() || !effectiveFrequency?.trim()))) return invalid();
  return receipt;
}
export function mergeRenewalRows(previous: RenewalRequest[], incoming: RenewalRequest[]): RenewalRequest[] {
  const rows = new Map(previous.map(item => [item.id, item]));
  for (const item of incoming) if (!rows.has(item.id) || rows.get(item.id)!.revision <= item.revision) rows.set(item.id, item);
  return [...rows.values()];
}
export function renewalNotCommitted(failure: unknown): boolean {
  const response = (failure as { response?: { status?: unknown; data?: { detail?: Record<string, unknown> } } })?.response;
  return response?.status === 409 && response.data?.detail?.code === 'renewal_not_committed' && response.data.detail.request_key_committed === false;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
/** Digest exact normalized bodies; medication, reason and clinical notes never enter recovery storage. */
export async function renewalDigest(body: RenewalCreate | RenewalDecisionBody): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(body)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
const storageKey = (owner: string, kind: PendingRenewal['kind']) => {
  if (!id(owner) || !['creation', 'decision'].includes(kind)) throw new Error('Conta de recuperação inválida.');
  return `kaya_pending_renewal:${kind}:${encodeURIComponent(owner)}`;
};
function validPending(value: unknown, owner: string, kind: PendingRenewal['kind']): value is PendingRenewal {
  return object(value) && value.owner === owner && value.kind === kind && uuid(value.key) && typeof value.digest === 'string' && /^[a-f0-9]{64}$/.test(value.digest)
    && isConsentCountry(value.country) && value.consent_language === 'pt' && id(value.target)
    && Object.keys(value).every(key => ['owner', 'kind', 'key', 'digest', 'country', 'consent_language', 'target'].includes(key));
}
export function readPendingRenewal(owner: string, kind: PendingRenewal['kind']): PendingRenewal | null {
  const raw = localStorage.getItem(storageKey(owner, kind)); if (raw === null) return null;
  if (raw.length > 1024) throw new Error('Referência de recuperação inválida.');
  const result: unknown = JSON.parse(raw);
  if (!validPending(result, owner, kind)) throw new Error('Referência de recuperação inválida.');
  return result;
}
export function savePendingRenewal(attempt: PendingRenewal): void {
  if (!validPending(attempt, attempt.owner, attempt.kind)) throw new Error('Referência de recuperação inválida.');
  const old = readPendingRenewal(attempt.owner, attempt.kind);
  if (old && canonical(old) !== canonical(attempt)) throw new Error('Existe outro pedido por confirmar. Recupere-o antes de continuar.');
  localStorage.setItem(storageKey(attempt.owner, attempt.kind), JSON.stringify(attempt));
}
export function clearPendingRenewal(attempt: PendingRenewal): boolean {
  const old = readPendingRenewal(attempt.owner, attempt.kind);
  if (!old || old.key !== attempt.key || old.digest !== attempt.digest) return false;
  localStorage.removeItem(storageKey(attempt.owner, attempt.kind)); return true;
}
