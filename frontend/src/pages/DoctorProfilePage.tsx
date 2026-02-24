import { useEffect, useState, type FormEvent } from 'react';
import api from '../api';
import type { Doctor } from '../types';
import { Stethoscope, Save, AlertCircle } from 'lucide-react';

export default function DoctorProfilePage() {
  const [profile, setProfile] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [license, setLicense] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [bio, setBio] = useState('');

  const specializations = [
    'Clínica Geral', 'Cardiologia', 'Dermatologia', 'Pediatria',
    'Ortopedia', 'Neurologia', 'Ginecologia', 'Oftalmologia',
    'Psiquiatria', 'Medicina Interna', 'Cirurgia Geral', 'Outra',
  ];

  useEffect(() => {
    api.get('/api/v1/doctors/me')
      .then(r => {
        const d = r.data;
        setProfile(d);
        setLicense(d.license_number || '');
        setSpecialization(d.specialization || '');
        setBio(d.bio || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    const body = { license_number: license, specialization, bio: bio || null };
    try {
      if (profile) {
        await api.put('/api/v1/doctors/me', body);
      } else {
        await api.post('/api/v1/doctors/', body);
      }
      setMsg('Perfil médico guardado.');
    } catch (err: any) {
      setMsg(err.response?.data?.detail || 'Erro ao guardar.');
    }
    setSaving(false);
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <h1>Perfil Médico</h1>
        <p>Gerir as suas credenciais e informações profissionais</p>
      </div>

      {/* Verification status */}
      {profile && (
        <div style={{
          marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '12px',
          display: 'flex', alignItems: 'center', gap: '0.65rem',
          background: profile.verification_status === 'verified' ? 'rgba(34,197,94,0.08)' : 'rgba(234,179,8,0.08)',
          border: `1px solid ${profile.verification_status === 'verified' ? 'rgba(34,197,94,0.2)' : 'rgba(234,179,8,0.2)'}`,
          maxWidth: '700px',
        }}>
          <AlertCircle size={18} style={{ color: profile.verification_status === 'verified' ? '#22c55e' : '#eab308' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            Estado de verificação: <strong style={{ color: profile.verification_status === 'verified' ? '#22c55e' : '#eab308' }}>
              {profile.verification_status === 'verified' ? 'Verificado' : profile.verification_status === 'rejected' ? 'Rejeitado' : 'Pendente'}
            </strong>
          </span>
        </div>
      )}

      <div className="card" style={{ maxWidth: '700px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
          <Stethoscope size={20} style={{ color: 'var(--accent-teal)' }} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Dados Profissionais</h3>
        </div>
        <form onSubmit={handleSave} style={{ padding: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Número de Licença</label>
              <input className="form-input" type="text" placeholder="OM-12345"
                value={license} onChange={e => setLicense(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Especialização</label>
              <select className="form-select" value={specialization} onChange={e => setSpecialization(e.target.value)} required>
                <option value="">Selecionar</option>
                {specializations.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Bio / Descrição</label>
            <textarea className="form-textarea" rows={4}
              placeholder="Breve descrição profissional..."
              value={bio} onChange={e => setBio(e.target.value)}
              style={{
                width: '100%', padding: '0.7rem 0.9rem',
                background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border)',
                borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.88rem', resize: 'vertical',
              }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} /> {saving ? 'A guardar…' : 'Guardar'}
            </button>
            {msg && <span style={{ fontSize: '0.82rem', color: msg.includes('guardado') ? 'var(--accent-green)' : '#fca5a5' }}>{msg}</span>}
          </div>
        </form>
      </div>
    </>
  );
}
