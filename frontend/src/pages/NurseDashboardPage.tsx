import { useEffect, useState } from 'react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import { specialtyLabel } from '../constants/specialties';
import { Activity, AlertTriangle, ClipboardList, HeartPulse } from 'lucide-react';

interface QueueItem { id: string; patient: string; specialty: string; risk_level?: string | null; chief_complaint?: string | null; created_at: string; }
interface Dash { queue_count: number; urgent_count: number; triages_today: number; recent: QueueItem[]; }

function riskBadge(level?: string | null) {
  switch ((level || '').toUpperCase()) {
    case 'URGENT': return { label: 'Urgente', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' };
    case 'HIGH': return { label: 'Alto', color: '#dc2626', bg: 'rgba(239,68,68,0.12)' };
    case 'MEDIUM': return { label: 'Médio', color: '#d97706', bg: 'rgba(234,179,8,0.12)' };
    case 'LOW': return { label: 'Baixo', color: '#059669', bg: 'rgba(16,185,129,0.12)' };
    default: return { label: '—', color: '#64748b', bg: 'rgba(100,116,139,0.1)' };
  }
}

export default function NurseDashboardPage() {
  const { t, lang } = useT();
  const locale = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', zh: 'zh-CN' }[lang] || 'pt-PT';
  const [dash, setDash] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/v1/nurse/dashboard')
      .then(r => setDash(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const kpis = dash ? [
    { label: t('nurse.kpi_queue'), value: dash.queue_count, icon: <ClipboardList size={18} />, color: '#0d9488' },
    { label: t('nurse.kpi_urgent'), value: dash.urgent_count, icon: <AlertTriangle size={18} />, color: '#dc2626' },
    { label: t('nurse.kpi_triages'), value: dash.triages_today, icon: <Activity size={18} />, color: '#3b82f6' },
  ] : [];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <HeartPulse size={20} style={{ color: 'var(--brand-primary)' }} /> {t('nurse.dashboard')}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>{t('nurse.desc')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {kpis.map(k => (
          <div key={k.label} className="card" style={{ padding: '1.1rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{k.label}</span>
              <span style={{ color: k.color }}>{k.icon}</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.9rem' }}>{t('nurse.recent')}</div>
        {(dash?.recent || []).length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('nurse.empty')}</div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead><tr><th>{t('table.patient')}</th><th>{t('table.specialty')}</th><th>Motivo</th><th>{t('table.risk')}</th><th>{t('table.date')}</th></tr></thead>
              <tbody>
                {dash!.recent.map(i => {
                  const r = riskBadge(i.risk_level);
                  return (
                    <tr key={i.id}>
                      <td style={{ fontWeight: 600 }}>{i.patient}</td>
                      <td>{specialtyLabel(i.specialty, t)}</td>
                      <td style={{ color: 'var(--text-muted)', maxWidth: 200 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{i.chief_complaint || '—'}</span></td>
                      <td><span style={{ padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.73rem', fontWeight: 700, background: r.bg, color: r.color }}>{r.label}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{new Date(i.created_at).toLocaleDateString(locale)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
