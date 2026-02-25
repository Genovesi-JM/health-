import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Heart } from 'lucide-react';
import type { Role } from '../types';

export default function AuthCallbackPage() {
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
    const redirect = searchParams.get('redirect') || '/dashboard';

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
        setError('Erro ao processar autenticação.');
      }
    } else {
      setError(searchParams.get('error') || 'Autenticação falhou.');
    }
  }, [searchParams, login, navigate]);

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-brand">
          <Heart size={32} className="auth-brand-icon" />
          <span className="auth-brand-text">HEALTH PLATFORM</span>
        </div>
        {error ? (
          <>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Erro de Autenticação</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>{error}</p>
            <button className="btn btn-primary" onClick={() => navigate('/login')}>Voltar ao Login</button>
          </>
        ) : (
          <>
            <div className="spinner" style={{ margin: '1.5rem auto' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>A processar autenticação…</p>
          </>
        )}
      </div>
    </div>
  );
}
