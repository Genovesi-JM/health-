import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Heart, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useAuth } from '../AuthContext';
import api from '../api';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  /* Forgot-password modal */
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data);
      const role = res.data.user?.role;
      navigate(role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Credenciais inválidas.');
    } finally { setLoading(false); }
  };

  const handleForgotPw = async (e: FormEvent) => {
    e.preventDefault();
    setForgotMsg('');
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotMsg('Se o email existir, receberá instruções de recuperação.');
    } catch {
      setForgotMsg('Se o email existir, receberá instruções de recuperação.');
    }
  };

  const handleOAuth = (provider: 'google' | 'microsoft') => {
    window.location.href = `/auth/${provider}/login`;
  };

  return (
    <div className="auth-shell">
      {/* Login Card */}
      <div className="auth-card">
        {/* Brand */}
        <div className="auth-brand">
          <Heart size={32} className="auth-brand-icon" />
          <span className="auth-brand-text">HEALTH PLATFORM</span>
        </div>

        <h1 className="auth-title">Iniciar Sessão</h1>
        <p className="auth-subtitle">Aceda ao portal Health Platform</p>

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <div className="form-input-icon">
              <Mail size={16} className="icon-left" />
              <input className="form-input" type="email" placeholder="utilizador@empresa.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Palavra-passe</label>
            <div className="form-input-icon">
              <Lock size={16} className="icon-left" />
              <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required
                style={{ paddingRight: '2.5rem' }} />
              <button type="button" className="icon-right" onClick={() => setShowPw(!showPw)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginBottom: '0.75rem' }}>
            {loading ? 'A entrar…' : 'Iniciar Sessão'}
          </button>
        </form>

        {/* OAuth */}
        <button type="button" className="auth-oauth-btn" onClick={() => handleOAuth('google')}
          style={{ marginBottom: '0.5rem' }}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width={18} height={18} />
          Entrar com Google
        </button>
        <button type="button" className="auth-oauth-btn" onClick={() => handleOAuth('microsoft')}
          style={{ background: '#2f2f2f', borderColor: '#2f2f2f', color: '#fff' }}>
          <svg width="18" height="18" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
          Entrar com Microsoft
        </button>

        {/* Links */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.82rem' }}>
          <button type="button" onClick={() => setShowForgot(true)}
            style={{ background: 'none', border: 'none', color: 'var(--accent-teal)', cursor: 'pointer', fontWeight: 600 }}>
            Esqueceu a palavra-passe?
          </button>
        </div>

        {/* Feedback */}
        {error && <div className="toast error" style={{ position: 'relative', top: 0, right: 0, marginTop: '1rem' }}>{error}</div>}
        {success && <div className="toast success" style={{ position: 'relative', top: 0, right: 0, marginTop: '1rem' }}>{success}</div>}

        {/* Toggle to register */}
        <div className="auth-toggle">
          Não tem conta?{' '}
          <Link to="/register">Criar conta</Link>
        </div>

        {/* Hint */}
        <div style={{
          marginTop: '1rem', padding: '0.75rem', borderRadius: '12px',
          border: '1px solid var(--border)', background: 'rgba(10,16,28,0.6)',
          fontSize: '0.82rem', color: 'var(--text-secondary)'
        }}>
          Aceda com as suas credenciais.
        </div>

        <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
          <Link to="/" style={{ color: 'var(--accent-teal)', fontSize: '0.82rem', textDecoration: 'none' }}>
            ← Voltar ao site
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowForgot(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>Recuperar Palavra-passe</h3>
              <button className="btn-icon" onClick={() => setShowForgot(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Insira o seu email e enviaremos instruções de recuperação.
              </p>
              <form onSubmit={handleForgotPw}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" placeholder="utilizador@empresa.com"
                    value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  Enviar
                </button>
              </form>
              {forgotMsg && <p style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--accent-teal)' }}>{forgotMsg}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
