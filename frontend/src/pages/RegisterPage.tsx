import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Heart, Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../AuthContext';
import api from '../api';

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [fullName, setFullName] = useState('');
  const [sector, setSector] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sectors = [
    { value: '', label: 'Selecionar especialidade' },
    { value: 'general', label: 'Clínica Geral' },
    { value: 'cardiology', label: 'Cardiologia' },
    { value: 'dermatology', label: 'Dermatologia' },
    { value: 'pediatrics', label: 'Pediatria' },
    { value: 'orthopedics', label: 'Ortopedia' },
    { value: 'neurology', label: 'Neurologia' },
  ];

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPw) { setError('As palavras-passe não coincidem.'); return; }
    if (password.length < 6) { setError('A palavra-passe deve ter pelo menos 6 caracteres.'); return; }

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
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao criar conta.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        {/* Brand */}
        <div className="auth-brand">
          <Heart size={32} className="auth-brand-icon" />
          <span className="auth-brand-text">HEALTH PLATFORM</span>
        </div>

        <h1 className="auth-title">Criar Conta</h1>
        <p className="auth-subtitle">Registe-se na Health Platform</p>

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">Nome Completo</label>
            <div className="form-input-icon">
              <User size={16} className="icon-left" />
              <input className="form-input" type="text" placeholder="João Silva"
                value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
          </div>

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
              <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="Escolha uma palavra-passe"
                value={password} onChange={e => setPassword(e.target.value)} required
                style={{ paddingRight: '2.5rem' }} />
              <button type="button" className="icon-right" onClick={() => setShowPw(!showPw)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Confirmar Palavra-passe</label>
            <div className="form-input-icon">
              <Lock size={16} className="icon-left" />
              <input className="form-input" type={showCpw ? 'text' : 'password'} placeholder="Repetir palavra-passe"
                value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required
                style={{ paddingRight: '2.5rem' }} />
              <button type="button" className="icon-right" onClick={() => setShowCpw(!showCpw)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showCpw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Área de Interesse</label>
            <select className="form-select" value={sector} onChange={e => setSector(e.target.value)} required>
              {sectors.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginBottom: '0.75rem' }}>
            {loading ? 'A criar…' : 'Criar Conta'}
          </button>

          <button type="button" className="btn btn-outline btn-lg"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => navigate('/login')}>
            Cancelar
          </button>
        </form>

        {error && <div className="toast error" style={{ position: 'relative', top: 0, right: 0, marginTop: '1rem' }}>{error}</div>}

        <div className="auth-toggle">
          Já tem conta?{' '}
          <Link to="/login">Iniciar sessão</Link>
        </div>

        <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
          <Link to="/" style={{ color: 'var(--accent-teal)', fontSize: '0.82rem', textDecoration: 'none' }}>
            ← Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  );
}
