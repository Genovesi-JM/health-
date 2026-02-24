import { useEffect, useState } from 'react';
import api from '../api';
import type { AdminDashboard } from '../types';
import {
  LayoutDashboard, Users, Stethoscope, Calendar, Activity,
  DollarSign, UserCheck, AlertTriangle,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/v1/dashboard/admin')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
          Administração
        </p>
        <h1>Dashboard Admin</h1>
        <p>Visão geral da plataforma e métricas</p>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard icon={<Users size={20} />} label="Pacientes" value={data?.total_patients ?? 0} color="rgba(20,184,166,0.15)" />
        <KpiCard icon={<Stethoscope size={20} />} label="Médicos" value={data?.total_doctors ?? 0} color="rgba(6,182,212,0.15)" />
        <KpiCard icon={<UserCheck size={20} />} label="Pendentes" value={data?.pending_doctors ?? 0} color="rgba(234,179,8,0.15)" variant="warning" />
        <KpiCard icon={<Calendar size={20} />} label="Consultas" value={data?.total_consultations ?? 0} color="rgba(34,197,94,0.15)" />
        <KpiCard icon={<Activity size={20} />} label="Triagens" value={data?.total_triage_sessions ?? 0} color="rgba(139,92,246,0.15)" />
        <KpiCard icon={<DollarSign size={20} />} label="Receita" value={`${(data?.revenue_total ?? 0).toFixed(0)} Kz`} color="rgba(249,115,22,0.15)" />
      </div>

      {/* Alerts Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Atenção Necessária</h3>
          <span className="badge badge-warning">{data?.pending_doctors ?? 0} pendente{(data?.pending_doctors ?? 0) !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ padding: '1rem 1.25rem' }}>
          {(data?.pending_doctors ?? 0) > 0 ? (
            <div style={{
              padding: '0.75rem 1rem', borderRadius: '10px',
              borderLeft: '4px solid #eab308', background: 'rgba(234,179,8,0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <AlertTriangle size={14} style={{ color: '#eab308' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Médicos Pendentes de Verificação</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Existem {data?.pending_doctors} médicos aguardando verificação de credenciais.
                Aceda à página de verificação para aprovar ou rejeitar.
              </p>
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sem itens pendentes.</p>
          )}
        </div>
      </div>
    </>
  );
}

function KpiCard({ icon, label, value, color, variant }: { icon: React.ReactNode; label: string; value: string | number; color: string; variant?: string }) {
  return (
    <div className="kpi-card" style={variant === 'warning' ? {
      background: 'linear-gradient(135deg, rgba(234,179,8,0.06), #ffffff)',
      borderColor: 'rgba(234,179,8,0.25)',
    } : {}}>
      <div className="kpi-icon" style={{ background: color, color: 'var(--accent-teal)' }}>{icon}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}
