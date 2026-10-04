import { appointmentError, formatAppointmentTime, isAppointmentConflict } from '../utils/appointments';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getSession } from '../api';
import type { Consultation, PatientState } from '../types';
import { Calendar, Clock, CheckCircle2, XCircle, AlertCircle, Activity, Zap, X } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';
import BookConsultationModal from '../components/BookConsultationModal';
import PaymentModal from '../components/PaymentModal';
import ChatModal from '../components/ChatModal';
import ReviewModal from '../components/ReviewModal';
import { specialtyLabel } from '../constants/specialties';
import { MessageSquare, Star, Video } from 'lucide-react';
import TeleconsultationControl from '../components/TeleconsultationControl';
import ConsultationCloseout from '../components/ConsultationCloseout';
import RescheduleConsultation from '../components/RescheduleConsultation';
import { useConsultationPages } from '../utils/useConsultationPages';
import { canReschedule, readReschedule } from '../utils/pendingReschedule';

const LOCALE_MAP: Record<string, string> = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR' };

export default function ConsultationsPage() {
  const { t, lang } = useT();
  const locale = LOCALE_MAP[lang] || 'pt-PT';
  const [patientState, setPatientState] = useState<PatientState | null>(null);
  const [tab, setTab] = useState<'all' | 'upcoming' | 'past'>('all');
  const history = useConsultationPages<Consultation>('/api/v1/consultations/me/page', tab);
  const { items: consultations, setItems: setConsultations, loading, error: loadError } = history;
  const [showBooking, setShowBooking] = useState(false);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [chatFor, setChatFor] = useState<Consultation | null>(null);
  const [reviewFor, setReviewFor] = useState<Consultation | null>(null);
  const [videoFor, setVideoFor] = useState<Consultation | null>(null);
  const [summaryFor, setSummaryFor] = useState<Consultation | null>(null);
  const [cancelFor, setCancelFor] = useState<Consultation | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<Consultation | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelNotice, setCancelNotice] = useState('');
  const cancellationBusy = useRef(false);
  const owner = getSession()?.userId;
  useEffect(() => {
    if (history.accessLost) {
      setShowBooking(false); setPayFor(null); setChatFor(null); setReviewFor(null);
      setVideoFor(null); setSummaryFor(null); setCancelFor(null); setRescheduleFor(null);
    }
  }, [history.accessLost]);
  // Recovery remains available after care or payment changes fresh-move eligibility.
  // Read again on modal close so a newly uncertain attempt is reachable immediately.
  const recovery = new Map<string, 'pending' | 'unavailable'>();
  if (owner) for (const item of consultations) {
    try { if (readReschedule(owner, item.id)) recovery.set(item.id, 'pending'); }
    catch { recovery.set(item.id, 'unavailable'); }
  }

  const cancelConsultation = async () => {
    if (!cancelFor || cancellationBusy.current || !['requested', 'scheduled'].includes(cancelFor.status)) return;
    const target = cancelFor;
    cancellationBusy.current = true; setCancelling(true); setCancelError(''); setCancelNotice('');
    try {
      const response = await api.patch(`/api/v1/consultations/${target.id}`, {});
      const saved: Consultation = response.data;
      setConsultations(previous => previous.map(item => item.id === target.id ? { ...item, ...saved } : item));
      setCancelFor(null);
      setCancelNotice(saved.status === 'cancelled' ? 'Consulta cancelada.' : 'O estado da consulta foi atualizado pelo serviço.');
    } catch (error) {
      if (isAppointmentConflict(error)) {
        setCancelFor(null);
        setCancelError('A consulta mudou antes do cancelamento. Consulte o estado atualizado.');
        try {
          await history.refresh();
        } catch {
          setCancelError('A consulta mudou, mas não foi possível atualizar a lista. Atualize a página antes de tentar cancelar novamente.');
        }
      } else {
        setCancelError(appointmentError(error, 'Não foi possível confirmar o cancelamento. A consulta mantém o último estado conhecido; tente novamente ou atualize a página.'));
      }
    } finally {
      cancellationBusy.current = false; setCancelling(false);
    }
  };

  useEffect(() => {
    let active = true;
    api.get('/api/v1/dashboard/patient-state').then(response => { if (active) setPatientState(response.data); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const filtered = consultations.filter(c => {
    if (tab === 'upcoming') return ['requested','scheduled','in_progress'].includes(c.status);
    if (tab === 'past') return ['completed','cancelled','no_show','expired'].includes(c.status);
    return true;
  });

  const statusIcon = (s: string) => {
    switch (s) {
      case 'completed': return <CheckCircle2 size={14} style={{ color: '#22c55e' }} />;
      case 'cancelled': case 'no_show': return <XCircle size={14} style={{ color: '#ef4444' }} />;
      case 'in_progress': return <Clock size={14} style={{ color: '#06b6d4' }} />;
      default: return <AlertCircle size={14} style={{ color: '#eab308' }} />;
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'completed': return 'badge-success';
      case 'cancelled': case 'no_show': return 'badge-danger';
      case 'in_progress': return 'badge-info';
      case 'scheduled': return 'badge-warning';
      default: return 'badge-neutral';
    }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      requested: t('consult.status_requested'), scheduled: t('consult.status_scheduled'), in_progress: t('consult.status_in_progress'),
      completed: t('consult.status_completed'), cancelled: t('consult.status_cancelled'), no_show: t('consult.status_no_show'),
    };
    return map[s] || s;
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (history.accessLost) return <><p role="alert">{loadError}</p><button className="btn btn-secondary" onClick={() => void history.refresh()}>Atualizar consultas</button></>;

  return (
    <>
      <div className="page-header">
        <h1>{t('consult.title')}</h1>
        <p>{t('consult.subtitle')}</p>
      </div>

      {loadError && <p role="alert" className="alert alert-danger">{loadError}</p>}
      <button className="btn btn-secondary" onClick={() => void history.refresh()}>Atualizar consultas</button>
      {history.moreError && <p role="alert">{history.moreError}</p>}
      {history.nextCursor && <button className="btn btn-secondary" disabled={history.loadingMore} onClick={() => void history.loadMore()}>{history.loadingMore ? 'A carregar…' : 'Carregar mais consultas'}</button>}
      {history.nextCursor && <p>A lista continua. Carregue mais para ver os restantes registos.</p>}
      {!cancelFor && cancelError && <p role="alert">{cancelError}</p>}
      {cancelNotice && <p role="status">{cancelNotice}</p>}
      <div className="tab-nav">
        <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>{t('consult.tab_all')}</button>
        <button className={tab === 'upcoming' ? 'active' : ''} onClick={() => setTab('upcoming')}>{t('consult.tab_upcoming')}</button>
        <button className={tab === 'past' ? 'active' : ''} onClick={() => setTab('past')}>{t('consult.tab_past')}</button>
      </div>

      <div className="card">
        {loadError ? null : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem' }}>
            <div className="empty-state-icon"><Calendar size={24} style={{ color: 'var(--accent-teal)' }} /></div>
            <div className="empty-state-title">
              {tab === 'upcoming' ? t('consult.no_scheduled') : tab === 'past' ? t('consult.no_past') : t('consult.no_any')}
            </div>
            <div className="empty-state-desc" style={{ maxWidth: '380px' }}>
              {patientState?.current_state === 'triage_completed' && patientState.last_triage_risk ? (
                <>
                  {patientState.last_triage_risk === 'LOW'
                    ? t('consult.self_care_msg')
                    : patientState.last_triage_risk === 'MEDIUM'
                    ? t('consult.medium_msg')
                    : t('consult.urgent_msg')}
                </>
              ) : patientState?.current_state === 'no_triage' || patientState?.current_state === 'triage_in_progress' ? (
                t('consult.complete_first')
              ) : (
                t('consult.no_records')
              )}
            </div>

            {/* Smart CTA based on patient state */}
            {patientState?.current_state === 'triage_completed' && patientState.last_triage_risk && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                {patientState.last_triage_risk !== 'LOW' && patientState.next_action_deadline && (
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 600,
                    color: patientState.last_triage_risk === 'URGENT' ? '#ef4444' : patientState.last_triage_risk === 'HIGH' ? '#f97316' : '#eab308',
                  }}>
                    ⏱ {t('consult.recommended_by')} {patientState.next_action_deadline}
                  </span>
                )}
                <button onClick={() => setShowBooking(true)} className="btn btn-primary" style={{
                  background: patientState.last_triage_risk === 'URGENT' ? '#ef4444'
                    : patientState.last_triage_risk === 'HIGH' ? '#f97316'
                    : patientState.last_triage_risk === 'MEDIUM' ? '#eab308'
                    : 'var(--accent-teal)',
                  color: patientState.last_triage_risk === 'MEDIUM' ? '#1e1e1e' : '#fff',
                  border: 'none', fontSize: '0.9rem', padding: '0.7rem 1.5rem',
                }}>
                  <Zap size={16} /> {t('consult.book_now')}
                </button>
              </div>
            )}

            {(patientState?.current_state === 'no_triage' || patientState?.current_state === 'triage_in_progress') && (
              <Link to="/triage" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                <Activity size={14} /> {patientState.current_state === 'triage_in_progress' ? t('consult.complete_triage') : t('triage.start_btn')}
              </Link>
            )}
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>{t('table.specialty')}</th>
                  <th>{t('table.status')}</th>
                  <th>{t('table.scheduled')}</th>
                  <th>{t('table.payment')}</th>
                  <th>{t('table.created')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      <div>{specialtyLabel(c.specialty, t)}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
                        {['requested', 'scheduled'].includes(c.status) && <button className="btn btn-sm" disabled={cancelling || recovery.has(c.id)} onClick={() => { setCancelFor(c); setCancelError(''); setCancelNotice(''); }}>Cancelar consulta</button>}
                        {(recovery.has(c.id) || canReschedule(c)) && <button className="btn btn-sm" disabled={cancelling} onClick={() => setRescheduleFor(c)}>{recovery.has(c.id) ? 'Recuperar alteração' : 'Alterar horário'}</button>}
                        {recovery.has(c.id) && <small>{recovery.get(c.id) === 'pending' ? 'Confirme a alteração pendente antes de cancelar a consulta.' : 'Não foi possível verificar a referência da alteração. Abra a recuperação antes de continuar.'}</small>}
                        {['scheduled', 'in_progress', 'completed'].includes(c.status) && (
                          <button
                            onClick={() => setChatFor(c)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--accent-teal)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: 0 }}
                          >
                            <MessageSquare size={13} /> {t('msg.messages')}
                          </button>
                        )}
                        {['scheduled', 'in_progress'].includes(c.status) && (
                          <button
                            onClick={() => setVideoFor(c)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: 0 }}
                          >
                            <Video size={13} /> {t('video.label')}
                          </button>
                        )}
                        {c.status === 'completed' && <button className="btn btn-sm" onClick={() => setSummaryFor(c)}>Resumo da consulta</button>}
                        {c.status === 'completed' && (
                          <button
                            onClick={() => setReviewFor(c)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: 0 }}
                          >
                            <Star size={13} /> {t('review.action')}
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(c.status)}`}>
                        {statusIcon(c.status)} {statusLabel(c.status)}
                      </span>
                    </td>
                    <td>{c.scheduled_at ? formatAppointmentTime(c.scheduled_at, c.timezone || 'UTC', locale) : '—'}</td>
                    <td>
                      {c.payment_status === 'paid' ? (
                        <span className="badge badge-success">{t('pay.status_paid')}</span>
                      ) : ['cancelled', 'no_show', 'completed'].includes(c.status) ? (
                        // Finished/cancelled consultations shouldn't offer a Pagar button —
                        // they're historical. Show the raw status only.
                        <span className="badge badge-neutral">{c.payment_status}</span>
                      ) : (
                        <button className="btn btn-primary btn-sm" onClick={() => setPayFor(c.id)}>
                          {t('pay.pay_now')}
                        </button>
                      )}
                    </td>
                    <td>{new Date(c.created_at).toLocaleDateString(locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cancelFor && <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cancel-consultation-title">
        <section className="modal" style={{ padding: '1.5rem', maxWidth: 480 }}>
          <h2 id="cancel-consultation-title">Cancelar esta consulta?</h2>
          <p>{specialtyLabel(cancelFor.specialty, t)}</p>
          <p>{cancelFor.scheduled_at ? formatAppointmentTime(cancelFor.scheduled_at, cancelFor.timezone || 'UTC', locale) : 'Pedido sem hora marcada'}</p>
          <p>Ao confirmar, o pedido ou a consulta será cancelado e o horário poderá voltar a ficar disponível.</p>
          {cancelError && <p role="alert">{cancelError}</p>}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" disabled={cancelling} onClick={() => { setCancelFor(null); setCancelError(''); }}>Manter consulta</button>
            <button type="button" className="btn btn-primary" disabled={cancelling} onClick={() => void cancelConsultation()}>{cancelling ? 'A cancelar…' : 'Confirmar cancelamento'}</button>
          </div>
        </section>
      </div>}

      {/* Book Consultation Modal */}
      {rescheduleFor && <RescheduleConsultation key={rescheduleFor.id} consultation={rescheduleFor} onClose={() => setRescheduleFor(null)} onUpdated={item => setConsultations(previous => previous.map(row => row.id === item.id ? item : row))} />}
      <BookConsultationModal
        open={showBooking}
        onClose={() => setShowBooking(false)}
        patientState={patientState}
        onBooked={(c: Consultation) => { setConsultations(prev => [c, ...prev]); setShowBooking(false); }}
      />

      {/* Payment Modal */}
      <PaymentModal
        open={payFor !== null}
        consultationId={payFor || ''}
        onClose={() => setPayFor(null)}
        onPaid={() => {
          setConsultations(prev => prev.map(c => c.id === payFor ? { ...c, payment_status: 'paid' } : c));
        }}
      />

      {/* Chat / teleconsult modal */}
      <ChatModal
        open={chatFor !== null}
        consultationId={chatFor?.id || ''}
        title={chatFor ? specialtyLabel(chatFor.specialty, t) : 'Mensagens'}
        myRole="patient"
        onClose={() => setChatFor(null)}
      />

      {videoFor && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('video.label')}
          onClick={event => { if (event.target === event.currentTarget) setVideoFor(null); }}
        >
          <div className="modal teleconsult-modal">
            <div className="modal-header">
              <div>
                <h3>{t('video.label')}</h3>
                <small>{specialtyLabel(videoFor.specialty, t)}</small>
              </div>
              <button className="teleconsult-modal-close" type="button" aria-label={t('common.close')} onClick={() => setVideoFor(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <TeleconsultationControl consultationId={videoFor.id} role="patient" />
            </div>
          </div>
        </div>
      )}

      {summaryFor && <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Resumo da consulta">
        <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}><div className="modal-header"><h3>{specialtyLabel(summaryFor.specialty, t)}</h3><button className="btn btn-sm" aria-label="Fechar resumo" onClick={() => setSummaryFor(null)}><X size={20} /></button></div>
          <div className="modal-body"><ConsultationCloseout consultationId={summaryFor.id} role="patient" /></div>
        </div>
      </div>}

      {/* Review modal */}
      <ReviewModal
        open={reviewFor !== null}
        consultationId={reviewFor?.id || ''}
        title={reviewFor ? specialtyLabel(reviewFor.specialty, t) : undefined}
        onClose={() => setReviewFor(null)}
      />
    </>
  );
}
