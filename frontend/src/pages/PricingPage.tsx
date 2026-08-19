import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Heart, Video, Activity, Users, Building2,
  CheckCircle2, ArrowRight, Star, RefreshCw,
  Shield, Clock, TrendingUp,
} from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

export default function PricingPage() {
  const { t } = useT();
  const TIERS = [
    {
      label: t('price.t1_label'), price: t('price.free'), period: t('price.forever'), color: '#64748b', popular: false,
      target: t('price.t1_target'),
      features: [t('price.t1_f1'), t('price.t1_f2'), t('price.t1_f3'), t('price.t1_f4'), t('price.t1_f5')],
      notIncluded: [t('price.t1_n1'), t('price.t1_n2'), t('price.t1_n3'), t('price.t1_n4')],
      cta: t('price.t1_cta'), ctaLink: '/register',
    },
    {
      label: t('price.t2_label'), price: '3.500 Kz', period: t('price.per_month'), color: '#0d9488', popular: true,
      target: t('price.t2_target'),
      features: [t('price.t2_f1'), t('price.t2_f2'), t('price.t2_f3'), t('price.t2_f4'), t('price.t2_f5'), t('price.t2_f6'), t('price.t2_f7'), t('price.t2_f8')],
      notIncluded: [t('price.t2_n1'), t('price.t2_n2')],
      cta: t('price.t2_cta'), ctaLink: '/register',
    },
    {
      label: t('price.t3_label'), price: '7.500 Kz', period: t('price.per_month'), color: '#7c3aed', popular: false,
      target: t('price.t3_target'),
      features: [t('price.t3_f1'), t('price.t3_f2'), t('price.t3_f3'), t('price.t3_f4'), t('price.t3_f5'), t('price.t3_f6'), t('price.t3_f7')],
      notIncluded: [] as string[],
      cta: t('price.t3_cta'), ctaLink: '/register',
    },
    {
      label: t('price.t4_label'), price: '4.500 Kz', period: t('price.per_month'), color: '#dc2626', popular: false,
      target: t('price.t4_target'),
      features: [t('price.t4_f1'), t('price.t4_f2'), t('price.t4_f3'), t('price.t4_f4'), t('price.t4_f5'), t('price.t4_f6'), t('price.t4_f7')],
      notIncluded: [] as string[],
      cta: t('price.t4_cta'), ctaLink: '/register',
    },
  ];
  const CLINIC_PLANS = [
    { label: t('price.c1_label'), price: '15.000 Kz/mês', sub: t('price.c1_sub'), features: [t('price.c1_f1'), t('price.c1_f2'), t('price.c1_f3'), t('price.c1_f4')], cta: t('price.c1_cta'), color: '#0d9488', featured: false },
    { label: t('price.c2_label'), price: '35.000 Kz/mês', sub: t('price.c2_sub'), features: [t('price.c2_f1'), t('price.c2_f2'), t('price.c2_f3'), t('price.c2_f4'), t('price.c2_f5')], cta: t('price.c2_cta'), color: '#0891b2', featured: true },
    { label: t('price.c3_label'), price: t('price.custom'), sub: t('price.c3_sub'), features: [t('price.c3_f1'), t('price.c3_f2'), t('price.c3_f3'), t('price.c3_f4'), t('price.c3_f5')], cta: t('price.c3_cta'), color: '#7c3aed', featured: false },
  ];
  const TRUST = [
    { icon: Shield,    color: '#0d9488', label: t('price.trust1'), desc: t('price.trust1_desc') },
    { icon: Clock,     color: '#0891b2', label: t('price.trust2'), desc: t('price.trust2_desc') },
    { icon: RefreshCw, color: '#7c3aed', label: t('price.trust3'), desc: t('price.trust3_desc') },
    { icon: Users,     color: '#d97706', label: t('price.trust4'), desc: t('price.trust4_desc') },
  ];
  const FAQ_PRICING = [
    { q: t('price.q1'), a: t('price.a1') },
    { q: t('price.q2'), a: t('price.a2') },
    { q: t('price.q3'), a: t('price.a3') },
    { q: t('price.q4'), a: t('price.a4') },
    { q: t('price.q5'), a: t('price.a5') },
  ];
  return (
    <div className="landing-wrapper">
      <Navbar />

      {/* ── Hero ── */}
      <section className="lp-page-hero">
        <div className="lp-tag"><TrendingUp size={12} /> {t('price.tag')}</div>
        <h1>{t('price.title1')}<br /><span className="lp-hero__accent">{t('price.title2')}</span></h1>
        <p>
          {t('price.subtitle')}
        </p>
      </section>

      {/* ── Patient plans ── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag"><Heart size={12} /> {t('price.pat_tag')}</div>
          <h2>{t('price.pat_title')}</h2>
          <p>{t('price.pat_desc')}</p>
        </div>
        <div className="pricing-grid">
          {TIERS.map(tier => (
            <div key={tier.label} className={`pricing-card${tier.popular ? ' pricing-card--popular' : ''}`}>
              {tier.popular && <div className="pricing-popular-badge"><Star size={11} /> {t('price.popular')}</div>}
              <div className="pricing-card__top" style={{ borderColor: `${tier.color}30` }}>
                <div className="pricing-label" style={{ color: tier.color }}>{tier.label}</div>
                <div className="pricing-amount">
                  <span className="pricing-price">{tier.price}</span>
                  <span className="pricing-period">{tier.period}</span>
                </div>
                <div className="pricing-target">{tier.target}</div>
              </div>
              <div className="pricing-features">
                <div className="pricing-features__title">{t('price.includes')}</div>
                {tier.features.map(f => (
                  <div key={f} className="pricing-feature">
                    <CheckCircle2 size={13} style={{ color: tier.color, flexShrink: 0 }} /> {f}
                  </div>
                ))}
                {tier.notIncluded.length > 0 && (
                  <>
                    <div className="pricing-features__title" style={{ marginTop: '0.75rem', opacity: 0.5 }}>{t('price.not_includes')}</div>
                    {tier.notIncluded.map(f => (
                      <div key={f} className="pricing-feature pricing-feature--no">
                        <span style={{ width: 13, height: 13, borderRadius: '50%', border: '1.5px solid var(--text-muted)', flexShrink: 0, display: 'inline-block' }} /> {f}
                      </div>
                    ))}
                  </>
                )}
              </div>
              <Link to={tier.ctaLink} className="pricing-cta" style={{ background: tier.popular ? tier.color : 'transparent', color: tier.popular ? '#fff' : tier.color, borderColor: tier.color }}>
                {tier.cta} {tier.popular && <ArrowRight size={14} />}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Clinic plans ── */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag"><Building2 size={12} /> {t('price.clin_tag')}</div>
          <h2>{t('price.clin_title')}</h2>
          <p>{t('price.clin_desc')}</p>
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
          <Link to="/clinics" className="lp-link-more">{t('price.clin_more')} <ArrowRight size={14} /></Link>
        </div>
      </section>

      {/* ── Trust ── */}
      <section className="lp-section lp-section--alt">
        <div className="pricing-trust-row">
          {TRUST.map(item => (
            <div key={item.label} className="pricing-trust-item">
              <item.icon size={20} style={{ color: item.color }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{item.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">{t('price.faq_tag')}</div>
          <h2>{t('price.faq_title')}</h2>
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
          <Link to="/faq" className="lp-link-more">{t('price.faq_more')} <ArrowRight size={14} /></Link>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="lp-final-cta">
        <div className="lp-tag" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>{t('price.final_tag')}</div>
        <h2>{t('price.final_title')}</h2>
        <p>{t('price.final_desc')}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/register" className="lp-cta lp-cta--white">{t('price.t1_cta')} <ArrowRight size={14} /></Link>
          <Link to="/contacto" className="lp-cta lp-cta--white-outline">{t('price.final_talk')}</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
