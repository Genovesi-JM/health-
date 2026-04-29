import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Pill, CheckCircle2, X, Clock, ChevronDown, ChevronUp,
  AlertTriangle, Loader2, Send, ArrowLeft,
} from 'lucide-react';
import api from '../api';

interface Doctor {
  id: string;
  display_name: string;
  title?: string;
  specialization?: string;
}

interface RxRequest {
  id: string;
  medication_name: string;
  dose?: string;
  frequency?: string;
  reason?: string;
  status: string;
  doctor_note?: string;
  adjusted_dose?: string;
  adjusted_frequency?: string;
  created_at: string;
  decided_at?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:           { label: 'Pendente',           color: '#d97706', bg: 'rgba(234,179,8,0.1)',    icon: <Clock size={13} /> },
  approve:           { label: 'Aprovada',            color: '#059669', bg: 'rgba(16,185,129,0.1)',   icon: <CheckCircle2 size={13} /> },
  adjust:            { label: 'Dose ajustada',       color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   icon: <CheckCircle2 size={13} /> },
  consult_requested: { label: 'Consulta solicitada', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',   icon: <Clock size={13} /> },
  exams_requested:   { label: 'Exames pedidos',      color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   icon: <Clock size={13} /> },
  reject:            { label: 'Recusada',            color: '#dc2626', bg: 'rgba(239,68,68,0.1)',    icon: <X size={13} /> },
};

export default function PatientPrescriptionRequestPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Pre-fill from query params (coming from SelfCare "Renovar" button)
  const initMed  = searchParams.get('med')  ?? '';
  const initDose = searchParams.get('dose') ?? '';
  const initFreq = searchParams.get('freq') ?? '';

  // Form state
  const [medName, setMedName]     = useState(initMed);
  const [dose, setDose]           = useState(initDose);
  const [frequency, setFrequency] = useState(initFreq);
  const [reason, setReason]       = useState('');
  const [doctorId, setDoctorId]   = useState('');
  const [doctors, setDoctors]     = useState<Doctor[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Submissions
  const [submitting, setSubmitting]   = useState(false);
  const [successMsg, setSuccessMsg]   = useState('');
  const [errorMsg, setErrorMsg]       = useState('');

  // History
  const [history, setHistory]         = useState<RxRequest[]>([]);
  const [loadingHist, setLoadingHist] = useState(true);
  const [expandedId, setExpandedId]   = useState<string | null>(null);

  // Show form toggle
  const [showForm, setShowForm]       = useState(!!initMed);

  useEffect(() => {
    api.get('/api/v1/doctors').then(r => {
      setDoctors(r.data);
      if (r.data.length === 1) setDoctorId(r.data[0].id);
    }).catch(() => {}).finally(() => setLoadingDocs(false));

    api.get<RxRequest[]>('/api/v1/prescription-requests')
      .then(r => setHistory(r.data))
      .catch(() => {})
      .finally(() => setLoadingHist(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim() || !doctorId) return;
    setSubmitting(true); setErrorMsg(''); setSuccessMsg('');
    try {
      const { data } = await api.post<RxRequest>('/api/v1/prescription-requests', {
        doctor_id: doctorId,
        medication_name: medName.trim(),
        dose: dose.trim() || undefined,
        frequency: frequency.trim() || undefined,
        reason: reason.trim() || undefined,
      });
      setHistory(h => [data, ...h]);
      setSuccessMsg('Pedido enviado com sucesso. O médico irá analisar brevemente.');
      setMedName(''); setDose(''); setFrequency(''); setReason(''); setDoctorId('');
      setShowForm(false);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail ?? 'Erro ao enviar pedido. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const pending = history.filter(r => r.status === 'pending').length;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.83rem', padding: '0.35rem 0.6rem', borderRadius: '8px' }}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Pill size={20} style={{ color: 'var(--brand-primary)' }} /> Pedidos de Prescrição
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.82rem' }}>
            Solicite renovação de medicação ao seu médico
          </p>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '10px', background: 'var(--brand-primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
        >
          <Send size={14} /> Novo pedido
        </button>
      </div>

      {/* Pending badge */}
      {pending > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1rem', borderRadius: '10px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#d97706', fontWeight: 600 }}>
          <Clock size={15} /> {pending} pedido{pending > 1 ? 's' : ''} pendente{pending > 1 ? 's' : ''} em análise
        </div>
      )}

      {/* Success / Error banners */}
      {successMsg && (
        <div style={{ display: 'flex', gap: '0.6rem', padding: '0.8rem 1rem', borderRadius: '10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', marginBottom: '1rem', color: '#059669', fontSize: '0.83rem', fontWeight: 500 }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />{successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ display: 'flex', gap: '0.6rem', padding: '0.8rem 1rem', borderRadius: '10px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '1rem', color: '#dc2626', fontSize: '0.83rem', fontWeight: 500 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{errorMsg}
        </div>
      )}

      {/* New request form */}
      {showForm && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Send size={16} style={{ color: 'var(--brand-primary)' }} /> Novo Pedido de Prescrição
          </h2>

          {/* Safety notice */}
          <div style={{ display: 'flex', gap: '0.6rem', padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#3b82f6' }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Os pedidos de prescrição são revistos por um profissional de saúde licenciado. Em caso de emergência, contacte o <strong>112</strong> ou dirija-se ao serviço de urgência mais próximo.</span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label">Medicamento *</label>
              <input className="form-input" placeholder="ex: Metformina 850mg" value={medName} onChange={e => setMedName(e.target.value)} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label">Dose</label>
                <input className="form-input" placeholder="ex: 850mg" value={dose} onChange={e => setDose(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Frequência</label>
                <input className="form-input" placeholder="ex: 2x/dia" value={frequency} onChange={e => setFrequency(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="form-label">Motivo do pedido</label>
              <textarea className="form-input" rows={3} placeholder="Descreva brevemente o motivo da renovação…" value={reason} onChange={e => setReason(e.target.value)} style={{ resize: 'vertical' }} />
            </div>
            <div>
              <label className="form-label">Médico *</label>
              {loadingDocs ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '0.5rem 0' }}><Loader2 size={14} style={{ display: 'inline', marginRight: 6 }} />A carregar médicos…</div>
              ) : doctors.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '0.5rem 0' }}>Nenhum médico disponível de momento.</div>
              ) : (
                <select className="form-input" value={doctorId} onChange={e => setDoctorId(e.target.value)} required>
                  <option value="">— Seleccionar médico —</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.title ? `${d.title} ` : ''}{d.display_name}{d.specialization ? ` · ${d.specialization}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '0.55rem 1.1rem', borderRadius: '10px', background: 'none', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.83rem', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="submit" disabled={submitting || !medName.trim() || !doctorId} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.25rem', borderRadius: '10px', background: 'var(--brand-primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.83rem', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? <Loader2 size={15} /> : <Send size={15} />}
                {submitting ? 'A enviar…' : 'Enviar pedido'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History */}
      <div>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
          Histórico
        </div>
        {loadingHist && (
          <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--text-muted)' }}>
            <Loader2 size={24} style={{ display: 'block', margin: '0 auto 0.5rem' }} /> A carregar…
          </div>
        )}
        {!loadingHist && history.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Sem pedidos anteriores.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {history.map(req => {
            const sc = STATUS_CONFIG[req.status] ?? { label: req.status, color: '#6b7280', bg: 'rgba(107,114,128,0.1)', icon: null };
            const isOpen = expandedId === req.id;
            const hasDecision = req.doctor_note || req.adjusted_dose || req.adjusted_frequency;
            return (
              <div key={req.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.9rem 1.1rem', cursor: hasDecision ? 'pointer' : 'default' }}
                  onClick={() => hasDecision && setExpandedId(isOpen ? null : req.id)}
                >
                  <Pill size={18} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{req.medication_name}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                      {req.dose && <span>{req.dose} · </span>}
                      {req.frequency && <span>{req.frequency} · </span>}
                      {new Date(req.created_at).toLocaleDateString('pt-PT')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 999, background: sc.bg, color: sc.color }}>
                      {sc.icon} {sc.label}
                    </span>
                    {hasDecision && (isOpen ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />)}
                  </div>
                </div>
                {isOpen && hasDecision && (
                  <div style={{ padding: '0.85rem 1.1rem', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.018)', fontSize: '0.82rem' }}>
                    {(req.adjusted_dose || req.adjusted_frequency) && (
                      <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
                        Dose ajustada: {req.adjusted_dose ?? req.dose}{req.adjusted_frequency ? ` · ${req.adjusted_frequency}` : ''}
                      </div>
                    )}
                    {req.doctor_note && (
                      <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        "{req.doctor_note}"
                      </div>
                    )}
                    {req.decided_at && (
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                        Decidido a {new Date(req.decided_at).toLocaleString('pt-PT')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
