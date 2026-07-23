import { useState, useEffect } from 'react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import type { Consultation, PatientState } from '../types';
import { X, Calendar, AlertTriangle } from 'lucide-react';
import { SPECIALTY_CODES, normalizeSpecialty } from '../constants/specialties';

const SPECIALTIES = SPECIALTY_CODES;

interface DoctorLite { id: string; display_name?: string | null; title?: string | null; specialization: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  patientState: PatientState | null;
  onBooked: (consultation: Consultation) => void;
}

export default function BookConsultationModal({ open, onClose, patientState, onBooked }: Props) {
  const { t } = useT();
  const [specialty, setSpecialty] = useState('');
  const [mode, setMode] = useState<'next' | 'schedule'>('next');
  const [doctors, setDoctors] = useState<DoctorLite[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Load verified doctors for the chosen specialty when scheduling.
  useEffect(() => {
    if (!open || mode !== 'schedule' || !specialty) { setDoctors([]); return; }
    let cancelled = false;
    api.get('/api/v1/doctors')
      .then(r => {
        if (cancelled) return;
        const list: DoctorLite[] = (r.data || []).filter(
          (d: DoctorLite) => normalizeSpecialty(d.specialization) === specialty,
        );
        setDoctors(list);
      })
      .catch(() => setDoctors([]));
    return () => { cancelled = true; };
  }, [open, mode, specialty]);

  if (!open) return null;

  const reset = () => { setSpecialty(''); setMode('next'); setDoctorId(''); setScheduledAt(''); setError(''); setSuccess(false); };

  const riskColor = (risk?: string) => {
    switch (risk?.toUpperCase()) {
      case 'URGENT': return '#ef4444';
      case 'HIGH': return '#f97316';
      case 'MEDIUM': return '#eab308';
      default: return '#22c55e';
    }
  };

  const scheduleReady = mode === 'next' || (!!doctorId && !!scheduledAt);

  const handleSubmit = async () => {
    if (!specialty || !scheduleReady) return;
    setSubmitting(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        specialty,
        triage_session_id: patientState?.last_triage_session_id || undefined,
      };
      if (mode === 'schedule') {
        payload.doctor_id = doctorId;
        payload.scheduled_at = new Date(scheduledAt).toISOString();
      } else {
        payload.next_available = true;
      }
      const res = await api.post('/api/v1/consultations/book', payload);
      setSuccess(true);
      setTimeout(() => {
        onBooked(res.data);
        reset();
      }, 1200);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('booking.error'));
    }
    setSubmitting(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) { onClose(); reset(); }
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '16px', width: '100%', maxWidth: '460px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        animation: 'fadeIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '10px',
              background: 'rgba(20,184,166,0.1)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--accent-teal)',
            }}>
              <Calendar size={20} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('booking.title')}
            </h3>
          </div>
          <button onClick={() => { onClose(); reset(); }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: '0.25rem',
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          {/* Triage context */}
          {patientState?.last_triage_risk && (
            <div style={{
              padding: '0.75rem 1rem', borderRadius: '10px',
              background: `${riskColor(patientState.last_triage_risk)}10`,
              border: `1px solid ${riskColor(patientState.last_triage_risk)}30`,
              marginBottom: '1.25rem',
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                {t('booking.based_on')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={14} style={{ color: riskColor(patientState.last_triage_risk) }} />
                <span style={{
                  padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                  background: `${riskColor(patientState.last_triage_risk)}15`,
                  color: riskColor(patientState.last_triage_risk),
                }}>
                  {t('booking.risk_label')}: {patientState.last_triage_risk}
                </span>
                {patientState.last_triage_complaint && (
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    — {patientState.last_triage_complaint}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Specialty selector */}
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {t('booking.specialty')}
          </label>
          <select
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="form-input"
            style={{ width: '100%', marginBottom: '1.25rem' }}
          >
            <option value="">{t('booking.specialty_select')}</option>
            {SPECIALTIES.map(s => (
              <option key={s} value={s}>{t(`spec.${s}`)}</option>
            ))}
          </select>

          {/* Mode: next available vs schedule a specific doctor/time */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: mode === 'schedule' ? '1rem' : '1.25rem' }}>
            {([['next', 'Próxima disponível'], ['schedule', 'Escolher médico e hora']] as const).map(([m, label]) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`btn btn-sm ${mode === m ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1, justifyContent: 'center' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Schedule: doctor + datetime */}
          {mode === 'schedule' && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Médico</label>
              <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className="form-input" style={{ width: '100%', marginBottom: '0.75rem' }} disabled={!specialty}>
                <option value="">{doctors.length ? 'Selecionar médico…' : (specialty ? 'Sem médicos disponíveis' : 'Escolha a especialidade primeiro')}</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.title || 'Dr.'} {d.display_name || 'Médico'}</option>
                ))}
              </select>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Data e hora</label>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="form-input" style={{ width: '100%' }} min={new Date().toISOString().slice(0, 16)} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.82rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '0.82rem', marginBottom: '1rem', fontWeight: 600 }}>
              ✓ {t('booking.success')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '0.75rem',
          padding: '1rem 1.5rem', borderTop: '1px solid var(--border)',
        }}>
          <button onClick={() => { onClose(); reset(); }} className="btn btn-secondary">
            {t('booking.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!specialty || !scheduleReady || submitting}
            className="btn btn-primary"
            style={{ opacity: !specialty || !scheduleReady || submitting ? 0.5 : 1 }}
          >
            {submitting ? t('booking.confirming') : t('booking.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
