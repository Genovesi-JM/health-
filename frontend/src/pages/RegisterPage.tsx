import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Stethoscope, HeartPulse } from 'lucide-react';
import { useAuth } from '../AuthContext';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import kayaLogo from '/kaya-logo.svg';
import LanguageSelector from '../components/LanguageSelector';
import { apiErrorMessage } from '../utils/apiError';

const REQUIRED_CONSENTS = ['terms_of_service', 'privacy_policy', 'medical_disclaimer', 'health_data_processing', 'telemedicine_consent'] as const;
const COUNTRIES = [
  ['AO', 'Angola'], ['PT', 'Portugal'], ['ES', 'Espanha'], ['CU', 'Cuba'],
  ['RU', 'Rússia'], ['BR', 'Brasil'], ['CV', 'Cabo Verde'], ['MZ', 'Moçambique'],
  ['CD', 'República Democrática do Congo'], ['ST', 'São Tomé e Príncipe'], ['ZW', 'Zimbabwe'],
] as const;
const countryName = (code: string) => COUNTRIES.find(([value]) => value === code)?.[1] || code;
const CountryOptions = () => <>{COUNTRIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</>;

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [fullName, setFullName] = useState('');
  const [sector, setSector] = useState('');
  const [role, setRole] = useState<'patient' | 'doctor' | 'nurse'>('patient');
  const [practiceCountry, setPracticeCountry] = useState('AO');
  const [licenceCountry, setLicenceCountry] = useState('AO');
  const [diplomaCountry, setDiplomaCountry] = useState('AO');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');
  const [diplomaInstitution, setDiplomaInstitution] = useState('');
  const [degreeTitle, setDegreeTitle] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Consent checkboxes
  const [consents, setConsents] = useState({
    terms_of_service: false,
    privacy_policy: false,
    medical_disclaimer: false,
    health_data_processing: false,
    telemedicine_consent: false,
  });
  const allConsentsChecked = REQUIRED_CONSENTS.every(c => consents[c]);

  const sectors = [
    { value: '', label: t('register.sector_select') },
    { value: 'general', label: t('register.sector_general') },
    { value: 'cardiology', label: t('register.sector_cardiology') },
    { value: 'dermatology', label: t('register.sector_dermatology') },
    { value: 'pediatrics', label: t('register.sector_pediatrics') },
    { value: 'orthopedics', label: t('register.sector_orthopedics') },
    { value: 'neurology', label: t('register.sector_neurology') },
  ];

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPw) { setError(t('register.pw_mismatch')); return; }
    if (password.length < 6) { setError(t('register.pw_short')); return; }
    if (!allConsentsChecked) { setError('Aceite todos os consentimentos obrigatórios para se registar.'); return; }
    if (role !== 'patient' && (!fullName || !issuingAuthority || !licenceNumber || !diplomaInstitution || !degreeTitle)) {
      setError('Complete os dados profissionais obrigatórios antes de continuar.');
      return;
    }

    setLoading(true);
    try {
      const body = {
        email,
        password,
        full_name: fullName || email.split('@')[0],
        sector_focus: 'health',
        org_name: 'KAYA',
        account_name: fullName || email.split('@')[0],
        entity_type: 'individual',
        modules_enabled: ['triage', 'teleconsulta'],
        role,
        ...(role !== 'patient' ? {
          practice_country: practiceCountry,
          licence_country: licenceCountry,
          diploma_country: diplomaCountry,
          issuing_authority: issuingAuthority,
          licence_number: licenceNumber,
          diploma_institution: diplomaInstitution,
          degree_title: degreeTitle,
          graduation_year: graduationYear ? Number(graduationYear) : null,
          specialization: sector || 'general',
        } : {}),
      };
      const res = await api.post('/auth/register', body);
      login(res.data);
      // Post consents in background (best-effort; ConsentGate will catch any failures)
      for (const ct of REQUIRED_CONSENTS) {
        api.post('/api/v1/compliance/consent', { consent_type: ct }).catch(() => {});
      }
      sessionStorage.setItem('consents_accepted', 'true');
      navigate(role === 'patient' ? '/dashboard' : '/professional-verification');
    } catch (err: any) {
      setError(apiErrorMessage(err, t('register.error')));
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-shell">
      <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 100 }}>
        <LanguageSelector />
      </div>

      <div className="auth-card" style={{ maxWidth: role === 'patient' ? 420 : 680, transition: 'max-width .2s ease' }}>
        {/* Brand */}
        <div className="auth-brand">
          <img src={kayaLogo} alt="KAYA" style={{ width: 48, height: 48 }} />
          <span className="auth-brand-text">KAYA</span>
        </div>

        <h1 className="auth-title">{t('register.title')}</h1>
        <p className="auth-subtitle">{t('register.subtitle')}</p>

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">Criar conta como</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.55rem' }}>
              {([
                ['patient', <User size={18} />, 'Paciente'],
                ['nurse', <HeartPulse size={18} />, 'Enfermeiro/a'],
                ['doctor', <Stethoscope size={18} />, 'Médico/a'],
              ] as const).map(([value, icon, label]) => (
                <button key={value} type="button" onClick={() => setRole(value)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '0.8rem 0.3rem', borderRadius: 10, cursor: 'pointer',
                    border: role === value ? '2px solid var(--accent-teal)' : '1px solid var(--border, #e2e8f0)',
                    background: role === value ? 'rgba(13,148,136,.08)' : 'var(--bg-card, white)',
                    color: role === value ? 'var(--accent-teal)' : 'var(--text-secondary, #475569)',
                    fontSize: '.76rem', fontWeight: 700,
                  }}>
                  {icon}{label}
                </button>
              ))}
            </div>
            {role !== 'patient' && (
              <p style={{ fontSize: '.76rem', color: 'var(--text-muted)', margin: '.55rem 0 0', lineHeight: 1.45 }}>
                A conta será criada com acesso limitado. Acesso clínico é activado após envio e revisão das credenciais.
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">{t('register.full_name')}</label>
            <div className="form-input-icon">
              <User size={16} className="icon-left" />
              <input className="form-input" type="text" placeholder="João Silva"
                value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
          </div>

          {role !== 'patient' && (
            <div style={{ padding: '1rem', marginBottom: '1rem', border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, background: 'var(--bg, #f8fafc)' }}>
              <p style={{ margin: '0 0 .8rem', fontSize: '.8rem', fontWeight: 700 }}>Dados profissionais</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '.7rem' }}>
                <label className="form-group" style={{ margin: 0 }}>
                  <span className="form-label">País de exercício / registo</span>
                  <select className="form-select" value={practiceCountry} onChange={e => setPracticeCountry(e.target.value)}>
                    <CountryOptions />
                  </select>
                </label>
                <label className="form-group" style={{ margin: 0 }}>
                  <span className="form-label">País que emitiu a licença</span>
                  <select className="form-select" value={licenceCountry} onChange={e => setLicenceCountry(e.target.value)}>
                    <CountryOptions />
                  </select>
                </label>
                <label className="form-group" style={{ margin: 0 }}>
                  <span className="form-label">País que emitiu o diploma / certificado</span>
                  <select className="form-select" value={diplomaCountry} onChange={e => setDiplomaCountry(e.target.value)}>
                    <CountryOptions />
                  </select>
                </label>
              </div>
              {practiceCountry !== diplomaCountry && (
                <div style={{ margin: '.7rem 0', padding: '.65rem', borderRadius: 8, background: '#fffbeb', color: '#92400e', fontSize: '.76rem' }}>
                  Diploma estrangeiro: será obrigatório enviar o reconhecimento/equivalência para exercer em {countryName(practiceCountry)}.
                </div>
              )}
              <input className="form-input" style={{ marginTop: '.7rem' }} placeholder="Autoridade emissora / Ordem profissional *"
                value={issuingAuthority} onChange={e => setIssuingAuthority(e.target.value)} required />
              <input className="form-input" style={{ marginTop: '.7rem' }} placeholder="Número da cédula ou licença profissional *"
                value={licenceNumber} onChange={e => setLicenceNumber(e.target.value)} required />
              <input className="form-input" style={{ marginTop: '.7rem' }} placeholder="Instituição do diploma *"
                value={diplomaInstitution} onChange={e => setDiplomaInstitution(e.target.value)} required />
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '.7rem', marginTop: '.7rem' }}>
                <input className="form-input" placeholder="Título do curso / grau *"
                  value={degreeTitle} onChange={e => setDegreeTitle(e.target.value)} required />
                <input className="form-input" inputMode="numeric" placeholder="Ano"
                  value={graduationYear} onChange={e => setGraduationYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t('register.email')}</label>
            <div className="form-input-icon">
              <Mail size={16} className="icon-left" />
              <input className="form-input" type="email" placeholder="utilizador@empresa.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('register.password')}</label>
            <div className="form-input-icon">
              <Lock size={16} className="icon-left" />
              <input className="form-input" type={showPw ? 'text' : 'password'} placeholder={t('register.password_placeholder')}
                value={password} onChange={e => setPassword(e.target.value)} required
                style={{ paddingRight: '2.5rem' }} />
              <button type="button" className="icon-right" onClick={() => setShowPw(!showPw)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('register.confirm_password')}</label>
            <div className="form-input-icon">
              <Lock size={16} className="icon-left" />
              <input className="form-input" type={showCpw ? 'text' : 'password'} placeholder={t('register.confirm_placeholder')}
                value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required
                style={{ paddingRight: '2.5rem' }} />
              <button type="button" className="icon-right" onClick={() => setShowCpw(!showCpw)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showCpw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('register.sector')}</label>
            <select className="form-select" value={sector} onChange={e => setSector(e.target.value)} required>
              {sectors.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* ── Required consents ── */}
          <div style={{ margin: '0.25rem 0 1rem', padding: '1rem', borderRadius: '8px',
            border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg, #f8fafc)',
            display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600,
              color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Consentimentos obrigatórios
            </p>

            <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={consents.terms_of_service}
                onChange={() => setConsents(p => ({ ...p, terms_of_service: !p.terms_of_service }))}
                style={{ marginTop: '2px', accentColor: 'var(--accent-teal, #0d9488)', cursor: 'pointer' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text, #0f172a)', lineHeight: 1.5 }}>
                Aceito os{' '}
                <Link to="/terms" target="_blank"
                  style={{ color: 'var(--accent-teal, #0d9488)' }}>Termos de Serviço</Link>
              </span>
            </label>

            <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={consents.medical_disclaimer}
                onChange={() => setConsents(p => ({ ...p, medical_disclaimer: !p.medical_disclaimer }))}
                style={{ marginTop: '2px', accentColor: 'var(--accent-teal, #0d9488)', cursor: 'pointer' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text, #0f172a)', lineHeight: 1.5 }}>
                Reconheço o{' '}
                <Link to="/medical-disclaimer" target="_blank"
                  style={{ color: 'var(--accent-teal, #0d9488)' }}>Aviso Médico</Link>
                {' '}— esta plataforma não é um serviço de emergência e não substitui o atendimento presencial
              </span>
            </label>

            <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={consents.health_data_processing}
                onChange={() => setConsents(p => ({ ...p, health_data_processing: !p.health_data_processing }))}
                style={{ marginTop: '2px', accentColor: 'var(--accent-teal, #0d9488)', cursor: 'pointer' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text, #0f172a)', lineHeight: 1.5 }}>
                Consinto o tratamento dos meus dados de saúde conforme descrito na{' '}
                <Link to="/privacy" target="_blank"
                  style={{ color: 'var(--accent-teal, #0d9488)' }}>Política de Privacidade</Link>
              </span>
            </label>

            <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={consents.privacy_policy}
                onChange={() => setConsents(p => ({ ...p, privacy_policy: !p.privacy_policy }))}
                style={{ marginTop: '2px', accentColor: 'var(--accent-teal, #0d9488)', cursor: 'pointer' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text, #0f172a)', lineHeight: 1.5 }}>
                Li e aceito a{' '}
                <Link to="/privacy" target="_blank"
                  style={{ color: 'var(--accent-teal, #0d9488)' }}>Política de Privacidade</Link>
              </span>
            </label>

            <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={consents.telemedicine_consent}
                onChange={() => setConsents(p => ({ ...p, telemedicine_consent: !p.telemedicine_consent }))}
                style={{ marginTop: '2px', accentColor: 'var(--accent-teal, #0d9488)', cursor: 'pointer' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text, #0f172a)', lineHeight: 1.5 }}>
                Consinto receber serviços de telemedicina através desta plataforma
              </span>
            </label>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading || !allConsentsChecked}
            style={{ width: '100%', justifyContent: 'center', marginBottom: '0.75rem' }}>
            {loading ? t('register.loading') : t('register.submit')}
          </button>

          <button type="button" className="btn btn-outline btn-lg"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => navigate('/login')}>
            {t('register.cancel')}
          </button>
        </form>

        {error && <div className="toast error" style={{ position: 'relative', top: 0, right: 0, marginTop: '1rem' }}>{error}</div>}

        <div className="auth-toggle">
          {t('register.have_account')}{' '}
          <Link to="/login">{t('register.sign_in')}</Link>
        </div>

        <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
          <Link to="/" style={{ color: 'var(--accent-teal)', fontSize: '0.82rem', textDecoration: 'none' }}>
            {t('register.back_site')}
          </Link>
        </div>
      </div>
    </div>
  );
}
