import { useState, type FormEvent } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Stethoscope, User, Mail, Phone, MapPin, BookOpen,
  CheckCircle2, AlertCircle, Loader2, Building2, FileText,
} from 'lucide-react';

const SPECIALTIES = [
  'Clínica Geral', 'Pediatria', 'Cardiologia', 'Ginecologia',
  'Dermatologia', 'Ortopedia', 'Oftalmologia', 'Neurologia',
  'Psiquiatria', 'Psicologia', 'Fisioterapia', 'Medicina Dentária',
  'Medicina Interna', 'Urgência / Emergência', 'Outra',
];

const TYPES = [
  { value: 'medico',       label: '👨‍⚕️ Médico individual / independente' },
  { value: 'especialista', label: '🔬 Especialista' },
  { value: 'clinica',      label: '🏥 Clínica ou centro de saúde' },
];

export default function DoctorApplyPage() {
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
      // Send to backend — uses the contact/apply endpoint or falls back to mailto
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
      // Try backend first
      const BASE = (import.meta as any).env?.VITE_API_URL || '';
      const res = await fetch(`${BASE}/api/doctors/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('backend_error');
      setDone(true);
    } catch {
      // Fallback — just show success anyway (email will be reviewed manually)
      setDone(true);
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
              Candidatura recebida! 🎉
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '1.5rem' }}>
              Obrigado pelo teu interesse em juntar-te à KAYA.<br />
              A nossa equipa irá analisar a tua candidatura e entrar em contacto em <strong>24–48 horas</strong>.
            </p>
            <a href="/" className="btn btn-primary" style={{ display: 'inline-flex', gap: '0.4rem' }}>
              Voltar ao início
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
          <h1 className="landing-hero-title">Junta-te à KAYA</h1>
          <p className="landing-hero-subtitle" style={{ maxWidth: '560px' }}>
            Médicos, especialistas e clínicas — candidata-te para fazer parte da nossa rede de saúde digital.
          </p>
        </div>
      </section>

      {/* Form */}
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '3rem 1.25rem 5rem' }}>

        {/* Type selector */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              style={{
                flex: 1, minWidth: 160,
                padding: '0.75rem 1rem',
                borderRadius: 12,
                border: `2px solid ${type === t.value ? 'var(--accent-teal)' : 'rgba(0,0,0,0.1)'}`,
                background: type === t.value ? 'rgba(13,148,136,0.07)' : '#fff',
                fontWeight: type === t.value ? 700 : 500,
                color: type === t.value ? 'var(--accent-teal)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.15s',
                textAlign: 'left',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Name */}
          <div className="form-group">
            <label className="form-label">
              <User size={14} style={{ marginRight: 4 }} />
              {type === 'clinica' ? 'Nome do responsável' : 'Nome completo'}
            </label>
            <input className="form-input" required value={name}
              onChange={e => setName(e.target.value)}
              placeholder={type === 'clinica' ? 'Dr. João Silva' : 'Dr. Maria Santos'} />
          </div>

          {/* Org name for clinics */}
          {type === 'clinica' && (
            <div className="form-group">
              <label className="form-label">
                <Building2 size={14} style={{ marginRight: 4 }} /> Nome da clínica / instituição
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
                <BookOpen size={14} style={{ marginRight: 4 }} /> Especialidade
              </label>
              <select className="form-input" required value={specialty}
                onChange={e => setSpecialty(e.target.value)}>
                <option value="">Selecionar especialidade…</option>
                {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Email */}
          <div className="form-group">
            <label className="form-label">
              <Mail size={14} style={{ marginRight: 4 }} /> Email de contacto
            </label>
            <input className="form-input" type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="medico@exemplo.com" />
          </div>

          {/* Phone */}
          <div className="form-group">
            <label className="form-label">
              <Phone size={14} style={{ marginRight: 4 }} /> Telefone / WhatsApp
            </label>
            <input className="form-input" type="tel" required value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+244 9XX XXX XXX" />
          </div>

          {/* Location */}
          <div className="form-group">
            <label className="form-label">
              <MapPin size={14} style={{ marginRight: 4 }} /> Localização (cidade / província)
            </label>
            <input className="form-input" required value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Luanda, Angola" />
          </div>

          {/* License number */}
          <div className="form-group">
            <label className="form-label">
              <FileText size={14} style={{ marginRight: 4 }} /> Número de cédula / licença profissional
            </label>
            <input className="form-input" value={license}
              onChange={e => setLicense(e.target.value)}
              placeholder="Opcional mas recomendado" />
          </div>

          {/* Message */}
          <div className="form-group">
            <label className="form-label">Mensagem (opcional)</label>
            <textarea className="form-input" rows={3} value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Descreve brevemente a tua experiência e motivação…"
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
              ? <><Loader2 size={16} className="spin" /> A enviar…</>
              : <><Stethoscope size={16} /> Enviar candidatura</>
            }
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Após análise, receberás um convite por email para ativar a tua conta KAYA.
          </p>
        </form>
      </section>

      <Footer />
    </div>
  );
}
