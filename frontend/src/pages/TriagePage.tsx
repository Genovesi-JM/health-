import { useEffect, useState, type FormEvent } from 'react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import type { TriageQuestion, TriageResult, TriageHistoryItem } from '../types';
import {
  Activity, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, ArrowLeft, RotateCcw,
} from 'lucide-react';

type Step = 'start' | 'questions' | 'result' | 'history';

type AgeGroup = 'adult' | 'pediatric';
type TriageCategory =
  | 'general'
  | 'respiratory'
  | 'cardiac'
  | 'neuro'
  | 'gi'
  | 'urinary'
  | 'skin'
  | 'injury'
  | 'mental'
  | 'womens'
  | 'medication'
  | 'chronic';

const LOCALE_MAP: Record<string, string> = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR' };

export default function TriagePage() {
  const { t, lang } = useT();
  const locale = LOCALE_MAP[lang] || 'pt-PT';
  const [step, setStep] = useState<Step>('history');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('adult');
  const [category, setCategory] = useState<TriageCategory>('general');
  const [guardian, setGuardian] = useState(false);
  const [complaint, setComplaint] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [questions, setQuestions] = useState<TriageQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const [result, setResult] = useState<TriageResult | null>(null);
  const [history, setHistory] = useState<TriageHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const r = await api.get('/api/v1/triage/history');
      setHistory(r.data);
    } catch { /* ignore */ }
  };

  const startTriage = async (e: FormEvent) => {
    e.preventDefault();
    if (!complaint.trim()) return;
    setLoading(true); setError('');
    try {
      const r = await api.post('/api/v1/triage/start', {
        chief_complaint: complaint,
        age_group: ageGroup,
        category,
        answered_by_guardian: ageGroup === 'pediatric' ? guardian : false,
      });
      setSessionId(r.data.triage_id ?? r.data.session_id);
      setQuestions(r.data.questions || []);
      setAnswers({});
      setStep('questions');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao iniciar triagem.');
    }
    setLoading(false);
  };

  const submitAnswers = async () => {
    setLoading(true); setError('');
    try {
      // Backend expects a list of {question_key, answer}
      const answerList = Object.entries(answers).map(([question_key, answer]) => ({ question_key, answer }));
      await api.post(`/api/v1/triage/${sessionId}/answers`, { answers: answerList });

      const r2 = await api.post(`/api/v1/triage/${sessionId}/complete`, {});
      setResult({
        id: r2.data.triage_id,
        triage_session_id: r2.data.triage_id,
        risk_level: r2.data.risk_level,
        recommended_action: r2.data.recommended_action,
        score: r2.data.score,
        reasoning: r2.data.reasoning || {},
        created_at: new Date().toISOString(),
      });
      setStep('result');
      loadHistory();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao submeter respostas.');
    }
    setLoading(false);
  };

  const riskData = (level?: string) => {
    switch (level?.toUpperCase()) {
      case 'URGENT': return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: t('risk.urgent'), icon: <AlertTriangle size={22} /> };
      case 'HIGH': return { color: '#f97316', bg: 'rgba(249,115,22,0.12)', label: t('risk.high'), icon: <AlertTriangle size={22} /> };
      case 'MEDIUM': return { color: '#eab308', bg: 'rgba(234,179,8,0.12)', label: t('risk.medium'), icon: <Clock size={22} /> };
      default: return { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: t('risk.low'), icon: <CheckCircle2 size={22} /> };
    }
  };

  const actionLabel = (action?: string) => {
    switch (action) {
      case 'ER_NOW': return t('triage.er_label');
      case 'DOCTOR_NOW': return t('triage.doctor_now_label');
      case 'DOCTOR_24H': return t('triage.doctor_24h_label');
      default: return t('triage.self_care_label');
    }
  };

  const riskBadge = (level?: string) => {
    switch (level?.toUpperCase()) {
      case 'URGENT': case 'HIGH': return 'badge-danger';
      case 'MEDIUM': return 'badge-warning';
      default: return 'badge-success';
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>{t('triage.title')}</h1>
        <p>{t('triage.subtitle')}</p>
      </div>

      {/* Tab nav */}
      <div className="tab-nav">
        <button className={step === 'history' ? 'active' : ''} onClick={() => setStep('history')}>{t('triage.history_tab')}</button>
        <button className={step === 'start' || step === 'questions' || step === 'result' ? 'active' : ''}
          onClick={() => { setStep('start'); setResult(null); setError(''); }}>
          {t('triage.new_tab')}
        </button>
      </div>

      {error && <div className="toast error" style={{ position: 'relative', top: 0, right: 0, marginBottom: '1rem' }}>{error}</div>}

      {/* ─── History ─── */}
      {step === 'history' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t('triage.sessions')}</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setStep('start')}>
              <Activity size={14} /> {t('triage.new_btn')}
            </button>
          </div>
          {history.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem' }}>
              <div className="empty-state-icon"><Activity size={24} style={{ color: 'var(--accent-teal)' }} /></div>
              <div className="empty-state-title">{t('triage.no_sessions')}</div>
              <div className="empty-state-desc">{t('triage.no_sessions_desc')}</div>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('triage.chief_complaint')}</th>
                    <th>{t('table.risk')}</th>
                    <th>{t('table.recommendation')}</th>
                    <th>{t('table.score')}</th>
                    <th>{t('table.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.session_id}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{h.chief_complaint}</td>
                      <td><span className={`badge ${riskBadge(h.risk_level)}`}>{h.risk_level || h.status}</span></td>
                      <td style={{ fontSize: '0.8rem' }}>{h.recommended_action || '—'}</td>
                      <td>{h.score ?? '—'}</td>
                      <td>{new Date(h.created_at).toLocaleDateString(locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Start ─── */}
      {step === 'start' && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t('triage.describe')}</h3>
          </div>
          <form onSubmit={startTriage} style={{ padding: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">{t('triage.age_group')}</label>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${ageGroup === 'adult' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => { setAgeGroup('adult'); setGuardian(false); }}
                >
                  {t('triage.age_adult')}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${ageGroup === 'pediatric' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setAgeGroup('pediatric')}
                >
                  {t('triage.age_child')}
                </button>
              </div>
              {ageGroup === 'pediatric' && (
                <div style={{ marginTop: '0.75rem' }}>
                  <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={guardian}
                      onChange={e => setGuardian(e.target.checked)}
                    />
                    {t('triage.answered_by_parent')}
                  </label>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">{t('triage.category')}</label>
              <select
                className="form-select"
                value={category}
                onChange={e => setCategory(e.target.value as TriageCategory)}
              >
                <option value="general">{t('triage.cat_general')}</option>
                <option value="respiratory">{t('triage.cat_respiratory')}</option>
                <option value="cardiac">{t('triage.cat_cardiac')}</option>
                <option value="neuro">{t('triage.cat_neuro')}</option>
                <option value="gi">{t('triage.cat_gi')}</option>
                <option value="urinary">{t('triage.cat_urinary')}</option>
                <option value="skin">{t('triage.cat_skin')}</option>
                <option value="injury">{t('triage.cat_injury')}</option>
                <option value="mental">{t('triage.cat_mental')}</option>
                <option value="womens">{t('triage.cat_womens')}</option>
                <option value="medication">{t('triage.cat_medication')}</option>
                <option value="chronic">{t('triage.cat_chronic')}</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t('triage.chief_complaint')}</label>
              <textarea className="form-textarea" rows={3}
                placeholder={t('triage.describe_placeholder')}
                value={complaint} onChange={e => setComplaint(e.target.value)} required
                style={{
                  width: '100%', padding: '0.7rem 0.9rem',
                  background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border)',
                  borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.88rem', resize: 'vertical',
                }} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t('triage.starting') : <><ChevronRight size={16} /> {t('triage.start_btn')}</>}
            </button>
          </form>
        </div>
      )}

      {/* ─── Questions ─── */}
      {step === 'questions' && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t('triage.answer_questions')}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              {t('triage.summary')}: <strong style={{ color: 'var(--text-primary)' }}>{(ageGroup === 'adult' ? t('triage.age_adult') : t('triage.age_child'))} • {t(`triage.cat_${category}`)}</strong> — {t('triage.chief_complaint')}: <strong style={{ color: 'var(--text-primary)' }}>{complaint}</strong>
            </p>
          </div>
          <div style={{ padding: '1.25rem' }}>
            {questions.map(q => (
              <div key={q.key} className="form-group">
                <label className="form-label">{q.label}</label>
                {q.type === 'boolean' && (
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {[t('triage.yes'), t('triage.no')].map(opt => (
                      <button key={opt} type="button"
                        className={`btn btn-sm ${answers[q.key] === (opt === t('triage.yes')) ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setAnswers(a => ({ ...a, [q.key]: opt === t('triage.yes') }))}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {q.type === 'scale' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button key={n} type="button"
                        className={`btn btn-sm ${answers[q.key] === n ? 'btn-primary' : 'btn-outline'}`}
                        style={{ minWidth: '2rem', justifyContent: 'center' }}
                        onClick={() => setAnswers(a => ({ ...a, [q.key]: n }))}>
                        {n}
                      </button>
                    ))}
                  </div>
                )}
                {q.type === 'select' && q.options && (
                  <select className="form-select" value={String(answers[q.key] || '')}
                    onChange={e => setAnswers(a => ({ ...a, [q.key]: e.target.value }))}>
                    <option value="">{t('common.select')}</option>
                    {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button className="btn btn-outline" onClick={() => setStep('start')}>
                <ArrowLeft size={16} /> {t('common.cancel')}
              </button>
              <button className="btn btn-primary" onClick={submitAnswers} disabled={loading}>
                {loading ? t('triage.submitting') : t('triage.submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Result ─── */}
      {step === 'result' && result && (() => {
        const rd = riskData(result.risk_level);
        return (
          <div className="card" style={{ maxWidth: '600px' }}>
            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: rd.bg, border: `2px solid ${rd.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem', color: rd.color,
              }}>
                {rd.icon}
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                {t('triage.risk_level')}: <span style={{ color: rd.color }}>{rd.label}</span>
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Score: {result.score} / 100
              </p>

              <div style={{
                padding: '1rem', borderRadius: '12px',
                background: rd.bg, border: `1px solid ${rd.color}30`,
                marginBottom: '1.5rem',
              }}>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: rd.color }}>
                  {actionLabel(result.recommended_action)}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={() => { setStep('start'); setComplaint(''); setResult(null); }}>
                  <RotateCcw size={16} /> {t('triage.new_again')}
                </button>
                <button className="btn btn-outline" onClick={() => { setStep('history'); loadHistory(); }}>
                  {t('triage.history_tab')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
