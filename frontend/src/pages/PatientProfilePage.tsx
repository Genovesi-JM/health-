import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import type { Patient } from '../types';
import { User, Save, AlertCircle, Plus, Trash2, Users, Pill, Activity, Building2, Stethoscope, Hospital, MonitorSmartphone, CheckCircle2 } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

// ─── Local Types ─────────────────────────────────────────────

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
}

interface Dependent {
  id: string;
  name: string;
  date_of_birth: string;
  relationship: 'filho' | 'filha' | 'outro';
  is_minor: boolean;
}

function calcAge(dob: string): number {
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

// ─── Partners Data ────────────────────────────────────────────

interface Partner {
  id: string;
  name: string;
  type: 'clinic' | 'online_doctor' | 'hospital';
  detail: string;
}

const PARTNERS: Partner[] = [
  { id: 'girassol',       name: 'Clínica Girassol',            type: 'clinic',         detail: 'Luanda — Clínica geral e especialidades' },
  { id: 'multiperfil',    name: 'Clínica Multiperfil',         type: 'clinic',         detail: 'Luanda — Multiespecialidades e urgência' },
  { id: 'sagrada',        name: 'Clínica Sagrada Esperança',   type: 'clinic',         detail: 'Luanda — Internamento e cirurgia' },
  { id: 'dr_consulta',    name: 'Dr. Consulta Online',         type: 'online_doctor',  detail: 'Consulta médica em vídeo — sem deslocação' },
  { id: 'medonline',      name: 'MedOnline Angola',            type: 'online_doctor',  detail: 'Médicos disponíveis 7 dias por semana' },
  { id: 'boavida',        name: 'Hospital Américo Boavida',    type: 'hospital',       detail: 'Luanda — Hospital público de referência' },
  { id: 'hlu',            name: 'Hospital de Luanda',          type: 'hospital',       detail: 'Luanda — Urgências e internamento' },
  { id: 'hmp',            name: 'Hospital Militar Principal',  type: 'hospital',       detail: 'Luanda — Urgências e especialidades' },
];

const PARTNER_TYPE_ICON: Record<Partner['type'], ReactNode> = {
  clinic:        <Stethoscope size={14} />,
  online_doctor: <MonitorSmartphone size={14} />,
  hospital:      <Hospital size={14} />,
};

const PARTNER_TYPE_LABEL: Record<Partner['type'], string> = {
  clinic:        'Clínica',
  online_doctor: 'Médico Online',
  hospital:      'Hospital',
};

export default function PatientProfilePage() {
  const { t } = useT();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // ── Core profile fields ───────────────────────────────────
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [chronic, setChronic] = useState('');
  const [emergName, setEmergName] = useState('');
  const [emergPhone, setEmergPhone] = useState('');

  // ── Medications ───────────────────────────────────────────
  const [medications, setMedications] = useState<Medication[]>([]);
  const [showMedForm, setShowMedForm] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedFreq, setNewMedFreq] = useState('');

  // ── Family / Dependents ───────────────────────────────────
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [showDepForm, setShowDepForm] = useState(false);
  const [newDepName, setNewDepName] = useState('');
  const [newDepDob, setNewDepDob] = useState('');
  const [newDepRel, setNewDepRel] = useState<'filho' | 'filha' | 'outro'>('filho');

  // ── Partners ──────────────────────────────────────────────
  const [selectedPartners, setSelectedPartners] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('cf_partners') || '[]'); } catch { return []; }
  });

  const togglePartner = (id: string) => {
    setSelectedPartners(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      localStorage.setItem('cf_partners', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    api.get('/api/v1/patients/me')
      .then((r: any) => {
        const p = r.data;
        setProfile(p);
        setDob(p.date_of_birth || '');
        setGender(p.gender || '');
        setBloodType(p.blood_type || '');
        setAllergies((p.allergies || []).join(', '));
        setChronic((p.chronic_conditions || []).join(', '));
        setEmergName(p.emergency_contact_name || '');
        setEmergPhone(p.emergency_contact_phone || '');
        if (p.medications) setMedications(p.medications);
      })
      .catch(() => { /* No profile yet */ })
      .finally(() => setLoading(false));

    // TODO: Replace with GET /api/v1/patients/dependents when endpoint is ready
    const stored = localStorage.getItem('cf_dependents');
    if (stored) setDependents(JSON.parse(stored));
    const storedMeds = localStorage.getItem('cf_medications');
    if (storedMeds) setMedications(JSON.parse(storedMeds));
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    const body = {
      date_of_birth: dob || null,
      gender: gender || null,
      blood_type: bloodType || null,
      allergies: allergies ? allergies.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      chronic_conditions: chronic ? chronic.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      emergency_contact_name: emergName || null,
      emergency_contact_phone: emergPhone || null,
      medications,
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

  // ── Medication helpers ────────────────────────────────────
  const addMedication = () => {
    if (!newMedName.trim()) return;
    const updated = [...medications, {
      id: `med-${Date.now()}`,
      name: newMedName.trim(),
      dosage: newMedDosage.trim(),
      frequency: newMedFreq.trim(),
    }];
    setMedications(updated);
    setNewMedName(''); setNewMedDosage(''); setNewMedFreq('');
    setShowMedForm(false);
    localStorage.setItem('cf_medications', JSON.stringify(updated));
  };

  const removeMedication = (id: string) => {
    const updated = medications.filter(m => m.id !== id);
    setMedications(updated);
    localStorage.setItem('cf_medications', JSON.stringify(updated));
  };

  // ── Dependent helpers ─────────────────────────────────────
  const addDependent = () => {
    if (!newDepName.trim() || !newDepDob) return;
    const age = calcAge(newDepDob);
    const dep: Dependent = {
      id: `dep-${Date.now()}`,
      name: newDepName.trim(),
      date_of_birth: newDepDob,
      relationship: newDepRel,
      is_minor: age < 16,
    };
    // TODO: POST /api/v1/patients/dependents
    const updated = [...dependents, dep];
    setDependents(updated);
    localStorage.setItem('cf_dependents', JSON.stringify(updated));
    setNewDepName(''); setNewDepDob(''); setNewDepRel('filho');
    setShowDepForm(false);
  };

  const removeDependent = (id: string) => {
    // TODO: DELETE /api/v1/patients/dependents/{id}
    const updated = dependents.filter(d => d.id !== id);
    setDependents(updated);
    localStorage.setItem('cf_dependents', JSON.stringify(updated));
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <h1>{t('profile.title')}</h1>
        <p>{t('profile.subtitle')}</p>
      </div>

      {/* ── Personal Profile Form ── */}
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

      {/* ── Medications Section ── */}
      <div className="card profile-med-section" style={{ maxWidth: '700px', marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Pill size={20} style={{ color: '#ef4444' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t('meds.title')}</h3>
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => setShowMedForm(v => !v)}>
            <Plus size={14} /> {t('meds.add')}
          </button>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {medications.length === 0 && !showMedForm && (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-icon"><Pill size={22} style={{ color: '#ef4444' }} /></div>
              <div className="empty-state-title">{t('meds.none')}</div>
              <div className="empty-state-desc">{t('meds.none_hint')}</div>
            </div>
          )}

          {medications.map(med => (
            <div key={med.id} className="profile-med-card">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{med.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {med.dosage && <span style={{ marginRight: '0.75rem' }}>💊 {med.dosage}</span>}
                  {med.frequency && <span>🔁 {med.frequency}</span>}
                </div>
              </div>
              <button className="btn btn-sm" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                onClick={() => removeMedication(med.id)}>
                <Trash2 size={13} /> {t('meds.remove')}
              </button>
            </div>
          ))}

          {showMedForm && (
            <div className="profile-med-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>{t('meds.name')}</label>
                  <input className="form-input" style={{ fontSize: '0.85rem' }} type="text"
                    placeholder="Ex: Metformina" value={newMedName} onChange={e => setNewMedName(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>{t('meds.dosage')}</label>
                  <input className="form-input" style={{ fontSize: '0.85rem' }} type="text"
                    placeholder="500mg" value={newMedDosage} onChange={e => setNewMedDosage(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>{t('meds.frequency')}</label>
                  <input className="form-input" style={{ fontSize: '0.85rem' }} type="text"
                    placeholder="2×/dia" value={newMedFreq} onChange={e => setNewMedFreq(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary btn-sm" onClick={addMedication}><Save size={13} /> {t('meds.save')}</button>
                <button className="btn btn-outline btn-sm" onClick={() => setShowMedForm(false)}>{t('family.cancel_add')}</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Family / Dependents Section ── */}
      <div className="card profile-family-section" style={{ maxWidth: '700px', marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Users size={20} style={{ color: 'var(--accent-teal)' }} />
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>{t('family.title')}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.15rem 0 0' }}>{t('family.subtitle')}</p>
            </div>
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => setShowDepForm(v => !v)}>
            <Plus size={14} /> {t('family.add')}
          </button>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {dependents.length === 0 && !showDepForm && (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-icon"><Users size={22} style={{ color: 'var(--accent-teal)' }} /></div>
              <div className="empty-state-title">{t('family.none')}</div>
            </div>
          )}

          {dependents.map(dep => {
            const age = dep.date_of_birth ? calcAge(dep.date_of_birth) : null;
            return (
              <div key={dep.id} className="profile-dependent-card">
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{dep.name}</span>
                    {dep.is_minor && (
                      <span style={{
                        fontSize: '0.68rem', padding: '0.1rem 0.45rem', borderRadius: '20px',
                        background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)', fontWeight: 600,
                      }}>
                        {t('family.minor_badge')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {dep.relationship.charAt(0).toUpperCase() + dep.relationship.slice(1)}
                    {age !== null && <span style={{ marginLeft: '0.5rem' }}>• {age} anos</span>}
                  </div>
                  {dep.is_minor && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--accent-teal)', marginTop: '0.2rem' }}>
                      {t('family.minor_note')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => navigate('/triage', { state: { dependent: dep } })}>
                    <Activity size={13} /> {t('family.triage_for')}
                  </button>
                  <button className="btn btn-sm"
                    style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                    onClick={() => removeDependent(dep.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {showDepForm && (
            <div className="profile-med-form">
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>{t('family.name')}</label>
                  <input className="form-input" style={{ fontSize: '0.85rem' }} type="text"
                    placeholder="Nome completo" value={newDepName} onChange={e => setNewDepName(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>{t('family.dob')}</label>
                  <input className="form-input" style={{ fontSize: '0.85rem' }} type="date"
                    value={newDepDob} onChange={e => setNewDepDob(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>{t('family.rel')}</label>
                  <select className="form-select" style={{ fontSize: '0.85rem' }} value={newDepRel}
                    onChange={e => setNewDepRel(e.target.value as 'filho' | 'filha' | 'outro')}>
                    <option value="filho">{t('family.rel_son')}</option>
                    <option value="filha">{t('family.rel_daughter')}</option>
                    <option value="outro">{t('family.rel_other')}</option>
                  </select>
                </div>
              </div>
              {newDepDob && (
                <p style={{ fontSize: '0.78rem', color: calcAge(newDepDob) < 16 ? '#eab308' : 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  {calcAge(newDepDob)} anos
                  {calcAge(newDepDob) < 16 ? ' — será criado como perfil pediátrico' : ''}
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary btn-sm" onClick={addDependent}><Save size={13} /> {t('family.save')}</button>
                <button className="btn btn-outline btn-sm" onClick={() => setShowDepForm(false)}>{t('family.cancel_add')}</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ PARCEIROS DE SAÚDE ══ */}
      <div className="card" style={{ maxWidth: '700px', marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
          <Building2 size={18} style={{ color: 'var(--accent-teal)' }} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Parceiros de Saúde</h3>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
            Seleccione os parceiros que pretende associar ao seu perfil. Ao marcar uma consulta, os seus dados de triagem serão partilhados com o parceiro seleccionado.
          </p>
          <div className="partners-grid">
            {PARTNERS.map(p => {
              const selected = selectedPartners.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`partner-card${selected ? ' partner-card--selected' : ''}`}
                  onClick={() => togglePartner(p.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span className={`partner-type-badge partner-type-badge--${p.type}`}>
                      {PARTNER_TYPE_ICON[p.type]} {PARTNER_TYPE_LABEL[p.type]}
                    </span>
                    {selected && <CheckCircle2 size={16} style={{ color: 'var(--accent-teal)', flexShrink: 0 }} />}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', marginTop: '0.5rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{p.detail}</div>
                </button>
              );
            })}
          </div>
          {selectedPartners.length > 0 && (
            <p style={{ fontSize: '0.78rem', color: 'var(--accent-teal)', marginTop: '1rem' }}>
              {selectedPartners.length} parceiro(s) seleccionado(s) — dados de triagem serão partilhados na próxima consulta agendada.
            </p>
          )}
        </div>
      </div>

      {/* Info tip */}
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
