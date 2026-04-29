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

interface PendingRx {
  id: string;
  patient_name?: string;
  patient_age?: number;
  medication_name: string;
  risk_level?: string;
  created_at: string;
}

// Mock data for UI richness — replaced by real API when available
const MOCK_AGENDA = [
  { id: '1', time: '09:00', patient: 'Maria Santos', type: 'teleconsulta', reason: 'Renovação de prescrição', status: 'confirmed', avatar: 'MS' },
  { id: '2', time: '10:30', patient: 'João Ferreira', type: 'presencial', reason: 'Consulta de seguimento — HTA', status: 'confirmed', avatar: 'JF' },
  { id: '3', time: '11:30', patient: 'Ana Rodrigues', type: 'teleconsulta', reason: 'Dor abdominal recorrente', status: 'waiting', avatar: 'AR' },
  { id: '4', time: '14:00', patient: 'Carlos Neto', type: 'presencial', reason: 'Resultados exames laboratoriais', status: 'confirmed', avatar: 'CN' },
  { id: '5', time: '15:30', patient: 'Luísa Pinto', type: 'teleconsulta', reason: 'Primeira consulta', status: 'pending', avatar: 'LP' },
];

export default function DoctorDashboardPage() {
  const session = getSession();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [pendingRx, setPendingRx] = useState<PendingRx[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    api.get('/api/v1/doctors/me').then(r => setProfile(r.data)).catch(() => {});
    api.get('/api/v1/doctor/queue').then(r => setQueue(r.data)).catch(() => {});
    api.get<PendingRx[]>('/api/v1/doctor/prescription-requests', { params: { status: 'pending' } })
      .then(r => setPendingRx(r.data)).catch(() => {});
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
              <HeroBtn to="/doctor/prescricoes" icon={<FileText size={14} />} label="Prescrições" badge={pendingRx.length > 0 ? pendingRx.length : undefined} />
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
        <KpiCard icon={<FileText size={18} />} label="Prescrições pendentes" value={pendingRx.length} color="rgba(239,68,68,0.1)" iconColor="#ef4444" urgent={pendingRx.length > 0} />
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
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: pendingRx.length > 0 ? '1.5px solid rgba(239,68,68,0.25)' : undefined }}>
            <SectionHeader title="Prescrições Pendentes" icon={<FileText size={16} />} count={pendingRx.length} to="/doctor/prescricoes" urgent={pendingRx.length > 0} />
            {pendingRx.length === 0 && (
              <div style={{ padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.83rem', textAlign: 'center' }}>Sem pedidos pendentes.</div>
            )}
            {pendingRx.map((rx, i) => (
              <div key={rx.id} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.9rem 1.25rem', borderBottom: i < pendingRx.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: rx.risk_level === 'high' ? 'rgba(239,68,68,0.12)' : rx.risk_level === 'medium' ? 'rgba(234,179,8,0.12)' : 'var(--brand-light)', color: rx.risk_level === 'high' ? '#dc2626' : rx.risk_level === 'medium' ? '#d97706' : 'var(--brand-primary)', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {(rx.patient_name ?? 'P').split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{rx.patient_name ?? 'Paciente'}{rx.patient_age ? `, ${rx.patient_age} anos` : ''}</div>
                  <div style={{ fontSize: '0.77rem', color: 'var(--text-primary)', fontWeight: 500, marginTop: '0.15rem' }}>💊 {rx.medication_name}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                  {rx.risk_level === 'high' && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#dc2626', background: 'rgba(239,68,68,0.1)', padding: '0.15rem 0.5rem', borderRadius: 999 }}>⚠ Alto risco</span>}
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(rx.created_at).toLocaleDateString('pt-PT')}</div>
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

