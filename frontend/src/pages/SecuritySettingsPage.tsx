import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Loader2, LogOut, Mail, Phone, ShieldCheck, Smartphone } from 'lucide-react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg-primary)',
  fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.6rem',
};

interface SessionRow { session_id: string; started_at: string; expires_at: string; }

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
      <h2 style={{ margin: '0 0 0.9rem', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}

export default function SecuritySettingsPage() {
  const { t } = useT();

  // Password
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  // Email / phone
  const [newEmail, setNewEmail] = useState(''); const [emailPw, setEmailPw] = useState('');
  const [newPhone, setNewPhone] = useState(''); const [phonePw, setPhonePw] = useState('');
  // Sessions
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setMsg({ kind, text });
    window.setTimeout(() => setMsg(null), 3500);
  };

  const loadSessions = useCallback(async () => {
    try {
      const res = await api.get<{ sessions: SessionRow[] }>('/auth/sessions');
      setSessions(res.data.sessions);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setMsg(null);
    try { await fn(); }
    catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      flash('err', err.response?.data?.detail || 'Erro.');
    } finally { setBusy(null); }
  };

  const changePassword = () => run('pw', async () => {
    await api.post('/auth/change-password', { current_password: curPw, new_password: newPw });
    setCurPw(''); setNewPw(''); flash('ok', t('sec.saved'));
  });
  const changeEmail = () => run('email', async () => {
    await api.post('/auth/change-email', { new_email: newEmail, password: emailPw });
    setNewEmail(''); setEmailPw(''); flash('ok', t('sec.saved'));
  });
  const changePhone = () => run('phone', async () => {
    await api.post('/auth/change-phone', { new_phone: newPhone, password: phonePw });
    setNewPhone(''); setPhonePw(''); flash('ok', t('sec.saved'));
  });
  const revokeOthers = () => run('sessions', async () => {
    const refresh = localStorage.getItem('ht_refresh_token');
    await api.post('/auth/revoke-sessions', { keep_current_refresh_token: refresh });
    await loadSessions(); flash('ok', t('sec.saved'));
  });

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldCheck size={22} style={{ color: 'var(--brand-primary)' }} /> {t('sec.title')}
      </h1>
      <p style={{ margin: '0 0 1.25rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{t('sec.subtitle')}</p>

      {msg && (
        <div style={{ marginBottom: '1rem', padding: '0.6rem 0.9rem', borderRadius: 8, fontSize: '0.85rem',
          background: msg.kind === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
          color: msg.kind === 'ok' ? '#047857' : '#b91c1c' }}>
          {msg.text}
        </div>
      )}

      <Section icon={<KeyRound size={16} />} title={t('sec.password')}>
        <input type="password" style={inputStyle} placeholder={t('sec.current_pw')} value={curPw} onChange={e => setCurPw(e.target.value)} />
        <input type="password" style={inputStyle} placeholder={t('sec.new_pw')} value={newPw} onChange={e => setNewPw(e.target.value)} />
        <button className="btn btn-primary btn-sm" disabled={busy === 'pw' || !curPw || newPw.length < 6} onClick={changePassword}>
          {busy === 'pw' ? <Loader2 size={14} className="spin" /> : null} {t('sec.change_pw')}
        </button>
      </Section>

      <Section icon={<Mail size={16} />} title={t('sec.email')}>
        <input type="email" style={inputStyle} placeholder={t('sec.new_email')} value={newEmail} onChange={e => setNewEmail(e.target.value)} />
        <input type="password" style={inputStyle} placeholder={t('sec.confirm_pw')} value={emailPw} onChange={e => setEmailPw(e.target.value)} />
        <button className="btn btn-primary btn-sm" disabled={busy === 'email' || !newEmail || !emailPw} onClick={changeEmail}>
          {busy === 'email' ? <Loader2 size={14} className="spin" /> : null} {t('sec.change_email')}
        </button>
      </Section>

      <Section icon={<Phone size={16} />} title={t('sec.phone')}>
        <input type="tel" style={inputStyle} placeholder={t('sec.new_phone')} value={newPhone} onChange={e => setNewPhone(e.target.value)} />
        <input type="password" style={inputStyle} placeholder={t('sec.confirm_pw')} value={phonePw} onChange={e => setPhonePw(e.target.value)} />
        <button className="btn btn-primary btn-sm" disabled={busy === 'phone' || newPhone.length < 6 || !phonePw} onClick={changePhone}>
          {busy === 'phone' ? <Loader2 size={14} className="spin" /> : null} {t('sec.change_phone')}
        </button>
      </Section>

      <Section icon={<Smartphone size={16} />} title={t('sec.mfa')}>
        <Link to="/security/mfa" className="btn btn-ghost btn-sm">{t('sec.mfa_manage')}</Link>
      </Section>

      <Section icon={<LogOut size={16} />} title={t('sec.sessions')}>
        {sessions.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</div>
        ) : sessions.map(s => (
          <div key={s.session_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
            <span>{t('sec.session_started')}: {new Date(s.started_at).toLocaleString('pt-PT')}</span>
            <span style={{ color: 'var(--text-muted)' }}>{t('sec.session_expires')}: {new Date(s.expires_at).toLocaleDateString('pt-PT')}</span>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" style={{ marginTop: '0.75rem', color: '#b91c1c' }}
          disabled={busy === 'sessions'} onClick={revokeOthers}>
          {busy === 'sessions' ? <Loader2 size={14} className="spin" /> : null} {t('sec.revoke_all')}
        </button>
      </Section>
    </div>
  );
}
