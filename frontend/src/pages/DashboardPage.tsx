import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';
import type { DashboardKPIs, TriageHistoryItem, Consultation } from '../types';
import {
  Activity, Calendar, Users, Stethoscope, ArrowRight,
  ClipboardList, HeartPulse, AlertTriangle,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [triageHistory, setTriageHistory] = useState<TriageHistoryItem[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [kRes, tRes, cRes] = await Promise.allSettled([
          api.get('/api/v1/dashboard/kpis'),
          api.get('/api/v1/triage/history'),
          api.get('/api/v1/consultations/'),
        ]);
        if (kRes.status === 'fulfilled') setKpis(kRes.value.data);
        if (tRes.status === 'fulfilled') setTriageHistory(tRes.value.data.slice(0, 5));
        if (cRes.status === 'fulfilled') setConsultations(cRes.value.data.slice(0, 5));
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const displayName = user?.name || user?.email?.split('@')[0] || 'Utilizador';

  const riskColor = (level?: string) => {
    if (!level) return 'badge-neutral';
    switch (level.toUpperCase()) {
      case 'URGENT': return 'badge-danger';
      case 'HIGH': return 'badge-danger';
      case 'MEDIUM': return 'badge-warning';
      default: return 'badge-success';
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'completed': return 'badge-success';
      case 'in_progress': return 'badge-info';
      case 'cancelled': case 'no_show': return 'badge-danger';
      case 'scheduled': return 'badge-warning';
      default: return 'badge-neutral';
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
          Painel do Paciente
        </p>
        <h1>Olá, {displayName} 👋</h1>
        <p>Bem-vindo ao seu painel de saúde. Aqui pode gerir as suas triagens, consultas e perfil clínico.</p>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <Link to="/triage" className="btn btn-primary">
          <Activity size={16} /> Iniciar Triagem
        </Link>
        <Link to="/consultations" className="btn btn-secondary">
          <Calendar size={16} /> Ver Consultas
        </Link>
        <Link to="/patient/profile" className="btn btn-secondary">
          <ClipboardList size={16} /> Meu Perfil
        </Link>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard icon={<Activity size={20} />} label="Triagens" value={kpis?.total_triage_sessions ?? 0} color="rgba(20,184,166,0.15)" />
        <KpiCard icon={<Calendar size={20} />} label="Consultas" value={kpis?.total_consultations ?? 0} color="rgba(6,182,212,0.15)" />
        <KpiCard icon={<Stethoscope size={20} />} label="Consultas Hoje" value={kpis?.consultations_today ?? 0} color="rgba(34,197,94,0.15)" />
        <KpiCard icon={<HeartPulse size={20} />} label="Score Médio" value={kpis?.avg_triage_score ? kpis.avg_triage_score.toFixed(1) : '—'} color="rgba(251,191,36,0.15)" />
      </div>

      {/* Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.25rem' }}>
        {/* Triage History */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Triagens Recentes</h3>
            <Link to="/triage" style={{ color: 'var(--accent-teal)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              Ver Todas <ArrowRight size={13} />
            </Link>
          </div>
          <div style={{ padding: '0.5rem 0' }}>
            {triageHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Activity size={24} style={{ color: 'var(--accent-teal)' }} /></div>
                <div className="empty-state-title">Sem triagens</div>
                <div className="empty-state-desc">Inicie a sua primeira triagem para avaliar o seu estado de saúde.</div>
                <Link to="/triage" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                  <Activity size={14} /> Iniciar Triagem
                </Link>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Queixa</th>
                      <th>Risco</th>
                      <th>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {triageHistory.map(t => (
                      <tr key={t.session_id}>
                        <td style={{ color: 'var(--text-primary)' }}>{t.chief_complaint}</td>
                        <td><span className={`badge ${riskColor(t.risk_level)}`}>{t.risk_level || t.status}</span></td>
                        <td>{new Date(t.created_at).toLocaleDateString('pt')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Consultations */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Consultas</h3>
            <span className={`badge ${consultations.length > 0 ? 'badge-info' : 'badge-neutral'}`}>
              {consultations.length} registadas
            </span>
          </div>
          <div style={{ padding: '0.5rem 0' }}>
            {consultations.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Calendar size={24} style={{ color: 'var(--accent-teal)' }} /></div>
                <div className="empty-state-title">Sem consultas</div>
                <div className="empty-state-desc">Complete uma triagem para agendar a sua primeira consulta.</div>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Especialidade</th>
                      <th>Estado</th>
                      <th>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consultations.map(c => (
                      <tr key={c.id}>
                        <td style={{ color: 'var(--text-primary)' }}>{c.specialty}</td>
                        <td><span className={`badge ${statusBadge(c.status)}`}>{c.status}</span></td>
                        <td>{c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString('pt') : new Date(c.created_at).toLocaleDateString('pt')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts section (like GeoVision) */}
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Alertas & Atenção</h3>
          <span className="badge badge-info">Info</span>
        </div>
        <div style={{ padding: '1rem 1.25rem' }}>
          <div style={{
            padding: '0.75rem 1rem', borderRadius: '10px',
            borderLeft: '4px solid var(--accent-teal)',
            background: 'rgba(20,184,166,0.08)', marginBottom: '0.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <AlertTriangle size={14} style={{ color: 'var(--accent-teal)' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Mantenha o seu perfil atualizado</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Informações como alergias, condições crónicas e contacto de emergência ajudam na triagem e no atendimento.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ background: color, color: 'var(--accent-teal)' }}>{icon}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}
