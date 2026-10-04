export const DOCUMENT_TEXT_LIMIT = 100_000;
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export type PatientDocument = {
  id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  status: 'pending_processing' | 'ready_for_review' | 'needs_manual_review' | 'confirmed' | 'rejected' | 'blocked' | 'processing_failed';
  scan_status: string;
  version: number;
  extraction_method: string | null;
  extracted_text: string | null;
  reviewed_text: string | null;
  created_at: string;
  reviewed_at: string | null;
  error_code: string | null;
};
export type DocumentMetadata = Omit<PatientDocument, 'extracted_text' | 'reviewed_text'>;
export type DocumentPage = { items: DocumentMetadata[]; next_cursor: string | null };

/** Never retain extracted or reviewed text in the list, even if a server sends extra fields. */
export function documentMetadata(item: DocumentMetadata): DocumentMetadata {
  return { id: item.id, original_filename: item.original_filename, content_type: item.content_type,
    size_bytes: item.size_bytes, status: item.status, scan_status: item.scan_status, version: item.version,
    extraction_method: item.extraction_method, created_at: item.created_at, reviewed_at: item.reviewed_at,
    error_code: item.error_code };
}

export async function loadDocumentPage(
  api: { get: (path: string) => Promise<{ data: unknown }> }, cursor: string | null = null,
): Promise<DocumentPage> {
  const response = await api.get('/api/v1/patient-documents/page?limit=20' + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''));
  const page = response.data as DocumentPage | null;
  if (!page || !Array.isArray(page.items) || !(page.next_cursor === null || (typeof page.next_cursor === 'string' && page.next_cursor.length > 0)) ||
      (cursor !== null && page.next_cursor === cursor) || page.items.some(item => !item || typeof item.id !== 'string' || !item.id ||
        typeof item.original_filename !== 'string' || !Number.isSafeInteger(item.version) || item.version < 1)) {
    throw new Error('Não foi possível verificar a página de documentos. Tente atualizar a lista.');
  }
  return { items: page.items.map(documentMetadata), next_cursor: page.next_cursor };
}

export function mergeDocumentPage(existing: DocumentMetadata[], page: DocumentMetadata[]): DocumentMetadata[] {
  const result = existing.map(documentMetadata);
  for (const item of page) {
    const index = result.findIndex(previous => previous.id === item.id);
    if (index < 0) result.push(documentMetadata(item));
    else if (item.version >= result[index].version) result[index] = documentMetadata(item);
  }
  return result;
}

export function documentAccessLost(error: unknown): boolean {
  return [401, 403].includes((error as { response?: { status?: number } })?.response?.status ?? 0);
}

export function documentCursorExpired(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 422;
}

export type DocumentCapabilities = {
  upload_enabled: boolean;
  request_lookup_enabled?: boolean;
  max_bytes: number;
  accepted_types: string[];
  extraction: string;
  message?: string;
};

export type PhotoAsset = { uri: string; fileName?: string | null; mimeType?: string | null; fileSize?: number };
export type DocumentUpload = { key: string; file: { uri: string; name: string; type: 'image/jpeg' | 'image/png' | 'application/pdf' }; size?: number };
export type ReviewDraft = { document: PatientDocument; text: string; conflict: boolean };
export type PdfAsset = { uri: string; name: string; mimeType?: string | null; size?: number };

export class DocumentSelectionError extends Error {}

export function validateCachedDocumentUpload(upload: DocumentUpload, size: number): void {
  if (!Number.isSafeInteger(size) || size <= 0 || size > DOCUMENT_MAX_BYTES ||
      (upload.size !== undefined && size !== upload.size)) {
    throw new DocumentSelectionError('O ficheiro temporário já não está disponível ou mudou. Verifique o envio guardado e consulte o histórico antes de descartar a recuperação local.');
  }
}

export function documentUploadLimit(capabilities: DocumentCapabilities | null): number {
  return capabilities && Number.isSafeInteger(capabilities.max_bytes) && capabilities.max_bytes > 0
    ? Math.min(capabilities.max_bytes, DOCUMENT_MAX_BYTES) : 0;
}

export function documentTypeAvailable(capabilities: DocumentCapabilities | null, type: string): boolean {
  return capabilities?.upload_enabled === true && documentUploadLimit(capabilities) > 0 &&
    Array.isArray(capabilities.accepted_types) && capabilities.accepted_types.includes(type);
}

export function validateDocumentUpload(upload: DocumentUpload, capabilities: DocumentCapabilities | null): void {
  if (!documentTypeAvailable(capabilities, upload.file.type)) {
    throw new DocumentSelectionError('O envio deste tipo de documento não está disponível neste momento. Atualize a lista e tente novamente.');
  }
  const limit = documentUploadLimit(capabilities);
  if ((upload.file.type === 'application/pdf' && upload.size === undefined) ||
      (upload.size !== undefined && (!Number.isSafeInteger(upload.size) || upload.size <= 0 || upload.size > limit))) {
    throw new DocumentSelectionError(`Escolha um documento não vazio com até ${limit / 1024 / 1024} MB.`);
  }
}

export function preparePdfUpload(asset: PdfAsset, capabilities: DocumentCapabilities | null, size = asset.size, key = newUploadKey()): DocumentUpload {
  const name = asset.name.split(/[\\/]/).pop() || '';
  const mime = asset.mimeType?.trim().toLowerCase();
  if (!name.toLowerCase().endsWith('.pdf') || (mime && mime !== 'application/pdf')) {
    throw new DocumentSelectionError('Escolha um ficheiro PDF. Para fotografias, utilize Escolher imagem.');
  }
  if (!asset.uri.startsWith('file://')) throw new DocumentSelectionError('Não foi possível obter uma cópia local do PDF. Tente selecionar o ficheiro novamente.');
  const upload: DocumentUpload = { key, file: { uri: asset.uri, name, type: 'application/pdf' }, size };
  validateDocumentUpload(upload, capabilities);
  return upload;
}

/** Return a replacement only after successful selection and validation; cancellation preserves all drafts. */
export async function selectPdfUpload(
  capabilities: DocumentCapabilities | null,
  pick: () => Promise<{ canceled: boolean; assets: PdfAsset[] | null }>,
  localSize: (uri: string) => number,
): Promise<DocumentUpload | null> {
  if (!documentTypeAvailable(capabilities, 'application/pdf')) {
    throw new DocumentSelectionError('O envio de PDFs não está disponível neste momento.');
  }
  const result = await pick();
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset) throw new DocumentSelectionError('Nenhum PDF foi selecionado. Tente novamente.');
  return preparePdfUpload(asset, capabilities, localSize(asset.uri));
}

/** An upload identifier only, never an authentication or access token. */
export function newUploadKey(): string {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) return random;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, symbol => {
    const value = Math.floor(Math.random() * 16);
    return (symbol === 'x' ? value : (value & 3) | 8).toString(16);
  });
}

export function preparePhotoUpload(asset: PhotoAsset, maxBytes: number, key = newUploadKey()): DocumentUpload {
  const extension = (asset.fileName || asset.uri.split('?')[0]).split('.').pop()?.toLowerCase();
  const mime = asset.mimeType?.toLowerCase() || (extension === 'png' ? 'image/png' : ['jpg', 'jpeg'].includes(extension || '') ? 'image/jpeg' : '');
  if (mime !== 'image/jpeg' && mime !== 'image/png') {
    throw new DocumentSelectionError('Escolha uma imagem JPG ou PNG. Para PDFs, utilize Escolher PDF.');
  }
  if (!asset.uri || !Number.isFinite(maxBytes) || maxBytes <= 0) throw new DocumentSelectionError('Não foi possível preparar a imagem. Tente novamente.');
  if (asset.fileSize !== undefined && (!Number.isFinite(asset.fileSize) || asset.fileSize <= 0 || asset.fileSize > maxBytes)) {
    throw new DocumentSelectionError(`Escolha uma imagem com até ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
  }
  return {
    key,
    file: { uri: asset.uri, name: asset.fileName || `documento.${mime === 'image/png' ? 'png' : 'jpg'}`, type: mime },
    size: asset.fileSize,
  };
}

export function canProcessDocument(document: PatientDocument): boolean {
  return ['pending_processing', 'processing_failed'].includes(document.status);
}

export async function sendDocumentUpload(
  api: { post: (path: string, body: unknown, options: { headers: Record<string, string>; timeout: number }) => Promise<{ data: PatientDocument }> },
  upload: DocumentUpload,
  consent: boolean,
  makeForm: () => { append: (name: string, value: any) => void } = () => new FormData(),
): Promise<PatientDocument> {
  if (!consent) throw new Error('Autorize o tratamento deste documento antes de o enviar.');
  const form = makeForm();
  form.append('file', upload.file);
  form.append('processing_consent', 'true');
  const response = await api.post('/api/v1/patient-documents', form, {
    headers: { 'Content-Type': 'multipart/form-data', 'Idempotency-Key': upload.key },
    timeout: 60_000,
  });
  return response.data;
}

export function canReviewDocument(document: PatientDocument): boolean {
  return document.scan_status === 'clean' && ['ready_for_review', 'needs_manual_review'].includes(document.status);
}

export function startDocumentReview(document: PatientDocument): ReviewDraft {
  return { document, text: document.reviewed_text ?? document.extracted_text ?? '', conflict: false };
}

export function reconcileDocumentReview(draft: ReviewDraft, latest: PatientDocument): ReviewDraft {
  if (draft.document.id !== latest.id) throw new Error('O documento atualizado não corresponde ao documento aberto.');
  return { document: latest, text: draft.text, conflict: true };
}

export function reviewPayload(draft: ReviewDraft, decision: 'confirm' | 'reject') {
  if (draft.conflict) throw new Error('Compare a versão atual antes de continuar.');
  if (!canReviewDocument(draft.document)) throw new Error('Este documento já não está disponível para revisão.');
  if (draft.text.length > DOCUMENT_TEXT_LIMIT) throw new Error('O texto excede o limite de 100 000 caracteres.');
  if (decision === 'confirm' && !draft.text.trim()) throw new Error('Introduza o texto do documento antes de confirmar.');
  return { version: draft.document.version, decision, text: draft.text };
}

type DocumentApi = {
  put: (path: string, data: unknown) => Promise<{ data: PatientDocument }>;
  get: (path: string) => Promise<{ data: PatientDocument }>;
};

export async function saveDocumentReview(api: DocumentApi, draft: ReviewDraft, decision: 'confirm' | 'reject'):
Promise<{ saved: boolean; draft: ReviewDraft }> {
  try {
    const response = await api.put(`/api/v1/patient-documents/${encodeURIComponent(draft.document.id)}/review`, reviewPayload(draft, decision));
    return { saved: true, draft: startDocumentReview(response.data) };
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } }).response?.status !== 409) throw error;
    // Reload the revision, but retain the patient's unsaved edits for comparison.
    const response = await api.get(`/api/v1/patient-documents/${encodeURIComponent(draft.document.id)}`);
    // A response can be lost after commit. Recover the confirmed result without
    // sending another write or mistaking a different confirmed text for ours.
    if ((decision === 'confirm' && response.data.status === 'confirmed' && response.data.reviewed_text === draft.text.trim()) ||
        (decision === 'reject' && response.data.status === 'rejected')) {
      return { saved: true, draft: startDocumentReview(response.data) };
    }
    return { saved: false, draft: reconcileDocumentReview(draft, response.data) };
  }
}

export function documentError(error: unknown, fallback: string): string {
  if (documentAccessLost(error)) return 'O acesso aos documentos mudou. O conteúdo carregado foi removido. Inicie sessão novamente para continuar.';
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

export const DOCUMENT_STATUS: Record<PatientDocument['status'], string> = {
  pending_processing: 'Por ler',
  ready_for_review: 'Texto pronto para rever',
  needs_manual_review: 'Necessita de transcrição manual',
  confirmed: 'Texto confirmado por si',
  rejected: 'Texto rejeitado por si',
  blocked: 'Documento bloqueado',
  processing_failed: 'Não foi possível ler',
};

export function manualReviewMessage(document: PatientDocument): string {
  if (document.error_code === 'partial_text_requires_ocr') {
    return 'O texto extraído está incompleto: algumas páginas não contêm texto legível automaticamente. Compare todas as páginas com o original e complete a transcrição antes de confirmar.';
  }
  if (document.error_code === 'encrypted_pdf') return 'Este PDF está protegido e o texto não pôde ser lido. Consulte o original e transcreva o conteúdo que consegue ler.';
  if (document.error_code === 'page_limit' || document.error_code === 'text_limit') return 'Este documento ultrapassa o limite da leitura automática. Reveja o original completo; não trate um eventual excerto como o documento completo.';
  return 'Não foi possível obter texto automaticamente. Consulte o original e transcreva apenas o que consegue ler, sem completar valores em falta.';
}
