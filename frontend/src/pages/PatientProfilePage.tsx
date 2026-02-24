import { useEffect, useState, type FormEvent } from 'react';
import api from '../api';
import type { Patient } from '../types';
import { User, Save, AlertCircle } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

export default function PatientProfilePage() {
  const { t } = useT();
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
      setMsg(t('profile.saved'));
    } catch (err: any) {
      setMsg(err.response?.data?.detail || t('profile.save_error'));
    }
    setSaving(false);
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <h1>{t('profile.title')}</h1>
        <p>{t('profile.subtitle')}</p>
      </div>

      <div className="card" style={{ maxWidth: '700px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
          <User size={20} style={{ color: 'var(--accent-teal)' }} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t('profile.personal')}</h3>
        </div>
        <form onSubmit={handleSave} style={{ padding: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{t('profile.dob')}</label>
              <input className="form-input" type="date" value={dob} onChange={e => setDob(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('profile.gender')}</label>
              <select className="form-select" value={gender} onChange={e => setGender(e.target.value)}>
                <option value="">{t('profile.gender_select')}</option>
                <option value="male">{t('profile.gender_male')}</option>
                <option value="female">{t('profile.gender_female')}</option>
                <option value="other">{t('profile.gender_other')}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('profile.blood_type')}</label>
              <select className="form-select" value={bloodType} onChange={e => setBloodType(e.target.value)}>
                <option value="">{t('profile.gender_select')}</option>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bt => <option key={bt} value={bt}>{bt}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('profile.allergies')}</label>
            <input className="form-input" type="text" placeholder={t('profile.allergies_placeholder')}
              value={allergies} onChange={e => setAllergies(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">{t('profile.chronic')}</label>
            <input className="form-input" type="text" placeholder={t('profile.chronic_placeholder')}
              value={chronic} onChange={e => setChronic(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{t('profile.emergency_name')}</label>
              <input className="form-input" type="text" placeholder={t('profile.emergency_name_placeholder')}
                value={emergName} onChange={e => setEmergName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('profile.emergency_phone')}</label>
              <input className="form-input" type="tel" placeholder="+244 ..."
                value={emergPhone} onChange={e => setEmergPhone(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} /> {saving ? t('profile.saving') : t('profile.save')}
            </button>
            {msg && (
              <span style={{ fontSize: '0.82rem', color: msg.includes(t('profile.saved')) ? 'var(--accent-green)' : '#fca5a5' }}>
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
          {t('profile.info_tip')}
        </div>
      </div>
    </>
  );
}
