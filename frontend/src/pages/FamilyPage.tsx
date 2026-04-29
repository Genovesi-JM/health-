import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import {
  Users, Plus, Trash2, Save, X, Edit2, Activity,
  Phone, Mail, AlertCircle, Loader2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FamilyMember {
  id: string;
  owner_patient_id: string;
  full_name: string;
  relationship: string;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  is_minor: boolean;
  emergency_contact: boolean;
  notes: string | null;
  created_at: string;
}

interface FormState {
  full_name: string;
  relationship: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  email: string;
  is_minor: boolean;
  emergency_contact: boolean;
  notes: string;
}

const BLANK_FORM: FormState = {
  full_name: '', relationship: 'filho', date_of_birth: '',
  gender: '', phone: '', email: '',
  is_minor: false, emergency_contact: false, notes: '',
};

const REL_OPTIONS = [
  { value: 'filho',    label: 'Filho' },
  { value: 'filha',    label: 'Filha' },
  { value: 'pai',      label: 'Pai' },
  { value: 'mãe',      label: 'Mãe' },
  { value: 'cônjuge',  label: 'Cônjuge / Parceiro(a)' },
  { value: 'irmão',    label: 'Irmão' },
  { value: 'irmã',     label: 'Irmã' },
  { value: 'avô',      label: 'Avô' },
  { value: 'avó',      label: 'Avó' },
  { value: 'outro',    label: 'Outro' },
];

function calcAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

export default function FamilyPage() {
  const { t } = useT();
  const navigate = useNavigate();

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    api.get<FamilyMember[]>('/api/v1/family/me')
      .then(r => setMembers(r.data))
      .catch(() => setError('Não foi possível carregar os membros da família.'))
      .finally(() => setLoading(false));
  }, []);

  // ── Form helpers ──────────────────────────────────────────────────────────

  const openAdd = () => { setEditId(null); setForm(BLANK_FORM); setFormError(''); setShowForm(true); };

  const openEdit = (m: FamilyMember) => {
    setEditId(m.id);
    setForm({
      full_name: m.full_name, relationship: m.relationship,
      date_of_birth: m.date_of_birth ?? '', gender: m.gender ?? '',
      phone: m.phone ?? '', email: m.email ?? '',
      is_minor: m.is_minor, emergency_contact: m.emergency_contact,
      notes: m.notes ?? '',
    });
    setFormError(''); setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditId(null); setForm(BLANK_FORM); };

  const f = (field: keyof FormState, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleDobChange = (dob: string) => {
    f('date_of_birth', dob);
    if (dob) f('is_minor', calcAge(dob) < 16);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) { setFormError('O nome é obrigatório.'); return; }
    setSaving(true); setFormError('');
    const payload = {
      full_name: form.full_name.trim(),
      relationship: form.relationship,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      is_minor: form.is_minor,
      emergency_contact: form.emergency_contact,
      notes: form.notes.trim() || null,
    };
    try {
      if (editId) {
        const r = await api.patch<FamilyMember>(`/api/v1/family/${editId}`, payload);
        setMembers(prev => prev.map(m => m.id === editId ? r.data : m));
      } else {
        const r = await api.post<FamilyMember>('/api/v1/family', payload);
        setMembers(prev => [...prev, r.data]);
      }
      closeForm();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Erro ao guardar. Tente novamente.');
    }
    setSaving(false);
  };

  const confirmDelete = async (id: string) => {
    setDeleting(true);
    try {
      await api.delete(`/api/v1/family/${id}`);
      setMembers(prev => prev.filter(m => m.id !== id));
    } catch {
      setError('Erro ao remover membro. Tente novamente.');
    }
    setDeleting(false); setDeleteId(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="page-header">
        <h1>{t('family.title')}</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Perfis de membros da família ou dependentes ligados à sua conta. Estes perfis não implicam cobertura médica automática.
        </p>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem', maxWidth: 700, color: '#dc2626', fontSize: '0.85rem' }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="card" style={{ maxWidth: '700px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Users size={20} style={{ color: 'var(--accent-teal)' }} />
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>{t('family.title')}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.1rem 0 0' }}>
                {members.length} membro{members.length !== 1 ? 's' : ''} registado{members.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {!showForm && (
            <button className="btn btn-sm btn-outline" onClick={openAdd}>
              <Plus size={14} /> {t('family.add')}
            </button>
          )}
        </div>

        <div style={{ padding: '1.25rem' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
              <Loader2 size={16} className="spin" /> A carregar…
            </div>
          )}

          {!loading && members.length === 0 && !showForm && (
            <div className="empty-state" style={{ padding: '3rem 2rem' }}>
              <div className="empty-state-icon"><Users size={28} style={{ color: 'var(--accent-teal)' }} /></div>
              <div className="empty-state-title">{t('family.none')}</div>
              <div className="empty-state-desc" style={{ maxWidth: 360, margin: '0 auto 1.25rem' }}>
                Adicione um membro da família ou dependente para poder realizar triagens em nome deles e acompanhar a sua saúde.
              </div>
              <button className="btn btn-primary btn-sm" onClick={openAdd}>
                <Plus size={14} /> {t('family.add')}
              </button>
            </div>
          )}

          {members.map(m => {
            const age = m.date_of_birth ? calcAge(m.date_of_birth) : null;
            const relLabel = REL_OPTIONS.find(r => r.value === m.relationship)?.label ?? m.relationship;
            return (
              <div key={m.id} className="profile-dependent-card" style={{ marginBottom: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{m.full_name}</span>
                    {m.is_minor && (
                      <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem', borderRadius: 20, background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)', fontWeight: 600 }}>
                        Pediátrico
                      </span>
                    )}
                    {m.emergency_contact && (
                      <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem', borderRadius: 20, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', fontWeight: 600 }}>
                        Emergência
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span>{relLabel}</span>
                    {age !== null && <span>• {age} anos</span>}
                    {m.gender && <span>• {m.gender}</span>}
                  </div>
                  {(m.phone || m.email) && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', gap: '0.75rem' }}>
                      {m.phone && <span><Phone size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{m.phone}</span>}
                      {m.email && <span><Mail size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{m.email}</span>}
                    </div>
                  )}
                  {m.notes && (
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontStyle: 'italic' }}>{m.notes}</div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => navigate('/triage', { state: { dependent: { id: m.id, name: m.full_name, is_minor: m.is_minor } } })}
                  >
                    <Activity size={12} /> Triagem
                  </button>
                  <button className="btn btn-sm btn-outline" onClick={() => openEdit(m)}>
                    <Edit2 size={12} />
                  </button>
                  {deleteId === m.id ? (
                    <>
                      <button
                        className="btn btn-sm"
                        style={{ background: '#dc2626', color: '#fff', border: 'none' }}
                        onClick={() => confirmDelete(m.id)}
                        disabled={deleting}
                      >
                        {deleting ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />} Confirmar
                      </button>
                      <button className="btn btn-sm btn-outline" onClick={() => setDeleteId(null)}>
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-sm"
                      style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                      onClick={() => setDeleteId(m.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add / Edit form */}
          {showForm && (
            <div className="profile-med-form" style={{ marginTop: members.length > 0 ? '1rem' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  {editId ? 'Editar membro' : 'Adicionar membro da família'}
                </span>
                <button className="btn btn-sm btn-outline" onClick={closeForm}><X size={13} /></button>
              </div>

              {formError && (
                <div style={{ fontSize: '0.8rem', color: '#dc2626', background: 'rgba(239,68,68,0.06)', borderRadius: 8, padding: '0.5rem 0.75rem', marginBottom: '0.75rem' }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Nome completo *</label>
                  <input className="form-input" style={{ fontSize: '0.85rem' }} type="text"
                    placeholder="Ex: Ana Silva" value={form.full_name}
                    onChange={e => f('full_name', e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Parentesco *</label>
                  <select className="form-select" style={{ fontSize: '0.85rem' }} value={form.relationship}
                    onChange={e => f('relationship', e.target.value)}>
                    {REL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Data de nascimento</label>
                  <input className="form-input" style={{ fontSize: '0.85rem' }} type="date"
                    value={form.date_of_birth} onChange={e => handleDobChange(e.target.value)} />
                  {form.date_of_birth && (
                    <span style={{ fontSize: '0.72rem', color: form.is_minor ? '#eab308' : 'var(--text-muted)' }}>
                      {calcAge(form.date_of_birth)} anos{form.is_minor ? ' — Perfil pediátrico' : ''}
                    </span>
                  )}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Género</label>
                  <select className="form-select" style={{ fontSize: '0.85rem' }} value={form.gender}
                    onChange={e => f('gender', e.target.value)}>
                    <option value="">Não especificar</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Telefone</label>
                  <input className="form-input" style={{ fontSize: '0.85rem' }} type="tel"
                    placeholder="+244 ..." value={form.phone} onChange={e => f('phone', e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>E-mail</label>
                  <input className="form-input" style={{ fontSize: '0.85rem' }} type="email"
                    placeholder="opcional" value={form.email} onChange={e => f('email', e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Notas</label>
                  <input className="form-input" style={{ fontSize: '0.85rem' }} type="text"
                    placeholder="Informação adicional" value={form.notes} onChange={e => f('notes', e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.emergency_contact}
                    onChange={e => f('emergency_contact', e.target.checked)} />
                  Contacto de emergência
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_minor}
                    onChange={e => f('is_minor', e.target.checked)} />
                  Menor / Perfil pediátrico
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                  <Save size={13} /> {saving ? 'A guardar…' : (editId ? 'Actualizar' : t('family.save'))}
                </button>
                <button className="btn btn-outline btn-sm" onClick={closeForm}>{t('family.cancel_add')}</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 700, marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 10, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        ℹ️ Os perfis de membros da família são geridos por si e ligados à sua conta. Podem ser seleccionados ao iniciar uma triagem em nome de outra pessoa. Não implicam automaticamente responsabilidade médica ou cobertura de seguro.
      </div>
    </>
  );
}
