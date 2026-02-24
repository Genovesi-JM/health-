import { useEffect, useState, type FormEvent } from 'react';
import api from '../api';
import type { TriageQuestion, TriageResult, TriageHistoryItem } from '../types';
import {
  Activity, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, ArrowLeft, RotateCcw,
} from 'lucide-react';

type Step = 'start' | 'questions' | 'result' | 'history';

export default function TriagePage() {
  const [step, setStep] = useState<Step>('history');
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
      const r = await api.post('/api/v1/triage/start', { chief_complaint: complaint });
      setSessionId(r.data.session_id);
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
      const r = await api.post(`/api/v1/triage/${sessionId}/submit`, { answers });
      setResult(r.data);
      setStep('result');
      loadHistory();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao submeter respostas.');
    }
    setLoading(false);
  };

  const riskData = (level?: string) => {
    switch (level?.toUpperCase()) {
      case 'URGENT': return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Urgente', icon: <AlertTriangle size={22} /> };
      case 'HIGH': return { color: '#f97316', bg: 'rgba(249,115,22,0.12)', label: 'Alto', icon: <AlertTriangle size={22} /> };
      case 'MEDIUM': return { color: '#eab308', bg: 'rgba(234,179,8,0.12)', label: 'Médio', icon: <Clock size={22} /> };
      default: return { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: 'Baixo', icon: <CheckCircle2 size={22} /> };
    }
  };

  const actionLabel = (action?: string) => {
    switch (action) {
      case 'ER_NOW': return 'Dirija-se às Urgências imediatamente';
      case 'DOCTOR_NOW': return 'Consulte um médico hoje';
      case 'DOCTOR_24H': return 'Agende consulta nas próximas 24h';
      default: return 'Auto-cuidado com monitorização';
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
        <h1>Triagem Inteligente</h1>
        <p>Avaliação de sintomas com classificação automática de risco</p>
      </div>

      {/* Tab nav */}
      <div className="tab-nav">
        <button className={step === 'history' ? 'active' : ''} onClick={() => setStep('history')}>Histórico</button>
        <button className={step === 'start' || step === 'questions' || step === 'result' ? 'active' : ''}
          onClick={() => { setStep('start'); setResult(null); setError(''); }}>
          Nova Triagem
        </button>
      </div>

      {error && <div className="toast error" style={{ position: 'relative', top: 0, right: 0, marginBottom: '1rem' }}>{error}</div>}

      {/* ─── History ─── */}
      {step === 'history' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Sessões de Triagem</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setStep('start')}>
              <Activity size={14} /> Nova Triagem
            </button>
          </div>
          {history.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem' }}>
              <div className="empty-state-icon"><Activity size={24} style={{ color: 'var(--accent-teal)' }} /></div>
              <div className="empty-state-title">Sem triagens realizadas</div>
              <div className="empty-state-desc">Inicie a sua primeira triagem para avaliar o seu estado de saúde.</div>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Queixa Principal</th>
                    <th>Risco</th>
                    <th>Recomendação</th>
                    <th>Score</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.session_id}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{h.chief_complaint}</td>
                      <td><span className={`badge ${riskBadge(h.risk_level)}`}>{h.risk_level || h.status}</span></td>
                      <td style={{ fontSize: '0.8rem' }}>{h.recommended_action || '—'}</td>
                      <td>{h.score ?? '—'}</td>
                      <td>{new Date(h.created_at).toLocaleDateString('pt')}</td>
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
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Descreva os seus sintomas</h3>
          </div>
          <form onSubmit={startTriage} style={{ padding: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Queixa Principal</label>
              <textarea className="form-textarea" rows={3}
                placeholder="Descreva os sintomas que está a sentir..."
                value={complaint} onChange={e => setComplaint(e.target.value)} required
                style={{
                  width: '100%', padding: '0.7rem 0.9rem',
                  background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border)',
                  borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.88rem', resize: 'vertical',
                }} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'A iniciar…' : <><ChevronRight size={16} /> Iniciar Triagem</>}
            </button>
          </form>
        </div>
      )}

      {/* ─── Questions ─── */}
      {step === 'questions' && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Responda às seguintes questões</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Queixa: <strong style={{ color: 'var(--text-primary)' }}>{complaint}</strong>
            </p>
          </div>
          <div style={{ padding: '1.25rem' }}>
            {questions.map(q => (
              <div key={q.key} className="form-group">
                <label className="form-label">{q.label}</label>
                {q.type === 'boolean' && (
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {['Sim', 'Não'].map(opt => (
                      <button key={opt} type="button"
                        className={`btn btn-sm ${answers[q.key] === (opt === 'Sim') ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setAnswers(a => ({ ...a, [q.key]: opt === 'Sim' }))}>
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
                    <option value="">Selecionar</option>
                    {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button className="btn btn-outline" onClick={() => setStep('start')}>
                <ArrowLeft size={16} /> Voltar
              </button>
              <button className="btn btn-primary" onClick={submitAnswers} disabled={loading}>
                {loading ? 'A submeter…' : 'Submeter Respostas'}
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
                Risco: <span style={{ color: rd.color }}>{rd.label}</span>
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
                  <RotateCcw size={16} /> Nova Triagem
                </button>
                <button className="btn btn-outline" onClick={() => { setStep('history'); loadHistory(); }}>
                  Ver Histórico
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
