import { useEffect, useRef, useState } from 'react';
import api, { getSession } from '../api';
import { apiErrorMessage } from '../utils/apiError';
import { useRenewalRequests } from '../hooks/useRenewalRequests';
import { canDecideRenewal, clearPendingRenewal, verifyDecisionReceipt, readPendingRenewal, renewalActionLabels, renewalActions, renewalCountryName, renewalDigest, renewalNotCommitted, renewalStatusLabels, savePendingRenewal } from '../utils/prescriptionRenewals';
import type { PendingRenewal, RenewalAction, RenewalDecisionBody, RenewalRequest } from '../utils/prescriptionRenewals';

const BASE = '/api/v1/doctor/prescription-requests';
const uncertain = 'A decisão ainda não foi confirmada. Recupere o resultado antes de decidir novamente; um erro ou uma pesquisa sem resultado não prova que falhou.';
export default function DoctorPrescriptionsPage() {
  const session = getSession();
  return <DoctorRenewals key={`${session?.userId}:${session?.token}`} />;
}
function DoctorRenewals() {
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const feed = useRenewalRequests('doctor', filter);
  const [restored] = useState(() => {
    try { return { pending: readPendingRenewal(feed.owner, 'decision'), error: '' }; }
    catch { return { pending: null, error: 'Não foi possível ler a referência guardada. Resolva o armazenamento antes de decidir.' }; }
  });
  const [pending, setPending] = useState<PendingRenewal | null>(restored.pending);
  const [storageError, setStorageError] = useState(restored.error);
  const [selected, setSelected] = useState<{ request: RenewalRequest; epoch: number } | null>(null);
  const [action, setAction] = useState<RenewalAction | ''>('');
  const [note, setNote] = useState('');
  const [adjustedDose, setAdjustedDose] = useState('');
  const [adjustedFrequency, setAdjustedFrequency] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [acknowledged, setAcknowledged] = useState<{ request: RenewalRequest; epoch: number } | null>(null);
  const [memoryIdentity, setMemoryIdentity] = useState<{ key: string; epoch: number } | null>(null);
  const mutation = useRef(false); const bodyMemory = useRef<RenewalDecisionBody | null>(null);
  useEffect(() => { if (feed.accessLost) bodyMemory.current = null; }, [feed.accessLost]);
  const request = selected?.epoch === feed.accessEpoch ? selected.request : null;
  const locked = !!pending && memoryIdentity?.key === pending.key && memoryIdentity.epoch === feed.accessEpoch;
  const restoreStorage = () => {
    if (!feed.current() || mutation.current) return;
    try { const saved = readPendingRenewal(feed.owner, 'decision'); if (saved) { setPending(saved); bodyMemory.current = null; setMemoryIdentity(null); } setStorageError(''); }
    catch { setStorageError('Não foi possível ler a referência. Nenhuma nova decisão foi enviada.'); }
  };
  const finish = (receipt: Awaited<ReturnType<typeof verifyDecisionReceipt>>, attempt: PendingRenewal) => {
    feed.apply(receipt.request); setAcknowledged({ request: receipt.request, epoch: feed.accessEpoch });
    clearPendingRenewal(attempt); setPending(readPendingRenewal(feed.owner, 'decision')); bodyMemory.current = null;
    setNotice(`Decisão confirmada. Estado atual: ${renewalStatusLabels[receipt.request.status]}.`);
    setSelected(null); setAction(''); setNote(''); setAdjustedDose(''); setAdjustedFrequency('');
  };
  const recover = async () => {
    const active = feed.capture(); if (!pending || !active() || mutation.current) return;
    mutation.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const response = await api.get(`${BASE}/decisions/${encodeURIComponent(pending.key)}`, feed.config());
      if (!active()) return;
      const received = await verifyDecisionReceipt(response.data, pending);
      if (active()) finish(received, pending);
    } catch (failure) { if (active()) { feed.invalidateAccess(failure); setError(`${uncertain} ${apiErrorMessage(failure, failure instanceof Error ? failure.message : '')}`); } }
    finally { if (feed.current()) { mutation.current = false; setBusy(false); } }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const active = feed.capture(); if (!active() || mutation.current || storageError || (!pending && (!request || !canDecideRenewal(request)))) return;
    mutation.current = true; setBusy(true); setError(''); setNotice('');
    let attempt = pending;
    try {
      const body: RenewalDecisionBody = bodyMemory.current ?? { action: action as RenewalAction, expected_revision: request?.revision ?? 0,
        doctor_note: note.trim() || null, adjusted_dose: action === 'adjust' ? adjustedDose.trim() || null : null,
        adjusted_frequency: action === 'adjust' ? adjustedFrequency.trim() || null : null };
      if (!renewalActions.includes(body.action) || (body.doctor_note?.length ?? 0) > 4000 || (body.adjusted_dose?.length ?? 0) > 100 || (body.adjusted_frequency?.length ?? 0) > 100) throw new Error('Reveja os campos da decisão.');
      const digest = await renewalDigest(body); if (!active()) return;
      if (attempt && digest !== attempt.digest) throw new Error('O texto e a ação não coincidem com a decisão original. Reintroduza exatamente os mesmos campos ou verifique o resultado guardado.');
      if (!attempt) {
        if (!request?.country || !canDecideRenewal(request)) throw new Error('Atualize e reveja o pedido antes de decidir.');
        attempt = { owner: feed.owner, kind: 'decision', key: crypto.randomUUID(), digest, country: request.country, consent_language: 'pt', target: request.id };
      }
      try { savePendingRenewal(attempt); }
      catch (failure) { setStorageError('Não foi possível guardar a referência. Nenhuma nova decisão foi enviada; verifique o armazenamento.'); throw failure; }
      if (!active()) return;
      setPending(attempt); bodyMemory.current = body; setMemoryIdentity({ key: attempt.key, epoch: feed.accessEpoch });
      const response = await api.post(`${BASE}/${encodeURIComponent(attempt.target)}/decide`, body, { headers: { ...feed.config().headers, 'Idempotency-Key': attempt.key } });
      if (!active()) return;
      const received = await verifyDecisionReceipt(response.data, attempt);
      if (active()) finish(received, attempt);
    } catch (failure) {
      if (!active()) return;
      feed.invalidateAccess(failure);
      if (attempt && renewalNotCommitted(failure)) {
        try { clearPendingRenewal(attempt); setPending(readPendingRenewal(feed.owner, 'decision')); bodyMemory.current = null; setMemoryIdentity(null); }
        catch { setStorageError('O servidor não registou a decisão, mas a referência local não pôde ser removida. Verifique o armazenamento.'); }
        setError(apiErrorMessage(failure, 'A decisão não foi registada. Atualize o pedido antes de decidir.')); setSelected(null); void feed.load();
      } else setError(`${attempt ? `${uncertain} ` : ''}${apiErrorMessage(failure, failure instanceof Error ? failure.message : 'Não foi possível confirmar a decisão.')}`);
    } finally { if (feed.current()) { mutation.current = false; setBusy(false); } }
  };
  return <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>
    <h1>Pedidos de renovação recebidos</h1>
    <p>A lista contém os dados de cada pedido atribuído. Uma decisão guardada na Kaya não confirma envio a uma farmácia ou a uma rede externa.</p>
    {error && <p role="alert">{error}</p>}{notice && !feed.accessLost && <p role="status">{notice}</p>}
    {storageError && <div role="alert">{storageError} <button disabled={busy} onClick={restoreStorage}>Verificar armazenamento</button></div>}
    {feed.accessLost && <p role="alert">O acesso precisa de nova confirmação. Atualize a lista antes de continuar.</p>}
    {pending && <section className="card" aria-label="Recuperar decisão de renovação">
      <h2>Decisão por confirmar</h2><p>{uncertain}</p><p>{renewalCountryName(pending.country)} · Pedido {pending.target} · Identificador {pending.key}</p>
      <p>As notas clínicas não são guardadas no armazenamento do navegador. Pode verificar o resultado sem as reintroduzir.</p>
      <button disabled={busy || feed.accessLost || !!storageError} onClick={() => void recover()}>Verificar decisão guardada</button>
    </section>}
    {!feed.accessLost && (pending || request) && <form className="card" onSubmit={submit} style={{ padding: '1rem', margin: '1rem 0', display: 'grid', gap: '.75rem' }}>
      <h2>{pending ? 'Repetir a decisão original' : `Decidir pedido de ${request?.medication_name}`}</h2>
      {request && <p>{[request.dose, request.frequency].filter(Boolean).join(' · ')} · {renewalCountryName(request.country)} · Revisão {request.revision}</p>}
      <fieldset disabled={busy || locked || !!storageError} style={{ border: 0, padding: 0, display: 'grid', gap: '.75rem' }}>
        <label>Ação<select aria-label="Ação" value={action} onChange={event => setAction(event.target.value as RenewalAction | '')} required><option value="">Escolha a decisão</option>{renewalActions.map(item => <option key={item} value={item}>{renewalActionLabels[item]}</option>)}</select></label>
        <label>Nota clínica<textarea aria-label="Nota clínica" value={note} onChange={event => setNote(event.target.value)} maxLength={4000} /></label>
        {action === 'adjust' && <><label>Dose ajustada<input aria-label="Dose ajustada" value={adjustedDose} onChange={event => setAdjustedDose(event.target.value)} maxLength={100} /></label>
          <label>Frequência ajustada<input aria-label="Frequência ajustada" value={adjustedFrequency} onChange={event => setAdjustedFrequency(event.target.value)} maxLength={100} /></label></>}
      </fieldset>
      <button disabled={busy || !!storageError || (!locked && !action)} type="submit">{busy ? 'A confirmar…' : pending ? 'Repetir a mesma decisão' : 'Confirmar decisão'}</button>
      {!pending && <button type="button" disabled={busy} onClick={() => { setSelected(null); setAction(''); setNote(''); setAdjustedDose(''); setAdjustedFrequency(''); }}>Descartar rascunho</button>}
    </form>}
    {acknowledged && acknowledged.epoch === feed.accessEpoch && !feed.accessLost && <section className="card" aria-label="Decisão confirmada">
      <h2>{renewalStatusLabels[acknowledged.request.status]}: {acknowledged.request.medication_name}</h2>
      {acknowledged.request.doctor_note && <p>{acknowledged.request.doctor_note}</p>}
      {acknowledged.request.standalone_prescription_id && <p>O registo da receita foi criado na Kaya.</p>}
    </section>}
    <h2>Histórico atribuído</h2>
    <label>Estado<select aria-label="Estado" value={filter} disabled={busy} onChange={event => setFilter(event.target.value === 'all' ? 'all' : 'pending')}><option value="pending">Pendentes</option><option value="all">Todos os estados</option></select></label>{' '}
    <button disabled={busy || feed.loading} onClick={() => void feed.load()}>Atualizar pedidos</button>
    {feed.error && <p role="alert">{feed.error}</p>}{feed.loading && <p>A carregar pedidos…</p>}
    {feed.loaded && !feed.loading && !feed.items.length && <p>Não há pedidos neste filtro.</p>}
    <p>{feed.items.length} pedidos carregados{feed.nextCursor ? '; existem mais páginas.' : '.'}</p>
    {feed.items.map(item => <article key={item.id} className="card" style={{ marginTop: '.75rem', padding: '1rem' }}>
      <h3>{item.medication_name}</h3><p>{item.patient_name || 'Paciente'} · {renewalCountryName(item.country)} · {new Date(item.created_at).toLocaleString('pt-PT')}</p>
      <p>{[item.dose, item.frequency].filter(Boolean).join(' · ')}</p>{item.reason && <p>Motivo: {item.reason}</p>}
      <p>Estado: {renewalStatusLabels[item.status]}</p>{item.doctor_note && <p>Nota: {item.doctor_note}</p>}
      {canDecideRenewal(item) ? <button disabled={busy || !!pending || !!request || !!storageError} onClick={() => { setSelected({ request: item, epoch: feed.accessEpoch }); setAction(''); setNote(''); setAdjustedDose(''); setAdjustedFrequency(''); }}>Rever decisão — {item.medication_name}</button>
        : item.decision_state === 'legacy_review_required' && <p>Registo anterior: requer revisão explícita. Não é possível decidir neste fluxo.</p>}
    </article>)}
    {feed.nextCursor && <button disabled={busy || feed.loading || feed.restartRequired} onClick={() => void feed.load(feed.nextCursor!)}>Carregar mais pedidos</button>}
  </div>;
}
