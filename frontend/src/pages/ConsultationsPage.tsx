import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import type { Consultation, PatientState } from '../types';
import { Calendar, Clock, CheckCircle2, XCircle, AlertCircle, Activity, Zap } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';
import BookConsultationModal from '../components/BookConsultationModal';
import PaymentModal from '../components/PaymentModal';
import ChatModal from '../components/ChatModal';
import ReviewModal from '../components/ReviewModal';
import { specialtyLabel } from '../constants/specialties';
import { openVideoRoom } from '../utils/video';
import { MessageSquare, Star, Video } from 'lucide-react';

const LOCALE_MAP: Record<string, string> = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR' };

export default function ConsultationsPage() {
  const { t, lang } = useT();
  const locale = LOCALE_MAP[lang] || 'pt-PT';
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [patientState, setPatientState] = useState<PatientState | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'upcoming' | 'past'>('all');
  const [showBooking, setShowBooking] = useState(false);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [chatFor, setChatFor] = useState<Consultation | null>(null);
  const [reviewFor, setReviewFor] = useState<Consultation | null>(null);

  useEffect(() => {
    Promise.allSettled([
      api.get('/api/v1/consultations/me'),
      api.get('/api/v1/dashboard/patient-state'),
    ]).then(([cRes, sRes]) => {
      if (cRes.status === 'fulfilled') setConsultations(cRes.value.data);
      if (sRes.status === 'fulfilled') setPatientState(sRes.value.data);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = consultations.filter(c => {
    if (tab === 'upcoming') return ['requested','scheduled','in_progress'].includes(c.status);
    if (tab === 'past') return ['completed','cancelled','no_show'].includes(c.status);
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

  return (
    <>
      <div className="page-header">
        <h1>{t('consult.title')}</h1>
        <p>{t('consult.subtitle')}</p>
      </div>

      <div className="tab-nav">
        <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>{t('consult.tab_all')}</button>
        <button className={tab === 'upcoming' ? 'active' : ''} onClick={() => setTab('upcoming')}>{t('consult.tab_upcoming')}</button>
        <button className={tab === 'past' ? 'active' : ''} onClick={() => setTab('past')}>{t('consult.tab_past')}</button>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
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
                      {specialtyLabel(c.specialty, t)}
                      {['scheduled', 'in_progress', 'completed'].includes(c.status) && (
                        <button
                          onClick={() => setChatFor(c)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, background: 'none', border: 'none', color: 'var(--accent-teal)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: 0 }}
                        >
                          <MessageSquare size={13} /> {t('msg.messages')}
                        </button>
                      )}
                      {['scheduled', 'in_progress'].includes(c.status) && (
                        <button
                          onClick={() => openVideoRoom(c.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, marginLeft: 10, background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: 0 }}
                        >
                          <Video size={13} /> Vídeo
                        </button>
                      )}
                      {c.status === 'completed' && (
                        <button
                          onClick={() => setReviewFor(c)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, marginLeft: 10, background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: 0 }}
                        >
                          <Star size={13} /> Avaliar
                        </button>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(c.status)}`}>
                        {statusIcon(c.status)} {statusLabel(c.status)}
                      </span>
                    </td>
                    <td>{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString(locale) : '—'}</td>
                    <td>
                      {c.payment_status === 'paid' ? (
                        <span className="badge badge-success">{t('pay.status_paid')}</span>
                      ) : ['cancelled', 'no_show'].includes(c.status) ? (
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

      {/* Book Consultation Modal */}
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
