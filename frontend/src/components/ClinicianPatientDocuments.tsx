import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { apiErrorMessage, apiErrorStatus } from '../utils/apiError';
import { appendDocumentPage, type DocumentMetadata, type DocumentPage, type PatientDocument } from '../utils/patientDocuments';

const BASE = '/api/v1/patient-documents';

export default function ClinicianPatientDocuments({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  return <DocumentReader key={`${user?.id}:${user?.role}:${patientId}`} patientId={patientId} />;
}

function DocumentReader({ patientId }: { patientId: string }) {
  const [items, setItems] = useState<DocumentMetadata[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorExpired, setCursorExpired] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [document, setDocument] = useState<PatientDocument | null>(null);
  const documentId = useRef<string | null>(null);
  const epoch = useRef(0);
  const advanceLifetime = useCallback(() => ++epoch.current, []);
  const working = useRef(false);
  const urls = useRef(new Set<string>());
  const clearAccess = useCallback(() => {
    setItems([]); setDocument(null); documentId.current = null; setNextCursor(null); setLoaded(false);
  }, []);
  const loadPage = useCallback(async (cursor?: string) => {
    const lifetime = epoch.current;
    try {
      const { data } = await api.get<DocumentPage>(`${BASE}/patients/${encodeURIComponent(patientId)}/page`, { params: { limit: 20, ...(cursor ? { cursor } : {}) } });
      if (lifetime !== epoch.current) return;
      setItems(previous => cursor ? appendDocumentPage(previous, data.items) : data.items);
      setNextCursor(data.next_cursor); setCursorExpired(false); setLoaded(true);
    } catch (failure) {
      if (lifetime !== epoch.current) return;
      if ([401, 403].includes(apiErrorStatus(failure) ?? 0)) clearAccess();
      if (cursor && apiErrorStatus(failure) === 422) {
        setCursorExpired(true); throw new Error('A continuação da lista expirou. Recomece a lista para continuar.');
      }
      throw failure;
    }
  }, [patientId, clearAccess]);
  useEffect(() => {
    const lifetime = advanceLifetime();
    void loadPage().catch(failure => {
      if (lifetime === epoch.current) setError(apiErrorMessage(failure, 'Não foi possível carregar os documentos deste paciente. Tente novamente.'));
    }).finally(() => { if (lifetime === epoch.current) setLoading(false); });
    const downloads = urls.current;
    return () => { advanceLifetime(); downloads.forEach(url => URL.revokeObjectURL(url)); downloads.clear(); };
  }, [loadPage, advanceLifetime]);
  const run = async (action: () => Promise<void>) => {
    if (working.current || loading) return;
    const lifetime = epoch.current;
    working.current = true; setBusy(true); setError('');
    try { await action(); }
    catch (failure) {
      if (lifetime === epoch.current) setError(apiErrorMessage(failure, failure instanceof Error ? failure.message : 'Não foi possível concluir. Tente novamente.'));
    } finally { if (lifetime === epoch.current) { working.current = false; setBusy(false); } }
  };
  const open = async (id: string) => {
    const lifetime = epoch.current;
    try {
      const { data } = await api.get<PatientDocument>(`${BASE}/${encodeURIComponent(id)}`);
      if (lifetime !== epoch.current) return;
      if (data.id !== id || data.scan_status !== 'clean') {
        setDocument(null); documentId.current = null;
        throw new Error('O documento não está disponível para consulta clínica. Atualize a lista.');
      }
      setDocument(data); documentId.current = id;
    } catch (failure) {
      if (lifetime !== epoch.current) return;
      if ([401, 403].includes(apiErrorStatus(failure) ?? 0)) clearAccess();
      if ([404, 409].includes(apiErrorStatus(failure) ?? 0)) { setDocument(null); documentId.current = null; }
      throw failure;
    }
  };
  const download = async () => {
    if (!document || document.scan_status !== 'clean') return;
    const lifetime = epoch.current;
    try {
      const { data } = await api.get(`${BASE}/${encodeURIComponent(document.id)}/download`, { responseType: 'blob' });
      if (lifetime !== epoch.current) return;
      const url = URL.createObjectURL(data); urls.current.add(url);
      const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = document.original_filename;
      window.document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url); }, 1000);
    } catch (failure) {
      if (lifetime !== epoch.current) return;
      if ([401, 403].includes(apiErrorStatus(failure) ?? 0)) clearAccess();
      if (apiErrorStatus(failure) === 409) { setDocument(null); documentId.current = null; }
      throw failure;
    }
  };
  return <section className="clinician-panel" aria-label="Documentos do paciente">
    <h2>Documentos do paciente</h2>
    <p>Consulta do original e do texto enviado pelo paciente. A confirmação do paciente não constitui validação clínica e não altera o processo clínico.</p>
    {error && <p role="alert">{error}</p>}
    <button type="button" className="btn btn-outline" disabled={loading || busy} onClick={() => void run(async () => { await loadPage(); if (documentId.current) await open(documentId.current); })}>Atualizar documentos do paciente</button>
    {(loading || busy) && <p role="status">A carregar documentos…</p>}
    {loaded && !items.length && <p>Não há documentos disponíveis para consulta clínica.</p>}
    <ul>{items.map(item => <li key={item.id}>
      <button type="button" className="btn btn-outline" disabled={busy || loading} aria-pressed={document?.id === item.id} onClick={() => void run(() => open(item.id))}>
        {item.original_filename} · {new Date(item.created_at).toLocaleDateString('pt-PT')} · {Math.ceil(item.size_bytes / 1024)} KB
      </button>
    </li>)}</ul>
    {nextCursor && !cursorExpired && <button type="button" className="btn btn-outline" disabled={busy || loading} onClick={() => void run(() => loadPage(nextCursor))}>Carregar mais documentos</button>}
    {cursorExpired && <button type="button" className="btn btn-outline" disabled={busy || loading} onClick={() => void run(() => loadPage())}>Recomeçar lista</button>}
    {document && <article aria-label="Documento aberto" style={{ marginTop: '1rem' }}>
      <h3>{document.original_filename}</h3>
      <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void run(download)}>Descarregar original</button>
      {document.status === 'confirmed' ? <><h4>Texto confirmado pelo paciente</h4><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{document.reviewed_text}</pre></>
        : <p>Este documento não tem texto confirmado pelo paciente{document.status === 'rejected' ? ': a leitura foi rejeitada.' : '.'}</p>}
      {document.extracted_text && <details><summary>Texto extraído automaticamente — requer verificação</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{document.extracted_text}</pre></details>}
      {document.status === 'needs_manual_review' && <p>A leitura automática pode estar incompleta. Consulte todas as páginas do original.</p>}
    </article>}
  </section>;
}
