import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import type { Role } from '../types';
import kayaLogo from '/kaya-logo.svg';
import { useT } from '../i18n/LanguageContext';

export default function AuthCallbackPage() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    // Backend sends: ?token=...&email=...&role=...&name=...&redirect=...
    const token = searchParams.get('token') || searchParams.get('access_token');
    const email = searchParams.get('email') || '';
    const role = (searchParams.get('role') || 'patient') as Role;
    const name = searchParams.get('name') || '';
    const redirect = searchParams.get('redirect') ||
      (role === 'admin' ? '/admin' : role === 'doctor' ? '/doctor/dashboard' : '/dashboard');

    if (token) {
      try {
        login({
          access_token: token,
          user: {
            id: searchParams.get('account_id') || '',
            email,
            role,
            name,
            is_active: true,
          },
        });
        navigate(redirect, { replace: true });
      } catch {
        setError(t('authcb.process_error'));
      }
    } else {
      setError(searchParams.get('error') || t('authcb.failed'));
    }
  }, [searchParams, login, navigate, t]);

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
