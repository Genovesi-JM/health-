import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Video, CheckCircle2, Clock, Shield, Wifi, Monitor, ArrowRight, Stethoscope, Brain, Heart, Activity, HeartPulse } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

export default function TeleconsultaPage() {
  const { t } = useT();
  const STEPS = [
    { num: '01', title: t('tele.s1_title'), desc: t('tele.s1_desc') },
    { num: '02', title: t('tele.s2_title'), desc: t('tele.s2_desc') },
    { num: '03', title: t('tele.s3_title'), desc: t('tele.s3_desc') },
    { num: '04', title: t('tele.s4_title'), desc: t('tele.s4_desc') },
  ];
  const SPECIALTIES_TELE = [
    { icon: Stethoscope, label: t('spec.clinica_geral') },
    { icon: Brain,       label: t('spec.psicologia') },
    { icon: Brain,       label: t('spec.psiquiatria') },
    { icon: Heart,       label: t('spec.ginecologia') },
    { icon: HeartPulse,  label: t('spec.cardiologia') },
    { icon: Activity,    label: t('spec.nutricao') },
  ];
  const BENEFITS = [
    { icon: Clock,    label: t('tele.b1_label'), desc: t('tele.b1_desc') },
    { icon: Shield,   label: t('tele.b2_label'), desc: t('tele.b2_desc') },
    { icon: Wifi,     label: t('tele.b3_label'), desc: t('tele.b3_desc') },
    { icon: Monitor,  label: t('tele.b4_label'), desc: t('tele.b4_desc') },
  ];
  return (
    <div className="landing-wrapper">
      <Navbar />

      <section className="lp-page-hero">
        <div className="lp-tag" style={{ background: 'rgba(8,145,178,0.12)', color: '#22d3ee' }}>{t('tele.tag')}</div>
        <h1>{t('tele.title')}</h1>
        <p>{t('tele.subtitle')}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/login" className="lp-cta lp-cta--secondary"><Video size={17} /> {t('tele.cta_start')}</Link>
          <Link to="/especialistas" className="lp-cta lp-cta--outline">{t('tele.cta_specialties')} <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">{t('tele.how_tag')}</div>
          <h2>{t('tele.how_title')}</h2>
        </div>
        <div className="lp-steps">
          {STEPS.map(s => (
            <div key={s.num} className="lp-step">
              <div className="lp-step__num" style={{ color: '#0891b2' }}>{s.num}</div>
              <div className="lp-step__icon" style={{ background: 'rgba(8,145,178,0.12)', color: '#0891b2' }}><Video size={22} /></div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">{t('tele.spec_tag')}</div>
          <h2>{t('tele.spec_title')}</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '700px', margin: '0 auto' }}>
          {SPECIALTIES_TELE.map(sp => (
            <div key={sp.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'rgba(8,145,178,0.06)', fontSize: '0.88rem', fontWeight: 500 }}>
              <sp.icon size={16} style={{ color: '#22d3ee' }} /> {sp.label}
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">{t('tele.adv_tag')}</div>
          <h2>{t('tele.adv_title')}</h2>
        </div>
        <div className="lp-trust-grid">
          {BENEFITS.map(b => (
            <div key={b.label} className="lp-trust-card">
              <b.icon size={22} style={{ color: '#0891b2' }} />
              <h4>{b.label}</h4>
              <p>{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <div className="lp-tag" style={{ display: 'inline-flex', marginBottom: '1rem' }}>{t('tele.cta_tag')}</div>
          <h2>{t('tele.final_title')}</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{t('tele.final_desc')}</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="lp-cta lp-cta--primary"><CheckCircle2 size={16} /> {t('tele.final_cta1')}</Link>
            <Link to="/login" className="lp-cta lp-cta--secondary"><Video size={16} /> {t('tele.final_cta2')}</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
