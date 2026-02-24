import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useT } from '../i18n/LanguageContext';
import { useAuth } from '../AuthContext';
import api from '../api';
import type { PatientState } from '../types';
import BookConsultationModal from '../components/BookConsultationModal';
import { useEffect } from 'react';
import {
  CheckCircle2, Droplets, Moon, Eye, Pill, Apple, Dumbbell,
  AlertTriangle, Activity, ArrowLeft,
} from 'lucide-react';

export default function SelfCarePage() {
  const { t } = useT();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patientState, setPatientState] = useState<PatientState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);

  useEffect(() => {
    api.get('/api/v1/dashboard/patient-state')
      .then(res => setPatientState(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const tips = [
    { icon: <Droplets size={20} />, title: t('selfcare.tip_hydration'), desc: t('selfcare.tip_hydration_desc'), color: '#06b6d4' },
    { icon: <Moon size={20} />, title: t('selfcare.tip_rest'), desc: t('selfcare.tip_rest_desc'), color: '#8b5cf6' },
    { icon: <Eye size={20} />, title: t('selfcare.tip_monitor'), desc: t('selfcare.tip_monitor_desc'), color: '#f59e0b' },
    { icon: <Pill size={20} />, title: t('selfcare.tip_medication'), desc: t('selfcare.tip_medication_desc'), color: '#ef4444' },
    { icon: <Apple size={20} />, title: t('selfcare.tip_diet'), desc: t('selfcare.tip_diet_desc'), color: '#22c55e' },
    { icon: <Dumbbell size={20} />, title: t('selfcare.tip_exercise'), desc: t('selfcare.tip_exercise_desc'), color: '#3b82f6' },
  ];

  const seekReasons = [
    t('selfcare.seek_1'),
    t('selfcare.seek_2'),
    t('selfcare.seek_3'),
    t('selfcare.seek_4'),
  ];

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
          {t('selfcare.title')}
        </p>
        <h1>{t('selfcare.title')}</h1>
        <p>{t('selfcare.subtitle')}</p>
      </div>

      {/* Good News Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff',
        borderRadius: '14px', padding: '1.25rem 1.5rem', marginBottom: '1.25rem',
        display: 'flex', alignItems: 'center', gap: '1rem',
        boxShadow: '0 4px 20px rgba(34,197,94,0.3)',
      }}>
        <CheckCircle2 size={28} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.2rem' }}>
            {t('selfcare.good_news')}
          </div>
          <div style={{ fontSize: '0.88rem', opacity: 0.95 }}>
            {t('selfcare.low_risk_msg')}
          </div>
          {patientState?.last_triage_complaint && (
            <div style={{ marginTop: '0.4rem', fontSize: '0.82rem', opacity: 0.85 }}>
              {t('selfcare.complaint_label')} {patientState.last_triage_complaint}
            </div>
          )}
        </div>
      </div>

      {/* Self-Care Tips Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {tips.map((tip, i) => (
          <div key={i} className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{
                width: 42, height: 42, borderRadius: '10px', flexShrink: 0,
                background: `${tip.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: tip.color,
              }}>
                {tip.icon}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                  {tip.title}
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {tip.desc}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* When to Seek Help */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{
          padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>{t('selfcare.when_seek')}</h3>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '0.75rem' }}>
            {t('selfcare.seek_desc')}
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {seekReasons.map((reason, i) => (
              <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.4rem', lineHeight: 1.5 }}>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <Link to="/triage" className="btn btn-primary">
          <Activity size={16} /> {t('selfcare.new_triage')}
        </Link>
        <button onClick={() => setShowBooking(true)} className="btn btn-secondary">
          {t('selfcare.book_anyway')}
        </button>
      </div>

      <Link to="/dashboard" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
        {t('selfcare.back_dashboard')}
      </Link>

      {/* Book Consultation Modal */}
      <BookConsultationModal
        open={showBooking}
        onClose={() => setShowBooking(false)}
        patientState={patientState}
        onBooked={() => { setShowBooking(false); navigate('/consultations'); }}
      />
    </>
  );
}
