import { Video, PhoneOff, Loader2, CalendarClock, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import TeleconsultationControl from '../components/TeleconsultationControl';
import { useT } from '../i18n/LanguageContext';
import ConsultationCloseout from '../components/ConsultationCloseout';

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
  const [closeoutDirty, setCloseoutDirty] = useState(false);
  const [closeoutBusy, setCloseoutBusy] = useState(false);
  const [endingVideo, setEndingVideo] = useState(false);
  const [videoError, setVideoError] = useState('');
  const leaveSelection = () => {
    if (!closeoutDirty || window.confirm('Sair e perder o rascunho de conclusão desta sessão?')) {
      setSelected(null); setRoomUrl(null); setCloseoutDirty(false);
    }
  };
  const endVideo = async () => {
    if (!selected || endingVideo) return;
    setEndingVideo(true); setVideoError('');
    try { await api.post(`/api/v1/teleconsultations/${selected.id}/complete`); setRoomUrl(null); }
    catch { setVideoError('Não foi possível confirmar o encerramento do vídeo. Tente novamente.'); }
    finally { setEndingVideo(false); }
  };

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
    () => agenda.find(a => ['scheduled', 'confirmed', 'in_progress'].includes(a.status)) ?? null,
    [agenda],
  );

  if (selected) {
    return <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <button className="btn btn-sm" disabled={closeoutBusy || endingVideo} onClick={leaveSelection}>← {t('dlive.back_agenda')}</button>
      <div className="card" style={{ padding: '1.25rem', margin: '1rem 0' }}>
        <strong>{selected.patient}</strong><p>{selected.time} · {selected.type}{selected.reason ? ` — ${selected.reason}` : ''}</p>
      </div>
      {videoError && <p role="alert">{videoError}</p>}
      {roomUrl ? <section>
        <button className="btn" type="button" disabled={endingVideo} onClick={endVideo}><PhoneOff size={16} /> Encerrar vídeo</button>
        <p>Encerrar o vídeo mantém a consulta aberta para concluir o registo clínico.</p>
        <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', background: '#1e1e2e', aspectRatio: '16/9' }}>
          <iframe title={`${t('appt.teleconsulta')} — ${selected.patient}`} src={roomUrl} referrerPolicy="no-referrer" allow="camera; microphone; fullscreen; autoplay" style={{ width: '100%', height: '100%', border: 'none' }} />
        </div>
      </section> : <TeleconsultationControl consultationId={selected.id} role="doctor" onEnterRoom={setRoomUrl} />}
      <ConsultationCloseout consultationId={selected.id} role="doctor" onDirtyChange={setCloseoutDirty} onBusyChange={setCloseoutBusy} onFinalized={() => {
        setRoomUrl(null); setAgenda(current => current.map(item => item.id === selected.id ? { ...item, status: 'completed' } : item));
      }} />
    </div>;
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
