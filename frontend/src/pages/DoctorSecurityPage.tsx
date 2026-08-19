import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, ShieldCheck, ChevronRight } from 'lucide-react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';

export default function DoctorSecurityPage() {
  const { t } = useT();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(''); setErr('');
    if (form.next !== form.confirm) { setErr(t('dsec.mismatch')); return; }
    if (form.next.length < 8) { setErr(t('dsec.too_short')); return; }
    setLoading(true);
    try {
      await api.post('/auth/change-password', { old_password: form.current, new_password: form.next });
      setMsg(t('dsec.updated'));
      setForm({ current: '', next: '', confirm: '' });
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? t('dsec.update_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Lock size={20} style={{ color: 'var(--brand-primary)' }} /> {t('dsec.title')}
      </h1>

      <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '1.25rem' }}>{t('dsec.change_password')}</div>
        <form onSubmit={submit}>
          {[
            { key: 'current', label: t('dsec.current') },
            { key: 'next',    label: t('dsec.new') },
            { key: 'confirm', label: t('dsec.confirm') },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>{f.label}</label>
              <div style={{ position: 'relative' }}>
                <input className="form-input" type={show ? 'text' : 'password'} value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} required style={{ paddingRight: '2.5rem' }} />
                <button type="button" onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          ))}
          {err && <div style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{err}</div>}
          {msg && <div style={{ color: '#059669', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{msg}</div>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', background: 'var(--brand-primary)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
            {loading ? t('dsec.saving') : t('dsec.update_btn')}
          </button>
        </form>
      </div>

      <Link to="/security/mfa" className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none', color: 'inherit' }}>
        <ShieldCheck size={28} style={{ color: '#10b981', flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t('dsec.mfa_title')}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{t('dsec.mfa_desc')}</div>
        </div>
        <ChevronRight size={18} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
      </Link>
    </div>
  );
}
