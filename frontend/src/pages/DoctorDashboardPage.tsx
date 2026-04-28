import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList, CheckCircle2, Clock, AlertTriangle, ArrowRight,
  Video, FileText, Calendar, DollarSign, Star, Users, TrendingUp,
  Zap, ShieldCheck, ChevronRight, RefreshCw, User,
  MessageSquare, Activity, AlertCircle,
} from 'lucide-react';
import api from '../api';
import { getSession } from '../api';

interface DoctorProfile {
  display_name: string | null;
  title: string | null;
  specialization: string | null;
  slug: string | null;
  verification_status: string;
  accepts_new_patients: boolean | null;
  price_min: number | null;
  price_max: number | null;
  years_experience: number | null;
}

interface QueueItem {
  id: string;
  patient_name: string;
  status: string;
  specialty?: string;
  risk_level?: string;
  created_at?: string;
}

const SPECIALTY_LABELS: Record<string, string> = {
  clinica_geral: 'Clínica Geral', pediatria: 'Pediatria', cardiologia: 'Cardiologia',
  ginecologia: 'Ginecologia', dermatologia: 'Dermatologia', ortopedia: 'Ortopedia',
  oftalmologia: 'Oftalmologia', neurologia: 'Neurologia', psiquiatria: 'Psiquiatria',
  psicologia: 'Psicologia', fisioterapia: 'Fisioterapia', odontologia: 'Medicina Dentária',
  medicina_interna: 'Medicina Interna', urgencia: 'Urgência', outro: 'Outra',
};

// Mock data for UI richness — replaced by real API when available
const MOCK_AGENDA = [
  { id: '1', time: '09:00', patient: 'Maria Santos', type: 'teleconsulta', reason: 'Renovação de prescrição', status: 'confirmed', avatar: 'MS' },
  { id: '2', time: '10:30', patient: 'João Ferreira', type: 'presencial', reason: 'Consulta de seguimento — HTA', status: 'confirmed', avatar: 'JF' },
  { id: '3', time: '11:30', patient: 'Ana Rodrigues', type: 'teleconsulta', reason: 'Dor abdominal recorrente', status: 'waiting', avatar: 'AR' },
  { id: '4', time: '14:00', patient: 'Carlos Neto', type: 'presencial', reason: 'Resultados exames laboratoriais', status: 'confirmed', avatar: 'CN' },
  { id: '5', time: '15:30', patient: 'Luísa Pinto', type: 'teleconsulta', reason: 'Primeira consulta', status: 'pending', avatar: 'LP' },
];

const MOCK_PRESCRIPTIONS = [
  { id: 'p1', patient: 'Maria Santos', age: 52, condition: 'HTA + Diabetes T2', med: 'Metformina 850mg', risk: 'low', avatar: 'MS', since: 'há 2 dias' },
  { id: 'p2', patient: 'José Almeida', age: 67, condition: 'Insuficiência cardíaca', med: 'Furosemida 40mg', risk: 'high', avatar: 'JA', since: 'há 5 horas' },
  { id: 'p3', patient: 'Beatriz Lima', age: 34, condition: 'Asma brônquica', med: 'Salbutamol inalador', risk: 'medium', avatar: 'BL', since: 'há 1 dia' },
];

export default function DoctorDashboardPage() {
  const session = getSession();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    api.get('/api/v1/doctors/me').then(r => setProfile(r.data)).catch(() => {});
    api.get('/api/v1/doctor/queue').then(r => setQueue(r.data)).catch(() => {});
  }, [lastRefresh]);

  const refresh = () => setLastRefresh(new Date());

  const name = profile?.display_name || session?.name || 'Médico';
  const title = profile?.title || 'Dr.';
  const specialty = profile?.specialization ? SPECIALTY_LABELS[profile.specialization] ?? profile.specialization : '';
  const verStatus = profile?.verification_status || 'pending';
  const isVerified = verStatus === 'verified';

  const waitingQ = queue.filter(q => q.status === 'waiting').length;
  const activeQ = queue.filter(q => q.status === 'in_progress').length;
  const todayConsultations = MOCK_AGENDA.length;
  const confirmedToday = MOCK_AGENDA.filter(a => a.status === 'confirmed').length;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  const statusBadge = {
    verified:  { label: '✓ Verificado',          color: '#059669', bg: 'rgba(16,185,129,0.1)' },
    pending:   { label: '⏳ Verificação pendente', color: '#d97706', bg: 'rgba(234,179,8,0.1)'  },
    rejected:  { label: '✗ Rejeitado',            color: '#dc2626', bg: 'rgba(239,68,68,0.1)'  },
  }[verStatus] ?? { label: verStatus, color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>

      {/* ── HERO ── */}
      <div style={{ background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 60%, #14b8a6 100%)', borderRadius: '20px', padding: '1.75rem 2rem', marginBottom: '1.5rem', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', right: '60px', bottom: '-40px', width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', opacity: 0.75, marginBottom: '0.25rem', fontWeight: 500 }}>{greeting} 👋</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.2rem', color: '#fff' }}>
              {title} {name}
            </h1>
            <p style={{ margin: '0 0 1.25rem', opacity: 0.85, fontSize: '0.88rem' }}>
              {specialty && <span>{specialty} · </span>}
              <span style={{ fontWeight: 600 }}>Hoje: {confirmedToday} consultas confirmadas</span>
              {waitingQ > 0 && <span style={{ marginLeft: '0.75rem', background: 'rgba(255,255,255,0.2)', padding: '0.15rem 0.6rem', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700 }}>🔴 {waitingQ} em espera</span>}
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <HeroBtn to="/doctor/consultas" icon={<Video size={14} />} label="Entrar Online" primary />
              <HeroBtn to="/doctor/agenda" icon={<Calendar size={14} />} label="Abrir Agenda" />
              <HeroBtn to="/doctor/queue" icon={<ClipboardList size={14} />} label="Ver Fila" badge={waitingQ > 0 ? waitingQ : undefined} />
              <HeroBtn to="/doctor/prescricoes" icon={<FileText size={14} />} label="Prescrições" badge={MOCK_PRESCRIPTIONS.length} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.3rem 0.75rem', borderRadius: 999, background: statusBadge.bg, color: statusBadge.color, border: `1px solid ${statusBadge.color}30`, backdropFilter: 'blur(8px)' }}>
              {statusBadge.label}
            </span>
            <button onClick={refresh} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '0.4rem 0.75rem', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 600 }}>
              <RefreshCw size={12} /> Actualizar
            </button>
            <div style={{ fontSize: '0.72rem', opacity: 0.6 }}>
              {lastRefresh.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
        <KpiCard icon={<ClipboardList size={18} />} label="Em espera agora" value={waitingQ} color="rgba(234,179,8,0.15)" iconColor="#d97706" urgent={waitingQ > 0} />
        <KpiCard icon={<Video size={18} />} label="Em consulta" value={activeQ} color="rgba(59,130,246,0.12)" iconColor="#3b82f6" />
        <KpiCard icon={<Calendar size={18} />} label="Consultas hoje" value={todayConsultations} color="rgba(16,185,129,0.12)" iconColor="#10b981" />
        <KpiCard icon={<CheckCircle2 size={18} />} label="Concluídas esta semana" value={12} color="rgba(99,102,241,0.12)" iconColor="#6366f1" />
        <KpiCard icon={<FileText size={18} />} label="Prescrições pendentes" value={MOCK_PRESCRIPTIONS.length} color="rgba(239,68,68,0.1)" iconColor="#ef4444" urgent={MOCK_PRESCRIPTIONS.length > 0} />
        <KpiCard icon={<DollarSign size={18} />} label="Receita este mês (Kz)" value="142.500" color="rgba(16,185,129,0.1)" iconColor="#059669" />
        <KpiCard icon={<Star size={18} />} label="Rating médio" value="4.8 ★" color="rgba(251,191,36,0.12)" iconColor="#f59e0b" />
        <KpiCard icon={<MessageSquare size={18} />} label="Mensagens por responder" value={2} color="rgba(139,92,246,0.12)" iconColor="#8b5cf6" />
      </div>

      {/* ── MAIN GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.25rem' }}>

        {/* LEFT COL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* AGENDA HOJE */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <SectionHeader title="Agenda Hoje" icon={<Calendar size={16} />} count={MOCK_AGENDA.length} to="/doctor/agenda" />
            <div>
              {MOCK_AGENDA.map((appt, i) => (
                <div key={appt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1.25rem', borderBottom: i < MOCK_AGENDA.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle, rgba(0,0,0,0.025))')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <div style={{ width: 52, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--brand-primary)', lineHeight: 1 }}>{appt.time}</div>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand-light)', color: 'var(--brand-primary)', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{appt.avatar}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.patient}</div>
                    <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.reason}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: 999, background: appt.type === 'teleconsulta' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)', color: appt.type === 'teleconsulta' ? '#3b82f6' : '#059669', fontWeight: 600 }}>
                      {appt.type === 'teleconsulta' ? '📹 Telec.' : '🏥 Presencial'}
                    </span>
                    <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: 999, fontWeight: 600, background: appt.status === 'confirmed' ? 'rgba(16,185,129,0.1)' : appt.status === 'waiting' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)', color: appt.status === 'confirmed' ? '#059669' : appt.status === 'waiting' ? '#dc2626' : '#d97706' }}>
                      {appt.status === 'confirmed' ? 'Confirmada' : appt.status === 'waiting' ? 'A aguardar' : 'Pendente'}
                    </span>
                  </div>
                  <Link to="/doctor/agenda" style={{ color: 'var(--text-muted)', textDecoration: 'none', padding: '0.3rem' }}><ChevronRight size={15} /></Link>
                </div>
              ))}
            </div>
          </div>

          {/* PRESCRIÇÕES PENDENTES */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: MOCK_PRESCRIPTIONS.length > 0 ? '1.5px solid rgba(239,68,68,0.25)' : undefined }}>
            <SectionHeader title="Prescrições Pendentes" icon={<FileText size={16} />} count={MOCK_PRESCRIPTIONS.length} to="/doctor/prescricoes" urgent={MOCK_PRESCRIPTIONS.length > 0} />
            {MOCK_PRESCRIPTIONS.map((rx, i) => (
              <div key={rx.id} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.9rem 1.25rem', borderBottom: i < MOCK_PRESCRIPTIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: rx.risk === 'high' ? 'rgba(239,68,68,0.12)' : rx.risk === 'medium' ? 'rgba(234,179,8,0.12)' : 'var(--brand-light)', color: rx.risk === 'high' ? '#dc2626' : rx.risk === 'medium' ? '#d97706' : 'var(--brand-primary)', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{rx.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{rx.patient}, {rx.age} anos</div>
                  <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>{rx.condition}</div>
                  <div style={{ fontSize: '0.77rem', color: 'var(--text-primary)', fontWeight: 500, marginTop: '0.15rem' }}>💊 {rx.med}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                  {rx.risk === 'high' && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#dc2626', background: 'rgba(239,68,68,0.1)', padding: '0.15rem 0.5rem', borderRadius: 999 }}>⚠ Alto risco</span>}
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{rx.since}</div>
                  <Link to="/doctor/prescricoes" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    Avaliar <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* FILA EM TEMPO REAL */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <SectionHeader title="Fila Agora" icon={<ClipboardList size={16} />} count={queue.length} to="/doctor/queue" />
            {queue.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                <CheckCircle2 size={28} style={{ color: '#10b981', margin: '0 auto 0.5rem', display: 'block' }} />
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#10b981' }}>Fila vazia</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Nenhum paciente em espera</div>
              </div>
            ) : (
              queue.slice(0, 5).map((q, i) => (
                <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.75rem 1.25rem', borderBottom: i < Math.min(queue.length, 5) - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-light)', color: 'var(--brand-primary)', fontWeight: 700, fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {(q.patient_name || 'P').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.83rem' }}>{q.patient_name || 'Paciente'}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{q.status === 'waiting' ? 'Em espera' : 'Em consulta'}</div>
                  </div>
                  <Link to="/doctor/consultas" style={{ padding: '0.3rem 0.65rem', borderRadius: '8px', background: 'var(--brand-primary)', color: '#fff', fontSize: '0.72rem', fontWeight: 700, textDecoration: 'none' }}>
                    Entrar
                  </Link>
                </div>
              ))
            )}
          </div>

          {/* ACESSO RÁPIDO */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.85rem' }}>Acesso Rápido</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { to: '/doctor/pacientes',   icon: <Users size={15} />,         label: 'Lista de Pacientes',     sub: 'Histórico e dados clínicos' },
                { to: '/doctor/financeiro',  icon: <DollarSign size={15} />,    label: 'Resumo Financeiro',      sub: 'Receitas e pagamentos' },
                { to: '/doctor/avaliacoes',  icon: <Star size={15} />,          label: 'Avaliações',             sub: '4.8 ★ média' },
                { to: '/doctor/mensagens',   icon: <MessageSquare size={15} />, label: 'Mensagens',              sub: '2 não lidas' },
                { to: '/doctor/profile',     icon: <Activity size={15} />,      label: 'Perfil Público',         sub: 'Editar e ver página pública' },
              ].map(item => (
                <Link key={item.to} to={item.to} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.65rem 0.75rem', borderRadius: '10px', background: 'var(--bg-subtle, rgba(0,0,0,0.02))', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--brand-primary)', flexShrink: 0 }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.83rem', fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{item.sub}</div>
                  </div>
                  <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
                </Link>
              ))}
            </div>
          </div>

          {/* STATUS VERIFICAÇÃO */}
          {!isVerified && (
            <div className="card" style={{ padding: '1.25rem', background: 'rgba(234,179,8,0.06)', border: '1.5px solid rgba(234,179,8,0.3)' }}>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <Clock size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#d97706' }}>Verificação pendente</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0' }}>
                    O perfil está a ser analisado. Continue a preencher os dados — quanto mais completo, mais rápida a aprovação.
                  </p>
                  <Link to="/doctor/profile" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand-primary)', textDecoration: 'none', marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                    Completar perfil <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HeroBtn({ to, icon, label, primary, badge }: { to: string; icon: React.ReactNode; label: string; primary?: boolean; badge?: number }) {
  return (
    <Link to={to} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', borderRadius: '10px', fontWeight: 700, fontSize: '0.83rem', textDecoration: 'none', background: primary ? '#fff' : 'rgba(255,255,255,0.15)', color: primary ? '#0f766e' : '#fff', border: primary ? 'none' : '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(6px)', position: 'relative' }}>
      {icon} {label}
      {badge !== undefined && badge > 0 && (
        <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: '#fff', borderRadius: 999, width: 18, height: 18, fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>
      )}
    </Link>
  );
}

function KpiCard({ icon, label, value, color, iconColor, urgent }: { icon: React.ReactNode; label: string; value: string | number; color: string; iconColor: string; urgent?: boolean }) {
  return (
    <div className="card" style={{ padding: '1rem 1.1rem', border: urgent ? `1.5px solid ${iconColor}30` : undefined }}>
      <div style={{ width: 36, height: 36, borderRadius: '10px', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor, marginBottom: '0.6rem' }}>
        {icon}
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1, color: urgent ? iconColor : 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

function SectionHeader({ title, icon, count, to, urgent }: { title: string; icon: React.ReactNode; count?: number; to: string; urgent?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', background: urgent ? 'rgba(239,68,68,0.03)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.88rem' }}>
        <span style={{ color: urgent ? '#ef4444' : 'var(--brand-primary)' }}>{icon}</span>
        {title}
        {count !== undefined && (
          <span style={{ fontSize: '0.73rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: 999, background: urgent && count > 0 ? 'rgba(239,68,68,0.1)' : 'var(--brand-light)', color: urgent && count > 0 ? '#dc2626' : 'var(--brand-primary)' }}>{count}</span>
        )}
      </div>
      <Link to={to} style={{ fontSize: '0.78rem', color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
        Ver tudo <ArrowRight size={12} />
      </Link>
    </div>
  );
}

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
