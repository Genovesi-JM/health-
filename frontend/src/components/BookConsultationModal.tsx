import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api, { getSession } from '../api';
import { clearPendingAppointment, readPendingAppointment, savePendingAppointment, type PendingAppointment } from '../utils/pendingAppointment';
import { useT } from '../i18n/LanguageContext';
import type { Consultation, PatientState } from '../types';
import { X, Calendar } from 'lucide-react';
import { SPECIALTY_CODES } from '../constants/specialties';
import { APPOINTMENT_MARKETS, appointmentError, appointmentWindow, appointmentWindowLabel, formatAppointmentTime, isAppointmentConflict, marketName, type AppointmentCapabilities, type AppointmentSlot } from '../utils/appointments';

interface Props {
  open: boolean; onClose: () => void; patientState: PatientState | null;
  onBooked: (consultation: Consultation) => void;
}

export default function BookConsultationModal({ open, onClose, patientState, onBooked }: Props) {
  const { t, lang } = useT();
  const owner = getSession()?.userId || '';
  const activeOwner = useRef(owner);
  activeOwner.current = owner;
  const [specialty, setSpecialty] = useState('');
  const [country, setCountry] = useState('AO');
  const [mode, setMode] = useState<'slots' | 'queue'>('slots');
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [selected, setSelected] = useState('');
  const [doctor, setDoctor] = useState('');
  const [capabilities, setCapabilities] = useState<AppointmentCapabilities | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [capabilityError, setCapabilityError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Consultation | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [windowIndex, setWindowIndex] = useState(0);
  const windowAnchor = useRef(Date.now());
  const windowDays = capabilities?.max_window_days ?? 31;
  const visibleWindow = appointmentWindow(windowIndex, windowAnchor.current, windowDays);
  const busy = useRef(false);
  const request = useRef<{ fingerprint: string; key: string; payload: PendingAppointment['payload'] } | null>(null);

  useEffect(() => {
    if (!open) return;
    setStorageError(''); setUncertain(false); request.current = null; setResult(null); setError('');
    setSelected(''); setDoctor(''); setCountry('AO'); setSpecialty(''); setMode('slots');
    try {
      const pending = readPendingAppointment(owner);
      if (pending) {
        request.current = { ...pending, fingerprint: JSON.stringify(pending.payload) };
        setCountry(pending.payload.country); setSpecialty(pending.payload.specialty);
        setSelected(pending.payload.slot_id || ''); setMode(pending.payload.slot_id ? 'slots' : 'queue');
        setUncertain(true); setError('Existe um pedido por confirmar neste separador. Recupere o mesmo pedido antes de enviar outro.');
      }
    } catch {
      setStorageError('Não foi possível ler a referência do pedido neste separador. Verifique o acesso ao armazenamento antes de enviar.');
    }
  }, [open, owner]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setCapabilities(null); setCapabilityError('');
    api.get('/api/v1/appointments/capabilities').then(r => { if (active) setCapabilities(r.data); })
      .catch(() => { if (active) setCapabilityError('Não foi possível consultar a disponibilidade. Tente novamente.'); });
    return () => { active = false; };
  }, [open, refresh]);

  useEffect(() => {
    if (!open || !specialty || mode !== 'slots') { setSlots([]); setLoading(false); return; }
    let active = true;
    setLoading(true); setLoadError(''); setSlots([]);
    api.get('/api/v1/appointments/slots', { params: { country, specialty, ...appointmentWindow(windowIndex, windowAnchor.current, windowDays) } })
      .then(r => { if (active) setSlots((r.data as AppointmentSlot[]).filter(s => s.status === 'open')); })
      .catch(() => { if (active) setLoadError('Não foi possível carregar os horários. A lista não foi confirmada.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, specialty, country, mode, refresh, windowIndex, windowDays]);

  if (!open) return null;
  const resetSelection = () => { setSelected(''); request.current = null; setError(''); setUncertain(false); };
  const close = () => {
    if (busy.current) return;
    if (result) { onBooked(result); setResult(null); setSpecialty(''); resetSelection(); }
    else onClose(); // Keep an uncertain request and its key available if the dialog is reopened.
  };
  const visibleSlots = slots.filter(s => !doctor || s.doctor_id === doctor);
  const chosen = slots.find(s => s.id === selected);
  const ready = !storageError && Boolean((uncertain && request.current) || (capabilities?.enabled && specialty && (mode === 'queue' || chosen)));
  const submit = async () => {
    if (!ready || busy.current || result) return;
    busy.current = true; setSubmitting(true); setError('');
    const payload: PendingAppointment['payload'] = uncertain && request.current ? request.current.payload : { specialty, country, consent_language: 'pt', ...(mode === 'slots' ? { slot_id: selected } : { next_available: true }),
      ...(patientState?.last_triage_session_id ? { triage_session_id: patientState.last_triage_session_id } : {}) };
    const fingerprint = JSON.stringify(payload);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID(), payload };
    try {
      savePendingAppointment(owner, { key: request.current.key, payload });
    } catch {
      setStorageError('Não foi possível guardar a referência do pedido neste separador. Ative o armazenamento e volte a abrir este formulário.');
      busy.current = false; setSubmitting(false); return;
    }
    try {
      const response = await api.post('/api/v1/consultations/book', payload, { headers: { 'Idempotency-Key': request.current.key } });
      try { clearPendingAppointment(owner); } catch { /* Retained key can only recover this same successful request. */ }
      if (activeOwner.current !== owner) return;
      setResult(response.data); setUncertain(false);
    } catch (err) {
      if (activeOwner.current !== owner) return;
      if (isAppointmentConflict(err)) {
        setError(`${chosen ? `O horário ${formatAppointmentTime(chosen.starts_at, chosen.timezone)} não pôde ser reservado. ` : ''}A disponibilidade mudou. Escolha um horário atualizado antes de enviar um novo pedido.`);
        try { clearPendingAppointment(owner); } catch { setStorageError('Não foi possível limpar a referência do pedido. Verifique o armazenamento.'); }
        setSelected(''); request.current = null; setUncertain(false); setRefresh(v => v + 1);
      } else {
        const status = (err as { response?: { status?: number } })?.response?.status;
        const definitive = !uncertain && status !== undefined && [400, 404, 422].includes(status);
        setUncertain(!definitive);
        if (definitive) { try { clearPendingAppointment(owner); } catch { setStorageError('Não foi possível limpar a referência do pedido. Verifique o armazenamento.'); } }
        setError(appointmentError(err, 'Não foi possível confirmar o envio. Tente novamente com a mesma escolha para recuperar o pedido, sem duplicar.'));
      }
    } finally { busy.current = false; setSubmitting(false); }
  };

  return <div onClick={e => { if (e.target === e.currentTarget) close(); }} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
    <section role="dialog" aria-modal="true" aria-label="Pedir consulta" style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '1.2rem' }}><Calendar size={20} /> Pedir consulta</h2><button type="button" aria-label="Fechar" disabled={submitting} onClick={close} className="btn btn-secondary"><X size={18} /></button></header>
      {result ? <><p role="status">{result.status === 'requested' ? 'Pedido enviado. A consulta aguarda aceitação do médico; ainda não está confirmada.' : `Pedido recuperado. Estado: ${t(`consult.status_${result.status}`)}.`}</p>{result.scheduled_at && <p>{formatAppointmentTime(result.scheduled_at, result.timezone || 'UTC', lang)}</p>}<button className="btn btn-primary" onClick={close}>Ver as minhas consultas</button></> : <>
        <p>Escolha um horário publicado ou envie um pedido sem hora marcada. A consulta só fica confirmada após aceitação do médico.</p>
        {patientState?.last_triage_risk && <p>{t('booking.risk_label')}: {patientState.last_triage_risk}</p>}
        <fieldset disabled={submitting || uncertain} style={{ border: 0, padding: 0, margin: 0 }}>
          <label className="form-label" htmlFor="booking-country">País do atendimento</label>
          <select id="booking-country" className="form-input" value={country} onChange={e => { setCountry(e.target.value); setDoctor(''); resetSelection(); }}>{APPOINTMENT_MARKETS.map(code => <option key={code} value={code}>{marketName(code)}</option>)}</select>
          <p><Link to={`/consents?country=${country}`}>Rever os consentimentos para este país</Link>. O servidor confirma as decisões atuais antes de criar um novo pedido.</p>
          <label className="form-label" htmlFor="booking-specialty">{t('booking.specialty')}</label>
          <select id="booking-specialty" className="form-input" value={specialty} onChange={e => { setSpecialty(e.target.value); setDoctor(''); resetSelection(); }}><option value="">{t('booking.specialty_select')}</option>{SPECIALTY_CODES.map(s => <option key={s} value={s}>{t(`spec.${s}`)}</option>)}</select>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '1rem 0' }}><button type="button" aria-pressed={mode === 'slots'} className="btn btn-secondary" onClick={() => { setMode('slots'); resetSelection(); }}>Escolher horário</button><button type="button" aria-pressed={mode === 'queue'} className="btn btn-secondary" onClick={() => { setMode('queue'); resetSelection(); }}>Pedido sem hora marcada</button></div>
          {mode === 'queue' ? <p>Este pedido entra na fila da especialidade, sem hora reservada nem prazo de resposta garantido. Não é um serviço de emergência.</p> : <>
            <p>Período: {appointmentWindowLabel(visibleWindow)}. Cada horário mostra o fuso do atendimento.</p>
            <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn btn-secondary" disabled={windowIndex === 0 || loading} onClick={() => { setWindowIndex(v => v - 1); resetSelection(); }}>Período anterior</button><button type="button" className="btn btn-secondary" disabled={(windowIndex + 1) * windowDays >= (capabilities?.max_publish_days ?? 180) || loading} onClick={() => { setWindowIndex(v => v + 1); resetSelection(); }}>Período seguinte</button></div>
            {specialty && <><label htmlFor="booking-doctor" className="form-label">Médico</label><select id="booking-doctor" className="form-input" value={doctor} onChange={e => { setDoctor(e.target.value); resetSelection(); }}><option value="">Todos os médicos com horários</option>{[...new Map(slots.map(s => [s.doctor_id, s.doctor_name])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></>}
            {loading ? <p role="status">A carregar horários…</p> : specialty && !loadError && visibleSlots.length === 0 ? <p>Sem horários publicados para esta escolha.</p> : <div role="group" aria-label="Horários publicados" style={{ display: 'grid', gap: 8, margin: '1rem 0' }}>{visibleSlots.map(s => <label key={s.id} className="card" style={{ display: 'flex', gap: 8, padding: 12 }}><input type="radio" name="appointment-slot" value={s.id} checked={selected === s.id} onChange={() => { setSelected(s.id); request.current = null; setError(''); }} /><span>{s.doctor_name}<br />{formatAppointmentTime(s.starts_at, s.timezone, lang)}<br />{Math.round((Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60000)} min</span></label>)}</div>}
          </>}
        </fieldset>
        {!capabilities && !capabilityError && <p role="status">A verificar disponibilidade…</p>}
        {capabilities && !capabilities.enabled && <p role="alert">Os pedidos de consulta estão indisponíveis.</p>}
        {storageError && <p role="alert">{storageError}</p>}{capabilityError && <p role="alert">{capabilityError}</p>}{loadError && <p role="alert">{loadError}</p>}{error && <p role="alert">{error}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: '1rem' }}><button className="btn btn-secondary" disabled={submitting || uncertain} onClick={() => { setSelected(''); setRefresh(v => v + 1); }}>Atualizar horários</button><button className="btn btn-primary" disabled={!ready || submitting || (!uncertain && loading)} onClick={submit}>{submitting ? 'A enviar…' : uncertain ? 'Recuperar pedido' : 'Enviar pedido'}</button></div>
      </>}
    </section>
  </div>;
}
