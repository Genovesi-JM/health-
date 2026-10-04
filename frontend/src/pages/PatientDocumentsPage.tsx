import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileText, RefreshCw, Upload } from 'lucide-react';
import api from '../api';

const BASE = '/api/v1/patient-documents';
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
type Status = 'pending_processing' | 'ready_for_review' | 'needs_manual_review' | 'confirmed' | 'rejected' | 'blocked' | 'processing_failed';
type PatientDocument = {
  id: string; original_filename: string; content_type: string; size_bytes: number;
  status: Status; scan_status: string; version: number; extraction_method: string | null;
  extracted_text: string | null; reviewed_text: string | null; created_at: string;
  reviewed_at: string | null; error_code: string | null;
};
type Capabilities = { upload_enabled: boolean; max_bytes: number; accepted_types: string[]; extraction: string; message?: string };
const STATUS_LABELS: Record<Status, string> = {
  pending_processing: 'A aguardar leitura', ready_for_review: 'Rever texto',
  needs_manual_review: 'Revisão manual necessária', confirmed: 'Texto confirmado por si',
  rejected: 'Leitura rejeitada', blocked: 'Ficheiro bloqueado', processing_failed: 'Leitura não concluída',
};
function errorMessage(error: unknown, fallback: string) {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string') return detail.message;
  return fallback;
}
function isConflict(error: unknown) { return (error as { response?: { status?: number } })?.response?.status === 409; }
function defaultText(doc: PatientDocument) { return doc.reviewed_text ?? doc.extracted_text ?? ''; }
function manualReviewMessage(doc: PatientDocument) {
  if (doc.error_code === 'partial_text_requires_ocr' || doc.extracted_text) return 'Só parte do documento pôde ser lida. Verifique todas as páginas do original e complete o texto em falta antes de confirmar.';
  if (doc.error_code === 'encrypted_pdf') return 'Este PDF está protegido e não pôde ser lido automaticamente. Pode transcrever o conteúdo a partir do original, ou rejeitar esta leitura.';
  if (['page_limit', 'text_limit'].includes(doc.error_code ?? '')) return 'O documento excede o limite de leitura automática. Verifique todas as páginas do original antes de transcrever o texto, ou rejeite esta leitura.';
  return 'Não foi possível obter texto automaticamente. Pode transcrever o conteúdo do original e revê-lo, ou rejeitar esta leitura.';
}

export default function PatientDocumentsPage() {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const uploadKey = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const downloadUrls = useRef(new Set<string>());
  const lifetime = useRef(0);
  const advanceLifetime = useCallback(() => ++lifetime.current, []);
  const doc = documents.find(item => item.id === selectedId) ?? null;
  const text = doc ? drafts[doc.id] ?? defaultText(doc) : '';
  const canReview = doc?.scan_status === 'clean' && ['ready_for_review', 'needs_manual_review'].includes(doc.status);
  const canProcess = doc && ['pending_processing', 'processing_failed'].includes(doc.status);

  const replaceDocument = (updated: PatientDocument) => {
    setDocuments(previous => [updated, ...previous.filter(item => item.id !== updated.id)]);
  };
  const load = async () => {
    const version = lifetime.current;
    const [capabilityResult, documentResult] = await Promise.allSettled([
      api.get<Capabilities>(`${BASE}/capabilities`), api.get<PatientDocument[]>(BASE),
    ]);
    if (version !== lifetime.current) return;
    const failures: string[] = [];
    if (capabilityResult.status === 'fulfilled') setCapabilities(capabilityResult.value.data);
    else { setCapabilities(null); failures.push('Não foi possível verificar a disponibilidade do envio.'); }
    if (documentResult.status === 'fulfilled') {
      setDocuments(documentResult.value.data);
      setListLoaded(true);
      setSelectedId(previous => documentResult.value.data.some(item => item.id === previous) ? previous : documentResult.value.data[0]?.id ?? null);
    } else failures.push('Não foi possível carregar os documentos. Tente atualizar.');
    if (failures.length) setError(failures.join(' '));
  };
  useEffect(() => {
    const version = advanceLifetime();
    void load().finally(() => { if (version === lifetime.current) setLoading(false); });
    const urls = downloadUrls.current;
    return () => { advanceLifetime(); urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); };
  }, [advanceLifetime]);

  const run = async (name: string, action: () => Promise<void>) => {
    if (busyRef.current) return;
    const version = lifetime.current;
    busyRef.current = true; setBusy(name); setError(''); setNotice('');
    try { await action(); }
    catch (e) { if (version === lifetime.current) setError(errorMessage(e, 'Não foi possível concluir. Os seus dados introduzidos foram mantidos; tente novamente.')); }
    finally { if (version === lifetime.current) { busyRef.current = false; setBusy(''); } }
  };
  const reloadConflict = async (id: string) => {
    const version = lifetime.current;
    try {
      const response = await api.get<PatientDocument>(`${BASE}/${id}`);
      if (version !== lifetime.current) return;
      replaceDocument(response.data);
      setError('O documento mudou noutra sessão. Carregámos a versão atual e mantivemos o seu texto. Compare-o antes de voltar a guardar.');
    } catch {
      if (version !== lifetime.current) return;
      setError('O documento mudou noutra sessão. Não foi possível carregar a versão atual. O seu texto foi mantido; atualize antes de voltar a guardar.');
    }
  };
  const processDocument = async (item: PatientDocument) => {
    const version = lifetime.current;
    try {
      const response = await api.post<PatientDocument>(`${BASE}/${item.id}/process`, { version: item.version });
      if (version !== lifetime.current) return;
      replaceDocument(response.data);
      setNotice(response.data.status === 'ready_for_review' ? 'Leitura concluída. Reveja o texto antes de confirmar.' : 'Estado do documento atualizado.');
    } catch (e) {
      if (version !== lifetime.current) return;
      if (isConflict(e)) await reloadConflict(item.id);
      else setError(errorMessage(e, 'O documento está guardado, mas a leitura não foi concluída. Pode tentar ler novamente.'));
    }
  };
  const chooseFile = (picked: File | undefined) => {
    if (!picked) return;
    setError(''); setNotice('');
    if (!ACCEPTED_TYPES.includes(picked.type) || !capabilities?.accepted_types.includes(picked.type)) { setError('Escolha um ficheiro PDF, JPG ou PNG permitido para envio.'); return; }
    if (picked.size === 0 || picked.size > Math.min(capabilities?.max_bytes ?? 10485760, 10485760)) {
      setError('O ficheiro deve ter conteúdo e não pode exceder 10 MB.'); return;
    }
    if (!file || picked.name !== file.name || picked.size !== file.size || picked.lastModified !== file.lastModified || picked.type !== file.type) {
      uploadKey.current = crypto.randomUUID();
      setConsent(false);
    }
    setFile(picked);
  };
  const upload = () => run('upload', async () => {
    if (!file || !consent || !capabilities?.upload_enabled) return;
    const version = lifetime.current;
    uploadKey.current ??= crypto.randomUUID();
    const form = new FormData(); form.append('file', file); form.append('processing_consent', 'true');
    const response = await api.post<PatientDocument>(BASE, form, {
      headers: { 'Content-Type': 'multipart/form-data', 'Idempotency-Key': uploadKey.current },
    });
    if (version !== lifetime.current) return;
    const uploaded = response.data;
    replaceDocument(uploaded); setSelectedId(uploaded.id);
    setFile(null); uploadKey.current = null; setConsent(false);
    if (fileInput.current) fileInput.current.value = '';
    setNotice('Documento guardado.');
    if (uploaded.status === 'pending_processing') await processDocument(uploaded);
  });
  const review = (decision: 'confirm' | 'reject') => run('review', async () => {
    if (!doc || !canReview || (decision === 'confirm' && !text.trim())) return;
    const version = lifetime.current;
    try {
      const response = await api.put<PatientDocument>(`${BASE}/${doc.id}/review`, { version: doc.version, decision, text });
      if (version !== lifetime.current) return;
      replaceDocument(response.data);
      setDrafts(previous => { const next = { ...previous }; delete next[doc.id]; return next; });
      setNotice(decision === 'confirm' ? 'O texto revisto foi guardado.' : 'A leitura foi rejeitada. O documento original foi mantido.');
    } catch (e) {
      if (version !== lifetime.current) return;
      if (isConflict(e)) await reloadConflict(doc.id);
      else throw e;
    }
  });
  const download = () => run('download', async () => {
    if (!doc || doc.scan_status !== 'clean') return;
    const version = lifetime.current;
    const response = await api.get(`${BASE}/${doc.id}/download`, { responseType: 'blob' });
    if (version !== lifetime.current) return;
    const url = URL.createObjectURL(response.data); downloadUrls.current.add(url);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = doc.original_filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.current.delete(url); }, 1000);
  });

  return <>
    <div className="page-header"><h1>Os meus documentos</h1><p>Guarde e reveja o texto dos seus documentos de saúde.</p></div>
    <p>O texto confirmado fica associado ao documento. Esta revisão não confirma um diagnóstico e não altera os seus medicamentos ou o processo clínico.</p>
    {error && <div role="alert" style={{ color: '#b91c1c', margin: '1rem 0' }}>{error}</div>}
    {notice && <div role="status" style={{ margin: '1rem 0', color: '#047857' }}>{notice}</div>}
    <button className="btn btn-outline" disabled={!!busy || loading} onClick={() => void run('refresh', load)}><RefreshCw size={16} /> Atualizar documentos</button>
    {loading ? <p role="status">A carregar documentos…</p> : <>
      <section className="card" aria-labelledby="upload-title" style={{ padding: '1.25rem', margin: '1rem 0' }}>
        <h2 id="upload-title">Adicionar documento</h2>
        <p>PDF, JPG ou PNG, até 10 MB. A leitura automática reconhece texto já existente em PDF. Fotografias e documentos digitalizados precisam de revisão manual.</p>
        {!capabilities?.upload_enabled && <p role="status">O envio de documentos está temporariamente indisponível. Pode consultar os documentos já guardados.</p>}
        <fieldset disabled={!!busy || !capabilities?.upload_enabled} style={{ border: 0, padding: 0 }}>
          <label htmlFor="patient-document-file">Ficheiro</label><br />
          <input id="patient-document-file" ref={fileInput} type="file" accept={ACCEPTED_TYPES.join(',')} onChange={event => chooseFile(event.target.files?.[0])} />
          {file && <p>Selecionado: {file.name}</p>}
          <label style={{ display: 'block', margin: '1rem 0' }}><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> Autorizo o armazenamento e a leitura deste documento para o rever na minha conta.</label>
          <button className="btn btn-primary" disabled={!file || !consent} onClick={() => void upload()}><Upload size={16} /> {busy === 'upload' ? 'A enviar…' : 'Enviar e ler documento'}</button>
        </fieldset>
      </section>
      <section aria-labelledby="documents-title"><h2 id="documents-title">Documentos guardados</h2>
        {listLoaded && documents.length === 0 && <p>Ainda não há documentos guardados.</p>}
        <ul style={{ listStyle: 'none', padding: 0 }}>{documents.map(item => <li key={item.id} style={{ marginBottom: '.5rem' }}>
          <button className="btn btn-outline" aria-pressed={selectedId === item.id} disabled={!!busy} onClick={() => { setSelectedId(item.id); setError(''); setNotice(''); }}>
            <FileText size={16} /> {item.original_filename} — {STATUS_LABELS[item.status] ?? 'Estado desconhecido'}
          </button>
        </li>)}</ul>
      </section>
      {doc && <section className="card" aria-labelledby="review-title" style={{ padding: '1.25rem', margin: '1rem 0' }}>
        <h2 id="review-title">{doc.original_filename}</h2>
        <p>{STATUS_LABELS[doc.status] ?? 'Estado desconhecido'} · {Math.ceil(doc.size_bytes / 1024)} KB</p>
        <button className="btn btn-outline" disabled={!!busy || doc.scan_status !== 'clean'} onClick={() => void download()}><Download size={16} /> Descarregar original</button>
        {doc.scan_status !== 'clean' && <p>O original fica indisponível até concluir a verificação de segurança.</p>}
        {doc.status === 'blocked' && <p>Não é possível ler ou descarregar este ficheiro.</p>}
        {canProcess && <button className="btn btn-primary" disabled={!!busy} onClick={() => void run('process', () => processDocument(doc))}>Ler documento</button>}
        {doc.status === 'processing_failed' && <p>A leitura não foi concluída. O documento continua guardado; tente novamente.</p>}
        {doc.status === 'needs_manual_review' && <p>{manualReviewMessage(doc)}</p>}
        {doc.scan_status === 'clean' && doc.extracted_text && <details><summary>Texto obtido do original</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{doc.extracted_text}</pre></details>}
        {canReview && <>
          <label htmlFor="document-reviewed-text" style={{ display: 'block', marginTop: '1rem' }}>Texto para rever</label>
          <textarea id="document-reviewed-text" className="form-input" rows={12} value={text} maxLength={100000} disabled={!!busy} onChange={event => setDrafts(previous => ({ ...previous, [doc.id]: event.target.value }))} />
          <p>Compare com o original e corrija nomes, datas, números e unidades antes de guardar.</p>
          {drafts[doc.id] !== undefined && <p>As suas alterações ainda não foram guardadas. Pode alternar entre documentos; sair desta página perde o texto por guardar.</p>}
          <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={!!busy || !text.trim()} onClick={() => void review('confirm')}>{busy === 'review' ? 'A guardar…' : 'Confirmar texto revisto'}</button>
            <button className="btn btn-outline" disabled={!!busy} onClick={() => void review('reject')}>Rejeitar leitura</button>
          </div>
        </>}
        {!canReview && drafts[doc.id] !== undefined && <><h3>O seu texto ainda não guardado</h3><p>A versão atual já não aceita revisão. Copie o seu texto se precisar de o conservar.</p><textarea aria-label="Texto local não guardado" rows={8} readOnly value={drafts[doc.id]} className="form-input" /></>}
        {doc.status === 'confirmed' && <><h3>Texto confirmado por si</h3><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{doc.reviewed_text}</pre><p>Esta confirmação regista a sua revisão do documento; não é uma validação clínica.</p></>}
        {doc.status === 'rejected' && <p>A leitura não será usada como texto confirmado.</p>}
      </section>}
    </>}
  </>;
}
