export const DOCUMENT_TEXT_LIMIT = 100_000;

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

export type DocumentCapabilities = {
  upload_enabled: boolean;
  max_bytes: number;
  accepted_types: string[];
  extraction: string;
  message?: string;
};

export type PhotoAsset = { uri: string; fileName?: string | null; mimeType?: string | null; fileSize?: number };
export type DocumentUpload = { key: string; file: { uri: string; name: string; type: 'image/jpeg' | 'image/png' }; size?: number };
export type ReviewDraft = { document: PatientDocument; text: string; conflict: boolean };

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
    throw new Error('Escolha uma imagem JPG ou PNG. Para enviar um PDF, utilize a Kaya na web.');
  }
  if (!asset.uri || !Number.isFinite(maxBytes) || maxBytes <= 0) throw new Error('Não foi possível preparar a imagem. Tente novamente.');
  if (asset.fileSize !== undefined && (!Number.isFinite(asset.fileSize) || asset.fileSize <= 0 || asset.fileSize > maxBytes)) {
    throw new Error(`Escolha uma imagem com até ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
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
