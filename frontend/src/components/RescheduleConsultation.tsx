import { useEffect, useRef, useState } from 'react';
import api, { getSession } from '../api';
import type { Consultation } from '../types';
import { appointmentWindow, appointmentWindowLabel, formatAppointmentTime, type AppointmentSlot } from '../utils/appointments';
import { apiErrorMessage } from '../utils/apiError';
import { canReschedule, clearReschedule, readReschedule, rescheduleNotCommitted, saveReschedule, type RescheduleAttempt } from '../utils/pendingReschedule';

export default function RescheduleConsultation({ consultation, onClose, onUpdated }: {
  consultation: Consultation; onClose: () => void; onUpdated: (item: Consultation) => void;
}) {
  const owner = getSession()?.userId ?? '';
  const [current, setCurrent] = useState(consultation);
  const [pending, setPending] = useState<RescheduleAttempt | null>(null);
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [selected, setSelected] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [windowIndex, setWindowIndex] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [slotError, setSlotError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [needsReload, setNeedsReload] = useState(false);
  const [saved, setSaved] = useState(false);
  const active = useRef(true);
  const busyRef = useRef(false);
  const anchor = useRef(Date.now());
  const visibleWindow = appointmentWindow(windowIndex, anchor.current);
  const stillOwner = () => active.current && getSession()?.userId === owner;

  useEffect(() => {
    active.current = true;
    try { setPending(readReschedule(owner, consultation.id)); }
    catch { setStorageError('Não foi possível ler a referência da alteração. Verifique o armazenamento antes de continuar.'); }
    return () => { active.current = false; };
  }, [owner, consultation.id]);

  useEffect(() => {
    let valid = true;
    setLoading(true); setSlots([]); setSelected(''); setConfirmed(false); setSlotError('');
    api.get<AppointmentSlot[]>('/api/v1/appointments/slots', { params: {
      country: current.country, doctor_id: current.doctor_id, ...appointmentWindow(windowIndex, anchor.current),
    } }).then(response => {
      if (valid) setSlots(response.data.filter(slot => slot.status === 'open' && slot.doctor_id === current.doctor_id && slot.country === current.country));
    }).catch(() => { if (valid) setSlotError('Não foi possível consultar os horários. Atualize para tentar novamente.'); })
      .finally(() => { if (valid) setLoading(false); });
    return () => { valid = false; };
  }, [current.country, current.doctor_id, windowIndex, refresh]);

  const reload = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const response = await api.get<Consultation[]>('/api/v1/consultations/me', { params: { consultation_id: current.id } });
      if (!stillOwner()) return;
      const item = response.data.find(row => row.id === current.id);
      if (!item) throw new Error('Missing consultation');
      setCurrent(item); onUpdated(item); setNeedsReload(false); setSelected(''); setConfirmed(false); setRefresh(value => value + 1);
    } catch { if (stillOwner()) { setNeedsReload(true); setError('Não foi possível confirmar a marcação atual. Atualize antes de escolher outro horário.'); } }
    finally { busyRef.current = false; if (stillOwner()) setBusy(false); }
  };

  const submit = async () => {
    if (busyRef.current || saved || storageError || (!pending && (!confirmed || !selected || needsReload || !canReschedule(current)))) return;
    const attempt = pending ?? { key: crypto.randomUUID(), payload: { slot_id: selected, expected_revision: current.reschedule_revision! } };
    try { saveReschedule(owner, current.id, attempt); }
    catch { setStorageError('Não foi possível guardar a referência para repetir esta alteração. Nenhum pedido foi enviado.'); return; }
    busyRef.current = true; setBusy(true); setError(''); setPending(attempt);
    try {
      const response = await api.post<Consultation>(`/api/v1/consultations/${encodeURIComponent(current.id)}/reschedule`, attempt.payload,
        { headers: { 'Idempotency-Key': attempt.key } });
      try { clearReschedule(owner, current.id, attempt.key); } catch { /* Retained identity can recover this same move. */ }
      if (!stillOwner()) return;
      setCurrent(response.data); onUpdated(response.data); setPending(null); setSaved(true);
    } catch (failure) {
      if (!stillOwner()) return;
      if (rescheduleNotCommitted(failure)) {
        try { clearReschedule(owner, current.id, attempt.key); setPending(null); }
        catch { setStorageError('Não foi possível limpar a referência. Verifique o armazenamento e recupere o mesmo pedido.'); }
        setSelected(''); setConfirmed(false); setNeedsReload(true);
      }
      setError(apiErrorMessage(failure, 'Não foi possível confirmar a alteração. Recupere o mesmo pedido antes de escolher outro horário.'));
    } finally { busyRef.current = false; if (stillOwner()) setBusy(false); }
  };

  return <div className="modal-overlay"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="reschedule-title" style={{ padding: '1.5rem', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
    <h2 id="reschedule-title">Alterar horário da consulta</h2>
    <p>Horário atual: {current.scheduled_at ? formatAppointmentTime(current.scheduled_at, current.timezone) : 'Por definir'}</p>
    {saved ? <p role="status">{current.status === 'requested' ? 'Alteração guardada. O novo horário aguarda aceitação do médico.' : 'Pedido recuperado. O estado atual da consulta foi atualizado na lista.'}</p> : <>
      <p>Escolha outro horário do mesmo médico. A reserva atual é mantida até a alteração ser guardada. O novo horário precisa de nova aceitação do médico.</p>
      {pending && <p role="status">Existe uma alteração por confirmar. Recupere o mesmo pedido; fechar e voltar a abrir mantém a referência neste separador.</p>}
      {needsReload && !pending && <button className="btn btn-secondary" disabled={busy} onClick={() => void reload()}>Atualizar marcação atual</button>}
      {!pending && !canReschedule(current) && <p role="alert">O estado atual não permite alterar o horário por aqui.</p>}
      <fieldset disabled={busy || !!pending || needsReload || !canReschedule(current)} style={{ border: 0, padding: 0 }}>
        <p>Período: {appointmentWindowLabel(visibleWindow)}</p>
        <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-secondary" disabled={windowIndex === 0 || loading} onClick={() => setWindowIndex(value => value - 1)}>Período anterior</button><button className="btn btn-secondary" disabled={windowIndex >= 5 || loading} onClick={() => setWindowIndex(value => value + 1)}>Período seguinte</button><button className="btn btn-secondary" disabled={loading} onClick={() => { setError(''); setRefresh(value => value + 1); }}>Atualizar horários</button></div>
        {loading ? <p role="status">A carregar horários…</p> : slotError ? <p role="alert">{slotError}</p> : slots.length === 0 ? <p>Sem outros horários publicados neste período.</p> : slots.map(slot => <label key={slot.id} style={{ display: 'flex', gap: 8, margin: '1rem 0' }}>
          <input type="radio" name="reschedule-slot" value={slot.id} checked={selected === slot.id} onChange={() => { setSelected(slot.id); setConfirmed(false); }} />
          <span>{slot.doctor_name}<br />{formatAppointmentTime(slot.starts_at, slot.timezone)} — {formatAppointmentTime(slot.ends_at, slot.timezone)}</span>
        </label>)}
        <label style={{ display: 'block', margin: '1rem 0' }}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Confirmo a troca de horário e que aguarda nova aceitação.</label>
      </fieldset>
      {storageError && <p role="alert">{storageError}</p>}{error && <p role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={busy || !!storageError || (!pending && (loading || needsReload || !selected || !confirmed || !canReschedule(current)))} onClick={() => void submit()}>{busy ? 'A guardar…' : pending ? 'Recuperar alteração' : 'Confirmar novo horário'}</button>
    </>}
    <button className="btn btn-secondary" style={{ margin: '1rem' }} disabled={busy} onClick={onClose}>Fechar</button>
  </section></div>;
}
