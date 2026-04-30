import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Heart, Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../AuthContext';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';

const REQUIRED_CONSENTS = ['terms_of_service', 'privacy_policy', 'medical_disclaimer', 'health_data_processing', 'telemedicine_consent'] as const;

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [fullName, setFullName] = useState('');
  const [sector, setSector] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Consent checkboxes
  const [consents, setConsents] = useState({
    terms_of_service: false,
    privacy_policy: false,
    medical_disclaimer: false,
    health_data_processing: false,
    telemedicine_consent: false,
  });
  const allConsentsChecked = REQUIRED_CONSENTS.every(c => consents[c]);

  const sectors = [
    { value: '', label: t('register.sector_select') },
    { value: 'general', label: t('register.sector_general') },
    { value: 'cardiology', label: t('register.sector_cardiology') },
    { value: 'dermatology', label: t('register.sector_dermatology') },
    { value: 'pediatrics', label: t('register.sector_pediatrics') },
    { value: 'orthopedics', label: t('register.sector_orthopedics') },
    { value: 'neurology', label: t('register.sector_neurology') },
  ];

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPw) { setError(t('register.pw_mismatch')); return; }
    if (password.length < 6) { setError(t('register.pw_short')); return; }
    if (!allConsentsChecked) { setError('Please accept all required consents to register.'); return; }

    setLoading(true);
    try {
      const body = {
        email,
        password,
        full_name: fullName || email.split('@')[0],
        sector_focus: sector || 'general',
        org_name: 'Health Platform',
        account_name: fullName || email.split('@')[0],
        entity_type: 'individual',
        modules_enabled: ['triage', 'teleconsulta'],
      };
      const res = await api.post('/auth/register', body);
      login(res.data);
      // Post consents in background (best-effort; ConsentGate will catch any failures)
      for (const ct of REQUIRED_CONSENTS) {
        api.post('/api/v1/compliance/consent', { consent_type: ct }).catch(() => {});
      }
      sessionStorage.setItem('consents_accepted', 'true');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || t('register.error'));
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-shell">
      <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 100 }}>
        <LanguageSelector />
      </div>

      <div className="auth-card">
        {/* Brand */}
        <div className="auth-brand">
          <Heart size={32} className="auth-brand-icon" />
          <span className="auth-brand-text">HEALTH PLATFORM</span>
        </div>

        <h1 className="auth-title">{t('register.title')}</h1>
        <p className="auth-subtitle">{t('register.subtitle')}</p>

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">{t('register.full_name')}</label>
            <div className="form-input-icon">
              <User size={16} className="icon-left" />
              <input className="form-input" type="text" placeholder="João Silva"
                value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('register.email')}</label>
            <div className="form-input-icon">
              <Mail size={16} className="icon-left" />
              <input className="form-input" type="email" placeholder="utilizador@empresa.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('register.password')}</label>
            <div className="form-input-icon">
              <Lock size={16} className="icon-left" />
              <input className="form-input" type={showPw ? 'text' : 'password'} placeholder={t('register.password_placeholder')}
                value={password} onChange={e => setPassword(e.target.value)} required
                style={{ paddingRight: '2.5rem' }} />
              <button type="button" className="icon-right" onClick={() => setShowPw(!showPw)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('register.confirm_password')}</label>
            <div className="form-input-icon">
              <Lock size={16} className="icon-left" />
              <input className="form-input" type={showCpw ? 'text' : 'password'} placeholder={t('register.confirm_placeholder')}
                value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required
                style={{ paddingRight: '2.5rem' }} />
              <button type="button" className="icon-right" onClick={() => setShowCpw(!showCpw)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showCpw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('register.sector')}</label>
            <select className="form-select" value={sector} onChange={e => setSector(e.target.value)} required>
              {sectors.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* ── Required consents ── */}
          <div style={{ margin: '0.25rem 0 1rem', padding: '1rem', borderRadius: '8px',
            border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg, #f8fafc)',
            display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600,
              color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Required consents
            </p>

            <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={consents.terms_of_service}
                onChange={() => setConsents(p => ({ ...p, terms_of_service: !p.terms_of_service }))}
                style={{ marginTop: '2px', accentColor: 'var(--accent-teal, #0d9488)', cursor: 'pointer' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text, #0f172a)', lineHeight: 1.5 }}>
                I accept the{' '}
                <Link to="/terms" target="_blank"
                  style={{ color: 'var(--accent-teal, #0d9488)' }}>Terms of Service</Link>
              </span>
            </label>

            <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={consents.medical_disclaimer}
                onChange={() => setConsents(p => ({ ...p, medical_disclaimer: !p.medical_disclaimer }))}
                style={{ marginTop: '2px', accentColor: 'var(--accent-teal, #0d9488)', cursor: 'pointer' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text, #0f172a)', lineHeight: 1.5 }}>
                I acknowledge the{' '}
                <Link to="/medical-disclaimer" target="_blank"
                  style={{ color: 'var(--accent-teal, #0d9488)' }}>Medical Disclaimer</Link>
                {' '}— this platform is not an emergency service and does not replace in-person care
              </span>
            </label>

            <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={consents.health_data_processing}
                onChange={() => setConsents(p => ({ ...p, health_data_processing: !p.health_data_processing }))}
                style={{ marginTop: '2px', accentColor: 'var(--accent-teal, #0d9488)', cursor: 'pointer' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text, #0f172a)', lineHeight: 1.5 }}>
                I consent to processing of my health-related data as described in the{' '}
                <Link to="/privacy" target="_blank"
                  style={{ color: 'var(--accent-teal, #0d9488)' }}>Privacy Policy</Link>
              </span>
            </label>

            <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={consents.privacy_policy}
                onChange={() => setConsents(p => ({ ...p, privacy_policy: !p.privacy_policy }))}
                style={{ marginTop: '2px', accentColor: 'var(--accent-teal, #0d9488)', cursor: 'pointer' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text, #0f172a)', lineHeight: 1.5 }}>
                I have read and accept the{' '}
                <Link to="/privacy" target="_blank"
                  style={{ color: 'var(--accent-teal, #0d9488)' }}>Privacy Policy</Link>
              </span>
            </label>

            <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={consents.telemedicine_consent}
                onChange={() => setConsents(p => ({ ...p, telemedicine_consent: !p.telemedicine_consent }))}
                style={{ marginTop: '2px', accentColor: 'var(--accent-teal, #0d9488)', cursor: 'pointer' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text, #0f172a)', lineHeight: 1.5 }}>
                I consent to receiving telemedicine services through this platform
              </span>
            </label>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading || !allConsentsChecked}
            style={{ width: '100%', justifyContent: 'center', marginBottom: '0.75rem' }}>
            {loading ? t('register.loading') : t('register.submit')}
          </button>

          <button type="button" className="btn btn-outline btn-lg"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => navigate('/login')}>
            {t('register.cancel')}
          </button>
        </form>

        {error && <div className="toast error" style={{ position: 'relative', top: 0, right: 0, marginTop: '1rem' }}>{error}</div>}

        <div className="auth-toggle">
          {t('register.have_account')}{' '}
          <Link to="/login">{t('register.sign_in')}</Link>
        </div>

        <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
          <Link to="/" style={{ color: 'var(--accent-teal)', fontSize: '0.82rem', textDecoration: 'none' }}>
            {t('register.back_site')}
          </Link>
        </div>
      </div>
    </div>
  );
}
