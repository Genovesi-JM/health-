import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import api from '../api';
import { Clock, Plus, Trash2 } from 'lucide-react';
import { APPOINTMENT_MARKETS, appointmentError, appointmentWindow, appointmentWindowLabel, clinicOffsetTimestamp, clinicTimeCandidates, formatAppointmentTime, isAppointmentConflict, marketName, marketZones, type AppointmentCapabilities, type AppointmentSlot } from '../utils/appointments';

export default function DoctorAvailabilityPage() {
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [capabilities, setCapabilities] = useState<AppointmentCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState('AO');
  const [timezone, setTimezone] = useState('Africa/Luanda');
  const [local, setLocal] = useState('');
  const [duration, setDuration] = useState(30);
  const [occurrence, setOccurrence] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = useRef(false);
  const loadGeneration = useRef(0);
  const windowAnchor = useRef(Date.now());
  const [windowIndex, setWindowIndex] = useState(0);
  const windowDays = capabilities?.max_window_days ?? 31;
  const visibleWindow = appointmentWindow(windowIndex, windowAnchor.current, windowDays);
  const candidates = useMemo(() => clinicTimeCandidates(local, timezone), [local, timezone]);
  const validDuration = Number.isFinite(duration) && duration >= (capabilities?.slot_duration_minutes.min ?? 15) && duration <= (capabilities?.slot_duration_minutes.max ?? 120);
  const instant = candidates.length === 1 ? candidates[0] : candidates.includes(occurrence) ? occurrence : '';
  const load = async () => {
    const generation = ++loadGeneration.current;
    setLoading(true); setLoadError('');
    const results = await Promise.allSettled([api.get('/api/v1/doctor/appointment-slots', { params: appointmentWindow(windowIndex, windowAnchor.current, windowDays) }), api.get('/api/v1/appointments/capabilities')]);
    if (generation !== loadGeneration.current) return;
    if (results[0].status === 'fulfilled') setSlots(results[0].value.data);
    else setLoadError('Não foi possível carregar os horários publicados. Tente novamente.');
    if (results[1].status === 'fulfilled') setCapabilities(results[1].value.data);
    else { setCapabilities(null); setLoadError('Não foi possível verificar a disponibilidade do agendamento.'); }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [windowIndex]);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (busy.current || !instant || !validDuration || !capabilities?.enabled) return;
    busy.current = true; setSaving(true); setError(''); setNotice('');
    const startsAt = clinicOffsetTimestamp(instant, timezone);
    const endsAt = clinicOffsetTimestamp(new Date(Date.parse(instant) + duration * 60000).toISOString(), timezone);
    try {
      await api.post('/api/v1/doctor/appointment-slots', { starts_at: startsAt, ends_at: endsAt, timezone, country });
      setNotice('Horário publicado. Um pedido reserva o horário, mas só fica confirmado após a sua aceitação.');
      setLocal(''); setOccurrence('');
      const publishedWindow = Math.max(0, Math.floor((Date.parse(instant) - windowAnchor.current) / (windowDays * 86400000)));
      if (publishedWindow !== windowIndex) setWindowIndex(publishedWindow);
      else await load();
    } catch (err) {
      setError(isAppointmentConflict(err) ? 'O horário sobrepõe uma reserva ou outro horário publicado. A lista foi atualizada; reveja a sua escolha.' : appointmentError(err, 'Não foi possível confirmar a publicação. Atualize a lista antes de repetir.'));
      await load();
    } finally { busy.current = false; setSaving(false); }
  };
  const remove = async (slot: AppointmentSlot) => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError(''); setNotice('');
    try {
      await api.delete(`/api/v1/doctor/appointment-slots/${slot.id}`);
      setSlots(previous => previous.map(item => item.id === slot.id ? { ...item, status: 'withdrawn' } : item));
      setNotice('Horário retirado.');
    } catch (err) {
      setError(appointmentError(err, 'Não foi possível retirar o horário. Pode já existir um pedido; atualizámos a lista.'));
      await load();
    } finally { busy.current = false; setSaving(false); }
  };
  const byDate = [...slots].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  return <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
    <h1 style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '1.25rem' }}><Clock size={20} /> Horários de consulta</h1>
    <p>Publique cada consulta com data, duração e fuso horário do atendimento. A disponibilidade semanal antiga não publica horários automaticamente.</p>
    <form onSubmit={add} className="card" style={{ padding: '1.25rem', margin: '1rem 0' }}>
      <fieldset disabled={saving || !capabilities?.enabled || loading} style={{ border: 0, padding: 0, display: 'grid', gap: 12 }}>
        <label>País do atendimento<select className="form-input" value={country} onChange={e => { setCountry(e.target.value); setTimezone(marketZones(e.target.value)[0] ?? ''); setOccurrence(''); }}>{APPOINTMENT_MARKETS.map(code => <option key={code} value={code}>{marketName(code)}</option>)}</select></label>
        <label>Fuso horário<select className="form-input" value={timezone} onChange={e => { setTimezone(e.target.value); setOccurrence(''); }}>{marketZones(country).map(zone => <option key={zone} value={zone}>{zone}</option>)}</select></label>
        <label>Data e hora local<input className="form-input" type="datetime-local" required value={local} onChange={e => { setLocal(e.target.value); setOccurrence(''); setError(''); }} /></label>
        {local && candidates.length === 0 && <p role="alert">Esta hora não existe neste fuso ou a data é inválida. Escolha outra hora.</p>}
        {candidates.length > 1 && <label>Esta hora repete-se na mudança de hora. Escolha a ocorrência<select className="form-input" required value={occurrence} onChange={e => setOccurrence(e.target.value)}><option value="">Selecionar ocorrência…</option>{candidates.map(candidate => <option key={candidate} value={candidate}>{clinicOffsetTimestamp(candidate, timezone)}</option>)}</select></label>}
        <label>Duração em minutos<input className="form-input" type="number" required min={capabilities?.slot_duration_minutes.min ?? 15} max={capabilities?.slot_duration_minutes.max ?? 120} step={5} value={duration} onChange={e => setDuration(Number(e.target.value))} /></label>
        {instant && validDuration && <p>Início: {formatAppointmentTime(instant, timezone)}<br />Fim: {formatAppointmentTime(new Date(Date.parse(instant) + duration * 60000).toISOString(), timezone)}</p>}
        <button className="btn btn-primary" disabled={!instant || saving || !validDuration}><Plus size={15} /> {saving ? 'A guardar…' : 'Publicar horário'}</button>
      </fieldset>
    </form>
    {capabilities && !capabilities.enabled && <p role="alert">A publicação de horários está indisponível.</p>}
    {error && <p role="alert">{error}</p>}{loadError && <p role="alert">{loadError}</p>}{notice && <p role="status">{notice}</p>}
    <button className="btn btn-secondary" disabled={saving || loading} onClick={() => void load()}>Atualizar horários</button>
    <p>Período: {appointmentWindowLabel(visibleWindow)}. Um horário reservado deve ser gerido na agenda; retirá-lo não cancela uma consulta.</p>
    <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}><button className="btn btn-secondary" disabled={loading || saving || windowIndex === 0} onClick={() => setWindowIndex(value => value - 1)}>Período anterior</button><button className="btn btn-secondary" disabled={loading || saving || (windowIndex + 1) * windowDays >= (capabilities?.max_publish_days ?? 180)} onClick={() => setWindowIndex(value => value + 1)}>Período seguinte</button></div>
    {loading ? <p role="status">A carregar horários…</p> : !loadError && byDate.length === 0 ? <p>Ainda não publicou horários neste período.</p> : <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>{byDate.map(slot => <li key={slot.id} className="card" style={{ padding: '1rem', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}><div><strong>{formatAppointmentTime(slot.starts_at, slot.timezone)}</strong><p>{marketName(slot.country)} · {Math.round((Date.parse(slot.ends_at) - Date.parse(slot.starts_at)) / 60000)} min · {slot.status === 'open' ? 'Publicado' : slot.status === 'reserved' ? 'Reservado por pedido ou consulta' : 'Retirado'}</p></div>{slot.status === 'open' && <button className="btn btn-secondary" aria-label={`Retirar ${formatAppointmentTime(slot.starts_at, slot.timezone)}`} disabled={saving} onClick={() => void remove(slot)}><Trash2 size={16} /> Retirar</button>}</li>)}</ul>}
  </div>;
}
