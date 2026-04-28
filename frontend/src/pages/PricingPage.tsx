import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Heart, Video, Activity, Users, Building2,
  CheckCircle2, ArrowRight, Star, RefreshCw,
  Shield, Clock, TrendingUp,
} from 'lucide-react';

const TIERS = [
  {
    label: 'Basic',
    price: 'Gratuito',
    period: 'Para sempre',
    color: '#64748b',
    popular: false,
    target: 'Pacientes individuais que querem começar',
    features: [
      'Marcação de consultas (5/mês)',
      'Triagem básica de sintomas',
      '1 perfil de utilizador',
      'Historial últimos 6 meses',
      'Notificações por email',
    ],
    notIncluded: ['Teleconsulta', 'Vitals tracking', 'Renovação de receitas', 'Perfis familiares'],
    cta: 'Criar conta grátis',
    ctaLink: '/register',
  },
  {
    label: 'Premium',
    price: '3.500 Kz',
    period: '/mês',
    color: '#0d9488',
    popular: true,
    target: 'Pacientes activos e famílias pequenas',
    features: [
      'Marcações ilimitadas',
      'Teleconsulta incluída (4/mês)',
      'Vitals tracking (tensão, SpO₂, peso)',
      'Renovação de receita crónica',
      'Lembretes personalizados',
      '3 perfis de utilizador',
      'Historial completo',
      'Suporte por chat',
    ],
    notIncluded: ['Dashboard familiar avançado', 'Perfis pediátricos ilimitados'],
    cta: 'Experimentar Premium',
    ctaLink: '/register',
  },
  {
    label: 'Family',
    price: '7.500 Kz',
    period: '/mês',
    color: '#7c3aed',
    popular: false,
    target: 'Famílias completas, incluindo idosos e crianças',
    features: [
      'Tudo do Premium',
      'Até 6 perfis de utilizador',
      'Perfis pediátricos (vacinas, crescimento)',
      'Dashboard familiar unificado',
      'Monitorização de idosos',
      'Partilha de historial entre membros',
      'Suporte prioritário',
    ],
    notIncluded: [],
    cta: 'Family Plan',
    ctaLink: '/register',
  },
  {
    label: 'Chronic Care',
    price: '4.500 Kz',
    period: '/mês',
    color: '#dc2626',
    popular: false,
    target: 'Doentes com condições crónicas (HTA, DM, asma)',
    features: [
      'Vitals tracking avançado',
      'Alertas de risco personalizados',
      'Check-in mensal com médico',
      'Renovação automática de receitas',
      'Histórico de leituras ilimitado',
      'Plano de saúde personalizado',
      'Monitorização familiar opcional',
    ],
    notIncluded: [],
    cta: 'Activar Chronic Care',
    ctaLink: '/register',
  },
];

const CLINIC_PLANS = [
  {
    label: 'Starter Clínica',
    price: '15.000 Kz/mês',
    sub: '1–3 médicos',
    features: ['50 marcações/mês', 'Perfil na rede', '1 especialidade', 'Relatórios básicos'],
    cta: 'Começar',
    color: '#0d9488',
    featured: false,
  },
  {
    label: 'Business Clínica',
    price: '35.000 Kz/mês',
    sub: '4–10 médicos',
    features: ['Marcações ilimitadas', 'Teleconsulta', 'Vitals pré-chegada', 'Dashboard analytics', '3 especialidades'],
    cta: 'Mais escolhido',
    color: '#0891b2',
    featured: true,
  },
  {
    label: 'Enterprise',
    price: 'Personalizado',
    sub: 'Hospitais e grupos',
    features: ['Tudo ilimitado', 'API / HIS integração', 'SLA 99.9%', 'Gestor dedicado', 'Formação presencial'],
    cta: 'Contactar',
    color: '#7c3aed',
    featured: false,
  },
];

const FAQ_PRICING = [
  { q: 'Posso cancelar a qualquer momento?', a: 'Sim. Sem contratos anuais. Cancele quando quiser, sem penalidades.' },
  { q: 'Quais os métodos de pagamento aceites?', a: 'Multicaixa Express, transferência bancária, Visa/Mastercard e pagamento em clínica parceira.' },
  { q: 'O plano Basic é realmente gratuito?', a: 'Sim. Basic é gratuito para sempre, com funcionalidades essenciais. Sem cartão de crédito necessário.' },
  { q: 'Posso mudar de plano mais tarde?', a: 'Sim. Pode fazer upgrade ou downgrade a qualquer momento. A diferença é calculada pro-rata.' },
  { q: 'Os dispositivos estão incluídos nos planos?', a: 'Os planos incluem software e sincronização. Os dispositivos físicos são adquiridos separadamente ou em kit.' },
];

export default function PricingPage() {
  return (
    <div className="landing-wrapper">
      <Navbar />

      {/* ── Hero ── */}
      <section className="lp-page-hero">
        <div className="lp-tag"><TrendingUp size={12} /> Preços</div>
        <h1>Preços simples.<br /><span className="lp-hero__accent">Sem surpresas.</span></h1>
        <p>
          Comece grátis. Evolua quando a sua saúde precisar. Planos para pacientes, famílias e clínicas —
          todos com cancelamento livre a qualquer momento.
        </p>
      </section>

      {/* ── Patient plans ── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag"><Heart size={12} /> Para Pacientes</div>
          <h2>Planos para cada necessidade de saúde.</h2>
          <p>Escolha o plano que se adapta ao seu perfil. Cancele quando quiser.</p>
        </div>
        <div className="pricing-grid">
          {TIERS.map(t => (
            <div key={t.label} className={`pricing-card${t.popular ? ' pricing-card--popular' : ''}`}>
              {t.popular && <div className="pricing-popular-badge"><Star size={11} /> Mais escolhido</div>}
              <div className="pricing-card__top" style={{ borderColor: `${t.color}30` }}>
                <div className="pricing-label" style={{ color: t.color }}>{t.label}</div>
                <div className="pricing-amount">
                  <span className="pricing-price">{t.price}</span>
                  <span className="pricing-period">{t.period}</span>
                </div>
                <div className="pricing-target">{t.target}</div>
              </div>
              <div className="pricing-features">
                <div className="pricing-features__title">Inclui</div>
                {t.features.map(f => (
                  <div key={f} className="pricing-feature">
                    <CheckCircle2 size={13} style={{ color: t.color, flexShrink: 0 }} /> {f}
                  </div>
                ))}
                {t.notIncluded.length > 0 && (
                  <>
                    <div className="pricing-features__title" style={{ marginTop: '0.75rem', opacity: 0.5 }}>Não inclui</div>
                    {t.notIncluded.map(f => (
                      <div key={f} className="pricing-feature pricing-feature--no">
                        <span style={{ width: 13, height: 13, borderRadius: '50%', border: '1.5px solid var(--text-muted)', flexShrink: 0, display: 'inline-block' }} /> {f}
                      </div>
                    ))}
                  </>
                )}
              </div>
              <Link to={t.ctaLink} className="pricing-cta" style={{ background: t.popular ? t.color : 'transparent', color: t.popular ? '#fff' : t.color, borderColor: t.color }}>
                {t.cta} {t.popular && <ArrowRight size={14} />}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Clinic plans ── */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag"><Building2 size={12} /> Para Clínicas</div>
          <h2>Planos B2B para clínicas e hospitais.</h2>
          <p>Onboarding em 48 horas. Suporte dedicado no primeiro mês.</p>
        </div>
        <div className="lp-pricing">
          {CLINIC_PLANS.map(p => (
            <div key={p.label} className={`lp-price-card${p.featured ? ' lp-price-card--featured' : ''}`}>
              <div className="lp-price-label">{p.label}</div>
              <div className="lp-price-amount">{p.price}</div>
              <div className="lp-price-sub">{p.sub}</div>
              <ul>
                {p.features.map(f => (
                  <li key={f}><CheckCircle2 size={13} style={{ color: p.featured ? '#fff' : p.color }} /> {f}</li>
                ))}
              </ul>
              <Link to="/contacto" className="lp-price-cta" style={p.featured ? { background: '#fff', color: '#0d9488' } : {}}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/clinics" className="lp-link-more">Saber mais sobre parcerias clínicas <ArrowRight size={14} /></Link>
        </div>
      </section>

      {/* ── Trust ── */}
      <section className="lp-section lp-section--alt">
        <div className="pricing-trust-row">
          {[
            { icon: Shield,    color: '#0d9488', label: 'Dados encriptados',      desc: 'AES-256. Os seus dados nunca são vendidos.' },
            { icon: Clock,     color: '#0891b2', label: 'Cancelamento livre',     desc: 'Sem contratos. Sem penalidades.' },
            { icon: RefreshCw, color: '#7c3aed', label: 'Mude de plano quando quiser', desc: 'Pro-rata calculado automaticamente.' },
            { icon: Users,     color: '#d97706', label: 'Suporte real',           desc: 'Equipa disponível para ajudar.' },
          ].map(t => (
            <div key={t.label} className="pricing-trust-item">
              <t.icon size={20} style={{ color: t.color }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">Dúvidas sobre preços</div>
          <h2>Perguntas frequentes.</h2>
        </div>
        <div className="pricing-faq">
          {FAQ_PRICING.map(item => (
            <div key={item.q} className="pricing-faq-item">
              <div className="pricing-faq-q"><CheckCircle2 size={15} style={{ color: 'var(--accent-teal)', flexShrink: 0 }} />{item.q}</div>
              <div className="pricing-faq-a">{item.a}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link to="/faq" className="lp-link-more">Ver todas as perguntas frequentes <ArrowRight size={14} /></Link>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="lp-final-cta">
        <div className="lp-tag" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>Comece hoje</div>
        <h2>O plano certo para cada fase da sua saúde.</h2>
        <p>Gratuito para começar. Premium quando precisar de mais.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/register" className="lp-cta lp-cta--white">Criar conta grátis <ArrowRight size={14} /></Link>
          <Link to="/contacto" className="lp-cta lp-cta--white-outline">Falar connosco</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
