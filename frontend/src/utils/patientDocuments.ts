export type DocumentStatus = 'pending_processing' | 'ready_for_review' | 'needs_manual_review' | 'confirmed' | 'rejected' | 'blocked' | 'processing_failed';
export type DocumentMetadata = {
  id: string; original_filename: string; content_type: string; size_bytes: number;
  status: DocumentStatus; scan_status: string; version: number; extraction_method: string | null;
  created_at: string; reviewed_at: string | null; error_code: string | null;
};
export type PatientDocument = DocumentMetadata & { extracted_text: string | null; reviewed_text: string | null };
export type DocumentPage = { items: DocumentMetadata[]; next_cursor: string | null };

export function appendDocumentPage(previous: DocumentMetadata[], incoming: DocumentMetadata[]): DocumentMetadata[] {
  const rows = new Map(previous.map(item => [item.id, item]));
  for (const item of incoming) if (!rows.has(item.id) || item.version >= rows.get(item.id)!.version) rows.set(item.id, item);
  return [...rows.values()];
}
