import { useEffect, useState } from 'react';
import api from '../api';
import type { ConsultationQueueItem } from '../types';
import { ClipboardList, CheckCircle2, Play, X, User, Stethoscope, AlertTriangle } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';
import PatientReadingsPanel from '../components/PatientReadingsPanel';

const LOCALE_MAP: Record<string, string> = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES' };

const SPECIALTY_LABELS: Record<string, string> = {
  clinica_geral: 'Clínica Geral', pediatria: 'Pediatria', cardiologia: 'Cardiologia',
  ginecologia: 'Ginecologia', dermatologia: 'Dermatologia', ortopedia: 'Ortopedia',
  neurologia: 'Neurologia', psiquiatria: 'Psiquiatria', urgencia: 'Urgência',
};

const RISK_MAP: Record<string, { label: string; color: string; bg: string }> = {
  LOW:    { label: 'Baixo',    color: '#059669', bg: 'rgba(16,185,129,0.1)' },
  MEDIUM: { label: 'Médio',   color: '#d97706', bg: 'rgba(234,179,8,0.1)'  },
  HIGH:   { label: 'Alto',    color: '#dc2626', bg: 'rgba(239,68,68,0.1)'  },
  URGENT: { label: 'Urgente', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
};

function riskBadge(level?: string) {
  switch (level?.toUpperCase()) {
    case 'URGENT': case 'HIGH': return 'badge-danger';
    case 'MEDIUM': return 'badge-warning';
    default: return 'badge-success';
  }
}

export default function DoctorQueuePage() {
  const { t, lang } = useT();
  const locale = LOCALE_MAP[lang] || 'pt-PT';
  const [queue, setQueue] = useState<ConsultationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ConsultationQueueItem | null>(null);

  useEffect(() => { loadQueue(); }, []);

  const loadQueue = () => {
    setLoading(true);
    api.get('/api/v1/doctor/queue')
      .then(r => setQueue(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const startConsultation = async (id: string) => {
    try {
      await api.post(`/api/v1/doctor/queue/${id}/accept`);
      setSelected(null);
      loadQueue();
    } catch { /* ignore */ }
  };

  const completeConsultation = async (id: string) => {
    try {
      await api.post(`/api/v1/consultations/${id}/complete`, { outcome: 'resolved' });
      setSelected(null);
      loadQueue();
    } catch { /* ignore */ }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const riskMeta = selected?.risk_level ? RISK_MAP[selected.risk_level.toUpperCase()] : null;

  return (
    <>
      <div className="page-header">
        <h1>{t('queue.title')}</h1>
        <p>{t('queue.subtitle')}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 480px' : '1fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* ── Queue list ── */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardList size={18} style={{ color: 'var(--accent-teal)' }} />
              {t('queue.patients')}
            </h3>
            <span className={`badge ${queue.length > 0 ? 'badge-warning' : 'badge-neutral'}`}>
              {queue.length} paciente{queue.length !== 1 ? 's' : ''}
            </span>
          </div>

          {queue.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem' }}>
              <div className="empty-state-icon"><ClipboardList size={24} style={{ color: 'var(--accent-teal)' }} /></div>
              <div className="empty-state-title">{t('queue.empty')}</div>
              <div className="empty-state-desc">{t('queue.empty_desc')}</div>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('table.patient')}</th>
                    <th>{t('table.specialty')}</th>
                    <th>Motivo</th>
                    <th>{t('table.risk')}</th>
                    <th>{t('table.date')}</th>
                    <th>{t('table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map(q => (
                    <tr
                      key={q.id}
                      style={{ cursor: 'pointer', background: selected?.id === q.id ? 'var(--brand-light, rgba(15,118,110,0.06))' : undefined }}
                      onClick={() => setSelected(prev => prev?.id === q.id ? null : q)}
                    >
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--brand-light)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem', flexShrink: 0 }}>
                            {(q.patient_name || 'P').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                          {q.patient_name || 'Paciente'}
                        </div>
                      </td>
                      <td>{SPECIALTY_LABELS[q.specialty] ?? q.specialty}</td>
                      <td style={{ color: 'var(--text-muted)', maxWidth: 160 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {q.chief_complaint || '—'}
                        </span>
                      </td>
                      <td><span className={`badge ${riskBadge(q.risk_level)}`}>{q.risk_level || '—'}</span></td>
                      <td>{new Date(q.created_at).toLocaleDateString(locale)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {q.status !== 'in_progress' && (
                            <button className="btn btn-primary btn-sm" onClick={() => startConsultation(q.id)}>
                              <Play size={13} /> {t('queue.start')}
                            </button>
                          )}
                          {q.status === 'in_progress' && (
                            <button className="btn btn-sm" onClick={() => completeConsultation(q.id)}
                              style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                              <CheckCircle2 size={13} /> {t('queue.complete')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Patient detail panel ── */}
        {selected && (
          <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: '1.25rem' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2, #f9fafb)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <User size={16} style={{ color: 'var(--brand-primary)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Dados do Paciente</span>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '80vh', overflowY: 'auto' }}>

              {/* Consultation context */}
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
                  Detalhes da Consulta
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <InfoRow icon={<Stethoscope size={13} />} label="Especialidade" value={SPECIALTY_LABELS[selected.specialty] ?? selected.specialty} />
                  <InfoRow icon={<span>📋</span>} label="Motivo" value={selected.chief_complaint || 'Não indicado'} />
                  {riskMeta && (
                    <InfoRow
                      icon={<AlertTriangle size={13} />}
                      label="Risco triagem"
                      value={
                        <span style={{ fontWeight: 700, color: riskMeta.color, background: riskMeta.bg, padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.75rem' }}>
                          {riskMeta.label}
                        </span>
                      }
                    />
                  )}
                  <InfoRow icon={<span>📅</span>} label="Pedido em" value={new Date(selected.created_at).toLocaleString('pt-PT')} />
                </div>
              </div>

              {/* Quick actions */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {selected.status !== 'in_progress' && (
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: '0.82rem' }} onClick={() => startConsultation(selected.id)}>
                    <Play size={14} /> Aceitar Consulta
                  </button>
                )}
                {selected.status === 'in_progress' && (
                  <button className="btn" style={{ flex: 1, fontSize: '0.82rem', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }} onClick={() => completeConsultation(selected.id)}>
                    <CheckCircle2 size={14} /> Concluir
                  </button>
                )}
              </div>

              {/* Readings */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                {selected.patient_id ? (
                  <PatientReadingsPanel patientId={selected.patient_id} patientName={selected.patient_name ?? undefined} />
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem', textAlign: 'center', padding: '1rem 0' }}>
                    ID do paciente não disponível para carregar medições.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.83rem' }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0, minWidth: 90 }}>{label}:</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
