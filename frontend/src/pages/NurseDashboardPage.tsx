import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import { specialtyLabel } from '../constants/specialties';
import {
  Activity, AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, Clock3,
  HeartPulse, HelpCircle, RefreshCw, Search, ShieldCheck, Timer, UserRound, X,
} from 'lucide-react';
import KpiGrid from '../components/KpiGrid';

interface QueueItem {
  id: string; patient_id?: string; patient: string; specialty: string; risk_level?: string | null;
  chief_complaint?: string | null; created_at: string; wait_minutes?: number;
}
interface Dash {
  queue_count: number; urgent_count: number; triages_today: number;
  unclassified_count: number; waiting_over_30_count: number;
  average_wait_minutes: number; longest_wait_minutes: number; recent: QueueItem[];
}

const PREVIEW_DASH: Dash = {
  queue_count: 18,
  urgent_count: 3,
  triages_today: 24,
  average_wait_minutes: 16,
  longest_wait_minutes: 42,
  waiting_over_30_count: 4,
  unclassified_count: 2,
  recent: [
    { id: 'preview-1', patient: 'Ana Manuel', specialty: 'general_medicine', risk_level: 'HIGH', chief_complaint: 'Febre e tosse persistente', created_at: '2026-07-30T09:20:00Z', wait_minutes: 42 },
    { id: 'preview-2', patient: 'Paulo Costa', specialty: 'cardiology', risk_level: 'MEDIUM', chief_complaint: 'Desconforto no peito', created_at: '2026-07-30T09:42:00Z', wait_minutes: 28 },
    { id: 'preview-3', patient: 'Teresa João', specialty: 'pediatrics', risk_level: null, chief_complaint: 'Dor abdominal', created_at: '2026-07-30T10:05:00Z', wait_minutes: 11 },
  ],
};

function riskBadge(level?: string | null) {
  switch ((level || '').toUpperCase()) {
    case 'URGENT': return { label: 'Urgente', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' };
    case 'HIGH': return { label: 'Alto', color: '#dc2626', bg: 'rgba(239,68,68,0.12)' };
    case 'MEDIUM': return { label: 'Médio', color: '#d97706', bg: 'rgba(234,179,8,0.12)' };
    case 'LOW': return { label: 'Baixo', color: '#059669', bg: 'rgba(16,185,129,0.12)' };
    default: return { label: '—', color: '#64748b', bg: 'rgba(100,116,139,0.1)' };
  }
}

export default function NurseDashboardPage({ preview = false }: { preview?: boolean }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [dash, setDash] = useState<Dash | null>(preview ? PREVIEW_DASH : null);
  const [loading, setLoading] = useState(!preview);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'priority' | 'unclassified'>('all');
  const [selected, setSelected] = useState<QueueItem | null>(null);

  const loadDashboard = () => {
    if (preview) {
      setDash(PREVIEW_DASH);
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    api.get('/api/v1/nurse/dashboard')
      .then(r => setDash(r.data))
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { loadDashboard(); }, [preview]);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const waitMinutes = (item: QueueItem) => item.wait_minutes ?? Math.max(0, Math.floor((Date.now() - new Date(item.created_at).getTime()) / 60000));
  const sla = dash?.queue_count ? Math.max(0, Math.round(((dash.queue_count - dash.waiting_over_30_count) / dash.queue_count) * 100)) : 100;
  const kpis = dash ? [
    { id: 'queue', label: t('nurse.kpi_queue'), value: dash.queue_count, helper: t('nurse.kpi_queue_help'), icon: <ClipboardList size={18} />, color: '#0d9488' },
    { id: 'urgent', label: t('nurse.kpi_urgent'), value: dash.urgent_count, helper: t('nurse.kpi_urgent_help'), icon: <AlertTriangle size={18} />, color: '#dc2626', tone: dash.urgent_count > 0 ? 'attention' as const : 'default' as const },
    { id: 'triages', label: t('nurse.kpi_triages'), value: dash.triages_today, helper: t('nurse.kpi_triages_help'), icon: <Activity size={18} />, color: '#2563eb', tone: 'positive' as const },
    { id: 'wait', label: t('nurse.kpi_wait'), value: `${dash.average_wait_minutes} min`, helper: t('nurse.kpi_wait_help'), icon: <Clock3 size={18} />, color: '#7c3aed' },
    { id: 'late', label: t('nurse.kpi_over_30'), value: dash.waiting_over_30_count, helper: t('nurse.kpi_over_30_help'), icon: <Timer size={18} />, color: '#ea580c', tone: dash.waiting_over_30_count > 0 ? 'attention' as const : 'default' as const },
    { id: 'unclassified', label: t('nurse.kpi_unclassified'), value: dash.unclassified_count, helper: t('nurse.kpi_unclassified_help'), icon: <HelpCircle size={18} />, color: '#64748b' },
  ] : [];

  const filteredItems = (dash?.recent || []).filter(item => {
    const matchesSearch = `${item.patient} ${item.chief_complaint || ''} ${item.specialty}`.toLowerCase().includes(query.toLowerCase());
    const risk = (item.risk_level || '').toUpperCase();
    const matchesRisk = riskFilter === 'all'
      || (riskFilter === 'priority' && ['URGENT', 'HIGH'].includes(risk))
      || (riskFilter === 'unclassified' && !risk);
    return matchesSearch && matchesRisk;
  });

  return (
    <div className="nurse-dashboard">
      <section className="nurse-hero">
        <div>
          <div className="nurse-hero__meta">
            {preview && <span className="nurse-preview-chip">{t('nurse.preview')}</span>}
            <span className="nurse-shift-chip"><span /> {t('nurse.shift_active')}</span>
          </div>
          <h1><HeartPulse size={25} /> {t('nurse.dashboard')}</h1>
          <p>{t('nurse.workspace_desc')}</p>
        </div>
        <div className="nurse-hero__actions">
          <span>{t('nurse.updated_now')}</span>
          <button type="button" onClick={loadDashboard} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} /> {t('nurse.refresh')}
          </button>
        </div>
      </section>

      {(dash?.urgent_count || dash?.unclassified_count) ? (
        <section className="nurse-alerts" aria-label={t('nurse.attention')}>
          {!!dash?.urgent_count && (
            <div className="nurse-alert nurse-alert--danger">
              <span className="nurse-alert__icon"><AlertTriangle size={19} /></span>
              <div><strong>{dash.urgent_count} {t('nurse.priority_patients')}</strong><span>{t('nurse.priority_action')}</span></div>
              <ChevronRight size={18} />
            </div>
          )}
          {!!dash?.unclassified_count && (
            <div className="nurse-alert nurse-alert--warning">
              <span className="nurse-alert__icon"><HelpCircle size={19} /></span>
              <div><strong>{dash.unclassified_count} {t('nurse.unclassified_patients')}</strong><span>{t('nurse.unclassified_action')}</span></div>
              <ChevronRight size={18} />
            </div>
          )}
        </section>
      ) : null}

      <KpiGrid items={kpis} ariaLabel={t('kpi.summary')} />

      <section className="nurse-workspace-grid">
        <div className="nurse-queue-card">
          <div className="nurse-card-header">
            <div>
              <h2>{t('nurse.live_queue')}</h2>
              <p>{t('nurse.live_queue_desc')}</p>
            </div>
            <span className="nurse-count-badge">{dash?.queue_count || 0}</span>
          </div>
          <div className="nurse-queue-toolbar">
            <label className="nurse-search">
              <Search size={16} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('nurse.search')} />
            </label>
            <div className="nurse-filters" role="group" aria-label={t('nurse.filter')}>
              {([
                ['all', t('nurse.filter_all')],
                ['priority', t('nurse.filter_priority')],
                ['unclassified', t('nurse.filter_unclassified')],
              ] as const).map(([value, label]) => (
                <button type="button" key={value} className={riskFilter === value ? 'active' : ''} onClick={() => setRiskFilter(value)}>{label}</button>
              ))}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="nurse-empty"><CheckCircle2 size={28} /><strong>{t('nurse.empty')}</strong></div>
          ) : (
            <div className="table-container nurse-table-wrap">
              <table className="nurse-queue-table">
                <thead><tr><th>#</th><th>{t('table.patient')}</th><th>{t('nurse.reason')}</th><th>{t('table.risk')}</th><th>{t('nurse.wait')}</th><th /></tr></thead>
                <tbody>
                  {filteredItems.map((i, index) => {
                  const r = riskBadge(i.risk_level);
                  const minutes = waitMinutes(i);
                  const initials = i.patient.split(' ').slice(0, 2).map(part => part[0]).join('');
                  return (
                    <tr key={i.id}>
                      <td><span className="nurse-priority-number">{index + 1}</span></td>
                      <td>
                        <div className="nurse-patient-cell">
                          <span className="nurse-patient-avatar">{initials}</span>
                          <span><strong>{i.patient}</strong><small>{specialtyLabel(i.specialty, t)}</small></span>
                        </div>
                      </td>
                      <td><span className="nurse-complaint">{i.chief_complaint || '—'}</span></td>
                      <td><span className="nurse-risk-badge" style={{ background: r.bg, color: r.color }}>{r.label}</span></td>
                      <td><span className={`nurse-wait ${minutes >= 30 ? 'late' : ''}`}><Clock3 size={14} /> {minutes} min</span></td>
                      <td>
                        <button
                          className="nurse-open-patient"
                          type="button"
                          onClick={() => i.patient_id && !preview ? navigate(`/clinician/patients/${i.patient_id}`) : setSelected(i)}
                        >
                          {t('nurse.open')}
                        </button>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="nurse-operations">
          {selected ? (
            <div className="nurse-patient-panel">
              <button className="nurse-panel-close" type="button" onClick={() => setSelected(null)} aria-label={t('common.close')}><X size={17} /></button>
              <div className="nurse-panel-avatar"><UserRound size={23} /></div>
              <span className="nurse-panel-eyebrow">{t('nurse.patient_detail')}</span>
              <h3>{selected.patient}</h3>
              <dl>
                <div><dt>{t('table.specialty')}</dt><dd>{specialtyLabel(selected.specialty, t)}</dd></div>
                <div><dt>{t('nurse.reason')}</dt><dd>{selected.chief_complaint || '—'}</dd></div>
                <div><dt>{t('table.risk')}</dt><dd>{riskBadge(selected.risk_level).label}</dd></div>
                <div><dt>{t('nurse.wait')}</dt><dd>{waitMinutes(selected)} min</dd></div>
              </dl>
              <button type="button" className="nurse-primary-action">{t('nurse.review_triage')} <ChevronRight size={16} /></button>
            </div>
          ) : (
            <>
              <div className="nurse-card-header">
                <div><h2>{t('nurse.shift_summary')}</h2><p>{t('nurse.shift_summary_desc')}</p></div>
              </div>
              <div className="nurse-sla">
                <div className="nurse-sla__ring" style={{ '--progress': `${sla * 3.6}deg` } as CSSProperties}>
                  <span><strong>{sla}%</strong><small>SLA</small></span>
                </div>
                <div><strong>{t('nurse.response_target')}</strong><span>{t('nurse.response_target_desc')}</span></div>
              </div>
              <div className="nurse-operation-list">
                <div><span className="nurse-op-icon nurse-op-icon--green"><ShieldCheck size={17} /></span><span><strong>{dash?.triages_today || 0}</strong><small>{t('nurse.completed_today')}</small></span></div>
                <div><span className="nurse-op-icon nurse-op-icon--orange"><Timer size={17} /></span><span><strong>{dash?.longest_wait_minutes || 0} min</strong><small>{t('nurse.longest_wait')}</small></span></div>
                <div><span className="nurse-op-icon nurse-op-icon--blue"><Activity size={17} /></span><span><strong>{dash?.queue_count ? Math.round(dash.triages_today / Math.max(1, dash.queue_count) * 10) / 10 : 0}×</strong><small>{t('nurse.flow_ratio')}</small></span></div>
              </div>
              <div className="nurse-priority-note">
                <AlertTriangle size={18} />
                <div><strong>{t('nurse.next_priority')}</strong><span>{dash?.urgent_count ? t('nurse.next_priority_urgent') : t('nurse.next_priority_clear')}</span></div>
              </div>
            </>
          )}
        </aside>
      </section>
    </div>
  );
}
