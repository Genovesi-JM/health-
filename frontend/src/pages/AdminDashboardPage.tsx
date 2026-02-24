import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import type { AdminDashboard } from '../types';
import {
  Users, Stethoscope, Calendar, Activity,
  DollarSign, UserCheck, AlertTriangle, TrendingUp,
  Shield, BarChart3, CheckCircle2, ArrowRight,
} from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

export default function AdminDashboardPage() {
  const { t } = useT();
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/v1/dashboard/admin')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const riskTotal = Object.values(data?.risk_distribution ?? {}).reduce((a, b) => a + b, 0) || 1;
  const riskColors: Record<string, string> = { LOW: '#22c55e', MEDIUM: '#eab308', HIGH: '#f97316', URGENT: '#ef4444' };
  const riskLabels: Record<string, string> = { LOW: t('risk.low'), MEDIUM: t('risk.medium'), HIGH: t('risk.high'), URGENT: t('risk.urgent') };

  return (
    <>
      <div className="page-header">
        <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
          {t('admin.label')}
        </p>
        <h1>{t('admin.title')}</h1>
        <p>{t('admin.subtitle')}</p>
      </div>

      {/* KPI Grid — Row 1: Volume */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <KpiCard icon={<Users size={20} />} label={t('admin.patients')} value={data?.total_patients ?? 0} color="rgba(20,184,166,0.15)" />
        <KpiCard icon={<Stethoscope size={20} />} label={t('admin.doctors')} value={data?.total_doctors ?? 0} color="rgba(6,182,212,0.15)" />
        <KpiCard icon={<UserCheck size={20} />} label={t('admin.pending')} value={data?.pending_verifications ?? 0} color="rgba(234,179,8,0.15)"
          variant={(data?.pending_verifications ?? 0) > 0 ? 'warning' : undefined} />
        <KpiCard icon={<Activity size={20} />} label={t('admin.active_patients')} value={data?.active_patients ?? 0} color="rgba(139,92,246,0.15)" />
      </div>

      {/* KPI Grid — Row 2: Business */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard icon={<Calendar size={20} />} label={t('admin.consult_month')} value={data?.consultations_this_month ?? 0} color="rgba(34,197,94,0.15)" />
        <KpiCard icon={<CheckCircle2 size={20} />} label={t('admin.resolution_rate')} value={`${data?.resolution_rate?.toFixed(1) ?? 0}%`} color="rgba(20,184,166,0.15)" />
        <KpiCard icon={<TrendingUp size={20} />} label={t('admin.total_consult')} value={data?.total_consultations ?? 0} color="rgba(6,182,212,0.15)" />
        <KpiCard icon={<DollarSign size={20} />} label={t('admin.revenue')} value={data?.revenue_this_month ? `${data.revenue_this_month.toFixed(0)} Kz` : '0 Kz'} color="rgba(249,115,22,0.15)" />
      </div>

      {/* Content Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.25rem' }}>

        {/* Risk Distribution */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={16} style={{ color: 'var(--accent-teal)' }} /> {t('admin.risk_dist')}
            </h3>
            <span className="badge badge-neutral">{riskTotal} triagen{riskTotal !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ padding: '1.25rem' }}>
            {Object.keys(data?.risk_distribution ?? {}).length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0' }}>{t('admin.no_triage_data')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(level => {
                  const count = data?.risk_distribution?.[level] ?? 0;
                  const pct = ((count / riskTotal) * 100).toFixed(1);
                  return (
                    <div key={level}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: riskColors[level] }}>
                          {riskLabels[level]}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 4,
                          width: `${Math.max(parseFloat(pct), 2)}%`,
                          background: riskColors[level],
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Alerts & Actions */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={16} style={{ color: 'var(--accent-teal)' }} /> {t('admin.attention')}
            </h3>
          </div>
          <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(data?.pending_verifications ?? 0) > 0 && (
              <AlertCard
                color="#eab308"
                icon={<UserCheck size={14} />}
                title={`${data?.pending_verifications} ${t('admin.pending_doctors')}`}
                desc={t('admin.pending_desc')}
                action={<Link to="/admin/doctors" style={{ color: '#eab308', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>{t('admin.verify')} <ArrowRight size={12} /></Link>}
              />
            )}
            {(data?.flagged_triage_sessions ?? 0) > 0 && (
              <AlertCard
                color="#ef4444"
                icon={<AlertTriangle size={14} />}
                title={`${data?.flagged_triage_sessions} ${t('admin.urgent_triages')}`}
                desc={t('admin.urgent_desc')}
              />
            )}
            {(data?.pending_verifications ?? 0) === 0 && (data?.flagged_triage_sessions ?? 0) === 0 && (
              <div style={{ padding: '1rem', textAlign: 'center' }}>
                <CheckCircle2 size={20} style={{ color: '#22c55e', marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>{t('admin.no_pending')}</p>
              </div>
            )}
          </div>
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

function AlertCard({ color, icon, title, desc, action }: { color: string; icon: React.ReactNode; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div style={{
      padding: '0.75rem 1rem', borderRadius: '10px',
      borderLeft: `4px solid ${color}`, background: `${color}0d`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
          <span style={{ color }}>{icon}</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{title}</span>
        </div>
        {action}
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, paddingLeft: '1.5rem' }}>{desc}</p>
    </div>
  );
}
