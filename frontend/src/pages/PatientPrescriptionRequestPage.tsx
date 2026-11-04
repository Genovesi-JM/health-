import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { getSession } from '../api';
import { apiErrorMessage } from '../utils/apiError';
import { allConsentEffective, parseConsentState, type ConsentCountry } from '../utils/consent';
import { clearPendingRenewal, verifyCreationReceipt, readPendingRenewal, renewalCountryName, renewalDigest, renewalNotCommitted, renewalStatusLabels, savePendingRenewal } from '../utils/prescriptionRenewals';
import type { PendingRenewal, RenewalCreate, RenewalRequest } from '../utils/prescriptionRenewals';
import { useRenewalRequests } from '../hooks/useRenewalRequests';

interface Doctor { id: string; display_name: string | null; specialization?: string | null; practice_country: ConsentCountry }
const BASE = '/api/v1/prescription-requests';
const uncertain = 'O resultado ainda não foi confirmado. Recupere este pedido antes de enviar outro; uma pesquisa sem resultado não prova que falhou.';

export default function PatientPrescriptionRequestPage() {
  const session = getSession();
  return <PatientRenewals key={`${session?.userId}:${session?.token}`} />;
}
function PatientRenewals() {
  const feed = useRenewalRequests('patient');
  const { capture, config, current, invalidateAccess } = feed;
  const [params] = useSearchParams();
  const [restored] = useState(() => {
    try { return { pending: readPendingRenewal(feed.owner, 'creation'), error: '' }; }
    catch { return { pending: null, error: 'Não foi possível ler a referência de recuperação. Resolva o armazenamento antes de enviar.' }; }
  });
  const [pending, setPending] = useState<PendingRenewal | null>(restored.pending);
  const [storageError, setStorageError] = useState(restored.error);
  const [country, setCountry] = useState<ConsentCountry>(restored.pending?.country ?? 'AO');
  const [doctorId, setDoctorId] = useState(restored.pending?.target ?? '');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorMarket, setDoctorMarket] = useState<ConsentCountry | null>(null);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [doctorError, setDoctorError] = useState('');
  const [medication, setMedication] = useState(() => restored.pending ? '' : (params.get('med') ?? '').slice(0, 300));
  const [dose, setDose] = useState(() => restored.pending ? '' : (params.get('dose') ?? '').slice(0, 100));
  const [frequency, setFrequency] = useState(() => restored.pending ? '' : (params.get('freq') ?? '').slice(0, 100));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [memoryIdentity, setMemoryIdentity] = useState<{ key: string; epoch: number } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [acknowledged, setAcknowledged] = useState<{ request: RenewalRequest; epoch: number } | null>(null);
  const mutation = useRef(false); const discovery = useRef(0); const bodyMemory = useRef<RenewalCreate | null>(null);
  const advanceDiscovery = useCallback(() => ++discovery.current, []);
  useEffect(() => { if (feed.accessLost) { bodyMemory.current = null; advanceDiscovery(); } }, [advanceDiscovery, feed.accessLost]);
  const loadDoctors = useCallback(async () => {
    const active = capture(); if (!active()) return;
    const sequence = ++discovery.current; setLoadingDoctors(true); setDoctorError('');
    try {
      const response = await api.get<Doctor[]>('/api/v1/doctors/', { ...config(), params: { country } });
      if (!active() || sequence !== discovery.current) return;
      if (!Array.isArray(response.data)) throw new Error('Lista de médicos inválida.');
      setDoctors(response.data.filter(item => item.practice_country === country)); setDoctorMarket(country);
    } catch (failure) {
      if (!active() || sequence !== discovery.current) return;
      invalidateAccess(failure); setDoctors([]); setDoctorMarket(null); setDoctorError(apiErrorMessage(failure, 'Não foi possível carregar os médicos deste país. Tente novamente.'));
    } finally { if (active() && sequence === discovery.current) setLoadingDoctors(false); }
  }, [capture, config, country, invalidateAccess]);
  useEffect(() => { void Promise.resolve().then(() => loadDoctors()); return () => { advanceDiscovery(); }; }, [advanceDiscovery, loadDoctors]);

  const restoreStorage = () => {
    if (!current() || mutation.current) return;
    try {
      const saved = readPendingRenewal(feed.owner, 'creation');
      if (saved) { setPending(saved); setCountry(saved.country); setDoctorId(saved.target); bodyMemory.current = null; setMemoryIdentity(null); }
      setStorageError('');
    } catch { setStorageError('Não foi possível ler a referência de recuperação. Nenhum pedido novo foi enviado.'); }
  };
  const finish = (request: RenewalRequest, attempt: PendingRenewal) => {
    setAcknowledged({ request, epoch: feed.accessEpoch }); feed.apply(request);
    clearPendingRenewal(attempt);
    const retained = readPendingRenewal(feed.owner, 'creation'); setPending(retained); bodyMemory.current = null;
    setNotice(`Pedido confirmado. Estado atual: ${renewalStatusLabels[request.status]}.`);
    if (!retained) { setMedication(''); setDose(''); setFrequency(''); setReason(''); setDoctorId(''); }
  };
  const recover = async () => {
    const active = capture(); if (!pending || !active() || mutation.current) return;
    mutation.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const response = await api.get(`${BASE}/requests/${encodeURIComponent(pending.key)}`, config());
      if (!active()) return;
      const received = await verifyCreationReceipt(response.data, pending);
      if (active()) finish(received, pending);
    } catch (failure) { if (active()) { invalidateAccess(failure); setError(`${uncertain} ${apiErrorMessage(failure, '')}`); } }
    finally { if (current()) { mutation.current = false; setBusy(false); } }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const active = capture(); if (!active() || mutation.current || storageError) return;
    mutation.current = true; setBusy(true); setError(''); setNotice('');
    let attempt = pending;
    try {
      const body: RenewalCreate = bodyMemory.current ?? { country, consent_language: 'pt', doctor_id: doctorId,
        medication_name: medication.trim(), dose: dose.trim() || null, frequency: frequency.trim() || null, reason: reason.trim() || null };
      if (!body.medication_name || body.medication_name.length > 300 || !body.doctor_id || (body.dose?.length ?? 0) > 100 || (body.frequency?.length ?? 0) > 100 || (body.reason?.length ?? 0) > 4000) throw new Error('Reveja os campos do pedido.');
      if (!attempt) {
        if (doctorMarket !== country || !doctors.some(item => item.id === doctorId && item.practice_country === country)) throw new Error('Selecione um médico atualmente disponível neste país.');
        const response = await api.get('/api/v1/compliance/consent-state', { ...config(), params: { country, language: 'pt' } });
        if (!active()) return;
        if (!allConsentEffective(parseConsentState(response.data, country))) throw new Error('Reveja os consentimentos atuais deste país antes de enviar um novo pedido.');
      }
      const digest = await renewalDigest(body); if (!active()) return;
      if (attempt && digest !== attempt.digest) throw new Error('O texto não coincide com o pedido original. Reintroduza exatamente os mesmos campos ou recupere o resultado pelo identificador.');
      attempt ??= { owner: feed.owner, kind: 'creation', key: crypto.randomUUID(), digest, country, consent_language: 'pt', target: doctorId };
      try { savePendingRenewal(attempt); }
      catch (failure) { setStorageError('Não foi possível guardar a referência. Nenhum novo envio foi iniciado; verifique o armazenamento.'); throw failure; }
      if (!active()) return;
      setPending(attempt); bodyMemory.current = body; setMemoryIdentity({ key: attempt.key, epoch: feed.accessEpoch });
      const response = await api.post(BASE, body, { headers: { ...config().headers, 'Idempotency-Key': attempt.key } });
      if (!active()) return;
      const received = await verifyCreationReceipt(response.data, attempt);
      if (active()) finish(received, attempt);
    } catch (failure) {
      if (!active()) return;
      invalidateAccess(failure);
      if (attempt && renewalNotCommitted(failure)) {
        try { clearPendingRenewal(attempt); setPending(readPendingRenewal(feed.owner, 'creation')); bodyMemory.current = null; }
        catch { setStorageError('O servidor não registou este pedido, mas a referência local não pôde ser removida. Verifique o armazenamento.'); }
        setError(apiErrorMessage(failure, 'O pedido não foi registado. Reveja os dados e tente novamente.'));
      } else setError(`${attempt ? `${uncertain} ` : ''}${apiErrorMessage(failure, failure instanceof Error ? failure.message : 'Não foi possível confirmar o pedido.')}`);
    } finally { if (current()) { mutation.current = false; setBusy(false); } }
  };
  const locked = !!pending && memoryIdentity?.key === pending.key && memoryIdentity.epoch === feed.accessEpoch;
  const shownDoctors = doctorMarket === country ? doctors : [];
  return <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem' }}>
    <h1>Pedidos de renovação</h1>
    <p>Envie um pedido para avaliação do médico. O envio não constitui uma aprovação ou uma receita.</p>
    {error && <p role="alert">{error}</p>}{notice && !feed.accessLost && <p role="status">{notice}</p>}
    {storageError && <div role="alert">{storageError} <button disabled={busy} onClick={restoreStorage}>Verificar armazenamento</button></div>}
    {feed.accessLost && <p role="alert">O acesso precisa de nova confirmação. Atualize o histórico antes de continuar.</p>}
    {pending && <section className="card" aria-label="Recuperar pedido de renovação">
      <h2>Pedido por confirmar</h2><p>{uncertain}</p><p>{renewalCountryName(pending.country)} · Identificador {pending.key}</p>
      <p>Os textos clínicos não são guardados no armazenamento do navegador. Após reabrir, pode verificar o resultado sem os reintroduzir.</p>
      <button disabled={busy || feed.accessLost || !!storageError} onClick={() => void recover()}>Verificar pedido guardado</button>
    </section>}
    {!feed.accessLost && <form className="card" onSubmit={submit} style={{ display: 'grid', gap: '1rem', padding: '1rem', marginTop: '1rem' }}>
      <h2>{pending ? 'Repetir o pedido original' : 'Novo pedido'}</h2>
      <fieldset disabled={busy || locked || !!storageError} style={{ border: 0, padding: 0, display: 'grid', gap: '.75rem' }}>
        <label>País do pedido<select aria-label="País do pedido" value={country} disabled={!!pending} onChange={event => { advanceDiscovery(); setCountry(event.target.value === 'PT' ? 'PT' : 'AO'); setDoctorId(''); }}><option value="AO">Angola</option><option value="PT">Portugal</option></select></label>
        <Link to={`/consents?country=${country}`}>Rever consentimentos deste país</Link>
        {pending ? <p>Médico do pedido original: {pending.target}</p> : <>
          <label>Médico<select aria-label="Médico" value={doctorId} onChange={event => setDoctorId(event.target.value)} disabled={loadingDoctors} required><option value="">Escolha um médico</option>{shownDoctors.map(item => <option key={item.id} value={item.id}>{item.display_name || 'Médico'}{item.specialization ? ` · ${item.specialization}` : ''}</option>)}</select></label>
          {loadingDoctors && <p>A carregar médicos…</p>}{doctorError && <p role="alert">{doctorError}</p>}{!loadingDoctors && !doctorError && !shownDoctors.length && <p>Não há médicos disponíveis neste país.</p>}
          <button type="button" onClick={() => void loadDoctors()}>Atualizar médicos</button>
        </>}
        <label>Medicamento<input aria-label="Medicamento" value={medication} onChange={event => setMedication(event.target.value)} maxLength={300} required /></label>
        <label>Dose<input aria-label="Dose" value={dose} onChange={event => setDose(event.target.value)} maxLength={100} /></label>
        <label>Frequência<input aria-label="Frequência" value={frequency} onChange={event => setFrequency(event.target.value)} maxLength={100} /></label>
        <label>Motivo<textarea aria-label="Motivo" value={reason} onChange={event => setReason(event.target.value)} maxLength={4000} /></label>
      </fieldset>
      <button type="submit" disabled={busy || !!storageError || (!locked && (!medication.trim() || !doctorId))}>{busy ? 'A confirmar…' : pending ? 'Repetir o mesmo pedido' : 'Enviar pedido para avaliação'}</button>
    </form>}
    {acknowledged && acknowledged.epoch === feed.accessEpoch && !feed.accessLost && <p>Último pedido confirmado: {acknowledged.request.medication_name} · {renewalStatusLabels[acknowledged.request.status]}</p>}
    <h2>Histórico de pedidos</h2><p>Os estados abaixo refletem os pedidos carregados; não indicam entrega numa farmácia ou numa rede externa.</p>
    <button disabled={busy || feed.loading} onClick={() => void feed.load()}>Atualizar histórico</button>
    {feed.error && <p role="alert">{feed.error}</p>}{feed.loading && <p>A carregar pedidos…</p>}
    {feed.loaded && !feed.loading && !feed.items.length && <p>Não há pedidos neste histórico.</p>}
    {feed.items.map(item => <article key={item.id} className="card" style={{ padding: '1rem', marginTop: '.75rem' }}>
      <h3>{item.medication_name}</h3><p>{[item.dose, item.frequency].filter(Boolean).join(' · ')}</p>
      <p>{renewalStatusLabels[item.status]} · {renewalCountryName(item.country)} · {new Date(item.created_at).toLocaleString('pt-PT')}</p>
      {item.doctor_name && <p>Médico: {item.doctor_name}</p>}{item.reason && <p>Motivo: {item.reason}</p>}
      {item.doctor_note && <p>Nota do médico: {item.doctor_note}</p>}{(item.adjusted_dose || item.adjusted_frequency) && <p>Ajuste registado: {[item.adjusted_dose, item.adjusted_frequency].filter(Boolean).join(' · ')}</p>}
      {item.decision_state === 'legacy_review_required' && <p>Registo anterior: requer revisão antes de uma nova decisão.</p>}
    </article>)}
    {feed.nextCursor && <button disabled={busy || feed.loading || feed.restartRequired} onClick={() => void feed.load(feed.nextCursor!)}>Carregar mais pedidos</button>}
  </div>;
}
