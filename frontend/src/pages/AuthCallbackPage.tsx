import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import kayaLogo from '/kaya-logo.svg';
import { useT } from '../i18n/LanguageContext';
import { accountPathAfterLogin } from '../authRouting';
import { persistSession } from '../api';

export default function AuthCallbackPage() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const { login, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    // Backend sends: ?token=...&email=...&role=...&name=...&redirect=...
    const token = searchParams.get('token') || searchParams.get('access_token');
    const redirect = searchParams.get('redirect') || undefined;

    if (token) {
      (async () => {
        try {
          // URL parameters are not an authority for a clinical role or identity.
          persistSession({ access_token: token, user: { id: '', email: '', role: 'patient' } });
          const fresh = await refreshUser();
          if (!cancelled) {
            login({ access_token: token, user: fresh });
            navigate(accountPathAfterLogin(fresh, redirect), { replace: true });
          }
        } catch {
          if (!cancelled) {
            logout();
            setError(t('authcb.process_error'));
          }
        }
      })();
    } else {
      setError(searchParams.get('error') || t('authcb.failed'));
    }
    return () => { cancelled = true; };
  }, [searchParams, login, logout, refreshUser, navigate, t]);

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-brand">
          <img src={kayaLogo} alt="KAYA" style={{ width: 48, height: 48 }} />
          <span className="auth-brand-text">KAYA</span>
        </div>
        {error ? (
          <>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>{t('authcb.error_title')}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>{error}</p>
            <button className="btn btn-primary" onClick={() => navigate('/login')}>{t('authcb.back_login')}</button>
          </>
        ) : (
          <>
            <div className="spinner" style={{ margin: '1.5rem auto' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{t('authcb.processing')}</p>
          </>
        )}
      </div>
    </div>
  );
}
