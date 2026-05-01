import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, CheckCircle2, AlertTriangle, Loader2, Heart } from 'lucide-react';
import api from '../api';

/**
 * ConsentGatePage — shown to authenticated patients who have not yet
 * accepted all required consents.
 *
 * Also accessible at /data-consent for users who want to review/re-confirm.
 *
 * Required consents:
 *   - terms_of_service
 *   - privacy_policy
 *   - medical_disclaimer
 *   - health_data_processing
 *   - telemedicine_consent
 */

const REQUIRED_CONSENTS = [
  'terms_of_service',
  'privacy_policy',
  'medical_disclaimer',
  'health_data_processing',
  'telemedicine_consent',
] as const;

export default function ConsentGatePage() {
  const navigate = useNavigate();
  const [existing, setExisting] = useState<string[]>([]);
  const [checked, setChecked] = useState({
    terms_of_service: false,
    privacy_policy: false,
    medical_disclaimer: false,
    health_data_processing: false,
    telemedicine_consent: false,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/v1/compliance/consents')
      .then(r => {
        const types: string[] = r.data.map((c: { consent_type: string }) => c.consent_type);
        setExisting(types);
        // Pre-check boxes for already-accepted consents
        setChecked({
          terms_of_service: types.includes('terms_of_service'),
          privacy_policy: types.includes('privacy_policy'),
          medical_disclaimer: types.includes('medical_disclaimer'),
          health_data_processing: types.includes('health_data_processing'),
          telemedicine_consent: types.includes('telemedicine_consent'),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const allAccepted = REQUIRED_CONSENTS.every(c => existing.includes(c));

  const toggle = (key: keyof typeof checked) =>
    setChecked(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSubmit = async () => {
    const allChecked = REQUIRED_CONSENTS.every(c => checked[c as keyof typeof checked]);
    if (!allChecked) {
      setError('Please accept all five items to continue.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      // Only POST consents not already accepted
      for (const ct of REQUIRED_CONSENTS) {
        if (!existing.includes(ct)) {
          await api.post('/api/v1/compliance/consent', { consent_type: ct });
        }
      }
      // Mark in sessionStorage so ProtectedRoute skips the gate until next login
      sessionStorage.setItem('consents_accepted', 'true');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save consents. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg, #f8fafc)' }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-teal, #0d9488)' }} />
      </div>
    );
  }

  // Already consented — just show confirmation and let them proceed
  if (allAccepted) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg, #f8fafc)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ background: '#fff', borderRadius: '14px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          padding: '2.5rem', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <CheckCircle2 size={48} style={{ color: '#10b981', marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Consents already accepted
          </h2>
          <p style={{ color: 'var(--text-muted, #64748b)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            You have previously accepted all required consents.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f8fafc)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ background: '#fff', borderRadius: '14px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        padding: '2.5rem', maxWidth: '540px', width: '100%' }}>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <Heart size={22} style={{ color: 'var(--accent-teal, #0d9488)' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em',
            color: 'var(--accent-teal, #0d9488)' }}>KAYA</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Shield size={26} style={{ color: 'var(--accent-teal, #0d9488)' }} />
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>Before you continue</h1>
        </div>
        <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.875rem', marginBottom: '1.75rem', lineHeight: 1.6 }}>
          Health Platform handles sensitive health data and provides care coordination services.
          Please read and accept the following before accessing your account.
        </p>

        {/* Emergency warning */}
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px',
          padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.83rem',
          color: '#7f1d1d', lineHeight: 1.5 }}>
          <strong>🚨 Not an emergency service.</strong> If you are in a medical emergency,
          call <strong>112</strong> (EU) or your local emergency number immediately.
        </div>

        {/* Consent checkboxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>

          <ConsentItem
            checked={checked.terms_of_service}
            already={existing.includes('terms_of_service')}
            onChange={() => toggle('terms_of_service')}
            label={
              <>
                I have read and accept the{' '}
                <Link to="/terms" target="_blank" style={{ color: 'var(--accent-teal, #0d9488)' }}>
                  Terms of Service
                </Link>
              </>
            }
            description="Governs your use of the platform, account responsibilities, and service scope."
          />

          <ConsentItem
            checked={checked.medical_disclaimer}
            already={existing.includes('medical_disclaimer')}
            onChange={() => toggle('medical_disclaimer')}
            label={
              <>
                I acknowledge the{' '}
                <Link to="/medical-disclaimer" target="_blank" style={{ color: 'var(--accent-teal, #0d9488)' }}>
                  Medical Disclaimer
                </Link>
              </>
            }
            description="This platform is not an emergency service and does not replace in-person medical care. Device readings may contain errors and must be reviewed by a professional."
          />

          <ConsentItem
            checked={checked.health_data_processing}
            already={existing.includes('health_data_processing')}
            onChange={() => toggle('health_data_processing')}
            label={
              <>
                I consent to the processing of my health-related data as described in the{' '}
                <Link to="/privacy" target="_blank" style={{ color: 'var(--accent-teal, #0d9488)' }}>
                  Privacy Policy
                </Link>
              </>
            }
            description="Health data is processed to provide care coordination services. You can request deletion or export at any time from Settings."
          />

          <ConsentItem
            checked={checked.privacy_policy}
            already={existing.includes('privacy_policy')}
            onChange={() => toggle('privacy_policy')}
            label={
              <>
                I have read and accept the{' '}
                <Link to="/privacy" target="_blank" style={{ color: 'var(--accent-teal, #0d9488)' }}>
                  Privacy Policy
                </Link>
              </>
            }
            description="Describes how we collect, use, store, and protect your personal data in compliance with GDPR."
          />

          <ConsentItem
            checked={checked.telemedicine_consent}
            already={existing.includes('telemedicine_consent')}
            onChange={() => toggle('telemedicine_consent')}
            label="I consent to receiving telemedicine services through this platform"
            description="Telemedicine consultations are provided by licensed professionals. You acknowledge the limitations of remote care and your right to in-person alternatives."
          />
        </div>

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px',
            padding: '0.6rem 0.875rem', color: '#b91c1c', fontSize: '0.83rem',
            marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <AlertTriangle size={15} />
            {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', fontSize: '0.95rem', padding: '0.75rem' }}
          onClick={handleSubmit}
          disabled={submitting || !REQUIRED_CONSENTS.every(c => checked[c as keyof typeof checked])}
        >
          {submitting
            ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
            : 'Accept and Continue'}
        </button>

        <p style={{ marginTop: '1rem', fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)',
          lineHeight: 1.5, textAlign: 'center' }}>
          These consents are recorded with your IP address and timestamp as required for audit
          purposes. You can review accepted consents at any time in the{' '}
          <Link to="/consents" style={{ color: 'var(--accent-teal, #0d9488)' }}>Consents</Link>{' '}
          section.
        </p>
      </div>
    </div>
  );
}

function ConsentItem({
  checked,
  already,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  already: boolean;
  onChange: () => void;
  label: React.ReactNode;
  description: string;
}) {
  return (
    <label style={{
      display: 'flex',
      gap: '0.75rem',
      alignItems: 'flex-start',
      padding: '0.875rem 1rem',
      borderRadius: '8px',
      border: `1px solid ${checked ? 'var(--accent-teal, #0d9488)' : 'var(--border, #e2e8f0)'}`,
      background: checked ? 'rgba(13,148,136,0.04)' : '#fff',
      cursor: already ? 'default' : 'pointer',
      transition: 'border-color 0.15s, background 0.15s',
    }}>
      <div style={{ flexShrink: 0, marginTop: '2px' }}>
        {already ? (
          <CheckCircle2 size={20} style={{ color: '#10b981' }} />
        ) : (
          <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            style={{ width: '18px', height: '18px', accentColor: 'var(--accent-teal, #0d9488)', cursor: 'pointer' }}
          />
        )}
      </div>
      <div>
        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text, #0f172a)',
          marginBottom: '0.2rem', lineHeight: 1.4 }}>
          {label}
          {already && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem',
            color: '#10b981', fontWeight: 400 }}>(already accepted)</span>}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
    </label>
  );
}
