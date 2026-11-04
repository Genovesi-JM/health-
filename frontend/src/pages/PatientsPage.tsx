import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Calendar, Video, Activity, Heart, Pill, Bell, Users,
  ArrowRight, CheckCircle2, Shield, Clock, FileText,
  Smartphone, RefreshCw, TrendingUp, Baby,
} from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

export default function PatientsPage() {
  const { t } = useT();
  const FEATURES = [
    { icon: Calendar,  color: '#0d9488', title: t('pat.f1_title'), desc: t('pat.f1_desc') },
    { icon: Activity,  color: '#dc2626', title: t('pat.f2_title'), desc: t('pat.f2_desc') },
    { icon: Video,     color: '#0891b2', title: t('pat.f3_title'), desc: t('pat.f3_desc') },
    { icon: Pill,      color: '#7c3aed', title: t('pat.f4_title'), desc: t('pat.f4_desc') },
    { icon: Bell,      color: '#d97706', title: t('pat.f5_title'), desc: t('pat.f5_desc') },
    { icon: Users,     color: '#0d9488', title: t('pat.f6_title'), desc: t('pat.f6_desc') },
    { icon: FileText,  color: '#0891b2', title: t('pat.f7_title'), desc: t('pat.f7_desc') },
    { icon: RefreshCw, color: '#059669', title: t('pat.f8_title'), desc: t('pat.f8_desc') },
  ];
  const JOURNEY = [
    { step: '01', icon: Smartphone, color: '#0d9488', title: t('pat.j1_title'), desc: t('pat.j1_desc') },
    { step: '02', icon: Activity,   color: '#0891b2', title: t('pat.j2_title'), desc: t('pat.j2_desc') },
    { step: '03', icon: Calendar,   color: '#7c3aed', title: t('pat.j3_title'), desc: t('pat.j3_desc') },
    { step: '04', icon: TrendingUp, color: '#d97706', title: t('pat.j4_title'), desc: t('pat.j4_desc') },
  ];
  const FAMILY = [
    { icon: Baby,  color: '#0891b2', label: t('pat.fam_children'), desc: t('pat.fam_children_desc') },
    { icon: Heart, color: '#dc2626', label: t('pat.fam_adults'),   desc: t('pat.fam_adults_desc') },
    { icon: Users, color: '#7c3aed', label: t('pat.fam_elderly'),  desc: t('pat.fam_elderly_desc') },
  ];
  const PLANS = [
    { label: 'Basic', price: t('pat.plan_basic_price'), sub: t('pat.plan_basic_sub'), color: '#0d9488',
      features: [t('pat.plan_basic_f1'), t('pat.plan_basic_f2'), t('pat.plan_basic_f3'), t('pat.plan_basic_f4')], cta: t('pat.plan_basic_cta'), featured: false },
    { label: 'Premium', price: '3.500 Kz/mês', sub: t('pat.plan_prem_sub'), color: '#0891b2',
      features: [t('pat.plan_prem_f1'), t('pat.plan_prem_f2'), t('pat.plan_prem_f3'), t('pat.plan_prem_f4'), t('pat.plan_prem_f5'), t('pat.plan_prem_f6')], cta: t('pat.plan_prem_cta'), featured: true },
    { label: 'Family', price: '7.500 Kz/mês', sub: t('pat.plan_fam_sub'), color: '#7c3aed',
      features: [t('pat.plan_fam_f1'), t('pat.plan_fam_f2'), t('pat.plan_fam_f3'), t('pat.plan_fam_f4'), t('pat.plan_fam_f5')], cta: t('pat.plan_fam_cta'), featured: false },
  ];
  const TRUST = [
    { icon: Shield,       color: '#0d9488', label: t('pat.trust1'), desc: t('pat.trust1_desc') },
    { icon: CheckCircle2, color: '#0891b2', label: t('pat.trust2'), desc: t('pat.trust2_desc') },
    { icon: Clock,        color: '#7c3aed', label: t('pat.trust3'), desc: t('pat.trust3_desc') },
    { icon: Shield,       color: '#d97706', label: t('pat.trust4'), desc: t('pat.trust4_desc') },
  ];
  return (
    <div className="landing-wrapper">
      <Navbar />

      {/* ── Page Hero ── */}
      <section className="lp-page-hero">
        <div className="lp-tag"><Heart size={12} /> {t('pat.tag')}</div>
        <h1>{t('pat.title1')}<br /><span className="lp-hero__accent">{t('pat.title2')}</span></h1>
        <p>
          {t('pat.subtitle')}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/register" className="lp-cta lp-cta--primary"><Calendar size={16} /> {t('pat.cta_free')}</Link>
          <Link to="/telemedicina" className="lp-cta lp-cta--secondary"><Video size={16} /> {t('pat.cta_tele')}</Link>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">{t('pat.feat_tag')}</div>
          <h2>{t('pat.feat_title')}</h2>
          <p>{t('pat.feat_desc')}</p>
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
          <div className="lp-tag">{t('pat.journey_tag')}</div>
          <h2>{t('pat.journey_title')}</h2>
          <p>{t('pat.journey_desc')}</p>
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
              <div className="lp-tag" style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', margin: 0 }}>{t('pat.chronic_tag')}</div>
              <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.2rem', fontWeight: 800 }}>{t('pat.chronic_title')}</h3>
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {t('pat.chronic_desc')}
          </p>
          <Link to="/chronic-care" className="lp-cta lp-cta--danger"><RefreshCw size={15} /> {t('pat.chronic_cta')}</Link>
        </div>
      </section>

      {/* ── Family feature ── */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">{t('pat.fam_tag')}</div>
          <h2>{t('pat.fam_title')}</h2>
          <p>{t('pat.fam_desc')}</p>
        </div>
        <div className="family-row">
          {FAMILY.map(m => (
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
          <div className="lp-tag">{t('pat.plans_tag')}</div>
          <h2>{t('pat.plans_title')}</h2>
          <p>{t('pat.plans_desc')}</p>
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
          {TRUST.map(item => (
            <div key={item.label} className="trust-item">
              <item.icon size={20} style={{ color: item.color }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{item.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="lp-final-cta">
        <div className="lp-tag" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>{t('pat.final_tag')}</div>
        <h2>{t('pat.final_title')}</h2>
        <p>{t('pat.final_desc')}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/register" className="lp-cta lp-cta--white">{t('pat.cta_free')} <ArrowRight size={15} /></Link>
          <Link to="/telemedicina" className="lp-cta lp-cta--white-outline"><Video size={15} /> {t('pat.cta_tele')}</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
