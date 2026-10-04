import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getSession } from '../api';
import type { ConsultationQueueItem } from '../types';
import { ClipboardList, CheckCircle2, Play, X, User, Stethoscope, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';
import PatientReadingsPanel from '../components/PatientReadingsPanel';
import { specialtyLabel } from '../constants/specialties';
import TriagePhotoReview from '../components/TriagePhotoReview';
import ConsultationCloseout from '../components/ConsultationCloseout';
import { formatAppointmentTime } from '../utils/appointments';
import { useConsultationPages } from '../utils/useConsultationPages';
import DoctorConsultationHistory from '../components/DoctorConsultationHistory';
import { requestCanProceed, requestExpiryMessage } from '../utils/requestExpiry';
import { apiErrorStatus } from '../utils/apiError';

const LOCALE_MAP: Record<string, string> = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES' };

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

interface Escalation {
  id: string;
  patient_id: string;
  patient_name: string;
  consultation_id?: string | null;
  urgency: string;
  reason: string;
  clinical_summary: string;
  status: string;
  created_at: string;
}

export default function DoctorQueuePage() {
  const [accessLost, setAccessLost] = useState(false);
  const denyAccess = useCallback(() => setAccessLost(true), []);
  // Unmount the entire clinical scope on authoritative denial. Its independent
  // requests and selected records must never survive into a restored scope.
  return accessLost ? <><p role="alert">O acesso mudou. Atualize a sessão para continuar.</p>
    <button className="btn btn-secondary" onClick={() => setAccessLost(false)}>Atualizar consultas</button></>
    : <DoctorQueueScope onAccessLost={denyAccess} />;
}

function DoctorQueueScope({ onAccessLost }: { onAccessLost: () => void }) {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const locale = LOCALE_MAP[lang] || 'pt-PT';
  const escalationSequence = useRef(0);
  const mounted = useRef(true);
  const denyClinicalAccess = useCallback(() => {
    mounted.current = false; escalationSequence.current += 1; onAccessLost();
  }, [onAccessLost]);
  const history = useConsultationPages<ConsultationQueueItem>('/api/v1/doctor/queue/page', undefined, denyClinicalAccess);
  const queue = history.items;
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ConsultationQueueItem | null>(null);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [acceptingEscalation, setAcceptingEscalation] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [escalationError, setEscalationError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeoutDirty, setCloseoutDirty] = useState(false);
  const [closeoutBusy, setCloseoutBusy] = useState(false);
  const dismissCloseout = () => {
    if (!closeoutDirty || window.confirm('Sair e perder o rascunho de conclusão desta sessão?')) { setClosingId(null); setCloseoutDirty(false); }
  };
  const refreshEscalations = useCallback(async () => {
    setEscalationError('');
    const ticket = ++escalationSequence.current;
    const owner = getSession()?.userId;
    const current = () => mounted.current && ticket === escalationSequence.current && getSession()?.userId === owner;
    try {
      const response = await api.get('/api/v1/clinical-operations/escalations', { params: { status: 'pending' } });
      if (current()) setEscalations(response.data.items || []);
    } catch (failure) {
      if (current()) {
        if ([401, 403].includes(apiErrorStatus(failure) ?? 0)) denyClinicalAccess();
        else setEscalationError('Não foi possível carregar os encaminhamentos. Atualize a lista.');
      }
    } finally { if (current()) setLoading(false); }
  }, [denyClinicalAccess]);
  useEffect(() => {
    mounted.current = true; void refreshEscalations();
    return () => { mounted.current = false; escalationSequence.current += 1; };
  }, [refreshEscalations]);

  const loadQueue = () => {
    setSelected(null);
    void history.refresh();
    void refreshEscalations();
  };

  const acceptEscalation = async (item: Escalation) => {
    setAcceptingEscalation(item.id);
    try {
      await api.post(`/api/v1/clinical-operations/escalations/${item.id}/accept`);
      if (!mounted.current) return;
      navigate(`/clinician/patients/${item.patient_id}`);
    } catch (failure) {
      if (!mounted.current) return;
      if ([401, 403].includes(apiErrorStatus(failure) ?? 0)) denyClinicalAccess();
      else loadQueue();
    } finally {
      setAcceptingEscalation(null);
    }
  };

  const startConsultation = async (item: ConsultationQueueItem) => {
    if (!requestCanProceed(item)) { setActionError('O prazo ou a elegibilidade do pedido mudou. Atualize a lista.'); return; }
    if (!Number.isSafeInteger(item.reschedule_revision) || item.reschedule_revision! < 0) {
      setActionError('Não foi possível confirmar a versão do horário. Atualize a lista.'); return;
    }
    setPendingAction(item.id);
    setActionError('');
    try {
      const action = item.status === 'scheduled' ? 'start' : 'accept';
      await api.post(`/api/v1/doctor/queue/${item.id}/${action}`, undefined, { params: { expected_revision: item.reschedule_revision ?? 0 } });
      if (!mounted.current) return;
      setSelected(null);
      loadQueue();
    } catch (failure) {
      if (!mounted.current) return;
      if ([401, 403].includes(apiErrorStatus(failure) ?? 0)) { denyClinicalAccess(); return; }
      setActionError(t('queue.action_error'));
      setSelected(null);
      loadQueue();
    } finally {
      setPendingAction(null);
    }
  };


  if (loading || (history.loading && !queue.length && !selected && !closingId && !showHistory)) return <div className="page-loading"><div className="spinner" /></div>;
  if (history.accessLost) return <><p role="alert">{history.error}</p><button className="btn btn-secondary" onClick={loadQueue}>Atualizar consultas</button></>;

  const riskMeta = selected?.risk_level ? RISK_MAP[selected.risk_level.toUpperCase()] : null;

  return (
    <>
      <div className="page-header">
        <h1>{t('queue.title')}</h1>
        <p>Consultas diretas e encaminhamentos estruturados da equipa de enfermagem.</p>
      </div>
      {actionError && <p role="alert" className="alert alert-danger">{actionError}</p>}
      {escalationError && <p role="alert">{escalationError}</p>}
      {history.error && <p role="alert">{history.error}</p>}
      {history.moreError && <p role="alert">{history.moreError}</p>}
      {history.loading && <p role="status">A atualizar consultas…</p>}
      <button className="btn btn-secondary" onClick={loadQueue}>Atualizar consultas</button>
      {history.nextCursor && <button className="btn btn-secondary" disabled={history.loadingMore} onClick={() => void history.loadMore()}>{history.loadingMore ? 'A carregar…' : 'Carregar mais consultas'}</button>}
      {history.nextCursor && <p>A fila continua. Carregue mais para ver os restantes pedidos.</p>}
      <button className="btn btn-secondary" aria-expanded={showHistory} onClick={() => setShowHistory(value => !value)}>{showHistory ? 'Fechar histórico' : 'Ver histórico das minhas consultas'}</button>
      {showHistory && <DoctorConsultationHistory onAccessLost={denyClinicalAccess} />}

      <section className="doctor-escalation-board">
        <header>
          <div>
            <span><Stethoscope size={17} /> Coordenação clínica</span>
            <h2>Encaminhamentos de enfermagem</h2>
            <p>Assuma o episódio com o resumo, prioridade e contexto Patient 360 já preparados.</p>
          </div>
          <strong>{escalations.length} pendente{escalations.length === 1 ? '' : 's'}</strong>
        </header>
        {escalations.length === 0 ? (
          <div className="doctor-escalation-empty"><CheckCircle2 size={19} /> Sem novos encaminhamentos clínicos.</div>
        ) : (
          <div className="doctor-escalation-list">
            {escalations.slice(0, 5).map(item => (
              <article key={item.id}>
                <span className={`doctor-escalation-urgency ${item.urgency}`}><AlertTriangle size={15} /> {item.urgency}</span>
                <div>
                  <h3>{item.patient_name}</h3>
                  <strong>{item.reason}</strong>
                  <p>{item.clinical_summary}</p>
                  <small>{new Date(item.created_at).toLocaleString(locale)}</small>
                </div>
                <button type="button" onClick={() => acceptEscalation(item)} disabled={acceptingEscalation === item.id}>
                  {acceptingEscalation === item.id ? <RefreshCw size={15} className="spin" /> : <ArrowRight size={15} />}
                  Aceitar e abrir 360°
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="responsive-split" style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 480px' : '1fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* ── Queue list ── */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardList size={18} style={{ color: 'var(--accent-teal)' }} />
              {t('queue.patients')}
            </h3>
            <span className={`badge ${queue.length > 0 ? 'badge-warning' : 'badge-neutral'}`}>
              {queue.length} consulta{queue.length !== 1 ? 's' : ''} carregada{queue.length !== 1 ? 's' : ''}
            </span>
          </div>

          {history.error ? null : queue.length === 0 ? (
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
                      <td>{specialtyLabel(q.specialty, t)}</td>
                      <td style={{ color: 'var(--text-muted)', maxWidth: 160 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {q.chief_complaint || '—'}
                        </span>
                      </td>
                      <td><span className={`badge ${riskBadge(q.risk_level)}`}>{q.risk_level || '—'}</span></td>
                      <td>{q.scheduled_at ? formatAppointmentTime(q.scheduled_at, q.timezone || 'UTC', locale) : new Date(q.created_at).toLocaleDateString(locale)}{q.scheduled_end_at && <><br />{formatAppointmentTime(q.scheduled_end_at, q.timezone || 'UTC', locale)}</>}<br /><span>{t(`consult.status_${q.status}`)}</span>{requestExpiryMessage(q) && <p>{requestExpiryMessage(q)}</p>}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {q.status !== 'in_progress' && (
                            <button className="btn btn-primary btn-sm" disabled={pendingAction !== null || !requestCanProceed(q)} onClick={() => startConsultation(q)}>
                              <Play size={13} /> {t(q.status === 'scheduled' ? 'queue.start' : 'queue.accept')}
                            </button>
                          )}
                          {q.status === 'in_progress' && (
                            <button className="btn btn-sm" disabled={pendingAction !== null} onClick={() => setClosingId(q.id)}
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
                  <InfoRow icon={<Stethoscope size={13} />} label="Especialidade" value={specialtyLabel(selected.specialty, t)} />
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
                  <button className="btn btn-primary" disabled={pendingAction !== null || !requestCanProceed(selected)} style={{ flex: 1, fontSize: '0.82rem' }} onClick={() => startConsultation(selected)}>
                    <Play size={14} /> {t(selected.status === 'scheduled' ? 'queue.start' : 'queue.accept')}
                  </button>
                )}
                {selected.status === 'in_progress' && (
                  <button className="btn" disabled={pendingAction !== null || !requestCanProceed(selected)} style={{ flex: 1, fontSize: '0.82rem', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }} onClick={() => setClosingId(selected.id)}>
                    <CheckCircle2 size={14} /> Concluir
                  </button>
                )}
              </div>

              {/* Triage photographs become visible only after the doctor accepts the case. */}
              {selected.status === 'in_progress' && selected.triage_session_id && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                  <TriagePhotoReview triageId={selected.triage_session_id} />
                </div>
              )}

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
      {closingId && <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Concluir consulta">
        <div className="modal" style={{ width: 'min(760px, 95vw)', maxHeight: '90vh', overflowY: 'auto' }}>
          <div className="modal-header"><h3>Rever e concluir consulta</h3><button type="button" className="btn btn-sm" onClick={dismissCloseout} disabled={closeoutBusy} aria-label="Fechar conclusão"><X size={20} /></button></div>
          <div className="modal-body"><ConsultationCloseout consultationId={closingId} role="doctor" onAccessLost={denyClinicalAccess} onDirtyChange={setCloseoutDirty} onBusyChange={setCloseoutBusy} onFinalized={() => {
            history.setItems(current => current.filter(item => item.id !== closingId)); setSelected(null);
          }} /></div>
        </div>
      </div>}
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
