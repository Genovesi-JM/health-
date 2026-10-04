import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { openServerVideoRoom } from '../utils/video';
import { Calendar, Video, MapPin, ChevronLeft, ChevronRight, Check, X, Plus } from 'lucide-react';
import { useT, type Lang } from '../i18n/LanguageContext';
import { APPOINTMENT_MARKETS, isAppointmentConflict, marketName, marketZones } from '../utils/appointments';

interface Appointment {
  id: string;
  time: string;
  duration: number | null;
  scheduled_at?: string;
  country?: string | null;
  patient: string;
  type: 'teleconsulta' | 'presencial';
  reason: string;
  status: string;   // confirmed | pending | in_progress | completed | cancelled | no_show
}

const LOCALES: Record<Lang, string> = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', zh: 'zh-CN' };

const statusConfig: Record<string, { key: string; color: string; bg: string }> = {
  confirmed:   { key: 'status.confirmed',           color: '#059669', bg: 'rgba(16,185,129,0.1)'  },
  pending:     { key: 'status.pending',             color: '#d97706', bg: 'rgba(234,179,8,0.12)'  },
  in_progress: { key: 'consult.status_in_progress', color: '#0891b2', bg: 'rgba(8,145,178,0.12)'  },
  completed:   { key: 'consult.status_completed',   color: '#6366f1', bg: 'rgba(99,102,241,0.1)'  },
  cancelled:   { key: 'consult.status_cancelled',   color: '#dc2626', bg: 'rgba(239,68,68,0.1)'   },
  no_show:     { key: 'consult.status_no_show',     color: '#dc2626', bg: 'rgba(239,68,68,0.1)'   },
  done:        { key: 'consult.status_completed',   color: '#6366f1', bg: 'rgba(99,102,241,0.1)'  },
};

function buildWeek(anchor: Date): Date[] {
  const day = anchor.getDay();
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
}

export default function DoctorAgendaPage() {
  const { t, lang } = useT();
  const locale = LOCALES[lang] || 'pt-PT';
  const [country, setCountry] = useState('AO');
  const [timezone, setTimezone] = useState('Africa/Luanda');
  const todayFields = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  const today = new Date(Number(todayFields.year), Number(todayFields.month) - 1, Number(todayFields.day));
  const [anchor, setAnchor] = useState(new Date(today));
  const [selected, setSelected] = useState(new Date(today));
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const actionBusy = useRef(false);
  const selectedDate = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(''); setAppts([]);
    api.get('/api/v1/doctor/agenda/today', { params: { date: selectedDate, timezone, country } })
      .then(r => {
        if (!active) return;
        const mapped: Appointment[] = (r.data || []).map((a: any) => ({
          id: a.id,
          time: a.scheduled_at ? new Intl.DateTimeFormat(locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' }).format(new Date(a.scheduled_at)) : a.time,
          duration: a.duration ?? null,
          scheduled_at: a.scheduled_at,
          country: a.country,
          patient: a.patient,
          type: a.type,
          reason: a.reason || '—',
          status: a.status,
        }));
        setAppts(mapped);
      })
      .catch(() => { if (active) setLoadError('Não foi possível carregar a agenda desta data.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedDate, timezone, country, revision, locale]);

  const week = buildWeek(anchor);

  const prevWeek = () => { const d = new Date(anchor); d.setDate(d.getDate() - 7); setAnchor(d); };
  const nextWeek = () => { const d = new Date(anchor); d.setDate(d.getDate() + 7); setAnchor(d); };
  const isToday = (d: Date) => d.toDateString() === today.toDateString();
  const isSelected = (d: Date) => d.toDateString() === selected.toDateString();

  const shownAppts = appts;

  const updateStatus = async (id: string, status: 'confirmed' | 'cancelled') => {
    if (actionBusy.current) return;
    actionBusy.current = true;
    setPendingAction(id);
    setActionError('');
    try {
      const response = status === 'confirmed'
        ? await api.post(`/api/v1/doctor/queue/${id}/accept`)
        : await api.patch(`/api/v1/consultations/${id}`, {});
      const serverStatus = response.data.status === 'scheduled' ? 'confirmed' : response.data.status;
      setAppts(prev => prev.map(a => a.id === id ? { ...a, status: serverStatus } : a));
    } catch (error) {
      setActionError(isAppointmentConflict(error) ? 'O pedido mudou ou o horário já não está disponível. A agenda foi atualizada.' : t('queue.action_error'));
      if (isAppointmentConflict(error)) setRevision(value => value + 1);
    } finally {
      actionBusy.current = false;
      setPendingAction(null);
    }
  };

  // Phase 25: video entry is server-authoritative. The backend join endpoint
  // fails closed (503) unless an approved provider is enabled server-side, and
  // only then returns a room_url built from an unguessable, server-issued key.
  // The client never derives a room from an appointment/consultation id.
  const enterTeleconsult = async (consultationId: string) => {
    try {
      const { data } = await api.post(`/api/v1/teleconsultations/${consultationId}/join`);
      openServerVideoRoom(data.room_url);
    } catch {
      alert(t('teleconsult.unavailable') || 'Teleconsulta indisponível.');
    }
  };

  const confirmed = shownAppts.filter(a => a.status === 'confirmed' || a.status === 'in_progress').length;
  const pending   = shownAppts.filter(a => a.status === 'pending').length;
  const done      = shownAppts.filter(a => a.status === 'completed' || a.status === 'done').length;

  return (
    <div style={{ margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      {actionError && <p role="alert">{actionError}</p>}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={20} style={{ color: 'var(--brand-primary)' }} /> {t('dag.title')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem', textTransform: 'capitalize' }}>
            {selected.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link to="/doctor/disponibilidade" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: '10px', background: 'var(--brand-primary)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer' }}>
          <Plus size={15} /> {t('dag.availability')}
        </Link>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: '1rem' }}>
        <label>País do atendimento<select className="form-input" value={country} onChange={e => { setCountry(e.target.value); setTimezone(marketZones(e.target.value)[0] ?? ''); }}>{APPOINTMENT_MARKETS.map(code => <option key={code} value={code}>{marketName(code)}</option>)}</select></label>
        <label>Fuso horário da agenda<select className="form-input" value={timezone} onChange={e => setTimezone(e.target.value)}>{marketZones(country).map(zone => <option key={zone} value={zone}>{zone}</option>)}</select></label>
        <label>Data da agenda<input className="form-input" type="date" value={selectedDate} onChange={e => { if (!e.target.value) return; const [year, month, day] = e.target.value.split('-').map(Number); const next = new Date(year, month - 1, day); setSelected(next); setAnchor(next); }} /></label>
      </div>
      <p>Horas apresentadas em {timezone}. Os pedidos pendentes precisam da sua aceitação.</p>
      {loadError && <p role="alert">{loadError} <button className="btn btn-secondary" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button></p>}

      {/* Week selector */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
          <button onClick={prevWeek} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.35rem 0.6rem', cursor: 'pointer', color: 'var(--text-muted)' }}><ChevronLeft size={16} /></button>
          <div style={{ display: 'flex', gap: '0.4rem', flex: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            {week.map((d, i) => (
              <button key={i} onClick={() => setSelected(d)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.5rem 0.75rem',
                borderRadius: '10px', border: `1.5px solid ${isSelected(d) ? 'var(--brand-primary)' : 'var(--border)'}`,
                background: isToday(d) && isSelected(d) ? 'var(--brand-primary)' : isSelected(d) ? 'var(--brand-light)' : isToday(d) ? 'rgba(var(--brand-rgb,14,165,233),0.06)' : 'transparent',
                cursor: 'pointer', minWidth: 52,
              }}>
                <span style={{ fontSize: '0.7rem', color: isSelected(d) && isToday(d) ? '#fff' : 'var(--text-muted)', fontWeight: 600, textTransform: 'capitalize' }}>{d.toLocaleDateString(locale, { weekday: 'short' })}</span>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: isSelected(d) && isToday(d) ? '#fff' : isSelected(d) ? 'var(--brand-primary)' : isToday(d) ? 'var(--brand-primary)' : 'var(--text-primary)', marginTop: '0.15rem' }}>{d.getDate()}</span>
                {isToday(d) && <span style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected(d) ? '#fff' : 'var(--brand-primary)', marginTop: '0.2rem' }} />}
              </button>
            ))}
          </div>
          <button onClick={nextWeek} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.35rem 0.6rem', cursor: 'pointer', color: 'var(--text-muted)' }}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Stats row */}
      {!loading && !loadError && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
          {[
            { label: t('dag.confirmed'), val: confirmed, color: '#059669' },
            { label: t('dag.pending'),   val: pending,   color: '#d97706' },
            { label: t('dag.done'),      val: done,       color: '#6366f1' },
          ].map(s => (
            <div key={s.label} className="card" style={{ textAlign: 'center', padding: '0.85rem 0.5rem' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Appointment list */}
      {loading ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : loadError ? null : shownAppts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <Calendar size={36} style={{ display: 'block', margin: '0 auto 0.75rem', color: 'var(--text-muted)' }} />
          <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{t('dag.empty_title')}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{t('dag.empty_desc')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {shownAppts.map(a => {
            const s = statusConfig[a.status] ?? { key: '', color: '#64748b', bg: 'rgba(100,116,139,0.1)' };
            const sLabel = s.key ? t(s.key) : a.status;
            return (
              <div key={a.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', opacity: a.status === 'cancelled' ? 0.5 : 1 }}>
                {/* Time */}
                <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 48 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{a.time}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{a.duration !== null ? `${a.duration} min` : 'Duração por definir'}</div>
                </div>
                {/* Divider */}
                <div style={{ width: 3, height: 40, borderRadius: 99, background: a.type === 'teleconsulta' ? '#3b82f6' : '#10b981', flexShrink: 0 }} />
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{a.patient}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                    {a.type === 'teleconsulta' ? <Video size={12} style={{ color: '#3b82f6' }} /> : <MapPin size={12} style={{ color: '#10b981' }} />}
                    <span style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>{a.type === 'teleconsulta' ? t('appt.teleconsulta') : t('appt.presencial')}</span>
                    {!a.country && <span style={{ fontSize: '.75rem' }}>País não registado</span>}
                    <span style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>· {a.reason}</span>
                  </div>
                </div>
                {/* Status */}
                <span style={{ padding: '0.25rem 0.65rem', borderRadius: 999, background: s.bg, color: s.color, fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>{sLabel}</span>
                {/* Actions */}
                {a.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button disabled={pendingAction !== null} onClick={() => updateStatus(a.id, 'confirmed')} title={t('common.confirm')} style={{ padding: '0.4rem', border: 'none', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', color: '#059669', cursor: 'pointer' }}><Check size={15} /></button>
                    <button disabled={pendingAction !== null} onClick={() => updateStatus(a.id, 'cancelled')} title={t('common.cancel')} style={{ padding: '0.4rem', border: 'none', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', color: '#dc2626', cursor: 'pointer' }}><X size={15} /></button>
                  </div>
                )}
                {(a.status === 'confirmed' || a.status === 'in_progress') && (
                  <button onClick={() => enterTeleconsult(a.id)} style={{ padding: '0.45rem 0.9rem', borderRadius: '8px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1.5px solid rgba(59,130,246,0.3)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Video size={13} /> {t('common.enter')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
