import { Video, PhoneOff, Loader2, CalendarClock, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import TeleconsultationControl from '../components/TeleconsultationControl';
import { useT } from '../i18n/LanguageContext';

type AgendaItem = {
  id: string;
  time: string;
  patient: string;
  patient_id?: string | null;
  type: string;
  specialty?: string | null;
  reason?: string | null;
  status: string;
  avatar: string;
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  done: { bg: 'rgba(99,102,241,0.1)', color: '#6366f1' },
  next: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
  pending: { bg: 'rgba(234,179,8,0.1)', color: '#d97706' },
};

function statusKey(status: string): 'done' | 'next' | 'pending' {
  const s = (status || '').toLowerCase();
  if (s.includes('conclu') || s.includes('done') || s.includes('complet')) return 'done';
  if (s.includes('curso') || s.includes('progress') || s.includes('seguir') || s.includes('agora')) return 'next';
  return 'pending';
}

export default function DoctorLivePage() {
  const { t } = useT();
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AgendaItem | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError('');
      try {
        const res = await api.get('/api/v1/doctor/agenda/today');
        if (active) setAgenda(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (active) setError(t('dlive.load_error'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nextConsult = useMemo(
    () => agenda.find(a => statusKey(a.status) !== 'done') ?? agenda[0] ?? null,
    [agenda],
  );

  // ── In an embedded call ──────────────────────────────────────────────────
  if (roomUrl && selected) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#dc2626' }}>●</span> {selected.patient} · {selected.time}
          </div>
          <button
            onClick={() => { setRoomUrl(null); setSelected(null); }}
            style={{ padding: '0.55rem 1.2rem', borderRadius: '10px', background: '#dc2626', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <PhoneOff size={16} /> {t('dlive.end')}
          </button>
        </div>
        <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)', background: '#1e1e2e', aspectRatio: '16/9' }}>
          <iframe
            title={`${t('appt.teleconsulta')} — ${selected.patient}`}
            src={roomUrl}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.75rem', textAlign: 'center' }}>
          {t('dlive.room_note')}
        </p>
      </div>
    );
  }

  // ── Preparing a selected consultation (device test / check-in / start) ────
  if (selected) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <button
          onClick={() => setSelected(null)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.82rem', cursor: 'pointer', padding: 0, marginBottom: '1rem' }}
        >
          ← {t('dlive.back_agenda')}
        </button>
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 800, fontSize: '1rem' }}>{selected.patient}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
            {selected.time} · {selected.type}{selected.reason ? ` — ${selected.reason}` : ''}
          </div>
        </div>
        <TeleconsultationControl
          consultationId={selected.id}
          role="doctor"
          onEnterRoom={(url) => setRoomUrl(url)}
        />
      </div>
    );
  }

  // ── Agenda / lobby ────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Video size={20} style={{ color: '#3b82f6' }} /> {t('dlive.title')}
      </h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 2rem', fontSize: '0.85rem' }}>{t('dlive.subtitle')}</p>

      {loading ? (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={28} className="spin" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
          {t('dlive.loading')}
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>{error}</div>
      ) : (
        <>
          <div className="card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Video size={36} />
            </div>
            {nextConsult ? (
              <>
                <h2 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>{t('dlive.next_title')}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  <strong>{nextConsult.patient}</strong> {t('dlive.at')} <strong>{nextConsult.time}</strong>
                  {nextConsult.reason ? ` — ${nextConsult.reason}` : nextConsult.type ? ` — ${nextConsult.type}` : ''}
                </p>
                <button onClick={() => setSelected(nextConsult)} style={{ padding: '0.8rem 2rem', borderRadius: '12px', background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Video size={18} /> {t('dlive.prepare')}
                </button>
              </>
            ) : (
              <>
                <h2 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>{t('dlive.none_title')}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {t('dlive.none_desc')}
                </p>
              </>
            )}
          </div>

          {agenda.length > 0 && (
            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CalendarClock size={15} /> {t('dlive.today')}
              </div>
              {agenda.map(c => {
                const style = STATUS_STYLE[statusKey(c.status)];
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0' }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{c.patient}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}> · {c.time}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.73rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 999, background: style.bg, color: style.color }}>
                        {c.status}
                      </span>
                      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
