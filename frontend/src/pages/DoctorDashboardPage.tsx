import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Stethoscope, ClipboardList, UserCircle2, CheckCircle2, Clock,
  AlertTriangle, ExternalLink, ArrowRight, Globe, Users, Star,
  TrendingUp, ShieldCheck,
} from 'lucide-react';
import api from '../api';
import { getSession } from '../api';

interface DoctorProfile {
  display_name: string | null;
  title: string | null;
  specialization: string | null;
  slug: string | null;
  photo_url: string | null;
  bio: string | null;
  verification_status: string;
  accepts_new_patients: boolean | null;
  consultation_types: string[] | null;
  location_city: string | null;
  location_province: string | null;
  years_experience: number | null;
  price_min: number | null;
  price_max: number | null;
  languages: string[] | null;
  education: unknown[] | null;
}

interface QueueItem { id: string; status: string }

const SPECIALTY_LABELS: Record<string, string> = {
  clinica_geral: 'Clínica Geral', pediatria: 'Pediatria', cardiologia: 'Cardiologia',
  ginecologia: 'Ginecologia', dermatologia: 'Dermatologia', ortopedia: 'Ortopedia',
  oftalmologia: 'Oftalmologia', neurologia: 'Neurologia', psiquiatria: 'Psiquiatria',
  psicologia: 'Psicologia', fisioterapia: 'Fisioterapia', odontologia: 'Medicina Dentária',
  medicina_interna: 'Medicina Interna', urgencia: 'Urgência', outro: 'Outra',
};

function profileCompleteness(d: DoctorProfile): { score: number; missing: string[] } {
  const checks: [boolean, string][] = [
    [!!d.display_name, 'Nome público'],
    [!!d.bio, 'Bio / apresentação'],
    [!!d.photo_url, 'Foto de perfil'],
    [!!d.location_city, 'Cidade'],
    [!!d.location_province, 'Província'],
    [!!d.years_experience, 'Anos de experiência'],
    [!!(d.consultation_types && d.consultation_types.length > 0), 'Tipo de consulta'],
    [!!(d.price_min || d.price_max), 'Preço por consulta'],
    [!!(d.languages && d.languages.length > 0), 'Idiomas'],
    [!!(d.education && (d.education as unknown[]).length > 0), 'Formação académica'],
  ];
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
  const score = Math.round(((checks.length - missing.length) / checks.length) * 100);
  return { score, missing };
}

export default function DoctorDashboardPage() {
  const session = getSession();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    api.get('/api/v1/doctors/me')
      .then(r => setProfile(r.data))
      .catch(() => {})
      .finally(() => setLoadingProfile(false));

    api.get('/api/v1/doctor/queue')
      .then(r => setQueue(r.data))
      .catch(() => {});
  }, []);

  const name = profile?.display_name || session?.name || 'Médico';
  const title = profile?.title || '';
  const verStatus = profile?.verification_status || 'pending';
  const { score, missing } = profile ? profileCompleteness(profile) : { score: 0, missing: [] };
  const publicUrl = profile?.slug
    ? `${window.location.origin}${import.meta.env.BASE_URL}medicos/${profile.slug}`
    : null;

  const verColors: Record<string, { bg: string; color: string; label: string; icon: typeof CheckCircle2 }> = {
    verified:  { bg: 'rgba(16,185,129,0.1)',  color: '#059669', label: 'Perfil verificado',       icon: CheckCircle2 },
    pending:   { bg: 'rgba(234,179,8,0.12)',  color: '#ca8a04', label: 'Verificação pendente',    icon: Clock },
    rejected:  { bg: 'rgba(239,68,68,0.1)',   color: '#dc2626', label: 'Verificação rejeitada',   icon: AlertTriangle },
    suspended: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280', label: 'Conta suspensa',          icon: AlertTriangle },
  };
  const ver = verColors[verStatus] || verColors.pending;
  const VerIcon = ver.icon;

  const activeQ = queue.filter(q => q.status === 'in_progress').length;
  const waitingQ = queue.filter(q => q.status === 'waiting').length;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>

      {/* Welcome header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 0.2rem' }}>
          Olá{title ? `, ${title}` : ','} {name} 👋
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.88rem' }}>
          {profile?.specialization ? SPECIALTY_LABELS[profile.specialization] ?? profile.specialization : 'Bem-vindo ao seu painel de médico'}
        </p>
      </div>

      {/* Status bar */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: 999, background: ver.bg, color: ver.color, fontWeight: 600, fontSize: '0.82rem' }}>
          <VerIcon size={14} /> {ver.label}
        </div>
        {profile?.accepts_new_patients !== false && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: 999, background: 'rgba(16,185,129,0.08)', color: '#059669', fontWeight: 600, fontSize: '0.82rem' }}>
            <Users size={14} /> A aceitar pacientes
          </div>
        )}
        {publicUrl && verStatus === 'verified' && (
          <a href={publicUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: 999, background: 'var(--brand-light)', color: 'var(--brand-primary)', fontWeight: 600, fontSize: '0.82rem', textDecoration: 'none' }}>
            <Globe size={14} /> Ver perfil público <ExternalLink size={11} />
          </a>
        )}
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard icon={<ClipboardList size={20} />} label="Na fila agora" value={waitingQ} color="rgba(234,179,8,0.15)" />
        <KpiCard icon={<Stethoscope size={20} />} label="Em consulta" value={activeQ} color="rgba(59,130,246,0.15)" />
        <KpiCard icon={<TrendingUp size={20} />} label="Perfil completo" value={`${score}%`} color="rgba(16,185,129,0.12)" />
        <KpiCard icon={<Star size={20} />} label="Experiência" value={profile?.years_experience ? `${profile.years_experience} anos` : '—'} color="rgba(168,85,247,0.12)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

        {/* Profile completeness */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Completude do perfil</h3>
            <Link to="/doctor/profile" style={{ fontSize: '0.78rem', color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              Editar <ArrowRight size={12} />
            </Link>
          </div>

          {/* Progress bar */}
          <div style={{ height: 8, borderRadius: 999, background: 'var(--border)', marginBottom: '0.5rem', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${score}%`, borderRadius: 999, background: score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444', transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>{score}% completo</div>

          {missing.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>A preencher:</div>
              {missing.slice(0, 5).map(m => (
                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                  {m}
                </div>
              ))}
              {missing.length > 5 && <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>+ {missing.length - 5} mais…</div>}
            </div>
          )}
          {missing.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.83rem', color: '#059669', fontWeight: 600 }}>
              <CheckCircle2 size={15} /> Perfil 100% completo!
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1rem' }}>Acesso rápido</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <QuickAction to="/doctor/queue" icon={<ClipboardList size={16} />} label="Fila de consultas" badge={waitingQ > 0 ? String(waitingQ) : undefined} badgeColor="#f59e0b" />
            <QuickAction to="/doctor/profile" icon={<UserCircle2 size={16} />} label="Editar perfil público" />
            <QuickAction to="/medicos" icon={<Globe size={16} />} label="Ver directório de médicos" />
            {publicUrl && verStatus === 'verified' && (
              <a href={publicUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'var(--bg-subtle, rgba(0,0,0,0.03))', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.85rem' }}>
                <ExternalLink size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>Página pública</span>
                <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
              </a>
            )}
          </div>
        </div>

        {/* Verification info */}
        {verStatus !== 'verified' && (
          <div className="card" style={{ padding: '1.5rem', gridColumn: '1 / -1', border: `1.5px solid ${ver.color}30`, background: ver.bg }}>
            <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
              <VerIcon size={20} style={{ color: ver.color, flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: ver.color, marginBottom: '0.3rem' }}>{ver.label}</div>
                {verStatus === 'pending' && (
                  <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0 }}>
                    O seu perfil está a ser analisado pela nossa equipa. Receberá uma notificação quando for aprovado. Pode continuar a preencher o seu perfil enquanto espera.
                  </p>
                )}
                {verStatus === 'rejected' && (
                  <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0 }}>
                    A sua candidatura foi rejeitada. Contacte <a href="mailto:parceiros@carefast.ao" style={{ color: ver.color }}>parceiros@carefast.ao</a> para mais informações.
                  </p>
                )}
              </div>
              <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                <ShieldCheck size={28} style={{ color: ver.color, opacity: 0.3 }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <div style={{ width: 36, height: 36, borderRadius: '10px', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{label}</div>
    </div>
  );
}

function QuickAction({ to, icon, label, badge, badgeColor }: { to: string; icon: React.ReactNode; label: string; badge?: string; badgeColor?: string }) {
  return (
    <Link to={to} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'var(--bg-subtle, rgba(0,0,0,0.03))', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.85rem' }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && <span style={{ background: badgeColor || 'var(--brand-primary)', color: '#fff', borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.72rem', fontWeight: 700 }}>{badge}</span>}
      <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
    </Link>
  );
}
