import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import type { PatientState, TriageHistoryItem, Consultation } from '../types';
import BookConsultationModal from '../components/BookConsultationModal';
import {
  Activity, Calendar, ArrowRight, ChevronRight,
  ClipboardList, HeartPulse, AlertTriangle, CheckCircle2,
  Clock, Shield, Zap, TrendingUp, Siren, User,
  FileText, Pill, Video, Stethoscope, FileCheck, MoreHorizontal,
  Droplets, Apple, Moon, Thermometer, Brain, Wind,
} from 'lucide-react';

const LOCALE_MAP: Record<string, string> = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR' };

export default function DashboardPage() {
  const { user } = useAuth();
  const [state, setState] = useState<PatientState | null>(null);
  const [triageHistory, setTriageHistory] = useState<TriageHistoryItem[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'triages' | 'consultations' | 'profile'>('summary');
  const [showBooking, setShowBooking] = useState(false);
  const [chronicConditions, setChronicConditions] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, tRes, cRes, pRes] = await Promise.allSettled([
          api.get('/api/v1/dashboard/patient-state'),
          api.get('/api/v1/triage/history'),
          api.get('/api/v1/consultations/'),
          api.get('/api/v1/patients/me'),
        ]);
        if (sRes.status === 'fulfilled') setState(sRes.value.data);
        if (tRes.status === 'fulfilled') setTriageHistory(tRes.value.data.slice(0, 5));
        if (cRes.status === 'fulfilled') setConsultations(cRes.value.data.slice(0, 5));
        if (pRes.status === 'fulfilled') setChronicConditions(pRes.value.data?.chronic_conditions || []);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const firstName = displayName.split(' ')[0];
  const { t, lang } = useT();
  const locale = LOCALE_MAP[lang] || 'pt-PT';

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const riskConfig = (risk?: string) => {
    switch (risk?.toUpperCase()) {
      case 'URGENT': return { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', label: t('risk.urgent'), icon: <Siren size={20} /> };
      case 'HIGH': return { color: '#f97316', bg: 'rgba(249,115,22,0.08)', label: t('risk.high'), icon: <AlertTriangle size={20} /> };
      case 'MEDIUM': return { color: '#eab308', bg: 'rgba(234,179,8,0.08)', label: t('risk.medium'), icon: <Clock size={20} /> };
      default: return { color: '#22c55e', bg: 'rgba(34,197,94,0.08)', label: t('risk.low'), icon: <CheckCircle2 size={20} /> };
    }
  };

  const risk = riskConfig(state?.last_triage_risk);

  /* Quick action cards — La Meva Salut style */
  const quickActions = [
    { icon: Activity, label: t('dash.qa_triage'), color: '#0d9488', bg: '#e0f7f5', to: '/triage' },
    { icon: Calendar, label: t('dash.qa_appointments'), color: '#2563eb', bg: '#dbeafe', to: '/consultations' },
    { icon: Pill, label: t('dash.qa_medication'), color: '#7c3aed', bg: '#ede9fe', to: '/self-care' },
    { icon: Video, label: t('dash.qa_econsulta'), color: '#059669', bg: '#d1fae5', to: '/consultations' },
    { icon: Stethoscope, label: t('dash.qa_doctors'), color: '#dc2626', bg: '#fee2e2', to: '/consultations' },
    { icon: FileText, label: t('dash.qa_results'), color: '#ea580c', bg: '#ffedd5', to: '/dashboard' },
    { icon: FileCheck, label: t('dash.qa_consents'), color: '#0891b2', bg: '#cffafe', to: '/consents' },
    { icon: User, label: t('dash.qa_profile'), color: '#64748b', bg: '#f1f5f9', to: '/patient/profile' },
  ];

  /* Highlights / Destaques — health tips */
  const highlights = [
    { icon: Droplets, title: t('dash.hl_hydration'), desc: t('dash.hl_hydration_desc'), color: '#0ea5e9' },
    { icon: Moon, title: t('dash.hl_sleep'), desc: t('dash.hl_sleep_desc'), color: '#6366f1' },
    { icon: Apple, title: t('dash.hl_nutrition'), desc: t('dash.hl_nutrition_desc'), color: '#22c55e' },
    { icon: HeartPulse, title: t('dash.hl_checkup'), desc: t('dash.hl_checkup_desc'), color: '#ef4444' },
  ];

  /* Chronic disease config — icons + colors */
  const chronicConfig: Record<string, { icon: typeof HeartPulse; color: string; tip: string }> = {
    diabetes: { icon: Activity, color: '#e17055', tip: t('dash.chronic_tip_diabetes') },
    hipertensão: { icon: HeartPulse, color: '#d63031', tip: t('dash.chronic_tip_hypertension') },
    hipertensao: { icon: HeartPulse, color: '#d63031', tip: t('dash.chronic_tip_hypertension') },
    hypertension: { icon: HeartPulse, color: '#d63031', tip: t('dash.chronic_tip_hypertension') },
    asma: { icon: Wind, color: '#6c5ce7', tip: t('dash.chronic_tip_asthma') },
    asthma: { icon: Wind, color: '#6c5ce7', tip: t('dash.chronic_tip_asthma') },
    dpoc: { icon: Wind, color: '#636e72', tip: t('dash.chronic_tip_copd') },
    copd: { icon: Wind, color: '#636e72', tip: t('dash.chronic_tip_copd') },
    epilepsia: { icon: Zap, color: '#0984e3', tip: t('dash.chronic_tip_epilepsy') },
    epilepsy: { icon: Zap, color: '#0984e3', tip: t('dash.chronic_tip_epilepsy') },
    drepanocitose: { icon: Droplets, color: '#e84393', tip: t('dash.chronic_tip_sickle') },
    'sickle cell': { icon: Droplets, color: '#e84393', tip: t('dash.chronic_tip_sickle') },
    vih: { icon: Shield, color: '#fd79a8', tip: t('dash.chronic_tip_hiv') },
    'vih/sida': { icon: Shield, color: '#fd79a8', tip: t('dash.chronic_tip_hiv') },
    hiv: { icon: Shield, color: '#fd79a8', tip: t('dash.chronic_tip_hiv') },
    'hiv/aids': { icon: Shield, color: '#fd79a8', tip: t('dash.chronic_tip_hiv') },
    tuberculose: { icon: Thermometer, color: '#b2bec3', tip: t('dash.chronic_tip_tb') },
    tuberculosis: { icon: Thermometer, color: '#b2bec3', tip: t('dash.chronic_tip_tb') },
    'insuficiência renal': { icon: Droplets, color: '#00b894', tip: t('dash.chronic_tip_kidney') },
    'kidney failure': { icon: Droplets, color: '#00b894', tip: t('dash.chronic_tip_kidney') },
    'doença cardíaca': { icon: HeartPulse, color: '#d63031', tip: t('dash.chronic_tip_heart') },
    'heart disease': { icon: HeartPulse, color: '#d63031', tip: t('dash.chronic_tip_heart') },
    'artrite reumatóide': { icon: Activity, color: '#e17055', tip: t('dash.chronic_tip_arthritis') },
    'rheumatoid arthritis': { icon: Activity, color: '#e17055', tip: t('dash.chronic_tip_arthritis') },
    parkinson: { icon: Brain, color: '#6c5ce7', tip: t('dash.chronic_tip_parkinson') },
    alzheimer: { icon: Brain, color: '#636e72', tip: t('dash.chronic_tip_alzheimer') },
    'esclerose múltipla': { icon: Brain, color: '#0984e3', tip: t('dash.chronic_tip_ms') },
    'multiple sclerosis': { icon: Brain, color: '#0984e3', tip: t('dash.chronic_tip_ms') },
    fibromialgia: { icon: Activity, color: '#a29bfe', tip: t('dash.chronic_tip_fibromyalgia') },
    fibromyalgia: { icon: Activity, color: '#a29bfe', tip: t('dash.chronic_tip_fibromyalgia') },
  };

  const getChronicInfo = (condition: string) => {
    const key = condition.toLowerCase().trim();
    return chronicConfig[key] || { icon: HeartPulse, color: 'var(--accent-teal)', tip: t('dash.chronic_tip_default') };
  };

  return (
    <>
      {/* ── Greeting Header (La Meva Salut style) ── */}
      <div className="dash-greeting">
        <div className="dash-greeting-bg" />
        <div className="dash-greeting-content">
          <div className="dash-greeting-avatar">
            {firstName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="dash-greeting-title">{t('dash.hello')} {firstName} 👋</h1>
            <p className="dash-greeting-subtitle">{t('dash.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* URGENT BANNER */}
      {state?.last_triage_action === 'ER_NOW' && state.current_state === 'triage_completed' && (
        <div className="dash-urgent-banner">
          <Siren size={24} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('dash.urgent_title')}</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.95 }}>{t('dash.urgent_desc')}</div>
          </div>
        </div>
      )}

      {/* ── Smart Status Card (compact) ── */}
      {state && state.current_state !== 'no_triage' && (
        <div className="dash-status-card">
          <div className="dash-status-bar" style={{
            background: state.last_triage_risk
              ? `linear-gradient(90deg, ${risk.color}, ${risk.color}88)`
              : 'linear-gradient(90deg, var(--accent-teal), var(--accent-cyan))',
          }} />
          <div className="dash-status-content">
            <div className="dash-status-icon" style={{
              background: state.last_triage_risk ? risk.bg : 'rgba(20,184,166,0.1)',
              color: state.last_triage_risk ? risk.color : 'var(--accent-teal)',
            }}>
              {state.current_state === 'triage_in_progress' ? <Clock size={22} /> :
               state.current_state === 'consultation_booked' ? <Calendar size={22} /> :
               state.current_state === 'consultation_completed' ? <CheckCircle2 size={22} /> :
               risk.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="dash-status-label">{t('dash.current_state')}</div>
              <div className="dash-status-title">{state.state_label || t('common.loading')}</div>
              {state.last_triage_risk && (
                <span className="dash-risk-badge" style={{ background: risk.bg, color: risk.color }}>
                  {risk.icon} {risk.label}
                </span>
              )}
            </div>
            {state.next_action && state.next_action !== 'none' && state.next_action !== 'go_to_er' && (
              <Link to={state.next_action === 'self_care' ? '/self-care' : state.next_action === 'book_consultation' ? '/consultations' : '/triage'} className="dash-status-action">
                <Zap size={14} /> {state.next_action_label}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Quick Actions Carousel (La Meva Salut style) ── */}
      <div className="dash-section-header">
        <h2>{t('dash.quick_actions')}</h2>
      </div>
      <div className="dash-carousel">
        <div className="dash-carousel-track">
          {quickActions.map(qa => (
            <Link key={qa.label} to={qa.to} className="dash-action-card" onClick={qa.label === t('dash.qa_appointments') ? (e) => { e.preventDefault(); setShowBooking(true); } : undefined}>
              <div className="dash-action-icon" style={{ background: qa.bg, color: qa.color }}>
                <qa.icon size={26} />
              </div>
              <span className="dash-action-label">{qa.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="dash-kpi-row">
        <div className="dash-kpi">
          <div className="dash-kpi-icon" style={{ background: state?.last_triage_risk ? risk.bg : 'rgba(20,184,166,0.1)', color: state?.last_triage_risk ? risk.color : 'var(--accent-teal)' }}>
            <Shield size={18} />
          </div>
          <div>
            <span className="dash-kpi-value" style={{ color: state?.last_triage_risk ? risk.color : 'var(--text-primary)' }}>
              {state?.last_triage_risk ? risk.label : '—'}
            </span>
            <span className="dash-kpi-label">{t('dash.last_risk')}</span>
          </div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-icon" style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
            <TrendingUp size={18} />
          </div>
          <div>
            <span className="dash-kpi-value">{state?.triage_count ?? 0}</span>
            <span className="dash-kpi-label">{t('dash.tab_triages')}</span>
          </div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-icon" style={{ background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>
            <Calendar size={18} />
          </div>
          <div>
            <span className="dash-kpi-value">{state?.completed_consultations ?? 0}</span>
            <span className="dash-kpi-label">{t('dash.consultations_done')}</span>
          </div>
        </div>
      </div>

      {/* ── Highlights / Destaques (La Meva Salut style) ── */}
      <div className="dash-section-header">
        <h2>{t('dash.highlights')}</h2>
      </div>
      <div className="dash-highlights">
        {highlights.map(h => (
          <div className="dash-highlight-card" key={h.title}>
            <div className="dash-highlight-icon" style={{ color: h.color, background: `${h.color}14` }}>
              <h.icon size={22} />
            </div>
            <div>
              <h4>{h.title}</h4>
              <p>{h.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Chronic Diseases Section ── */}
      <div className="dash-section-header" style={{ marginTop: '1.5rem' }}>
        <h2>{t('dash.chronic_title')}</h2>
      </div>
      {chronicConditions.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          {chronicConditions.map(condition => {
            const info = getChronicInfo(condition);
            const Icon = info.icon;
            return (
              <div key={condition} className="card" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '12px',
                  background: `${info.color}14`, color: info.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={22} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem', textTransform: 'capitalize' }}>{condition}</div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{info.tip}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <HeartPulse size={28} style={{ color: 'var(--accent-teal)', opacity: 0.5 }} />
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>{t('dash.no_chronic')}</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>{t('dash.no_chronic_desc')}</p>
          <Link to="/patient/profile" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <User size={14} /> {t('dash.update_profile')}
          </Link>
        </div>
      )}

      {/* ── Tab Navigation ── */}
      <div className="tab-nav" style={{ marginTop: '1.5rem', marginBottom: '1.25rem' }}>
        <button className={activeTab === 'summary' ? 'active' : ''} onClick={() => setActiveTab('summary')}>{t('dash.tab_summary')}</button>
        <button className={activeTab === 'triages' ? 'active' : ''} onClick={() => setActiveTab('triages')}>{t('dash.tab_triages')}</button>
        <button className={activeTab === 'consultations' ? 'active' : ''} onClick={() => setActiveTab('consultations')}>{t('dash.tab_consultations')}</button>
        <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>{t('dash.tab_profile')}</button>
      </div>

      {/* TAB: Summary */}
      {activeTab === 'summary' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {/* Recent Triages preview */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t('dash.recent_triages')}</h3>
              <button onClick={() => setActiveTab('triages')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-teal)', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {t('dash.view_all')} <ArrowRight size={13} />
              </button>
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
                      {triageHistory.slice(0, 3).map(th => {
                        const r = riskConfig(th.risk_level);
                        return (
                          <tr key={th.session_id}>
                            <td style={{ color: 'var(--text-primary)' }}>{th.chief_complaint}</td>
                            <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.15rem 0.5rem', borderRadius: '6px', background: r.bg, color: r.color, fontSize: '0.75rem', fontWeight: 600 }}>{th.risk_level || th.status}</span></td>
                            <td>{new Date(th.created_at).toLocaleDateString(locale)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Recent Consultations preview */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t('dash.consultations')}</h3>
              <button onClick={() => setActiveTab('consultations')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-teal)', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {t('dash.manage')} <ArrowRight size={13} />
              </button>
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
                  {state?.current_state === 'triage_completed' ? (
                    <button onClick={() => setShowBooking(true)} className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                      <Calendar size={14} /> {t('dash.book_consultation')}
                    </button>
                  ) : (
                    <Link to="/triage" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                      <Activity size={14} /> {t('dash.btn_start_triage')}
                    </Link>
                  )}
                </div>
              ) : (
                <div className="table-container" style={{ border: 'none' }}>
                  <table>
                    <thead><tr><th>{t('table.specialty')}</th><th>{t('table.status')}</th><th>{t('table.date')}</th></tr></thead>
                    <tbody>
                      {consultations.slice(0, 3).map(c => (
                        <tr key={c.id}>
                          <td style={{ color: 'var(--text-primary)' }}>{c.specialty}</td>
                          <td><span className={`badge ${c.status === 'completed' ? 'badge-success' : c.status === 'in_progress' ? 'badge-info' : c.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>{c.status}</span></td>
                          <td>{c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString(locale) : new Date(c.created_at).toLocaleDateString(locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Triages (full history) */}
      {activeTab === 'triages' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t('dash.recent_triages')}</h3>
            <Link to="/triage" className="btn btn-primary btn-sm">
              <Activity size={14} /> {t('dash.btn_start_triage')}
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
                  <thead><tr><th>{t('table.complaint')}</th><th>{t('table.risk')}</th><th>{t('table.recommendation')}</th><th>{t('table.score')}</th><th>{t('table.date')}</th></tr></thead>
                  <tbody>
                    {triageHistory.map(th => {
                      const r = riskConfig(th.risk_level);
                      return (
                        <tr key={th.session_id}>
                          <td style={{ color: 'var(--text-primary)' }}>{th.chief_complaint}</td>
                          <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.15rem 0.5rem', borderRadius: '6px', background: r.bg, color: r.color, fontSize: '0.75rem', fontWeight: 600 }}>{th.risk_level || th.status}</span></td>
                          <td style={{ fontSize: '0.82rem' }}>{th.recommended_action || '—'}</td>
                          <td style={{ fontSize: '0.82rem' }}>{th.score != null ? th.score.toFixed(1) : '—'}</td>
                          <td>{new Date(th.created_at).toLocaleDateString(locale)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Consultations (full list) */}
      {activeTab === 'consultations' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t('dash.consultations')}</h3>
            {state?.current_state === 'triage_completed' && (
              <button onClick={() => setShowBooking(true)} className="btn btn-primary btn-sm">
                <Calendar size={14} /> {t('dash.book_consultation')}
              </button>
            )}
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
                {state?.current_state === 'triage_completed' ? (
                  <button onClick={() => setShowBooking(true)} className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                    <Calendar size={14} /> {t('dash.book_consultation')}
                  </button>
                ) : (
                  <Link to="/triage" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                    <Activity size={14} /> {t('dash.btn_start_triage')}
                  </Link>
                )}
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table>
                  <thead><tr><th>{t('table.specialty')}</th><th>{t('table.status')}</th><th>{t('table.scheduled')}</th><th>{t('table.payment')}</th><th>{t('table.created')}</th></tr></thead>
                  <tbody>
                    {consultations.map(c => (
                      <tr key={c.id}>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.specialty}</td>
                        <td><span className={`badge ${c.status === 'completed' ? 'badge-success' : c.status === 'in_progress' ? 'badge-info' : c.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>{c.status}</span></td>
                        <td>{c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString(locale) : '—'}</td>
                        <td><span className={`badge ${c.payment_status === 'paid' ? 'badge-success' : 'badge-neutral'}`}>{c.payment_status}</span></td>
                        <td>{new Date(c.created_at).toLocaleDateString(locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Profile */}
      {activeTab === 'profile' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: 'rgba(20,184,166,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-teal)',
            }}>
              <User size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{displayName}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{user?.email}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-darker)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{t('dash.tab_triages')}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{state?.triage_count ?? 0}</div>
            </div>
            <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-darker)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{t('dash.tab_consultations')}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{state?.consultation_count ?? 0}</div>
            </div>
            <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-darker)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{t('dash.resolved')}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{state?.resolution_rate != null ? `${state.resolution_rate}%` : '—'}</div>
            </div>
          </div>

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
      )}

      {/* Book Consultation Modal */}
      <BookConsultationModal
        open={showBooking}
        onClose={() => setShowBooking(false)}
        patientState={state}
        onBooked={(c: Consultation) => { setConsultations(prev => [c, ...prev]); setShowBooking(false); }}
      />
    </>
  );
}
