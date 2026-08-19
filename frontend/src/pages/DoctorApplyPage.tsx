import { useState, type FormEvent } from 'react';
import api from '../api';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Stethoscope, User, Mail, Phone, MapPin, BookOpen,
  CheckCircle2, AlertCircle, Loader2, Building2, FileText,
} from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

// value = canonical PT label sent to the backend; key = translation for display.
const SPECIALTIES: Array<{ value: string; key: string }> = [
  { value: 'Clínica Geral', key: 'spec.clinica_geral' },
  { value: 'Pediatria', key: 'spec.pediatria' },
  { value: 'Cardiologia', key: 'spec.cardiologia' },
  { value: 'Ginecologia', key: 'spec.ginecologia' },
  { value: 'Dermatologia', key: 'spec.dermatologia' },
  { value: 'Ortopedia', key: 'spec.ortopedia' },
  { value: 'Oftalmologia', key: 'spec.oftalmologia' },
  { value: 'Neurologia', key: 'spec.neurologia' },
  { value: 'Psiquiatria', key: 'spec.psiquiatria' },
  { value: 'Psicologia', key: 'spec.psicologia' },
  { value: 'Fisioterapia', key: 'spec.fisioterapia' },
  { value: 'Medicina Dentária', key: 'spec.odontologia' },
  { value: 'Medicina Interna', key: 'spec.medicina_interna' },
  { value: 'Urgência / Emergência', key: 'spec.urgencia' },
  { value: 'Outra', key: 'spec.outra' },
];

const TYPES = [
  { value: 'medico',       key: 'dapply.type_medico' },
  { value: 'especialista', key: 'dapply.type_especialista' },
  { value: 'clinica',      key: 'dapply.type_clinica' },
];

export default function DoctorApplyPage() {
  const { t } = useT();
  const [type, setType] = useState('medico');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [orgName, setOrgName] = useState('');
  const [location, setLocation] = useState('');
  const [license, setLicense] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = {
        type,
        name,
        email,
        phone,
        specialty: type !== 'clinica' ? specialty : undefined,
        org_name: type === 'clinica' ? orgName : undefined,
        location,
        license_number: license,
        message,
      };
      await api.post('/api/v1/doctors/apply', body);
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('dapply.error'));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="landing-wrapper">
        <Navbar />
        <div style={{
          minHeight: '70vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '4rem 1rem',
        }}>
          <div style={{
            background: '#fff', borderRadius: 18, boxShadow: '0 8px 40px rgba(0,0,0,0.09)',
            padding: '3rem 2.5rem', maxWidth: 480, width: '100%', textAlign: 'center',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: 'rgba(13,148,136,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
            }}>
              <CheckCircle2 size={32} color="#0d9488" />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              {t('dapply.received_title')}
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '1.5rem' }}>
              {t('dapply.received_p1')}<br />
              {t('dapply.received_p2_pre')} <strong>{t('dapply.hours')}</strong>{t('dapply.received_p2_post')}
            </p>
            <a href="/" className="btn btn-primary" style={{ display: 'inline-flex', gap: '0.4rem' }}>
              {t('dapply.back_home')}
            </a>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="landing-wrapper">
      <Navbar />

      {/* Hero */}
      <section className="landing-hero" style={{ minHeight: '38vh' }}>
        <div className="landing-hero-bg" />
        <div className="landing-hero-content">
          <div className="landing-hero-icon" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Stethoscope size={28} color="#fff" />
          </div>
          <h1 className="landing-hero-title">{t('dapply.hero_title')}</h1>
          <p className="landing-hero-subtitle" style={{ maxWidth: '560px' }}>
            {t('dapply.hero_subtitle')}
          </p>
        </div>
      </section>

      {/* Form */}
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '3rem 1.25rem 5rem' }}>

        {/* Type selector */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {TYPES.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              style={{
                flex: 1, minWidth: 160,
                padding: '0.75rem 1rem',
                borderRadius: 12,
                border: `2px solid ${type === opt.value ? 'var(--accent-teal)' : 'rgba(0,0,0,0.1)'}`,
                background: type === opt.value ? 'rgba(13,148,136,0.07)' : '#fff',
                fontWeight: type === opt.value ? 700 : 500,
                color: type === opt.value ? 'var(--accent-teal)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.15s',
                textAlign: 'left',
              }}
            >
              {t(opt.key)}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Name */}
          <div className="form-group">
            <label className="form-label">
              <User size={14} style={{ marginRight: 4 }} />
              {type === 'clinica' ? t('dapply.name_responsible') : t('dapply.name_full')}
            </label>
            <input className="form-input" required value={name}
              onChange={e => setName(e.target.value)}
              placeholder={type === 'clinica' ? 'Dr. João Silva' : 'Dr. Maria Santos'} />
          </div>

          {/* Org name for clinics */}
          {type === 'clinica' && (
            <div className="form-group">
              <label className="form-label">
                <Building2 size={14} style={{ marginRight: 4 }} /> {t('dapply.org_name')}
              </label>
              <input className="form-input" required value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="Clínica Saúde Luanda" />
            </div>
          )}

          {/* Specialty (not for clinics) */}
          {type !== 'clinica' && (
            <div className="form-group">
              <label className="form-label">
                <BookOpen size={14} style={{ marginRight: 4 }} /> {t('dapply.specialty')}
              </label>
              <select className="form-input" required value={specialty}
                onChange={e => setSpecialty(e.target.value)}>
                <option value="">{t('dapply.select_specialty')}</option>
                {SPECIALTIES.map(s => <option key={s.value} value={s.value}>{t(s.key)}</option>)}
              </select>
            </div>
          )}

          {/* Email */}
          <div className="form-group">
            <label className="form-label">
              <Mail size={14} style={{ marginRight: 4 }} /> {t('dapply.email')}
            </label>
            <input className="form-input" type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="medico@exemplo.com" />
          </div>

          {/* Phone */}
          <div className="form-group">
            <label className="form-label">
              <Phone size={14} style={{ marginRight: 4 }} /> {t('dapply.phone')}
            </label>
            <input className="form-input" type="tel" required value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+244 9XX XXX XXX" />
          </div>

          {/* Location */}
          <div className="form-group">
            <label className="form-label">
              <MapPin size={14} style={{ marginRight: 4 }} /> {t('dapply.location')}
            </label>
            <input className="form-input" required value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Luanda, Angola" />
          </div>

          {/* License number */}
          <div className="form-group">
            <label className="form-label">
              <FileText size={14} style={{ marginRight: 4 }} /> {t('dapply.license')}
            </label>
            <input className="form-input" value={license}
              onChange={e => setLicense(e.target.value)}
              placeholder={t('dapply.license_ph')} />
          </div>

          {/* Message */}
          <div className="form-group">
            <label className="form-label">{t('dapply.message')}</label>
            <textarea className="form-input" rows={3} value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={t('dapply.message_ph')}
              style={{ resize: 'vertical' }} />
          </div>

          {error && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center',
              color: '#dc2626', background: 'rgba(220,38,38,0.07)',
              padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.87rem' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', gap: '0.5rem' }}>
            {loading
              ? <><Loader2 size={16} className="spin" /> {t('dapply.sending')}</>
              : <><Stethoscope size={16} /> {t('dapply.submit')}</>
            }
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {t('dapply.footer')}
          </p>
        </form>
      </section>

      <Footer />
    </div>
  );
}
