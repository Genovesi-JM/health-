import { Link, useNavigate } from 'react-router-dom';
import { Heart, Users, Stethoscope, Building2, Pill, ChevronRight } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';

interface Choice {
  key: string;
  labelKey: string;
  descKey: string;
  Icon: typeof Heart;
  color: string;
  destination: string;
}

const CHOICES: Choice[] = [
  { key: 'patient',      labelKey: 'ct.patient',      descKey: 'ct.patient_desc',      Icon: Heart,       color: '#0F766E', destination: '/register?role=patient' },
  { key: 'caregiver',    labelKey: 'ct.caregiver',    descKey: 'ct.caregiver_desc',    Icon: Users,       color: '#0891B2', destination: '/register?role=caregiver' },
  { key: 'professional', labelKey: 'ct.professional', descKey: 'ct.professional_desc', Icon: Stethoscope, color: '#7C3AED', destination: '/onboarding/professional' },
  { key: 'clinic',       labelKey: 'ct.clinic',       descKey: 'ct.clinic_desc',       Icon: Building2,   color: '#D97706', destination: '/onboarding/organisation?type=clinic' },
  { key: 'pharmacy',     labelKey: 'ct.pharmacy',     descKey: 'ct.pharmacy_desc',     Icon: Pill,        color: '#059669', destination: '/onboarding/organisation?type=pharmacy' },
];

export default function ChooseAccountTypePage() {
  const { t } = useT();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', padding: '2rem 1rem 4rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <Link to="/" style={{ textDecoration: 'none', fontWeight: 800, fontSize: '1.35rem', color: 'var(--brand-primary)' }}>
            KAYA
          </Link>
          <LanguageSelector />
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 800 }}>
            {t('ct.title')}
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
            {t('ct.subtitle')}
          </p>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {CHOICES.map(({ key, labelKey, descKey, Icon, color, destination }) => (
            <button
              key={key}
              type="button"
              onClick={() => navigate(destination)}
              className="card hover-lift"
              style={{
                textAlign: 'left',
                padding: '1.1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                cursor: 'pointer',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                width: '100%',
              }}
              aria-label={t(labelKey)}
            >
              <div style={{
                flexShrink: 0, width: 48, height: 48, borderRadius: 14,
                background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.98rem', marginBottom: '0.15rem' }}>
                  {t(labelKey)}
                </div>
                <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {t(descKey)}
                </div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          {t('ct.already_have')}{' '}
          <Link to="/login" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
            {t('ct.sign_in')}
          </Link>
        </div>
      </div>
    </div>
  );
}
