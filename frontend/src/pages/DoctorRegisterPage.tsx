import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Stethoscope, User, Mail, Lock, Phone, MapPin, BookOpen,
  CheckCircle2, AlertCircle, Loader2, ChevronRight, Globe,
} from 'lucide-react';
import api, { persistSession } from '../api';
import { useT, type Lang } from '../i18n/LanguageContext';

const LOCALES: Record<Lang, string> = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', zh: 'zh-CN' };

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
// Country codes only — names are rendered locale-aware via Intl.DisplayNames.
const CREDENTIAL_COUNTRY_CODES = [
  'AO','US','GB','PT','ES','CU','RU','BR','CV','MZ','CD','ST','ZW',
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT',
  'LV','LT','LU','MT','NL','PL','RO','SK','SI','SE',
];

type Step = 'validating' | 'invalid' | 'form' | 'success';

export default function DoctorRegisterPage() {
  const { t, lang } = useT();
  const locale = LOCALES[lang] || 'pt-PT';
  const regionNames = new Intl.DisplayNames([locale], { type: 'region' });
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [step, setStep] = useState<Step>('validating');
  const [inviteInfo, setInviteInfo] = useState<{ invited_email?: string; note?: string; role?: 'doctor' | 'nurse' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [title, setTitle] = useState('Dr.');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [specialty, setSpecialty] = useState('clinica_geral');
  const [license, setLicense] = useState('');
  const [practiceCountry, setPracticeCountry] = useState('AO');
  const [licenceCountry, setLicenceCountry] = useState('AO');
  const [licenceJurisdiction, setLicenceJurisdiction] = useState('');
  const [diplomaCountry, setDiplomaCountry] = useState('AO');
  const [authority, setAuthority] = useState('');
  const [institution, setInstitution] = useState('');
  const [degreeTitle, setDegreeTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [bio, setBio] = useState('');
  const [consultTypes, setConsultTypes] = useState<string[]>(['teleconsulta']);
  const [years, setYears] = useState('');

  useEffect(() => {
    if (!token) { setStep('invalid'); return; }
    api.get(`/auth/doctor-invite/${token}`)
      .then(r => {
        setInviteInfo(r.data);
        if (r.data.invited_email) setEmail(r.data.invited_email);
        if (r.data.role === 'nurse') {
          setTitle('Enf.');
          setSpecialty('enfermagem_geral');
        }
        setStep('form');
      })
      .catch(() => setStep('invalid'));
  }, [token]);

  const toggleConsultType = (ct: string) => {
    setConsultTypes(prev =>
      prev.includes(ct) ? prev.filter(x => x !== ct) : [...prev, ct]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!displayName.trim()) return setError(t('dreg.err_name'));
    if (password !== confirmPassword) return setError(t('dsec.mismatch'));
    if (password.length < 8) return setError(t('dreg.err_pw_short'));
    if (!license.trim() || !authority.trim() || !institution.trim() || !degreeTitle.trim()) {
      return setError(t('dreg.err_creds'));
    }
    if (consultTypes.length === 0) return setError(t('dreg.err_consult'));

    setLoading(true);
    try {
      const res = await api.post('/auth/register/doctor', {
        token,
        email: email.trim().toLowerCase(),
        password,
        display_name: displayName.trim(),
        title,
        specialization: specialty,
        license_number: license.trim(),
        practice_country: practiceCountry,
        licence_country: licenceCountry,
        licence_jurisdiction: licenceJurisdiction || null,
        diploma_country: diplomaCountry,
        issuing_authority: authority.trim(),
        diploma_institution: institution.trim(),
        degree_title: degreeTitle.trim(),
        phone: phone.trim() || null,
        location_city: city.trim() || null,
        bio: bio.trim() || null,
      });
      persistSession({
        access_token: res.data.access_token,
        refresh_token: res.data.refresh_token,
        user: res.data.user,
      });
      // Save consultation types via profile endpoint after registration
      try {
        await api.patch('/api/v1/doctors/me', {
          consultation_types: consultTypes,
          location_province: province || null,
          years_experience: years ? parseInt(years) : null,
        });
      } catch { /* non-blocking */ }
      setStep('success');
      setTimeout(() => navigate('/professional-verification'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('dreg.err_generic'));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'validating') {
    return (
      <div className="landing-wrapper">
        <Navbar />
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <Loader2 size={32} style={{ color: 'var(--brand-primary)', animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>{t('dreg.validating')}</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (step === 'invalid') {
    return (
      <div className="landing-wrapper">
        <Navbar />
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: '2.5rem' }}>
            <AlertCircle size={40} style={{ color: '#ef4444', marginBottom: '1rem' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>{t('dreg.invalid_title')}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
              {t('dreg.invalid_body')}
            </p>
            <a href="mailto:parcerias@kaya.ao" className="lp-cta lp-cta--primary" style={{ display: 'inline-flex', marginTop: '1.5rem' }}>
              <Mail size={15} /> parcerias@kaya.ao
            </a>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="landing-wrapper">
        <Navbar />
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: '2.5rem' }}>
            <CheckCircle2 size={48} style={{ color: '#10b981', marginBottom: '1rem' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>{t('dreg.success_title')}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
              {t('dreg.success_body')}
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Form ──
  return (
    <div className="landing-wrapper">
      <Navbar />

      <section className="lp-page-hero" style={{ paddingBottom: '1.5rem' }}>
        <div className="lp-tag"><Stethoscope size={12} /> {t('dreg.tag')}</div>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.5rem)' }}>
          {t('dreg.welcome_pre')} <span className="lp-hero__accent">KAYA</span>
        </h1>
        <p style={{ maxWidth: 520, margin: '0 auto' }}>
          {t('dreg.subtitle')}
          {inviteInfo?.note && <><br /><em style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>"{inviteInfo.note}"</em></>}
        </p>
      </section>

      <div style={{ maxWidth: 680, margin: '0 auto 4rem', padding: '0 1.25rem' }}>
        <form onSubmit={handleSubmit} className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* ── Identity ── */}
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <User size={15} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />{t('dpe.sec_identity')}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label">{t('dpe.title_label')}</label>
              <select className="form-input" value={title} onChange={e => setTitle(e.target.value)}>
                <option>Dr.</option>
                <option>Dra.</option>
                <option>Prof.</option>
                <option>Prof.ª</option>
                <option>Enf.</option>
                <option>Enf.ª</option>
              </select>
            </div>
            <div>
              <label className="form-label">{t('dapply.name_full')} *</label>
              <input className="form-input" placeholder={t('dreg.name_ph')} value={displayName} onChange={e => setDisplayName(e.target.value)} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label"><Mail size={13} /> {t('dsup.email')} *</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="form-label"><Phone size={13} /> {t('dreg.phone')}</label>
              <input className="form-input" type="tel" placeholder="+244 9XX XXX XXX" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label"><Lock size={13} /> {t('dreg.password')} *</label>
              <input className="form-input" type="password" placeholder={t('dreg.password_ph')} value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div>
              <label className="form-label"><Lock size={13} /> {t('dreg.confirm_password')} *</label>
              <input className="form-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>
          </div>

          {/* ── Credentials ── */}
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <Stethoscope size={15} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
            {inviteInfo?.role === 'nurse' ? t('dreg.sec_creds_nurse') : t('dreg.sec_creds_doctor')}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label">{t('dpe.specialty')} *</label>
              {inviteInfo?.role === 'nurse' ? (
                <input className="form-input" value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder={t('dreg.specialty_nurse_ph')} />
              ) : (
                <select className="form-input" value={specialty} onChange={e => setSpecialty(e.target.value)}>
                  {SPECIALTY_VALUES.map(v => <option key={v} value={v}>{t(`spec.${v}`)}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="form-label">{t('dreg.license')} *</label>
              <input className="form-input" placeholder={t('dreg.license_ph')} value={license} onChange={e => setLicense(e.target.value)} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
            {[
              ['dreg.country_practice', practiceCountry, setPracticeCountry],
              ['dreg.country_licence', licenceCountry, setLicenceCountry],
              ['dreg.country_diploma', diplomaCountry, setDiplomaCountry],
            ].map(([labelKey, value, setter]: any) => (
              <div key={labelKey}>
                <label className="form-label">{t(labelKey)}</label>
                <select className="form-input" value={value} onChange={e => setter(e.target.value)}>
                  {CREDENTIAL_COUNTRY_CODES.map(code => <option key={code} value={code}>{regionNames.of(code) || code}</option>)}
                </select>
              </div>
            ))}
          </div>
          {licenceCountry === 'US' && (
            <input className="form-input" placeholder={t('dreg.us_jurisdiction_ph')}
              value={licenceJurisdiction} onChange={e => setLicenceJurisdiction(e.target.value)} required />
          )}
          {practiceCountry !== diplomaCountry && (
            <div style={{ padding: '.65rem', borderRadius: 8, background: '#fffbeb', color: '#92400e', fontSize: '.78rem' }}>
              {t('dreg.foreign_diploma')}
            </div>
          )}
          <input className="form-input" placeholder={t('dreg.authority_ph')} value={authority} onChange={e => setAuthority(e.target.value)} required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <input className="form-input" placeholder={t('dreg.institution_ph')} value={institution} onChange={e => setInstitution(e.target.value)} required />
            <input className="form-input" placeholder={t('dreg.degree_ph')} value={degreeTitle} onChange={e => setDegreeTitle(e.target.value)} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label">{t('dpe.years_exp')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('dpe.optional')}</span></label>
              <input className="form-input" type="number" min="0" max="60" placeholder={t('dreg.years_ph')} value={years} onChange={e => setYears(e.target.value)} />
            </div>
          </div>

          {/* ── Location ── */}
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <MapPin size={15} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />{t('dpe.sec_location')}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label">{t('dpe.city')}</label>
              <input className="form-input" placeholder={t('dreg.city_ph')} value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div>
              <label className="form-label">{t('dpe.province')}</label>
              <select className="form-input" value={province} onChange={e => setProvince(e.target.value)}>
                <option value="">{t('dpe.select')}</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* ── Consultation types ── */}
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <Globe size={15} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />{t('dpe.sec_consult_type')}
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {[
              { key: 'teleconsulta', label: t('dpe.ct_tele') },
              { key: 'presencial',   label: t('dpe.ct_presencial') },
              { key: 'domicilio',    label: t('dpe.ct_domicilio') },
            ].map(ct => (
              <label key={ct.key} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 1rem', borderRadius: '999px', cursor: 'pointer',
                background: consultTypes.includes(ct.key) ? 'var(--brand-light)' : 'var(--bg-card)',
                border: `1.5px solid ${consultTypes.includes(ct.key) ? 'var(--brand-primary)' : 'var(--border)'}`,
                color: consultTypes.includes(ct.key) ? 'var(--brand-primary)' : 'var(--text-secondary)',
                fontWeight: consultTypes.includes(ct.key) ? 600 : 400,
                fontSize: '0.85rem',
              }}>
                <input type="checkbox" checked={consultTypes.includes(ct.key)} onChange={() => toggleConsultType(ct.key)} style={{ display: 'none' }} />
                {ct.label}
              </label>
            ))}
          </div>

          {/* ── Bio ── */}
          <div>
            <label className="form-label"><BookOpen size={13} /> {t('dreg.bio_label')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('dreg.bio_optional')}</span></label>
            <textarea className="form-input" rows={3} placeholder={t('dreg.bio_ph')} value={bio} onChange={e => setBio(e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          {error && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', fontSize: '0.85rem' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '0.9rem', fontSize: '0.95rem', fontWeight: 700 }}>
            {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> {t('dreg.registering')}</> : <>{t('dreg.submit')} <ChevronRight size={16} /></>}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {t('dreg.footer_pre')} <Link to="/terms" style={{ color: 'var(--brand-primary)' }}>{t('dreg.terms_link')}</Link>.
          </p>
        </form>
      </div>

      <Footer />
    </div>
  );
}
