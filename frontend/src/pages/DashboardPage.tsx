import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import type { PatientState, TriageHistoryItem, Consultation } from '../types';
import {
  Activity, Calendar, ArrowRight, ChevronRight,
  ClipboardList, HeartPulse, AlertTriangle, CheckCircle2,
  Clock, Shield, Zap, TrendingUp, Siren,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [state, setState] = useState<PatientState | null>(null);
  const [triageHistory, setTriageHistory] = useState<TriageHistoryItem[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, tRes, cRes] = await Promise.allSettled([
          api.get('/api/v1/dashboard/patient-state'),
          api.get('/api/v1/triage/history'),
          api.get('/api/v1/consultations/'),
        ]);
        if (sRes.status === 'fulfilled') setState(sRes.value.data);
        if (tRes.status === 'fulfilled') setTriageHistory(tRes.value.data.slice(0, 5));
        if (cRes.status === 'fulfilled') setConsultations(cRes.value.data.slice(0, 5));
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const { t } = useT();

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const riskConfig = (risk?: string) => {
    switch (risk?.toUpperCase()) {
      case 'URGENT': return { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', label: t('risk.urgent'), icon: <Siren size={20} /> };
      case 'HIGH': return { color: '#f97316', bg: 'rgba(249,115,22,0.08)', label: t('risk.high'), icon: <AlertTriangle size={20} /> };
      case 'MEDIUM': return { color: '#eab308', bg: 'rgba(234,179,8,0.08)', label: t('risk.medium'), icon: <Clock size={20} /> };
      default: return { color: '#22c55e', bg: 'rgba(34,197,94,0.08)', label: t('risk.low'), icon: <CheckCircle2 size={20} /> };
    }
  };

  const urgencyConfig = (urgency: string) => {
    switch (urgency) {
      case 'critical': return { color: '#ef4444', bg: '#ef4444', text: '#fff' };
      case 'high': return { color: '#f97316', bg: '#f97316', text: '#fff' };
      case 'medium': return { color: '#eab308', bg: '#eab308', text: '#1e1e1e' };
      default: return { color: 'var(--accent-teal)', bg: 'var(--accent-teal)', text: '#fff' };
    }
  };

  const actionRoute = (action: string) => {
    switch (action) {
      case 'start_triage': case 'complete_triage': return '/triage';
      case 'book_consultation': case 'self_care': return '/consultations';
      default: return '/triage';
    }
  };

  const actionMap = (action?: string) => {
    switch (action) {
      case 'ER_NOW': return t('action.er_now');
      case 'DOCTOR_NOW': return t('action.doctor_now');
      case 'DOCTOR_24H': return t('action.doctor_24h');
      default: return t('action.self_care');
    }
  };

  const risk = riskConfig(state?.last_triage_risk);
  const urgency = urgencyConfig(state?.next_action_urgency || 'low');

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
          {t('dash.panel')}
        </p>
        <h1>{t('dash.hello')} {displayName} 👋</h1>
        <p>{t('dash.subtitle')}</p>
      </div>

      {/* URGENT BANNER */}
      {state?.last_triage_action === 'ER_NOW' && state.current_state === 'triage_completed' && (
        <div style={{
          background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff',
          borderRadius: '14px', padding: '1.25rem 1.5rem', marginBottom: '1.25rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
          boxShadow: '0 4px 20px rgba(239,68,68,0.3)',
        }}>
          <Siren size={28} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.2rem' }}>{t('dash.urgent_title')}</div>
            <div style={{ fontSize: '0.88rem', opacity: 0.95 }}>
              {t('dash.urgent_desc')}
            </div>
          </div>
        </div>
      )}

      {/* SMART STATUS CARD */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '14px', padding: '1.5rem', marginBottom: '1.25rem',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: state?.last_triage_risk
            ? `linear-gradient(90deg, ${risk.color}, ${risk.color}88)`
            : 'linear-gradient(90deg, var(--accent-teal), var(--accent-cyan))',
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '14px',
            background: state?.last_triage_risk ? risk.bg : 'rgba(20,184,166,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: state?.last_triage_risk ? risk.color : 'var(--accent-teal)', flexShrink: 0,
          }}>
            {state?.current_state === 'no_triage' ? <Activity size={24} /> :
             state?.current_state === 'triage_in_progress' ? <Clock size={24} /> :
             state?.current_state === 'consultation_booked' ? <Calendar size={24} /> :
             state?.current_state === 'consultation_completed' ? <CheckCircle2 size={24} /> :
             risk.icon}
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
              Estado Atual
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              {state?.state_label || t('common.loading')}
            </div>

            {state?.current_state === 'no_triage' && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                {t('dash.no_triage_desc')}
              </p>
            )}
            {state?.current_state === 'triage_in_progress' && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                {t('dash.triage_in_progress')}
                <br /><strong style={{ color: 'var(--text-primary)' }}>{t('dash.complaint')}</strong> {state.last_triage_complaint}
              </p>
            )}
            {state?.current_state === 'triage_completed' && state.last_triage_risk && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.15rem 0.6rem', borderRadius: '6px',
                  background: risk.bg, color: risk.color, fontWeight: 600, fontSize: '0.78rem', marginRight: '0.5rem',
                }}>
                  {risk.icon} {t('dash.risk')} {risk.label}
                </span>
                {actionMap(state.last_triage_action)}
                {state.next_action_deadline && (
                  <span style={{ fontWeight: 600, color: risk.color }}> — {state.next_action_deadline}</span>
                )}
              </p>
            )}
            {state?.current_state === 'consultation_booked' && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                {t('dash.consultation_booked')}
              </p>
            )}
            {state?.current_state === 'consultation_completed' && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                {t('dash.consultation_completed')}
              </p>
            )}
          </div>

          {state?.next_action && state.next_action !== 'none' && state.next_action !== 'go_to_er' && (
            <Link to={actionRoute(state.next_action)} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1.5rem', borderRadius: '10px',
              background: urgency.bg, color: urgency.text,
              fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none',
              boxShadow: `0 4px 14px ${urgency.color}33`,
              alignSelf: 'center', whiteSpace: 'nowrap',
            }}>
              <Zap size={16} /> {state.next_action_label}
            </Link>
          )}
        </div>
      </div>

      {/* 3 SMART KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '10px',
              background: state?.last_triage_risk ? risk.bg : 'rgba(20,184,166,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: state?.last_triage_risk ? risk.color : 'var(--accent-teal)',
            }}>
              <Shield size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{t('dash.last_risk')}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: state?.last_triage_risk ? risk.color : 'var(--text-primary)' }}>
                {state?.last_triage_risk ? risk.label : '—'}
              </div>
            </div>
          </div>
          {state?.last_triage_score != null && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Score: <strong>{state.last_triage_score.toFixed(1)}</strong> · {state.last_triage_complaint}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '10px',
              background: `${urgency.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: urgency.color,
            }}>
              <Zap size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{t('dash.next_action')}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {state?.next_action_deadline || t('dash.whenever')}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {state?.next_action_label || t('dash.start_triage')}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '10px',
              background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#8b5cf6',
            }}>
              <TrendingUp size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{t('dash.history')}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {state?.triage_count ?? 0} {(state?.triage_count ?? 0) !== 1 ? t('dash.triages') : t('dash.triage_singular')}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {state?.completed_consultations ?? 0} {(state?.completed_consultations ?? 0) !== 1 ? t('dash.consultations_done') : t('dash.consultation_done')}
            {state?.resolution_rate != null && <> · {state.resolution_rate}% {t('dash.resolved')}</>}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <Link to="/triage" className="btn btn-primary"><Activity size={16} /> {t('dash.btn_start_triage')}</Link>
        <Link to="/consultations" className="btn btn-secondary"><Calendar size={16} /> {t('dash.btn_consultations')}</Link>
        <Link to="/patient/profile" className="btn btn-secondary"><ClipboardList size={16} /> {t('dash.btn_profile')}</Link>
      </div>

      {/* Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.25rem' }}>
        {/* Triage History */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t('dash.recent_triages')}</h3>
            <Link to="/triage" style={{ color: 'var(--accent-teal)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {t('dash.view_all')} <ArrowRight size={13} />
            </Link>
          </div>
          <div style={{ padding: '0.5rem 0' }}>
            {triageHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Activity size={24} style={{ color: 'var(--accent-teal)' }} /></div>
                <div className="empty-state-title">{t('dash.no_triages')}</div>
                <div className="empty-state-desc">{t('dash.no_triages_desc')}</div>
                <Link to="/triage" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                  <Activity size={14} /> {t('dash.btn_start_triage')}
                </Link>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table>
                  <thead><tr><th>{t('table.complaint')}</th><th>{t('table.risk')}</th><th>{t('table.date')}</th></tr></thead>
                  <tbody>
                    {triageHistory.map(th => {
                      const r = riskConfig(th.risk_level);
                      return (
                        <tr key={th.session_id}>
                          <td style={{ color: 'var(--text-primary)' }}>{th.chief_complaint}</td>
                          <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.15rem 0.5rem', borderRadius: '6px', background: r.bg, color: r.color, fontSize: '0.75rem', fontWeight: 600 }}>{th.risk_level || th.status}</span></td>
                          <td>{new Date(th.created_at).toLocaleDateString('pt')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Consultations */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t('dash.consultations')}</h3>
            <Link to="/consultations" style={{ color: 'var(--accent-teal)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {t('dash.manage')} <ArrowRight size={13} />
            </Link>
          </div>
          <div style={{ padding: '0.5rem 0' }}>
            {consultations.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Calendar size={24} style={{ color: 'var(--accent-teal)' }} /></div>
                <div className="empty-state-title">{t('dash.no_consultations')}</div>
                <div className="empty-state-desc">
                  {state?.current_state === 'triage_completed'
                    ? t('dash.triage_done_book')
                    : t('dash.complete_triage_first')}
                </div>
                <Link to={state?.current_state === 'triage_completed' ? '/consultations' : '/triage'}
                  className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                  {state?.current_state === 'triage_completed'
                    ? <><Calendar size={14} /> {t('dash.book_consultation')}</>
                    : <><Activity size={14} /> {t('dash.btn_start_triage')}</>}
                </Link>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table>
                  <thead><tr><th>{t('table.specialty')}</th><th>{t('table.status')}</th><th>{t('table.date')}</th></tr></thead>
                  <tbody>
                    {consultations.map(c => (
                      <tr key={c.id}>
                        <td style={{ color: 'var(--text-primary)' }}>{c.specialty}</td>
                        <td><span className={`badge ${c.status === 'completed' ? 'badge-success' : c.status === 'in_progress' ? 'badge-info' : c.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>{c.status}</span></td>
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

      {/* Profile Alert */}
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div style={{ padding: '1rem 1.25rem' }}>
          <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', borderLeft: '4px solid var(--accent-teal)', background: 'rgba(20,184,166,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <HeartPulse size={14} style={{ color: 'var(--accent-teal)' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{t('dash.keep_profile')}</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
              {t('dash.profile_tip')}{' '}
              <Link to="/patient/profile" style={{ color: 'var(--accent-teal)', fontWeight: 600, textDecoration: 'none' }}>
                {t('dash.update_profile')} <ChevronRight size={12} style={{ verticalAlign: 'middle' }} />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
