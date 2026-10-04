import { DOCUMENT_MAX_BYTES, sendDocumentUpload } from '../screens/patientDocuments';
import type { DocumentUpload, PatientDocument } from '../screens/patientDocuments';

type RecoveryStorage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};
export type PendingDocumentUpload = { ownerId: string; upload: DocumentUpload; consent: true };
type UploadApi = Parameters<typeof sendDocumentUpload>[0];
type LookupApi = { get(path: string): Promise<{ data: PatientDocument }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const queues = new WeakMap<RecoveryStorage, Map<string, Promise<unknown>>>();

export function recoveryStorageKey(ownerId: string): string {
  if (!ownerId || ownerId.length > 128) throw new Error('É necessária uma conta autenticada para recuperar o envio.');
  const encoded = Array.from(ownerId).map(character => character.codePointAt(0)!.toString(16)).join('_');
  return `kaya_document_upload_${encoded}`;
}

function serialize<T>(storage: RecoveryStorage, key: string, action: () => Promise<T>): Promise<T> {
  let queue = queues.get(storage);
  if (!queue) { queue = new Map(); queues.set(storage, queue); }
  const result = (queue.get(key) ?? Promise.resolve()).catch(() => undefined).then(action);
  queue.set(key, result);
  void result.finally(() => { if (queue.get(key) === result) queue.delete(key); }).catch(() => undefined);
  return result;
}

function validated(value: unknown, ownerId: string): PendingDocumentUpload {
  const pending = value as Partial<PendingDocumentUpload> | null;
  const upload = pending?.upload;
  const file = upload?.file;
  if (!pending || pending.ownerId !== ownerId || pending.consent !== true || !upload || !file ||
      typeof upload.key !== 'string' || !UUID.test(upload.key) ||
      typeof file.uri !== 'string' || !file.uri.startsWith('file://') || file.uri.length <= 7 || file.uri.length > 1024 ||
      typeof file.name !== 'string' || !file.name.trim() || file.name.length > 255 || /[\u0000-\u001f]/.test(file.name) ||
      !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) ||
      (upload.size !== undefined && (!Number.isSafeInteger(upload.size) || upload.size <= 0 || upload.size > DOCUMENT_MAX_BYTES)) ||
      (file.type === 'application/pdf' && upload.size === undefined) ||
      Object.keys(pending).some(key => !['ownerId', 'upload', 'consent'].includes(key)) ||
      Object.keys(upload).some(key => !['key', 'file', 'size'].includes(key)) ||
      Object.keys(file).some(key => !['uri', 'name', 'type'].includes(key))) {
    throw new Error('Não foi possível verificar a referência do envio anterior. Verifique esse envio antes de escolher outro ficheiro.');
  }
  return { ownerId, upload: { key: upload.key, file: { uri: file.uri, name: file.name, type: file.type },
    ...(upload.size === undefined ? {} : { size: upload.size }) }, consent: true };
}

async function readStored(storage: RecoveryStorage, key: string, ownerId: string): Promise<PendingDocumentUpload | null> {
  const raw = await storage.getItemAsync(key);
  if (raw === null) return null;
  if (raw.length > 4096) throw new Error('A referência do envio anterior é inválida.');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('Não foi possível ler a referência do envio anterior.'); }
  return validated(parsed, ownerId);
}

export function readPendingUpload(storage: RecoveryStorage, ownerId: string): Promise<PendingDocumentUpload | null> {
  const key = recoveryStorageKey(ownerId);
  return serialize(storage, key, () => readStored(storage, key, ownerId));
}

/** Local-reference removal only. The caller must confirm an explicit discard with the patient. */
export function discardPendingUpload(storage: RecoveryStorage, ownerId: string, expectedUUID: string): Promise<boolean> {
  const key = recoveryStorageKey(ownerId);
  if (!UUID.test(expectedUUID)) return Promise.reject(new Error('A referência do envio é inválida.'));
  return serialize(storage, key, async () => {
    const current = await readStored(storage, key, ownerId);
    if (current?.upload.key !== expectedUUID) return false;
    await storage.deleteItemAsync(key);
    return true;
  });
}

function verifiedDocument(value: PatientDocument): PatientDocument {
  if (!value || typeof value.id !== 'string' || !value.id || typeof value.original_filename !== 'string' ||
      !['image/jpeg', 'image/png', 'application/pdf'].includes(value.content_type) ||
      !Number.isSafeInteger(value.version) || value.version < 1 || !Number.isSafeInteger(value.size_bytes) || value.size_bytes <= 0) {
    throw new Error('Não foi possível confirmar o resultado do envio. Recupere o mesmo pedido.');
  }
  return value;
}

/** Bind the supplied API to the operation's session generation before calling: storage is asynchronous.
 * Every error preserves the durable request, including later authentication/validation failures. */
export async function sendRecoverableUpload(
  api: UploadApi, storage: RecoveryStorage, ownerId: string, upload: DocumentUpload, consent: boolean,
  makeForm?: Parameters<typeof sendDocumentUpload>[3],
): Promise<PatientDocument> {
  if (!consent) throw new Error('Autorize o tratamento deste documento antes de o enviar.');
  const pending = validated({ ownerId, upload, consent: true }, ownerId);
  const key = recoveryStorageKey(ownerId);
  await serialize(storage, key, async () => {
    const current = await readStored(storage, key, ownerId);
    if (current && JSON.stringify(current) !== JSON.stringify(pending)) {
      throw new Error('Existe um envio por confirmar. Recupere o pedido guardado antes de escolher outro ficheiro.');
    }
    await storage.setItemAsync(key, JSON.stringify(pending));
  });
  const document = verifiedDocument(await sendDocumentUpload(api, pending.upload, true, makeForm));
  // A failed cleanup keeps a safe replay reference; it must not hide an acknowledged upload.
  try { await discardPendingUpload(storage, ownerId, pending.upload.key); } catch { /* Retry lookup can clear it later. */ }
  return document;
}

/** A positive lookup can recover a committed upload without reading its expired cached file.
 * A 404 does not prove that an earlier request never committed and never clears the reference. */
export async function recoverCommittedUpload(
  api: LookupApi, storage: RecoveryStorage, ownerId: string, pending: PendingDocumentUpload,
): Promise<PatientDocument | null> {
  const attempt = validated(pending, ownerId);
  let document: PatientDocument;
  try {
    const response = await api.get(`/api/v1/patient-documents/requests/${encodeURIComponent(attempt.upload.key)}`);
    document = verifiedDocument(response.data);
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) return null;
    throw error;
  }
  try { await discardPendingUpload(storage, ownerId, attempt.upload.key); } catch { /* Retain for positive lookup retry. */ }
  return document;
}
