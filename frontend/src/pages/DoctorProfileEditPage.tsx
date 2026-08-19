import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stethoscope, User, Phone, MapPin, BookOpen, Save, CheckCircle2,
  AlertCircle, Loader2, Globe, Link2, ExternalLink, PlusCircle, Trash2,
} from 'lucide-react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';

const SPECIALTY_VALUES = [
  'clinica_geral', 'pediatria', 'cardiologia', 'ginecologia', 'dermatologia',
  'ortopedia', 'oftalmologia', 'neurologia', 'psiquiatria', 'psicologia',
  'fisioterapia', 'odontologia', 'medicina_interna', 'urgencia', 'outro',
];

const PROVINCES = [
  'Luanda','Benguela','Huambo','Bié','Malanje','Lunda Norte','Lunda Sul',
  'Huíla','Namibe','Cunene','Cuando Cubango','Moxico','Uíge','Zaire',
  'Cabinda','Bengo','Cuanza Norte','Cuanza Sul',
];

const LANG_OPTIONS = ['PT','EN','FR','ES','AR','ZH'];

type Education = { institution: string; degree: string; year: string };

export default function DoctorProfileEditPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [slug, setSlug] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('pending');

  // Fields
  const [displayName, setDisplayName] = useState('');
  const [title, setTitle] = useState('Dr.');
  const [specialty, setSpecialty] = useState('clinica_geral');
  const [license, setLicense] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [years, setYears] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [acceptsNew, setAcceptsNew] = useState(true);
  const [consultTypes, setConsultTypes] = useState<string[]>(['teleconsulta']);
  const [languages, setLanguages] = useState<string[]>(['PT']);
  const [education, setEducation] = useState<Education[]>([]);

  useEffect(() => {
    api.get('/api/v1/doctors/me')
      .then(r => {
        const d = r.data;
        setSlug(d.slug || '');
        setVerificationStatus(d.verification_status || 'pending');
        setDisplayName(d.display_name || '');
        setTitle(d.title || 'Dr.');
        setSpecialty(d.specialization || 'clinica_geral');
        setLicense(d.license_number || '');
        setPhone(d.phone || '');
        setCity(d.location_city || '');
        setProvince(d.location_province || '');
        setYears(d.years_experience?.toString() || '');
        setBio(d.bio || '');
        setPhotoUrl(d.photo_url || '');
        setPriceMin(d.price_min?.toString() || '');
        setPriceMax(d.price_max?.toString() || '');
        setAcceptsNew(d.accepts_new_patients ?? true);
        setConsultTypes(d.consultation_types || ['teleconsulta']);
        setLanguages(d.languages || ['PT']);
        setEducation((d.education || []).map((e: any) => ({ ...e, year: e.year?.toString() || '' })));
      })
      .catch(() => setError(t('dpe.load_error')))
      .finally(() => setLoading(false));
  }, []);

  const toggleConsultType = (t: string) =>
    setConsultTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const toggleLang = (l: string) =>
    setLanguages(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);

  const addEducation = () =>
    setEducation(prev => [...prev, { institution: '', degree: '', year: '' }]);

  const updateEdu = (idx: number, field: keyof Education, value: string) =>
    setEducation(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));

  const removeEdu = (idx: number) =>
    setEducation(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api.patch('/api/v1/doctors/me', {
        display_name: displayName.trim() || null,
        title,
        specialization: specialty,
        license_number: license.trim() || null,
        phone: phone.trim() || null,
        location_city: city.trim() || null,
        location_province: province || null,
        years_experience: years ? parseInt(years) : null,
        bio: bio.trim() || null,
        photo_url: photoUrl.trim() || null,
        price_min: priceMin ? parseInt(priceMin) : null,
        price_max: priceMax ? parseInt(priceMax) : null,
        accepts_new_patients: acceptsNew,
        consultation_types: consultTypes,
        languages,
        education: education.filter(e => e.institution).map(e => ({ ...e, year: e.year ? parseInt(e.year) : null })),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('dpe.save_error'));
    } finally {
      setSaving(false);
    }
  };

  const statusColors: Record<string, string> = {
    pending: '#d97706', verified: '#059669', rejected: '#dc2626', suspended: '#6b7280',
  };
  const statusLabelKeys: Record<string, string> = {
    pending: 'dpe.st_pending', verified: 'dpe.st_verified', rejected: 'dpe.st_rejected', suspended: 'dpe.st_suspended',
  };
  const publicUrl = slug ? `${window.location.origin}${import.meta.env.BASE_URL}medicos/${slug}` : null;

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={28} style={{ color: 'var(--brand-primary)', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 740, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{t('dpe.title')}</h1>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
            {t('dpe.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: statusColors[verificationStatus] || '#6b7280', background: `${statusColors[verificationStatus]}18`, padding: '0.3rem 0.75rem', borderRadius: 999 }}>
            {statusLabelKeys[verificationStatus] ? t(statusLabelKeys[verificationStatus]) : verificationStatus}
          </span>
          {publicUrl && verificationStatus === 'verified' && (
            <a href={publicUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', fontWeight: 600 }}>
              <ExternalLink size={13} /> {t('dpe.view_public')}
            </a>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── Identidade ── */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 className="card-section-title"><User size={14} /> {t('dpe.sec_identity')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label className="form-label">{t('dpe.title_label')}</label>
              <select className="form-input" value={title} onChange={e => setTitle(e.target.value)}>
                <option>Dr.</option><option>Dra.</option><option>Prof.</option><option>Prof.ª</option>
              </select>
            </div>
            <div>
              <label className="form-label">{t('dpe.public_name')} *</label>
              <input className="form-input" placeholder={t('dpe.public_name_ph')} value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label"><Phone size={12} /> {t('dpe.phone')}</label>
              <input className="form-input" placeholder="+244 9XX XXX XXX" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="form-label">{t('dpe.photo_url')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('dpe.optional')}</span></label>
              <input className="form-input" placeholder="https://…" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── Credenciais ── */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 className="card-section-title"><Stethoscope size={14} /> {t('dpe.sec_credentials')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label className="form-label">{t('dpe.specialty')} *</label>
              <select className="form-input" value={specialty} onChange={e => setSpecialty(e.target.value)}>
                {SPECIALTY_VALUES.map(v => <option key={v} value={v}>{t(`spec.${v}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">{t('dpe.license')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('dpe.optional')}</span></label>
              <input className="form-input" placeholder="OMEN-12345" value={license} onChange={e => setLicense(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label">{t('dpe.years_exp')}</label>
              <input className="form-input" type="number" min="0" max="60" value={years} onChange={e => setYears(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={acceptsNew} onChange={e => setAcceptsNew(e.target.checked)} />
                <span>{t('dpe.accepts_new')}</span>
              </label>
            </div>
          </div>
        </div>

        {/* ── Localização ── */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 className="card-section-title"><MapPin size={14} /> {t('dpe.sec_location')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label">{t('dpe.city')}</label>
              <input className="form-input" placeholder="Luanda" value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div>
              <label className="form-label">{t('dpe.province')}</label>
              <select className="form-input" value={province} onChange={e => setProvince(e.target.value)}>
                <option value="">{t('dpe.select')}</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Consulta ── */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 className="card-section-title"><Globe size={14} /> {t('dpe.sec_consult_type')}</h3>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {[{ key: 'teleconsulta', label: t('dpe.ct_tele') }, { key: 'presencial', label: t('dpe.ct_presencial') }, { key: 'domicilio', label: t('dpe.ct_domicilio') }].map(ct => (
              <label key={ct.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: 999, cursor: 'pointer', background: consultTypes.includes(ct.key) ? 'var(--brand-light)' : 'var(--bg-card)', border: `1.5px solid ${consultTypes.includes(ct.key) ? 'var(--brand-primary)' : 'var(--border)'}`, color: consultTypes.includes(ct.key) ? 'var(--brand-primary)' : 'var(--text-secondary)', fontWeight: consultTypes.includes(ct.key) ? 600 : 400, fontSize: '0.82rem' }}>
                <input type="checkbox" checked={consultTypes.includes(ct.key)} onChange={() => toggleConsultType(ct.key)} style={{ display: 'none' }} />
                {ct.label}
              </label>
            ))}
          </div>

          <h4 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>{t('dpe.price_title')}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label className="form-label">{t('dpe.min')}</label>
              <input className="form-input" type="number" min="0" placeholder="ex: 5000" value={priceMin} onChange={e => setPriceMin(e.target.value)} />
            </div>
            <div>
              <label className="form-label">{t('dpe.max')}</label>
              <input className="form-input" type="number" min="0" placeholder="ex: 15000" value={priceMax} onChange={e => setPriceMax(e.target.value)} />
            </div>
          </div>

          <h4 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>{t('dpe.languages')}</h4>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {LANG_OPTIONS.map(l => (
              <label key={l} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.75rem', borderRadius: 999, cursor: 'pointer', background: languages.includes(l) ? 'var(--brand-light)' : 'var(--bg-card)', border: `1.5px solid ${languages.includes(l) ? 'var(--brand-primary)' : 'var(--border)'}`, color: languages.includes(l) ? 'var(--brand-primary)' : 'var(--text-secondary)', fontWeight: languages.includes(l) ? 600 : 400, fontSize: '0.8rem' }}>
                <input type="checkbox" checked={languages.includes(l)} onChange={() => toggleLang(l)} style={{ display: 'none' }} />
                {l}
              </label>
            ))}
          </div>
        </div>

        {/* ── Bio ── */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 className="card-section-title"><BookOpen size={14} /> {t('dpe.sec_bio')}</h3>
          <textarea className="form-input" rows={4} placeholder={t('dpe.bio_ph')} value={bio} onChange={e => setBio(e.target.value)} style={{ resize: 'vertical' }} />
        </div>

        {/* ── Formação ── */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="card-section-title" style={{ margin: 0 }}><Link2 size={14} /> {t('dpe.sec_education')}</h3>
            <button type="button" onClick={addEducation} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--brand-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              <PlusCircle size={15} /> {t('dpe.add')}
            </button>
          </div>
          {education.length === 0 && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('dpe.no_education')}</p>}
          {education.map((edu, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 36px', gap: '0.5rem', marginBottom: '0.6rem', alignItems: 'center' }}>
              <input className="form-input" placeholder={t('dpe.institution')} value={edu.institution} onChange={e => updateEdu(idx, 'institution', e.target.value)} />
              <input className="form-input" placeholder={t('dpe.degree')} value={edu.degree} onChange={e => updateEdu(idx, 'degree', e.target.value)} />
              <input className="form-input" placeholder={t('dpe.year')} type="number" min="1960" max="2030" value={edu.year} onChange={e => updateEdu(idx, 'year', e.target.value)} />
              <button type="button" onClick={() => removeEdu(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', fontSize: '0.85rem' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {saved && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#059669', fontSize: '0.85rem' }}>
            <CheckCircle2 size={16} /> {t('dpe.saved')}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn btn-primary" style={{ padding: '0.9rem', fontSize: '0.95rem', fontWeight: 700 }}>
          {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> {t('common.saving')}</> : <><Save size={16} /> {t('dpe.save')}</>}
        </button>
      </form>
    </div>
  );
}
