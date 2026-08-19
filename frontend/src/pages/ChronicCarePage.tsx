import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Heart, Activity, Wind, TrendingUp, RefreshCw,
  Bell, Calendar, Video, Shield, CheckCircle2,
  ArrowRight, Users, Clock, AlertTriangle,
} from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

export default function ChronicCarePage() {
  const { t } = useT();
  const CONDITIONS = [
    { icon: Activity,   color: '#dc2626', bg: 'rgba(220,38,38,0.1)',   label: t('cc.c1_label'), sub: t('cc.c1_sub') },
    { icon: TrendingUp, color: '#d97706', bg: 'rgba(217,119,6,0.1)',   label: t('cc.c2_label'), sub: t('cc.c2_sub') },
    { icon: Wind,       color: '#0891b2', bg: 'rgba(8,145,178,0.1)',   label: t('cc.c3_label'), sub: t('cc.c3_sub') },
    { icon: Heart,      color: '#7c3aed', bg: 'rgba(124,58,237,0.1)',  label: t('cc.c4_label'), sub: t('cc.c4_sub') },
    { icon: Users,      color: '#059669', bg: 'rgba(5,150,105,0.1)',   label: t('cc.c5_label'), sub: t('cc.c5_sub') },
    { icon: Clock,      color: '#0d9488', bg: 'rgba(13,148,136,0.1)',  label: t('cc.c6_label'), sub: t('cc.c6_sub') },
  ];
  const FEATURES = [
    { icon: RefreshCw, color: '#0d9488', title: t('cc.f1_title'), desc: t('cc.f1_desc') },
    { icon: Calendar,  color: '#0891b2', title: t('cc.f2_title'), desc: t('cc.f2_desc') },
    { icon: Activity,  color: '#dc2626', title: t('cc.f3_title'), desc: t('cc.f3_desc') },
    { icon: Bell,      color: '#d97706', title: t('cc.f4_title'), desc: t('cc.f4_desc') },
    { icon: Users,     color: '#7c3aed', title: t('cc.f5_title'), desc: t('cc.f5_desc') },
    { icon: Shield,    color: '#059669', title: t('cc.f6_title'), desc: t('cc.f6_desc') },
  ];
  const JOURNEY = [
    { step: '01', icon: Activity,   color: '#dc2626', title: t('cc.j1_title'), desc: t('cc.j1_desc') },
    { step: '02', icon: TrendingUp, color: '#0891b2', title: t('cc.j2_title'), desc: t('cc.j2_desc') },
    { step: '03', icon: Calendar,   color: '#7c3aed', title: t('cc.j3_title'), desc: t('cc.j3_desc') },
    { step: '04', icon: RefreshCw,  color: '#059669', title: t('cc.j4_title'), desc: t('cc.j4_desc') },
  ];
  const chips = [t('cc.chip1'), t('cc.chip2'), t('cc.chip3'), t('cc.chip4'), t('cc.chip5'), t('cc.chip6')];
  return (
    <div className="landing-wrapper">
      <Navbar />

      {/* ── Hero ── */}
      <section className="lp-page-hero">
        <div className="lp-tag" style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
          <Heart size={12} /> {t('cc.tag')}
        </div>
        <h1>{t('cc.title1')}<br /><span className="lp-hero__accent">{t('cc.title2')}</span></h1>
        <p>
          {t('cc.subtitle')}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/register" className="lp-cta lp-cta--primary"><Heart size={15} /> {t('cc.cta_start')}</Link>
          <Link to="/telemedicina" className="lp-cta lp-cta--secondary"><Video size={15} /> {t('cc.cta_talk')}</Link>
        </div>
      </section>

      {/* ── Disclaimer ── */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 1.5rem 2rem', textAlign: 'center' }}>
        <div className="disclaimer-box">
          <AlertTriangle size={16} style={{ color: '#d97706', flexShrink: 0 }} />
          <span>
            {t('cc.disclaimer')}
          </span>
        </div>
      </div>

      {/* ── Conditions ── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">{t('cc.cond_tag')}</div>
          <h2>{t('cc.cond_title')}</h2>
          <p>{t('cc.cond_desc')}</p>
        </div>
        <div className="conditions-grid">
          {CONDITIONS.map(c => (
            <div key={c.label} className="condition-card" style={{ borderColor: c.color + '30', background: c.bg }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${c.color}20`, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <c.icon size={22} />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.4rem' }}>{c.label}</h3>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{c.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">{t('cc.feat_tag')}</div>
          <h2>{t('cc.feat_title')}</h2>
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

      {/* ── Journey ── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">{t('cc.journey_tag')}</div>
          <h2>{t('cc.journey_title')}</h2>
        </div>
        <div className="journey-steps">
          {JOURNEY.map(s => (
            <div key={s.step} className="journey-step">
              <div className="journey-num" style={{ color: s.color }}>{s.step}</div>
              <div className="journey-icon" style={{ background: `${s.color}18`, color: s.color }}>
                <s.icon size={24} />
              </div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing callout ── */}
      <section className="lp-section">
        <div className="page-callout" style={{ borderColor: 'rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.03)' }}>
          <div className="lp-tag" style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>{t('cc.plan_tag')}</div>
          <h2 style={{ fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 800, margin: '0.5rem 0 0.75rem' }}>
            {t('cc.plan_title')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {t('cc.plan_desc')}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {chips.map(f => (
              <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.7rem', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600, color: '#dc2626' }}>
                <CheckCircle2 size={12} /> {f}
              </span>
            ))}
          </div>
          <Link to="/register" className="lp-cta lp-cta--danger"><ArrowRight size={15} /> {t('cc.plan_cta')}</Link>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="lp-final-cta">
        <div className="lp-tag" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>{t('cc.tag')}</div>
        <h2>{t('cc.final_title')}</h2>
        <p>{t('cc.final_desc')}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/register" className="lp-cta lp-cta--white">{t('cc.final_cta1')} <ArrowRight size={14} /></Link>
          <Link to="/contacto" className="lp-cta lp-cta--white-outline">{t('cc.final_cta2')}</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
