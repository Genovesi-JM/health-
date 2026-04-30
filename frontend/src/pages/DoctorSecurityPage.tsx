import { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import api from '../api';

export default function DoctorSecurityPage() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(''); setErr('');
    if (form.next !== form.confirm) { setErr('As palavras-passe não coincidem.'); return; }
    if (form.next.length < 8) { setErr('A nova palavra-passe deve ter pelo menos 8 caracteres.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/change-password', { old_password: form.current, new_password: form.next });
      setMsg('Palavra-passe actualizada com sucesso!');
      setForm({ current: '', next: '', confirm: '' });
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? 'Erro ao actualizar. Verifique a palavra-passe actual.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Lock size={20} style={{ color: 'var(--brand-primary)' }} /> Segurança
      </h1>

      <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '1.25rem' }}>Alterar Palavra-passe</div>
        <form onSubmit={submit}>
          {[
            { key: 'current', label: 'Palavra-passe actual' },
            { key: 'next',    label: 'Nova palavra-passe' },
            { key: 'confirm', label: 'Confirmar nova palavra-passe' },
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
            {loading ? 'A guardar…' : 'Actualizar palavra-passe'}
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <ShieldCheck size={28} style={{ color: '#10b981', flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Autenticação de dois factores</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Brevemente disponível. Aumenta a segurança da sua conta.</div>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: '0.73rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: 999, background: 'rgba(234,179,8,0.1)', color: '#d97706' }}>Em breve</span>
      </div>
    </div>
  );
}
