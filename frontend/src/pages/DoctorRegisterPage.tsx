import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Stethoscope, User, Mail, Lock, Phone, MapPin, BookOpen,
  CheckCircle2, AlertCircle, Loader2, ChevronRight, Globe,
} from 'lucide-react';
import api, { persistSession } from '../api';

const SPECIALTIES = [
  { value: 'clinica_geral',    label: 'Clínica Geral' },
  { value: 'pediatria',        label: 'Pediatria' },
  { value: 'cardiologia',      label: 'Cardiologia' },
  { value: 'ginecologia',      label: 'Ginecologia' },
  { value: 'dermatologia',     label: 'Dermatologia' },
  { value: 'ortopedia',        label: 'Ortopedia' },
  { value: 'oftalmologia',     label: 'Oftalmologia' },
  { value: 'neurologia',       label: 'Neurologia' },
  { value: 'psiquiatria',      label: 'Psiquiatria' },
  { value: 'psicologia',       label: 'Psicologia' },
  { value: 'fisioterapia',     label: 'Fisioterapia' },
  { value: 'odontologia',      label: 'Medicina Dentária' },
  { value: 'medicina_interna', label: 'Medicina Interna' },
  { value: 'urgencia',         label: 'Urgência / Emergência' },
  { value: 'outro',            label: 'Outra especialidade' },
];

const PROVINCES = [
  'Luanda','Benguela','Huambo','Bié','Malanje','Lunda Norte','Lunda Sul',
  'Huíla','Namibe','Cunene','Cuando Cubango','Moxico','Uíge','Zaire',
  'Cabinda','Bengo','Cuanza Norte','Cuanza Sul',
];

type Step = 'validating' | 'invalid' | 'form' | 'success';

export default function DoctorRegisterPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [step, setStep] = useState<Step>('validating');
  const [inviteInfo, setInviteInfo] = useState<{ invited_email?: string; note?: string } | null>(null);
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
        setStep('form');
      })
      .catch(() => setStep('invalid'));
  }, [token]);

  const toggleConsultType = (t: string) => {
    setConsultTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!displayName.trim()) return setError('Nome completo obrigatório.');
    if (password !== confirmPassword) return setError('As palavras-passe não coincidem.');
    if (password.length < 8) return setError('Palavra-passe: mínimo 8 caracteres.');
    if (consultTypes.length === 0) return setError('Selecione pelo menos um tipo de consulta.');

    setLoading(true);
    try {
      const res = await api.post('/auth/register/doctor', {
        token,
        email: email.trim().toLowerCase(),
        password,
        display_name: displayName.trim(),
        title,
        specialization: specialty,
        license_number: license.trim() || null,
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
      setTimeout(() => navigate('/doctor/profile'), 2500);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao registar. Tente novamente.');
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
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>A validar o seu convite…</p>
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
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Convite inválido ou expirado</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
              Este link de convite não é válido, já foi utilizado ou expirou.<br />
              Contacte a equipa CareFast+ para receber um novo convite.
            </p>
            <a href="mailto:parcerias@carefast.ao" className="lp-cta lp-cta--primary" style={{ display: 'inline-flex', marginTop: '1.5rem' }}>
              <Mail size={15} /> parcerias@carefast.ao
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
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Registo concluído!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
              A sua conta foi criada com sucesso. O perfil está pendente de verificação.<br />
              A redirecionar para o seu perfil…
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
        <div className="lp-tag"><Stethoscope size={12} /> Registo de Médico Parceiro</div>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.5rem)' }}>
          Bem-vindo ao <span className="lp-hero__accent">CareFast+</span>
        </h1>
        <p style={{ maxWidth: 520, margin: '0 auto' }}>
          Complete o registo para activar o seu perfil público e começar a receber pacientes.
          {inviteInfo?.note && <><br /><em style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>"{inviteInfo.note}"</em></>}
        </p>
      </section>

      <div style={{ maxWidth: 680, margin: '0 auto 4rem', padding: '0 1.25rem' }}>
        <form onSubmit={handleSubmit} className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* ── Identity ── */}
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <User size={15} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Identidade
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label">Título</label>
              <select className="form-input" value={title} onChange={e => setTitle(e.target.value)}>
                <option>Dr.</option>
                <option>Dra.</option>
                <option>Prof.</option>
                <option>Prof.ª</option>
              </select>
            </div>
            <div>
              <label className="form-label">Nome completo *</label>
              <input className="form-input" placeholder="Como aparece no perfil público" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label"><Mail size={13} /> Email *</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="form-label"><Phone size={13} /> Telefone</label>
              <input className="form-input" type="tel" placeholder="+244 9XX XXX XXX" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label"><Lock size={13} /> Palavra-passe *</label>
              <input className="form-input" type="password" placeholder="Mínimo 8 caracteres" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div>
              <label className="form-label"><Lock size={13} /> Confirmar palavra-passe *</label>
              <input className="form-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>
          </div>

          {/* ── Credentials ── */}
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <Stethoscope size={15} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Credenciais médicas
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label">Especialidade *</label>
              <select className="form-input" value={specialty} onChange={e => setSpecialty(e.target.value)}>
                {SPECIALTIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Nº de Licença / Cédula <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
              <input className="form-input" placeholder="ex: OMEN-12345" value={license} onChange={e => setLicense(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label">Anos de experiência <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
              <input className="form-input" type="number" min="0" max="60" placeholder="ex: 8" value={years} onChange={e => setYears(e.target.value)} />
            </div>
          </div>

          {/* ── Location ── */}
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <MapPin size={15} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Localização
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label">Cidade / Município</label>
              <input className="form-input" placeholder="ex: Luanda" value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Província</label>
              <select className="form-input" value={province} onChange={e => setProvince(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* ── Consultation types ── */}
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <Globe size={15} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Tipo de consulta
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {[
              { key: 'teleconsulta', label: '📹 Teleconsulta' },
              { key: 'presencial',   label: '🏥 Presencial' },
              { key: 'domicilio',    label: '🏠 Domicílio' },
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
            <label className="form-label"><BookOpen size={13} /> Bio / Apresentação <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional — aparece no perfil público)</span></label>
            <textarea className="form-input" rows={3} placeholder="Apresente-se brevemente aos pacientes…" value={bio} onChange={e => setBio(e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          {error && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', fontSize: '0.85rem' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '0.9rem', fontSize: '0.95rem', fontWeight: 700 }}>
            {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> A registar…</> : <>Criar perfil médico <ChevronRight size={16} /></>}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Ao registar, o seu perfil ficará pendente de verificação pela equipa CareFast+.<br />
            Consulte os <Link to="/terms" style={{ color: 'var(--brand-primary)' }}>Termos de Uso</Link>.
          </p>
        </form>
      </div>

      <Footer />
    </div>
  );
}
