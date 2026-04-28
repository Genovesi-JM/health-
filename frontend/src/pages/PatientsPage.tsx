import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Calendar, Video, Activity, Heart, Pill, Bell, Users,
  ArrowRight, CheckCircle2, Shield, Clock, FileText,
  Smartphone, RefreshCw, TrendingUp, Baby,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Calendar,
    color: '#0d9488',
    title: 'Marque consultas online',
    desc: 'Escolha a clínica, especialidade, data e hora. Confirmação imediata sem telefonemas.',
  },
  {
    icon: Activity,
    color: '#dc2626',
    title: 'Envie as suas leituras antes da consulta',
    desc: 'Tensão, glicemia, oximetria — o médico recebe os seus dados antes de chegar. Consulta mais eficiente.',
  },
  {
    icon: Video,
    color: '#0891b2',
    title: 'Teleconsulta de casa',
    desc: 'Consulta por vídeo com médico certificado. Sem deslocação, sem espera, sem stress.',
  },
  {
    icon: Pill,
    color: '#7c3aed',
    title: 'Renovação de receita',
    desc: 'Medicação crónica? Solicite renovação em 2 cliques. Médico valida e emite a receita digitalmente.',
  },
  {
    icon: Bell,
    color: '#d97706',
    title: 'Lembretes inteligentes',
    desc: 'Nunca se esqueça de uma consulta, medição ou medicação. Alertas personalizados para cada necessidade.',
  },
  {
    icon: Users,
    color: '#0d9488',
    title: 'Gestão familiar',
    desc: 'Gerencie a saúde de filhos, pais e cônjuge a partir de uma única conta. Um portal para toda a família.',
  },
  {
    icon: FileText,
    color: '#0891b2',
    title: 'Historial clínico organizado',
    desc: 'Todas as consultas, receitas e resultados num só lugar. Partilhe com qualquer médico, quando precisar.',
  },
  {
    icon: RefreshCw,
    color: '#059669',
    title: 'Acompanhamento de doenças crónicas',
    desc: 'Hipertensão, diabetes, asma — monitorização contínua com alertas de risco e check-ins mensais.',
  },
];

const JOURNEY = [
  { step: '01', icon: Smartphone, color: '#0d9488', title: 'Registe-se em 2 minutos', desc: 'Crie o seu perfil, adicione a família e configure as suas condições de saúde.' },
  { step: '02', icon: Activity,   color: '#0891b2', title: 'Meça os seus vitais em casa', desc: 'Tensão, glicemia, SpO₂ — sincronize com o portal antes da consulta.' },
  { step: '03', icon: Calendar,   color: '#7c3aed', title: 'Marque ou entre em teleconsulta', desc: 'O médico vê os seus dados e a consulta começa com contexto completo.' },
  { step: '04', icon: TrendingUp, color: '#d97706', title: 'Acompanhe a sua saúde', desc: 'Gráficos, tendências, receitas e próximas consultas — tudo organizado.' },
];

const PLANS = [
  {
    label: 'Basic',
    price: 'Gratuito',
    sub: 'Para começar',
    color: '#0d9488',
    features: ['Marcação de consultas', 'Triagem básica', '1 perfil', 'Historial de 6 meses'],
    cta: 'Criar conta grátis',
    featured: false,
  },
  {
    label: 'Premium',
    price: '3.500 Kz/mês',
    sub: '≈ 42.000 Kz/ano',
    color: '#0891b2',
    features: ['Teleconsulta ilimitada', 'Vitals tracking', 'Renovação de receita', 'Lembretes', '3 perfis', 'Historial completo'],
    cta: 'Começar Premium',
    featured: true,
  },
  {
    label: 'Family',
    price: '7.500 Kz/mês',
    sub: 'Até 6 membros',
    color: '#7c3aed',
    features: ['Tudo do Premium', '6 perfis', 'Perfis pediátricos', 'Dashboard familiar', 'Suporte prioritário'],
    cta: 'Family Plan',
    featured: false,
  },
];

export default function PatientsPage() {
  return (
    <div className="landing-wrapper">
      <Navbar />

      {/* ── Page Hero ── */}
      <section className="lp-page-hero">
        <div className="lp-tag"><Heart size={12} /> Para Pacientes</div>
        <h1>A sua saúde, organizada.<br /><span className="lp-hero__accent">Simples, rápida e contínua.</span></h1>
        <p>
          Marque consultas, envie leituras antes de chegar, renove receitas e acompanhe a saúde da família —
          tudo num só portal, desenhado para Angola.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/register" className="lp-cta lp-cta--primary"><Calendar size={16} /> Criar conta grátis</Link>
          <Link to="/telemedicina" className="lp-cta lp-cta--secondary"><Video size={16} /> Teleconsulta agora</Link>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">O que pode fazer</div>
          <h2>Tudo o que precisa para cuidar da sua saúde.</h2>
          <p>Ferramentas reais para pacientes reais. Sem complicação.</p>
        </div>
        <div className="feat-grid">
          {FEATURES.map(f => (
            <div key={f.title} className="feat-card">
              <div className="feat-icon" style={{ background: `${f.color}15`, color: f.color }}>
                <f.icon size={22} />
              </div>
              <div>
                <h3 className="feat-title">{f.title}</h3>
                <p className="feat-desc">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Patient Journey ── */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">Como funciona</div>
          <h2>De paciente a utilizador activo de saúde.</h2>
          <p>Quatro passos que transformam a forma como cuida de si e da família.</p>
        </div>
        <div className="journey-steps">
          {JOURNEY.map((s, i) => (
            <div key={s.step} className="journey-step">
              <div className="journey-num" style={{ color: s.color }}>{s.step}</div>
              <div className="journey-icon" style={{ background: `${s.color}18`, color: s.color }}>
                <s.icon size={24} />
              </div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              {i < JOURNEY.length - 1 && <div className="journey-connector" style={{ background: s.color }} />}
            </div>
          ))}
        </div>
      </section>

      {/* ── Chronic care callout ── */}
      <section className="lp-section lp-section--alt">
        <div className="page-callout" style={{ borderColor: 'rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(220,38,38,0.12)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Heart size={22} />
            </div>
            <div>
              <div className="lp-tag" style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', margin: 0 }}>Cuidado Crónico</div>
              <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.2rem', fontWeight: 800 }}>Tem hipertensão, diabetes ou asma?</h3>
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            O CareFast+ tem um programa dedicado para doentes crónicos — monitorização contínua, renovação automática de receitas e check-ins mensais com o seu médico.
          </p>
          <Link to="/chronic-care" className="lp-cta lp-cta--danger"><RefreshCw size={15} /> Ver programa de cuidado crónico</Link>
        </div>
      </section>

      {/* ── Family feature ── */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">Gestão Familiar</div>
          <h2>Um portal para cuidar de toda a família.</h2>
          <p>Gerencie a saúde dos seus filhos, pais e cônjuge — sem criar contas separadas.</p>
        </div>
        <div className="family-row">
          {[
            { icon: Baby,  color: '#0891b2', label: 'Crianças', desc: 'Calendário de vacinas, consultas pediátricas, altura e peso.' },
            { icon: Heart, color: '#dc2626', label: 'Adultos',  desc: 'Medicação crónica, marcações, teleconsulta.' },
            { icon: Users, color: '#7c3aed', label: 'Idosos',   desc: 'Monitorização de tensão, glicemia e check-ins regulares.' },
          ].map(m => (
            <div key={m.label} className="family-card">
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${m.color}15`, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <m.icon size={22} />
              </div>
              <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>{m.label}</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">Planos</div>
          <h2>Comece grátis. Escale quando precisar.</h2>
          <p>Sem contratos anuais. Cancele quando quiser.</p>
        </div>
        <div className="lp-pricing">
          {PLANS.map(p => (
            <div key={p.label} className={`lp-price-card${p.featured ? ' lp-price-card--featured' : ''}`}>
              <div className="lp-price-label">{p.label}</div>
              <div className="lp-price-amount">{p.price}</div>
              <div className="lp-price-sub">{p.sub}</div>
              <ul>
                {p.features.map(f => (
                  <li key={f}>
                    <CheckCircle2 size={13} style={{ color: p.featured ? '#fff' : p.color }} /> {f}
                  </li>
                ))}
              </ul>
              <Link to="/register" className="lp-price-cta" style={p.featured ? { background: '#fff', color: '#0d9488' } : {}}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trust ── */}
      <section className="lp-section">
        <div className="trust-bar">
          {[
            { icon: Shield,       color: '#0d9488', label: 'Dados encriptados',         desc: 'AES-256 em repouso e em trânsito.' },
            { icon: CheckCircle2, color: '#0891b2', label: 'Médico real valida tudo',   desc: 'Nenhuma IA toma decisões clínicas.' },
            { icon: Clock,        color: '#7c3aed', label: 'Disponível 24/7',           desc: 'Portal sempre online.' },
            { icon: Shield,       color: '#d97706', label: 'Privacidade garantida',     desc: 'Os seus dados nunca são vendidos.' },
          ].map(t => (
            <div key={t.label} className="trust-item">
              <t.icon size={20} style={{ color: t.color }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="lp-final-cta">
        <div className="lp-tag" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>Comece hoje</div>
        <h2>A sua saúde merece este cuidado.</h2>
        <p>Crie a sua conta gratuita agora. Sem cartão, sem compromisso.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/register" className="lp-cta lp-cta--white">Criar conta grátis <ArrowRight size={15} /></Link>
          <Link to="/telemedicina" className="lp-cta lp-cta--white-outline"><Video size={15} /> Teleconsulta agora</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
