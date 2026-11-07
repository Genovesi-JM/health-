import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, CalendarDays, Pill, FileText, HeartPulse, Leaf, Users, UserRound,
  Stethoscope, ClipboardCheck, Bell, ExternalLink, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import { specialtyLabel } from '../constants/specialties';
import { formatAppointmentTime } from '../utils/appointments';
import type { PatientState, TriageHistoryItem, Consultation } from '../types';
import type { ReadingSummary } from '../components/HealthSnapshot';
import BookConsultationModal from '../components/BookConsultationModal';

const LOCALE_MAP: Record<string, string> = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR' };

/* "Directo a": two pages of four pastel tiles, like La Meva Salut's quick access. */
const TILES: { to: string; label: string; color: string; icon: typeof Activity; book?: boolean }[][] = [
  [
    { to: '/patient/documents', label: 'Documentos e resultados', color: '#bfe7df', icon: FileText },
    { to: '/triage',            label: 'Triagem',                color: '#ffc4a8', icon: Activity },
    { to: '/prescricoes/pedido', label: 'Medicação',             color: '#b9c2d9', icon: Pill },
    { to: '/consultations',     label: 'Teleconsulta',           color: '#f7b4de', icon: Stethoscope, book: true },
  ],
  [
    { to: '/consultations',     label: 'Consultas e agenda',     color: '#f3a1a1', icon: CalendarDays },
    { to: '/patient/readings',  label: 'Medições',               color: '#a9ddf4', icon: HeartPulse },
    { to: '/self-care',         label: 'Autocuidado',            color: '#cdb8f0', icon: Leaf },
    { to: '/family',            label: 'Família',                color: '#eee59a', icon: Users },
  ],
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { t, lang } = useT();
  const locale = LOCALE_MAP[lang] || 'pt-PT';
  const [state, setState] = useState<PatientState | null>(null);
  const [triages, setTriages] = useState<TriageHistoryItem[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [readings, setReadings] = useState<ReadingSummary | null>(null);
  const [pendingRx, setPendingRx] = useState<number>(0);
  const [unread, setUnread] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [page, setPage] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const [s, tr, c, r, rx, n] = await Promise.allSettled([
        api.get('/api/v1/dashboard/patient-state'),
        api.get('/api/v1/triage/history'),
        api.get('/api/v1/consultations/me'),
        api.get('/api/v1/readings/me/summary?days=30'),
        api.get('/api/v1/prescription-requests/me'),
        api.get('/api/v1/notifications/unread-count'),
      ]);
      if (s.status === 'fulfilled') setState(s.value.data);
      if (tr.status === 'fulfilled') setTriages(tr.value.data.slice(0, 3));
      if (c.status === 'fulfilled') setConsultations(c.value.data);
      if (r.status === 'fulfilled') setReadings(r.value.data);
      if (rx.status === 'fulfilled') {
        const items: unknown = Array.isArray(rx.value.data) ? rx.value.data : rx.value.data?.items;
        setPendingRx(Array.isArray(items) ? items.filter((x: { status?: string }) => x.status === 'pending').length : 0);
      }
      if (n.status === 'fulfilled') setUnread(Number(n.value.data?.count ?? n.value.data?.unread ?? 0) || 0);
      setLoading(false);
    };
    load();
  }, []);

  const onStripScroll = () => {
    const el = stripRef.current; if (!el) return;
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  };
  const goPage = (i: number) => {
    const el = stripRef.current; if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    setPage(i);
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const firstName = (user?.name || user?.email?.split('@')[0] || '').split(' ')[0];
  const upcoming = consultations
    .filter(c => ['scheduled', 'requested', 'in_progress'].includes(c.status) && c.scheduled_at)
    .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))[0];
  const lastTriage = triages[0];
  const bp = readings?.items?.find(i => i.reading_type === 'blood_pressure');

  return (
    <>
      <section className="lms-greet">
        <h1>{t('dash.hello')} {firstName},</h1>
        <p>Está no seu espaço de saúde digital.</p>
      </section>

      <h2 className="lms-h2">Directo a</h2>
      <div className="lms-strip">
        <div className="lms-strip__pages" ref={stripRef} onScroll={onStripScroll}>
          {TILES.map((pageTiles, i) => (
            <div key={i} className="lms-strip__page">
              {pageTiles.map(tile => (
                tile.book && state?.current_state === 'triage_completed' ? (
                  <button key={tile.label} className="lms-tile" onClick={() => setShowBooking(true)}>
                    <span className="lms-tile__sq" style={{ background: tile.color }}><tile.icon /></span>
                    <span className="lms-tile__label">{tile.label}</span>
                  </button>
                ) : (
                  <Link key={tile.label} to={tile.to} className="lms-tile">
                    <span className="lms-tile__sq" style={{ background: tile.color }}><tile.icon /></span>
                    <span className="lms-tile__label">{tile.label}</span>
                  </Link>
                )
              ))}
            </div>
          ))}
        </div>
        <div className="lms-dots" role="tablist" aria-label="Páginas de acesso rápido">
          {TILES.map((_, i) => <button key={i} role="tab" aria-selected={page === i} className={page === i ? 'is-on' : ''} onClick={() => goPage(i)} aria-label={`Página ${i + 1}`} />)}
        </div>
      </div>

      <h2 className="lms-h2">Destacados</h2>
      <ul className="lms-feat">
        {upcoming && (
          <li className="lms-card">
            <div className="lms-card__ico"><CalendarDays /></div>
            <div>
              <h3>Próxima consulta</h3>
              <p>{specialtyLabel(upcoming.specialty, t)} · {formatAppointmentTime(upcoming.scheduled_at as string, upcoming.timezone || 'Africa/Luanda', locale)}</p>
              <Link to="/consultations">Ver consulta <ArrowRight size={20} /></Link>
            </div>
          </li>
        )}
        <li className="lms-card">
          <div className="lms-card__ico"><Activity /></div>
          <div>
            <h3>{state?.state_label || 'Triagem digital'}</h3>
            <p>{lastTriage
              ? `Última triagem: ${lastTriage.chief_complaint} · risco ${String(lastTriage.risk_level || '').toLowerCase()} · ${new Date(lastTriage.created_at).toLocaleDateString(locale)}.`
              : 'Avalie sintomas em minutos e receba uma recomendação. Um médico real decide o passo seguinte.'}</p>
            {state?.next_action === 'book_consultation'
              ? <button className="lms-link" onClick={() => setShowBooking(true)}>Marcar consulta <ArrowRight size={20} /></button>
              : <Link to="/triage">{lastTriage ? 'Nova triagem' : 'Iniciar triagem'} <ArrowRight size={20} /></Link>}
          </div>
        </li>
        <li className="lms-card">
          <div className="lms-card__ico"><HeartPulse /></div>
          <div>
            <h3>Medições</h3>
            <p>{bp
              ? `Última tensão arterial ${bp.systolic}/${bp.diastolic} mmHg · ${readings?.total_readings ?? 0} registos em 30 dias.`
              : 'Registe tensão arterial, glicose, peso e temperatura, ou ligue um dispositivo.'}</p>
            <Link to="/patient/readings">Ver medições <ArrowRight size={20} /></Link>
          </div>
        </li>
        <li className="lms-card">
          <div className="lms-card__ico"><ClipboardCheck /></div>
          <div>
            <h3>Receitas e renovações</h3>
            <p>{pendingRx > 0
              ? `${pendingRx} pedido${pendingRx > 1 ? 's' : ''} de renovação a aguardar decisão médica.`
              : 'Peça ou renove uma receita a partir de casa. A dispensa é feita em farmácias parceiras.'}</p>
            <Link to="/prescricoes/pedido">Pedir renovação <ArrowRight size={20} /></Link>
          </div>
        </li>
        {unread > 0 && (
          <li className="lms-card">
            <div className="lms-card__ico"><Bell /></div>
            <div>
              <h3>Notificações</h3>
              <p>{unread} notificaç{unread > 1 ? 'ões' : 'ão'} por ler.</p>
              <Link to="/notifications">Ver notificações <ArrowRight size={20} /></Link>
            </div>
          </li>
        )}
        <li className="lms-card">
          <div className="lms-card__ico"><UserRound /></div>
          <div>
            <h3>Os seus dados</h3>
            <p>Mantenha alergias, condições crónicas e contacto de emergência actualizados para consultas mais seguras.</p>
            <Link to="/patient/profile">Actualizar perfil <ExternalLink size={20} /></Link>
          </div>
        </li>
      </ul>

      <BookConsultationModal
        open={showBooking}
        onClose={() => setShowBooking(false)}
        patientState={state}
        onBooked={(c: Consultation) => { setConsultations(prev => [c, ...prev]); setShowBooking(false); }}
      />
    </>
  );
}
