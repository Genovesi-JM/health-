import { useEffect, useState, type FormEvent } from 'react';
import api from '../api';
import type { Patient } from '../types';
import { User, Save, AlertCircle } from 'lucide-react';

export default function PatientProfilePage() {
  const [profile, setProfile] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Form fields
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [chronic, setChronic] = useState('');
  const [emergName, setEmergName] = useState('');
  const [emergPhone, setEmergPhone] = useState('');

  useEffect(() => {
    api.get('/api/v1/patients/me')
      .then(r => {
        const p = r.data;
        setProfile(p);
        setDob(p.date_of_birth || '');
        setGender(p.gender || '');
        setBloodType(p.blood_type || '');
        setAllergies((p.allergies || []).join(', '));
        setChronic((p.chronic_conditions || []).join(', '));
        setEmergName(p.emergency_contact_name || '');
        setEmergPhone(p.emergency_contact_phone || '');
      })
      .catch(() => { /* No profile yet */ })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    const body = {
      date_of_birth: dob || null,
      gender: gender || null,
      blood_type: bloodType || null,
      allergies: allergies ? allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
      chronic_conditions: chronic ? chronic.split(',').map(s => s.trim()).filter(Boolean) : [],
      emergency_contact_name: emergName || null,
      emergency_contact_phone: emergPhone || null,
    };
    try {
      if (profile) {
        await api.put('/api/v1/patients/me', body);
      } else {
        await api.post('/api/v1/patients/', body);
      }
      setMsg('Perfil guardado com sucesso.');
    } catch (err: any) {
      setMsg(err.response?.data?.detail || 'Erro ao guardar.');
    }
    setSaving(false);
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <h1>Perfil Clínico</h1>
        <p>Gerir os seus dados de saúde e informações pessoais</p>
      </div>

      <div className="card" style={{ maxWidth: '700px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
          <User size={20} style={{ color: 'var(--accent-teal)' }} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Informações Pessoais</h3>
        </div>
        <form onSubmit={handleSave} style={{ padding: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Data de Nascimento</label>
              <input className="form-input" type="date" value={dob} onChange={e => setDob(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Género</label>
              <select className="form-select" value={gender} onChange={e => setGender(e.target.value)}>
                <option value="">Selecionar</option>
                <option value="male">Masculino</option>
                <option value="female">Feminino</option>
                <option value="other">Outro</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo Sanguíneo</label>
              <select className="form-select" value={bloodType} onChange={e => setBloodType(e.target.value)}>
                <option value="">Selecionar</option>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Alergias (separadas por vírgula)</label>
            <input className="form-input" type="text" placeholder="Ex: Penicilina, Glúten"
              value={allergies} onChange={e => setAllergies(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Condições Crónicas (separadas por vírgula)</label>
            <input className="form-input" type="text" placeholder="Ex: Diabetes, Hipertensão"
              value={chronic} onChange={e => setChronic(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Contacto de Emergência — Nome</label>
              <input className="form-input" type="text" placeholder="Nome do contacto"
                value={emergName} onChange={e => setEmergName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Contacto de Emergência — Telefone</label>
              <input className="form-input" type="tel" placeholder="+244 ..."
                value={emergPhone} onChange={e => setEmergPhone(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} /> {saving ? 'A guardar…' : 'Guardar Perfil'}
            </button>
            {msg && (
              <span style={{ fontSize: '0.82rem', color: msg.includes('sucesso') ? 'var(--accent-green)' : '#fca5a5' }}>
                {msg}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Info alert */}
      <div style={{
        marginTop: '1rem', padding: '0.85rem 1rem', borderRadius: '12px',
        border: '1px solid rgba(20,184,166,0.2)', background: 'rgba(20,184,166,0.06)',
        display: 'flex', gap: '0.65rem', alignItems: 'flex-start', maxWidth: '700px',
      }}>
        <AlertCircle size={18} style={{ color: 'var(--accent-teal)', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Estas informações são utilizadas durante a triagem e consultas médicas.
          Quanto mais completo o perfil, melhor a qualidade do atendimento.
        </div>
      </div>
    </>
  );
}
