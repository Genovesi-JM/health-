import { useState, type FormEvent } from 'react';
import { useAuth } from '../AuthContext';
import api from '../api';
import { Settings, Lock, Bell, Globe, Save } from 'lucide-react';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<'account' | 'security' | 'notifications'>('account');

  // Password change
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setPwMsg('As palavras-passe não coincidem.'); return; }
    if (newPw.length < 6) { setPwMsg('Mínimo 6 caracteres.'); return; }
    setPwLoading(true); setPwMsg('');
    try {
      await api.post('/auth/change-password', { old_password: oldPw, new_password: newPw });
      setPwMsg('Palavra-passe alterada com sucesso.');
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      setPwMsg(err.response?.data?.detail || 'Erro ao alterar.');
    }
    setPwLoading(false);
  };

  return (
    <>
      <div className="page-header">
        <h1>Definições</h1>
        <p>Gerir as configurações da sua conta</p>
      </div>

      <div className="tab-nav">
        <button className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}>
          <Settings size={14} style={{ marginRight: '0.4rem', verticalAlign: 'text-bottom' }} /> Conta
        </button>
        <button className={tab === 'security' ? 'active' : ''} onClick={() => setTab('security')}>
          <Lock size={14} style={{ marginRight: '0.4rem', verticalAlign: 'text-bottom' }} /> Segurança
        </button>
        <button className={tab === 'notifications' ? 'active' : ''} onClick={() => setTab('notifications')}>
          <Bell size={14} style={{ marginRight: '0.4rem', verticalAlign: 'text-bottom' }} /> Notificações
        </button>
      </div>

      {/* Account */}
      {tab === 'account' && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Informações da Conta</h3>
          </div>
          <div style={{ padding: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={user?.email || ''} readOnly
                style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Função</label>
              <input className="form-input" type="text" value={user?.role || ''} readOnly
                style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Nome</label>
              <input className="form-input" type="text" value={user?.name || ''} readOnly
                style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Para alterar estas informações, contacte o suporte.
            </p>
          </div>
        </div>
      )}

      {/* Security */}
      {tab === 'security' && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Alterar Palavra-passe</h3>
          </div>
          <form onSubmit={handlePasswordChange} style={{ padding: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Palavra-passe atual</label>
              <input className="form-input" type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Nova palavra-passe</label>
              <input className="form-input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmar nova palavra-passe</label>
              <input className="form-input" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={pwLoading}>
                <Save size={16} /> {pwLoading ? 'A alterar…' : 'Alterar'}
              </button>
              {pwMsg && <span style={{ fontSize: '0.82rem', color: pwMsg.includes('sucesso') ? 'var(--accent-green)' : '#fca5a5' }}>{pwMsg}</span>}
            </div>
          </form>
        </div>
      )}

      {/* Notifications */}
      {tab === 'notifications' && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Preferências de Notificação</h3>
          </div>
          <div style={{ padding: '1.25rem' }}>
            {['Alertas de Triagem', 'Lembretes de Consulta', 'Atualizações da Plataforma', 'Emails Promocionais'].map(n => (
              <div key={n} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.75rem 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: '0.88rem' }}>{n}</span>
                <label style={{ position: 'relative', width: '44px', height: '24px', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{
                    position: 'absolute', inset: 0, borderRadius: '12px',
                    background: 'var(--gradient-primary)', transition: '0.2s',
                  }} />
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
