import { useState, useEffect } from 'react';
import {
  FileText, AlertTriangle, CheckCircle2, X, ChevronDown, ChevronUp,
  Activity, Calendar, Stethoscope, AlertCircle, RefreshCw,
  Search, Loader2, SidebarOpen, Pill, Heart,
  ShieldCheck,
} from 'lucide-react';
import api from '../api';
import { useT, type Lang } from '../i18n/LanguageContext';

const LOCALES: Record<Lang, string> = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', zh: 'zh-CN' };

interface RxRequest {
  id: string;
  patient_id: string;
  doctor_id: string;
  medication_name: string;
  dose?: string;
  frequency?: string;
  reason?: string;
  status: string;
  risk_level?: string;
  risk_alert?: string;
  doctor_note?: string;
  adjusted_dose?: string;
  adjusted_frequency?: string;
  created_at: string;
  decided_at?: string;
  patient_name?: string;
  patient_age?: number;
  patient_gender?: string;
  chronic_conditions?: string[];
  allergies?: string[];
}

interface ClinicalSummary {
  identity: { id: string; name: string; age: number | null; gender: string | null; blood_type: string | null; date_of_birth: string | null; city: string | null };
  chronic_conditions: string[];
  allergies: string[];
  current_medications: { id: string; name: string; dosage: string | null; frequency: string | null }[];
  last_consultations: { id: string; specialty: string; status: string; scheduled_at: string | null }[];
  last_vitals: { reading_type: string; value: number | null; unit: string | null; measured_at: string }[];
  previous_prescriptions: { id: string; medication_name: string; status: string; created_at: string }[];
  risk_flags: string[];
}

interface PemStatus {
  provider: string;
  network: string;
  configured: boolean;
  mode: string;
  message: string;
  requirements: Record<string, boolean>;
}

const riskConfig = {
  low:    { key: 'dpres.risk_low',    color: '#059669', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
  medium: { key: 'dpres.risk_medium', color: '#d97706', bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.3)'   },
  high:   { key: 'dpres.risk_high',   color: '#dc2626', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)'   },
};

const actionKeyMap: Record<string, string> = {
  approve:            'dpres.act_approve',
  adjust:             'dpres.act_adjust',
  consult_requested:  'dpres.act_consult',
  exams_requested:    'dpres.act_exams',
  reject:             'dpres.act_reject',
};

type Action = 'approve' | 'adjust' | 'consult_requested' | 'exams_requested' | 'reject';

export default function DoctorPrescriptionsPage() {
  const { t, lang } = useT();
  const locale = LOCALES[lang] || 'pt-PT';
  const [requests, setRequests] = useState<RxRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<{ id: string; action: Action } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [adjDoseText, setAdjDoseText] = useState('');
  const [adjFreqText, setAdjFreqText] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [quickView, setQuickView] = useState<RxRequest | null>(null);
  const [clinicalSummary, setClinicalSummary] = useState<ClinicalSummary | null>(null);
  const [clinicalLoading, setClinicalLoading] = useState(false);
  const [pemStatus, setPemStatus] = useState<PemStatus | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const params = filter === 'all' ? { status: 'all' } : { status: 'pending' };
      const { data } = await api.get<RxRequest[]>('/api/v1/doctor/prescription-requests', { params });
      setRequests(data);
      if (data.length > 0) setExpanded(data[0].id);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? t('dpres.load_error'));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);
  useEffect(() => {
    api.get<PemStatus>('/api/v1/clinical-operations/integrations/pem/status')
      .then(response => setPemStatus(response.data))
      .catch(() => {});
  }, []);

  const openQuickView = async (rx: RxRequest) => {
    if (quickView?.id === rx.id) { setQuickView(null); setClinicalSummary(null); return; }
    setQuickView(rx);
    setClinicalSummary(null);
    setClinicalLoading(true);
    try {
      const { data } = await api.get<ClinicalSummary>(`/api/v1/doctor/patients/${rx.patient_id}/clinical-summary`);
      setClinicalSummary(data);
    } catch {
      // summary may not be available if no consultation yet — fall back to basic data
    } finally {
      setClinicalLoading(false);
    }
  };

  const decide = async (id: string, action: Action, note?: string, adjDose?: string, adjFreq?: string) => {
    setSubmitting(id);
    try {
      const { data } = await api.post<RxRequest>(`/api/v1/doctor/prescription-requests/${id}/decide`, {
        action, doctor_note: note || undefined,
        adjusted_dose: adjDose || undefined, adjusted_frequency: adjFreq || undefined,
      });
      setRequests(prev => prev.map(r => r.id === id ? data : r));
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? t('dpres.decide_error'));
    } finally { setSubmitting(null); setNoteFor(null); setNoteText(''); setAdjDoseText(''); setAdjFreqText(''); }
  };

  const handleAction = (rx: RxRequest, action: Action) => {
    if (action === 'reject' || action === 'adjust') { setNoteFor({ id: rx.id, action }); setNoteText(''); setAdjDoseText(''); setAdjFreqText(''); }
    else decide(rx.id, action);
  };

  const pending = requests.filter(r => r.status === 'pending');
  const done    = requests.filter(r => r.status !== 'pending');
  const shown   = pending.filter(r =>
    !search || (r.patient_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    r.medication_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', gap: '1rem', maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <section style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.75rem', alignItems: 'center',
          marginBottom: '1rem', padding: '0.85rem 1rem', border: `1px solid ${pemStatus?.configured ? '#a7f3d0' : '#fde68a'}`,
          borderRadius: 12, background: pemStatus?.configured ? '#ecfdf5' : '#fffbeb',
        }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 10, background: pemStatus?.configured ? '#d1fae5' : '#fef3c7', color: pemStatus?.configured ? '#047857' : '#b45309' }}>
            <ShieldCheck size={19} />
          </span>
          <div>
            <strong style={{ display: 'block', fontSize: '0.78rem' }}>{t('dpres.pem_title')}</strong>
            <span style={{ display: 'block', marginTop: '0.15rem', color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
              {pemStatus?.message || t('dpres.pem_checking')}
            </span>
          </div>
          <span style={{ padding: '0.25rem 0.55rem', borderRadius: 999, background: pemStatus?.configured ? '#047857' : '#b45309', color: '#fff', fontSize: '0.58rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
            {pemStatus?.configured ? t('dpres.pem_configured') : t('dpres.pem_prep')}
          </span>
        </section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} style={{ color: '#ef4444' }} /> {t('dpres.title')}
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>{t('dpres.subtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {pending.length > 0 && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '0.35rem 0.75rem', borderRadius: 999 }}>{pending.length} {t('dpres.pending_badge')}</span>}
            <button onClick={load} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.4rem 0.75rem', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}>
              <RefreshCw size={13} /> {t('common.refresh')}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="form-input" placeholder={t('dpres.search_ph')} value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.1rem' }} />
          </div>
          {(['pending', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '0.5rem 0.9rem', borderRadius: '8px', border: `1.5px solid ${filter === f ? 'var(--brand-primary)' : 'var(--border)'}`, background: filter === f ? 'var(--brand-light)' : 'var(--bg-card)', color: filter === f ? 'var(--brand-primary)' : 'var(--text-secondary)', fontWeight: filter === f ? 700 : 500, fontSize: '0.8rem', cursor: 'pointer' }}>
              {f === 'pending' ? t('dpres.filter_pending') : t('dpres.filter_all')}
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}><Loader2 size={28} style={{ display: 'block', margin: '0 auto 0.5rem' }} />{t('common.loading')}</div>}
        {!loading && error && <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', color: '#dc2626', fontSize: '0.85rem' }}>{error}</div>}
        {!loading && !error && shown.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <CheckCircle2 size={40} style={{ color: '#10b981', margin: '0 auto 0.75rem', display: 'block' }} />
            <div style={{ fontWeight: 700, color: '#10b981' }}>{t('dpres.empty_title')}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{t('dpres.empty_desc')}</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {shown.map(rx => {
            const risk = riskConfig[(rx.risk_level as keyof typeof riskConfig) ?? 'low'];
            const isOpen = expanded === rx.id;
            const isBusy = submitting === rx.id;
            return (
              <div key={rx.id} className="card" style={{ padding: 0, overflow: 'hidden', border: rx.risk_level === 'high' ? `2px solid ${risk.border}` : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', cursor: 'pointer', background: rx.risk_level === 'high' ? 'rgba(239,68,68,0.03)' : undefined }}
                  onClick={() => setExpanded(isOpen ? null : rx.id)}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: risk.bg, color: risk.color, fontWeight: 800, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `2px solid ${risk.border}` }}>
                    {(rx.patient_name ?? 'P').split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{rx.patient_name ?? 'Paciente'}{rx.patient_age ? ` · ${rx.patient_age} ${t('dpat.years')}` : ''}</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 500, marginTop: '0.1rem' }}>💊 {rx.medication_name}{rx.dose ? ` — ${rx.dose}` : ''}{rx.frequency ? ` ${rx.frequency}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', flexShrink: 0 }}>
                    {rx.risk_level && <span style={{ fontSize: '0.73rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 999, background: risk.bg, color: risk.color }}>{t(risk.key)}</span>}
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(rx.created_at).toLocaleDateString(locale)}</span>
                    <button onClick={e => { e.stopPropagation(); openQuickView(rx); }} style={{ fontSize: '0.72rem', background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <SidebarOpen size={13} /> {t('dpres.profile')}
                    </button>
                    {isOpen ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </div>

                {rx.risk_alert && (
                  <div style={{ display: 'flex', gap: '0.6rem', padding: '0.6rem 1.25rem', background: rx.risk_level === 'high' ? 'rgba(239,68,68,0.07)' : 'rgba(234,179,8,0.06)', borderTop: '1px solid var(--border)' }}>
                    <AlertCircle size={15} style={{ color: risk.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem', color: risk.color, fontWeight: 500 }}>{rx.risk_alert}</span>
                  </div>
                )}

                {isOpen && (
                  <div style={{ padding: '1.25rem', borderTop: rx.risk_alert ? undefined : '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      {(rx.chronic_conditions ?? []).length > 0 && (
                        <DetailBlock title={t('dpres.detail_chronic')}>
                          {(rx.chronic_conditions ?? []).map((c: string) => <Tag key={c} label={c} color="rgba(59,130,246,0.1)" textColor="#3b82f6" />)}
                        </DetailBlock>
                      )}
                      {(rx.allergies ?? []).length > 0 && (
                        <DetailBlock title={t('dpres.detail_allergies')}>
                          {(rx.allergies ?? []).map((a: string) => <Tag key={a} label={a} color="rgba(239,68,68,0.1)" textColor="#dc2626" />)}
                        </DetailBlock>
                      )}
                    </div>
                    {rx.reason && (
                      <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(0,0,0,0.025)', border: '1px solid var(--border)', marginBottom: '1.25rem', fontSize: '0.83rem' }}>
                        <span style={{ fontWeight: 700 }}>{t('dpres.reason')} </span>{rx.reason}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <ActionBtn onClick={() => handleAction(rx, 'approve')} disabled={isBusy} color="#059669" bg="rgba(16,185,129,0.1)" border="rgba(16,185,129,0.3)" icon={<CheckCircle2 size={15} />} label={isBusy ? '…' : t('dpres.approve')} />
                      <ActionBtn onClick={() => handleAction(rx, 'adjust')} disabled={isBusy} color="#d97706" bg="rgba(234,179,8,0.1)" border="rgba(234,179,8,0.3)" icon={<Stethoscope size={15} />} label={t('dpres.adjust')} />
                      <ActionBtn onClick={() => handleAction(rx, 'consult_requested')} disabled={isBusy} color="#3b82f6" bg="rgba(59,130,246,0.1)" border="rgba(59,130,246,0.3)" icon={<Calendar size={15} />} label={t('dpres.request_consult')} />
                      <ActionBtn onClick={() => handleAction(rx, 'exams_requested')} disabled={isBusy} color="#8b5cf6" bg="rgba(139,92,246,0.1)" border="rgba(139,92,246,0.3)" icon={<Activity size={15} />} label={t('dpres.request_exams')} />
                      <ActionBtn onClick={() => handleAction(rx, 'reject')} disabled={isBusy} color="#dc2626" bg="rgba(239,68,68,0.08)" border="rgba(239,68,68,0.25)" icon={<X size={15} />} label={t('dpres.reject')} />
                    </div>
                    {noteFor?.id === rx.id && (
                      <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '10px', background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                          {noteFor.action === 'reject' ? t('dpres.note_reject') : t('dpres.note_adjust')}
                        </label>
                        {noteFor.action === 'adjust' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <input className="form-input" placeholder={t('dpres.new_dose')} value={adjDoseText} onChange={e => setAdjDoseText(e.target.value)} />
                            <input className="form-input" placeholder={t('dpres.new_freq')} value={adjFreqText} onChange={e => setAdjFreqText(e.target.value)} />
                          </div>
                        )}
                        <textarea className="form-input" rows={2} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder={t('dpres.justification_ph')} style={{ resize: 'vertical', marginBottom: '0.6rem' }} />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => decide(rx.id, noteFor.action, noteText, adjDoseText, adjFreqText)} disabled={!noteText.trim()} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--brand-primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>{t('common.confirm')}</button>
                          <button onClick={() => setNoteFor(null)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'none', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>{t('common.cancel')}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {done.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>{t('dpres.processed')} ({done.length})</div>
            {done.map(rx => (
              <div key={rx.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: '0.4rem', opacity: 0.6 }}>
                <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 500 }}>{rx.patient_name ?? 'Paciente'} — {rx.medication_name}</span>
                <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 600 }}>{actionKeyMap[rx.status] ? t(actionKeyMap[rx.status]) : rx.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {quickView && (
        <div style={{ width: 290, flexShrink: 0 }}>
          <div className="card" style={{ padding: '1.25rem', position: 'sticky', top: '1rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>{t('dpres.quick_profile')}</span>
              <button onClick={() => { setQuickView(null); setClinicalSummary(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>

            {clinicalLoading && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)' }}>
                <Loader2 size={20} style={{ display: 'block', margin: '0 auto 0.4rem' }} />
                <span style={{ fontSize: '0.8rem' }}>{t('dpres.loading_history')}</span>
              </div>
            )}

            {!clinicalLoading && (
              <>
                {/* Identity */}
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--brand-light)', color: 'var(--brand-primary)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem', fontSize: '0.9rem' }}>
                    {((clinicalSummary?.identity.name ?? quickView.patient_name) ?? 'P').split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{clinicalSummary?.identity.name ?? quickView.patient_name ?? 'Paciente'}</div>
                  <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>
                    {clinicalSummary?.identity.age ?? quickView.patient_age ?? '—'} {t('dpat.years')}
                    {(clinicalSummary?.identity.gender ?? quickView.patient_gender) ? ` · ${clinicalSummary?.identity.gender ?? quickView.patient_gender}` : ''}
                    {clinicalSummary?.identity.blood_type ? ` · ${clinicalSummary.identity.blood_type}` : ''}
                  </div>
                </div>

                {/* Risk flags */}
                {(clinicalSummary?.risk_flags ?? []).length > 0 && (
                  <div style={{ marginBottom: '0.85rem', padding: '0.6rem 0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <SectionLabel>{t('dpres.risk_alerts')}</SectionLabel>
                    {clinicalSummary!.risk_flags.map((f, i) => <div key={i} style={{ fontSize: '0.76rem', color: '#dc2626', marginBottom: '0.2rem' }}>• {f}</div>)}
                  </div>
                )}

                {/* Chronic conditions */}
                {((clinicalSummary?.chronic_conditions ?? quickView.chronic_conditions) ?? []).length > 0 && (
                  <div style={{ marginBottom: '0.85rem' }}>
                    <SectionLabel>{t('dpres.detail_chronic')}</SectionLabel>
                    {(clinicalSummary?.chronic_conditions ?? quickView.chronic_conditions ?? []).map((c: string) => <Tag key={c} label={c} color="rgba(59,130,246,0.1)" textColor="#3b82f6" />)}
                  </div>
                )}

                {/* Allergies */}
                {((clinicalSummary?.allergies ?? quickView.allergies) ?? []).length > 0 && (
                  <div style={{ marginBottom: '0.85rem' }}>
                    <SectionLabel>{t('dpres.detail_allergies')}</SectionLabel>
                    {(clinicalSummary?.allergies ?? quickView.allergies ?? []).map((a: string) => <Tag key={a} label={a} color="rgba(239,68,68,0.1)" textColor="#dc2626" />)}
                  </div>
                )}

                {/* Current medications */}
                {clinicalSummary && clinicalSummary.current_medications.length > 0 && (
                  <div style={{ marginBottom: '0.85rem' }}>
                    <SectionLabel><Pill size={11} style={{ display: 'inline', marginRight: 3 }} />{t('dpres.current_meds')}</SectionLabel>
                    {clinicalSummary.current_medications.map(m => (
                      <div key={m.id} style={{ fontSize: '0.77rem', padding: '0.25rem 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                        {m.dosage && <span style={{ color: 'var(--text-muted)' }}> · {m.dosage}</span>}
                        {m.frequency && <span style={{ color: 'var(--text-muted)' }}> · {m.frequency}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Latest vitals */}
                {clinicalSummary && clinicalSummary.last_vitals.length > 0 && (
                  <div style={{ marginBottom: '0.85rem' }}>
                    <SectionLabel><Heart size={11} style={{ display: 'inline', marginRight: 3 }} />{t('dpres.latest_vitals')}</SectionLabel>
                    {clinicalSummary.last_vitals.slice(0, 5).map((v, i) => (
                      <div key={i} style={{ fontSize: '0.77rem', display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ textTransform: 'capitalize' }}>{v.reading_type.replace(/_/g, ' ')}</span>
                        <span style={{ fontWeight: 600 }}>{v.value ?? '—'}{v.unit ? ` ${v.unit}` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Last consultations */}
                {clinicalSummary && clinicalSummary.last_consultations.length > 0 && (
                  <div style={{ marginBottom: '0.85rem' }}>
                    <SectionLabel>{t('dpres.prev_consults')}</SectionLabel>
                    {clinicalSummary.last_consultations.slice(0, 3).map(c => (
                      <div key={c.id} style={{ fontSize: '0.77rem', padding: '0.2rem 0', borderBottom: '1px solid var(--border)' }}>
                        {c.specialty.replace(/_/g, ' ')} · <span style={{ color: 'var(--text-muted)' }}>{c.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Current request */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  <SectionLabel>{t('dpres.current_request')}</SectionLabel>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{quickView.medication_name}</div>
                  {quickView.dose && <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>{quickView.dose} · {quickView.frequency}</div>}
                  {quickView.reason && <div style={{ fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>"{quickView.reason}"</div>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>{children}</div>;
}
function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>{children}</div>
    </div>
  );
}
function Tag({ label, color, textColor }: { label: string; color: string; textColor: string }) {
  return <span style={{ display: 'inline-block', padding: '0.18rem 0.55rem', borderRadius: 999, background: color, color: textColor, fontSize: '0.75rem', fontWeight: 600, width: 'fit-content', marginBottom: '0.18rem' }}>{label}</span>;
}
function ActionBtn({ onClick, disabled, color, bg, border, icon, label }: { onClick: () => void; disabled?: boolean; color: string; bg: string; border: string; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: '10px', background: bg, color, border: `1.5px solid ${border}`, fontWeight: 700, fontSize: '0.82rem', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      {icon} {label}
    </button>
  );
}
