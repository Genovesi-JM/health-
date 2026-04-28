import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  HeartPulse, Calendar, Video, RefreshCw, Search,
  Activity, ArrowRight, CheckCircle2, Shield, Zap,
  Stethoscope, Users, Building2, Phone,
  Clock, ChevronRight, Heart, Pill, AlertTriangle,
  TrendingUp, Lock, Smartphone, MonitorSmartphone,
  Baby, Brain, Eye, Bone, Apple, Wind,
} from 'lucide-react';

const SPECIALTIES = [
  { icon: Stethoscope, label: 'Clínica Geral',   color: '#0d9488' },
  { icon: Baby,        label: 'Pediatria',        color: '#0891b2' },
  { icon: Heart,       label: 'Ginecologia',      color: '#db2777' },
  { icon: HeartPulse,  label: 'Cardiologia',      color: '#dc2626' },
  { icon: Activity,    label: 'Dermatologia',     color: '#ea580c' },
  { icon: Brain,       label: 'Psicologia',       color: '#7c3aed' },
  { icon: Brain,       label: 'Psiquiatria',      color: '#6d28d9' },
  { icon: Eye,         label: 'Oftalmologia',     color: '#0369a1' },
  { icon: Stethoscope, label: 'Dentária',         color: '#0891b2' },
  { icon: Wind,        label: 'Fisioterapia',     color: '#059669' },
  { icon: Activity,    label: 'Neurologia',       color: '#4f46e5' },
  { icon: Bone,        label: 'Ortopedia',        color: '#b45309' },
  { icon: Apple,       label: 'Nutrição',         color: '#16a34a' },
];

const HOW_STEPS = [
  { num: '01', icon: Search,     title: 'Escolhe o serviço',       desc: 'Marcação, teleconsulta, renovação de receita ou triagem — tudo num só lugar.', color: '#0d9488' },
  { num: '02', icon: Video,      title: 'Recebe orientação médica', desc: 'Um médico real analisa a sua situação. Nenhuma decisão clínica é tomada por software.', color: '#0891b2' },
  { num: '03', icon: HeartPulse, title: 'Continua o cuidado',      desc: 'O seu historial, medicação e próximas consultas ficam acessíveis a qualquer momento.', color: '#7c3aed' },
];

const PREMIUM_PLANS = [
  { icon: Users,     label: 'Family Plan',     color: '#0d9488', desc: 'Cobertura total para toda a família num único portal.', features: ['Perfis ilimitados', 'Consultas partilhadas', 'Alertas familiares', 'Historial integrado'], cta: 'Family Plan', featured: false },
  { icon: Heart,     label: 'Chronic Care',    color: '#dc2626', desc: 'Acompanhamento contínuo para condições crónicas.', features: ['Monitorização de vitais', 'Renovação automática', 'Coach de aderência', 'Alertas de risco'], cta: 'Chronic Care', featured: true },
  { icon: Building2, label: 'Corporate',       color: '#7c3aed', desc: 'Saúde ocupacional para equipas sem burocracia.', features: ['Dashboard RH anónimo', 'Teleconsulta staff', 'Check-ups anuais', 'Gestão absentismo'], cta: 'Empresas', featured: false },
  { icon: Zap,       label: 'Priority Access', color: '#b45309', desc: 'Acesso prioritário e chegada pre-alerta em hospitais.', features: ['Fila prioritária', 'Pre-alerta hospitalar', 'Médico dedicado', 'Teleconsulta imediata'], cta: 'Priority', featured: false },
];

const PARTNERSHIP_TYPES = [
  {
    icon: Stethoscope,
    color: '#0d9488',
    title: 'Médico individual / independente',
    desc: 'Consulta presencial ou teleconsulta. Integração simples, sem mensalidades de entrada. O portal trata das marcações e do historial do paciente.',
    cta: 'Candidatar-me como médico',
  },
  {
    icon: Building2,
    color: '#2563eb',
    title: 'Clínica ou centro de saúde',
    desc: 'Gestão de agenda, triagem digital pré-consulta e acesso ao histórico do paciente. Dashboard próprio para a equipa clínica.',
    cta: 'Candidatar a minha clínica',
  },
  {
    icon: HeartPulse,
    color: '#7c3aed',
    title: 'Hospital ou instituição',
    desc: 'Integração de fluxos de urgência, pré-alertas e continuidade de cuidados pós-alta. Fale connosco para uma proposta à medida.',
    cta: 'Falar com a equipa',
  },
];

const TRUST_POINTS = [
  { icon: Shield,       label: 'Médico real valida tudo',  desc: 'Nenhuma decisão clínica é tomada por IA ou software.' },
  { icon: Lock,         label: 'Dados protegidos',         desc: 'Historial clínico encriptado. Só você e o seu médico acedem.' },
  { icon: CheckCircle2, label: 'Transparente',             desc: 'Mostramos o que fazemos e o que não fazemos. Sempre.' },
  { icon: TrendingUp,   label: 'Continuidade real',        desc: 'O cuidado não termina com a consulta. Acompanhamos.' },
];

const TRIAGE_OUTCOMES = [
  { icon: AlertTriangle,    color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   label: '🔴 Urgência',          sub: 'Dirige-se imediatamente. Hospital pré-alertado.' },
  { icon: MonitorSmartphone,color: '#0891b2', bg: 'rgba(8,145,178,0.08)',   border: 'rgba(8,145,178,0.2)',   label: '🟠 Teleconsulta',       sub: 'Médico disponível em minutos.' },
  { icon: Calendar,         color: '#16a34a', bg: 'rgba(22,163,74,0.08)',   border: 'rgba(22,163,74,0.2)',   label: '🟢 Consulta Agendada',  sub: 'Marcação na clínica mais próxima.' },
];

export default function LandingPage() {
  return (
    <div className="landing-wrapper">
      <Navbar />

      {/* ══ HERO ══════════════════════════════════════════ */}
      <section className="lp-hero">
        <div className="lp-hero__badge">
          <HeartPulse size={13} /> Plataforma de saúde digital — Angola, África
        </div>
        <h1 className="lp-hero__title">
          Smarter healthcare<br />
          <span className="lp-hero__accent">starts at home.</span>
        </h1>
        <p className="lp-hero__sub">
          Meça os seus vitais, marque consultas, fale com médicos por vídeo e acompanhe a saúde da família —
          tudo num portal seguro, construído para Angola e escalável para toda a África.
        </p>
        <div className="lp-hero__ctas">
          <Link to="/register" className="lp-cta lp-cta--primary"><Calendar size={17} /> Criar conta grátis</Link>
          <Link to="/telemedicina" className="lp-cta lp-cta--secondary"><Video size={17} /> Teleconsulta imediata</Link>
          <Link to="/chronic-care" className="lp-cta lp-cta--outline"><Heart size={17} /> Cuidado Crónico</Link>
          <Link to="/clinics" className="lp-cta lp-cta--outline"><Building2 size={17} /> Para Parceiros</Link>
          <Link to="/devices" className="lp-cta lp-cta--outline"><Activity size={17} /> Smart Devices</Link>
          <Link to="/login" className="lp-cta lp-cta--portal"><ArrowRight size={17} /> Entrar no Portal</Link>
        </div>
        <div className="lp-hero__stats">
          {[
            { value: '13',    label: 'Especialidades' },
            { value: '24/7',  label: 'Suporte digital' },
            { value: '100%',  label: 'Médico real na validação' },
            { value: 'Grátis', label: 'Registo sem cartão' },
          ].map(s => (
            <div key={s.label} className="lp-stat">
              <span className="lp-stat__val">{s.value}</span>
              <span className="lp-stat__lbl">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="trust-strip" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
          <span className="trust-badge trust-badge--encrypted"><Lock size={11} /> Dados encriptados</span>
          <span className="trust-badge trust-badge--verified"><Shield size={11} /> Médicos verificados</span>
          <span className="trust-badge trust-badge--private"><HeartPulse size={11} /> Privacidade médica</span>
          <span className="trust-badge trust-badge--secure"><CheckCircle2 size={11} /> Pagamentos seguros</span>
        </div>
      </section>

      {/* ══ COMO FUNCIONA ════════════════════════════════ */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">Como funciona</div>
          <h2>Três passos para cuidado completo.</h2>
          <p>De qualquer sintoma a um plano de saúde claro — simples, seguro e sempre acompanhado por um médico.</p>
        </div>
        <div className="lp-steps">
          {HOW_STEPS.map(s => (
            <div key={s.num} className="lp-step">
              <div className="lp-step__num" style={{ color: s.color }}>{s.num}</div>
              <div className="lp-step__icon" style={{ background: `${s.color}18`, color: s.color }}><s.icon size={22} /></div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ VERIFICAÇÃO PRÉ-CONSULTA ══════════════════════ */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">Verificação Pré-Consulta</div>
          <h2>Envie as suas leituras antes de chegar.</h2>
          <p>Tensão arterial, glicemia, temperatura — o médico recebe os seus dados e a consulta começa com contexto completo. <strong>Médico real interpreta. Sempre.</strong></p>
        </div>
        <div className="lp-triage-outcomes">
          {TRIAGE_OUTCOMES.map(o => (
            <div key={o.label} className="lp-outcome" style={{ background: o.bg, border: `1px solid ${o.border}` }}>
              <o.icon size={24} style={{ color: o.color }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: o.color }}>{o.label}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{o.sub}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link to="/register" className="lp-cta lp-cta--primary" style={{ display: 'inline-flex' }}><Activity size={16} /> Começar verificação pré-consulta</Link>
        </div>
      </section>

      {/* ══ ECOSYSTEM ══════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">Ecossistema CareFast+</div>
          <h2>Um sistema de saúde completo.</h2>
          <p>Do paciente à clínica, do device ao médico — tudo conectado numa só plataforma.</p>
        </div>
        <div className="ecosystem-grid">
          {[
            { icon: Users,     color: '#0d9488', to: '/patients',    label: 'Para Pacientes',    desc: 'Marcações, vitals, teleconsulta, família.' },
            { icon: Building2, color: '#0891b2', to: '/clinics',     label: 'Para Parceiros',     desc: 'Médicos particulares, clínicas e hospitais.' },
            { icon: Heart,     color: '#dc2626', to: '/chronic-care',label: 'Cuidado Crónico',   desc: 'Hipertensão, diabetes, asma — contínuos.' },
            { icon: Activity,  color: '#d97706', to: '/devices',     label: 'Smart Devices',     desc: 'Tensiómetros, glicómetros, oxímetros.' },
            { icon: TrendingUp,color: '#7c3aed', to: '/pricing',     label: 'Preços Simples',    desc: 'Grátis para começar, premium ao crescer.' },
            { icon: Phone,     color: '#059669', to: '/contacto',    label: 'Contacto',          desc: 'Fale com a equipa CareFast+.' },
          ].map(item => (
            <Link key={item.to} to={item.to} className="ecosystem-card">
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${item.color}15`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <item.icon size={22} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.3rem' }}>{item.label}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</div>
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: item.color, fontWeight: 600 }}>
                Saber mais <ArrowRight size={13} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ══ ESPECIALIDADES ══════════════════════════════ */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">Especialidades</div>
          <h2>O especialista certo, no momento certo.</h2>
          <p>Presencial, teleconsulta ou segunda opinião — encontre o médico de que precisa.</p>
        </div>
        <div className="lp-specialties">
          {SPECIALTIES.map(sp => (
            <Link to="/especialistas" key={sp.label} className="lp-specialty-card">
              <div className="lp-specialty-icon" style={{ background: `${sp.color}18`, color: sp.color }}><sp.icon size={20} /></div>
              <span>{sp.label}</span>
              <ChevronRight size={14} style={{ color: 'var(--text-muted)', marginLeft: 'auto' }} />
            </Link>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/especialistas" className="lp-link-more">Ver todos os especialistas <ArrowRight size={15} /></Link>
        </div>
      </section>

      {/* ══ SOLUÇÕES PREMIUM ════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">Soluções Premium</div>
          <h2>Saúde contínua, para cada necessidade.</h2>
          <p>Planos pensados para famílias, doentes crónicos e empresas que levam a saúde a sério.</p>
        </div>
        <div className="lp-plans">
          {PREMIUM_PLANS.map(plan => (
            <div key={plan.label} className={`lp-plan-card${plan.featured ? ' lp-plan-card--featured' : ''}`} style={{ '--plan-color': plan.color } as React.CSSProperties}>
              <div className="lp-plan-card__head">
                <div className="lp-plan-icon" style={{ background: `${plan.color}18`, color: plan.color }}><plan.icon size={20} /></div>
                <h3>{plan.label}</h3>
                {plan.featured && <span className="lp-plan-badge">Mais popular</span>}
              </div>
              <p>{plan.desc}</p>
              <ul>{plan.features.map(f => (<li key={f}><CheckCircle2 size={14} style={{ color: plan.featured ? 'rgba(255,255,255,0.8)' : plan.color }} /> {f}</li>))}</ul>
              <Link to="/login" className="lp-plan-cta" style={{ background: plan.featured ? '#fff' : plan.color, color: plan.featured ? plan.color : '#fff' }}>
                {plan.cta} <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ══ PORQUÊ CAREFAST+ ════════════════════════════ */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">Porque nos escolher</div>
          <h2>Healthcare simplificado. Sem atalhos.</h2>
        </div>
        <div className="lp-trust-grid">
          {TRUST_POINTS.map(tp => (
            <div key={tp.label} className="lp-trust-card">
              <tp.icon size={22} style={{ color: 'var(--accent-teal)' }} />
              <h4>{tp.label}</h4>
              <p>{tp.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ PARCEIROS ════════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">Parcerias abertas</div>
          <h2>Trabalhe connosco — seja quem for.</h2>
          <p>
            Estamos a construir a rede. Se é médico independente, tem uma clínica ou dirige uma instituição,
            há um lugar para si no CareFast+.
          </p>
        </div>
        <div className="feat-grid" style={{ maxWidth: 900, margin: '0 auto' }}>
          {PARTNERSHIP_TYPES.map(p => (
            <div key={p.title} className="feat-card hover-lift" style={{ borderTop: `3px solid ${p.color}` }}>
              <div className="feat-icon" style={{ background: `${p.color}15`, color: p.color }}>
                <p.icon size={22} />
              </div>
              <div>
                <h3 className="feat-title">{p.title}</h3>
                <p className="feat-desc">{p.desc}</p>
                <a href="mailto:parcerias@carefast.ao" className="btn btn-ghost btn-sm"
                  style={{ marginTop: '0.75rem', color: p.color, borderColor: `${p.color}40` }}>
                  {p.cta} →
                </a>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Contacto de parcerias: <a href="mailto:parcerias@carefast.ao" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>parcerias@carefast.ao</a>
        </div>
      </section>

      {/* ══ URGÊNCIA ════════════════════════════════════ */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>Urgência</div>
          <h2>Vou para a urgência. O hospital já sabe.</h2>
          <p>Envie os seus sintomas e dados vitais antes de chegar. O hospital parceiro recebe um pré-alerta.</p>
        </div>
        <div className="lp-urgency-flow">
          {[{ icon: Smartphone, label: 'Envia sintomas e ETA' }, { icon: AlertTriangle, label: 'Gera pré-alerta' }, { icon: Building2, label: 'Hospital prepara' }, { icon: CheckCircle2, label: 'Chegada rápida' }].map((s, i, arr) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="lp-urgency-step"><s.icon size={20} style={{ color: '#ef4444' }} /><span>{s.label}</span></div>
              {i < arr.length - 1 && <ArrowRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/urgencia" className="lp-cta lp-cta--danger" style={{ display: 'inline-flex' }}><AlertTriangle size={16} /> Saber mais</Link>
        </div>
      </section>

      {/* ══ B2B ══════════════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">Para Empresas</div>
          <h2>A saúde da sua equipa, organizada.</h2>
          <p>Reduza absentismo. Melhore produtividade. Ofereça um benefício real.</p>
        </div>
        <div className="lp-b2b-grid">
          {[
            { icon: Users,     label: 'Teleconsulta para staff',    desc: 'Acesso médico imediato, sem deslocações.' },
            { icon: TrendingUp,label: 'Dashboard RH anónimo',       desc: 'Tendências de saúde sem violar privacidade.' },
            { icon: RefreshCw, label: 'Check-ups anuais',           desc: 'Agenda organizada para toda a equipa.' },
            { icon: Pill,      label: 'Gestão de crónicos',         desc: 'Acompanhamento de colaboradores com condições crónicas.' },
            { icon: Shield,    label: 'Compliance saúde ocupac.',   desc: 'Relatórios e certificados para auditoria.' },
            { icon: Clock,     label: 'Resposta rápida',            desc: 'SLA de resposta médica garantida.' },
          ].map(item => (
            <div key={item.label} className="lp-b2b-card">
              <item.icon size={20} style={{ color: '#7c3aed' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.label}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/empresas" className="lp-cta lp-cta--secondary" style={{ display: 'inline-flex' }}><Building2 size={16} /> Soluções para Empresas</Link>
        </div>
      </section>

      {/* ══ DEVICES ══════════════════════════════════════ */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">Smart Devices</div>
          <h2>Os seus sinais vitais chegam ao médico.</h2>
          <p>Não vendemos gadgets. Os dados chegam ao médico. Ele interpreta e orienta. Sempre.</p>
        </div>
        <div className="lp-devices-row">
          {[{ icon: Activity, label: 'Tensiómetro smart', sub: 'Tensão arterial em tempo real' }, { icon: Wind, label: 'Oxímetro', sub: 'SpO₂ e frequência cardíaca' }, { icon: TrendingUp, label: 'Balança smart', sub: 'Peso e IMC com tendências' }, { icon: Zap, label: 'Termómetro', sub: 'Temperatura corporal' }, { icon: HeartPulse, label: 'Glicómetro', sub: 'Glicemia em jejum e pós-prandial' }].map(d => (
            <div key={d.label} className="lp-device-card">
              <d.icon size={24} style={{ color: '#0d9488' }} />
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.5rem' }}>{d.label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{d.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/devices" className="lp-link-more">Ver integração de devices <ArrowRight size={15} /></Link>
        </div>
      </section>

      {/* ══ PRICING ══════════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">Preços simples</div>
          <h2>Comece grátis. Evolua quando precisar.</h2>
        </div>
        <div className="lp-pricing">
          {[
            { label: 'Basic',   price: 'Gratuito',      sub: 'Para começar',      features: ['Triagem básica', 'Historial limitado', 'Marcação de consulta', '1 perfil'],                                                                    cta: 'Começar Grátis',    featured: false },
            { label: 'Premium', price: '3.500 Kz/mês',  sub: 'Dia-a-dia',         features: ['Tudo do Basic', 'Teleconsulta incluída', 'Refill medicação', 'Reminders', 'Vitals tracking', '3 perfis'],                                      cta: 'Experimentar',      featured: true  },
            { label: 'Family',  price: '7.500 Kz/mês',  sub: 'Para a família',    features: ['Tudo do Premium', 'Até 6 perfis', 'Family dashboard', 'Perfis pediátricos', 'Prioridade no suporte'],                                          cta: 'Family Plan',       featured: false },
          ].map(p => (
            <div key={p.label} className={`lp-price-card${p.featured ? ' lp-price-card--featured' : ''}`}>
              <div className="lp-price-label">{p.label}</div>
              <div className="lp-price-amount">{p.price}</div>
              <div className="lp-price-sub">{p.sub}</div>
              <ul>{p.features.map(f => (<li key={f}><CheckCircle2 size={13} style={{ color: p.featured ? '#fff' : '#0d9488' }} /> {f}</li>))}</ul>
              <Link to="/register" className="lp-price-cta" style={p.featured ? { background: '#fff', color: '#0d9488' } : {}}>{p.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FINAL CTA ════════════════════════════════════ */}
      <section className="lp-final-cta">
        <div className="lp-tag" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>CareFast+ — O seu sistema de saúde</div>
        <h2>Acesso rápido à saúde começa aqui.</h2>
        <p>Junte-se a um ecossistema de saúde digital construído para Angola — e para o mundo.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/register" className="lp-cta lp-cta--white">Criar conta gratuita</Link>
          <Link to="/contacto" className="lp-cta lp-cta--white-outline"><Phone size={15} /> Falar connosco</Link>
        </div>
        <div style={{ marginTop: '2rem', display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {['Sem diagnóstico por IA', 'Médico real valida tudo', 'Dados encriptados', 'Transparente'].map(t => (
            <span key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.83rem', color: 'rgba(255,255,255,0.7)' }}>
              <CheckCircle2 size={13} style={{ color: 'rgba(255,255,255,0.5)' }} /> {t}
            </span>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
