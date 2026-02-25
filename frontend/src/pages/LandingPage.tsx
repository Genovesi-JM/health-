import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useT } from '../i18n/LanguageContext';
import {
  HeartPulse, ClipboardCheck, Stethoscope, ArrowRight,
  UserPlus, Heart, Brain,
  Activity, Pill, Wind, Smile, Shield, Droplets,
  MapPin, CalendarCheck, Zap,
} from 'lucide-react';

export default function LandingPage() {
  const { t } = useT();

  const stats = [
    { label: t('landing.stat_patients') },
    { label: t('landing.stat_doctors') },
    { label: t('landing.stat_satisfaction') },
    { label: t('landing.stat_available') },
  ];

  const steps = [
    { icon: UserPlus, num: '01', title: t('landing.step1_title'), desc: t('landing.step1_desc') },
    { icon: ClipboardCheck, num: '02', title: t('landing.step2_title'), desc: t('landing.step2_desc') },
    { icon: Stethoscope, num: '03', title: t('landing.step3_title'), desc: t('landing.step3_desc') },
  ];

  const features = [
    { icon: MapPin, title: t('landing.feature1_title'), desc: t('landing.feature1_desc') },
    { icon: CalendarCheck, title: t('landing.feature2_title'), desc: t('landing.feature2_desc') },
    { icon: HeartPulse, title: t('landing.feature3_title'), desc: t('landing.feature3_desc') },
  ];

  return (
    <>
      <Navbar />

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-bg" />
        <div className="landing-hero-content">
          <div className="landing-hero-icon">
            <HeartPulse size={48} />
          </div>
          <h1 className="landing-hero-title">Health Platform</h1>
          <p className="landing-hero-subtitle">{t('landing.hero_desc')}</p>
          <div className="landing-hero-actions">
            <Link to="/login" className="landing-btn-primary">
              {t('landing.enter')}
              <ArrowRight size={16} />
            </Link>
            <Link to="/services" className="landing-btn-secondary">
              {t('landing.discover_services')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="landing-stats-strip">
        {stats.map(s => (
          <div className="landing-stat" key={s.label}>
            <span className="landing-stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* ── How it works (3 steps) ── */}
      <section className="landing-section">
        <div className="section-header">
          <h2>{t('landing.highlights_title')}</h2>
          <p>{t('landing.highlights_subtitle')}</p>
        </div>
        <div className="landing-steps-grid">
          {steps.map((s, i) => (
            <div className="landing-step-card" key={s.num}>
              <div className="landing-step-num">{s.num}</div>
              <div className="landing-step-icon"><s.icon size={28} /></div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              {i < steps.length - 1 && <div className="landing-step-arrow"><ArrowRight size={20} /></div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── Specialties Strip ── */}
      <section className="landing-section landing-section-alt">
        <div className="section-header">
          <h2>{t('landing.specialties_title')}</h2>
          <p>{t('landing.specialties_subtitle')}</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', maxWidth: '900px', margin: '0 auto' }}>
          {[
            { icon: Heart, label: t('landing.spec_cardiology') },
            { icon: Stethoscope, label: t('landing.spec_endocrinology') },
            { icon: Shield, label: t('landing.spec_pulmonology') },
            { icon: Droplets, label: t('landing.spec_dermatology') },
            { icon: Wind, label: t('landing.spec_neurology') },
            { icon: Activity, label: t('landing.spec_orthopedics') },
            { icon: Pill, label: t('landing.spec_psychiatry') },
            { icon: HeartPulse, label: t('landing.spec_general') },
          ].map(s => (
            <div key={s.label} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '99px', padding: '0.5rem 1rem',
              fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)',
              transition: 'all 0.2s',
            }}>
              <s.icon size={16} style={{ color: 'var(--accent-teal)' }} />
              {s.label}
            </div>
          ))}
          <div style={{
            display: 'flex', alignItems: 'center',
            background: 'var(--gradient-primary)', borderRadius: '99px',
            padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#fff',
          }}>
            {t('landing.spec_more')}
          </div>
        </div>
      </section>

      {/* ── Chronic Diseases ── */}
      <section className="landing-section">
        <div className="section-header">
          <h2>{t('landing.chronic_title')}</h2>
          <p>{t('landing.chronic_subtitle')}</p>
        </div>
        <div className="landing-services-grid">
          {[
            { icon: Activity, title: t('landing.chronic_diabetes'), desc: t('landing.chronic_diabetes_desc'), color: '#e17055' },
            { icon: Heart, title: t('landing.chronic_hypertension'), desc: t('landing.chronic_hypertension_desc'), color: '#d63031' },
            { icon: Wind, title: t('landing.chronic_asthma'), desc: t('landing.chronic_asthma_desc'), color: '#6c5ce7' },
            { icon: Zap, title: t('landing.chronic_mental'), desc: t('landing.chronic_mental_desc'), color: '#0984e3' },
          ].map(c => (
            <div className="landing-service-card" key={c.title}>
              <div className="landing-service-icon" style={{ color: c.color }}><c.icon size={24} /></div>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-section landing-section-alt">
        <div className="section-header">
          <h2>{t('landing.trust_title')}</h2>
        </div>
        <div className="landing-services-grid">
          {features.map((f, i) => (
            <div className="landing-service-card" key={i}>
              <div className="landing-service-icon" style={{ color: 'var(--accent-teal)' }}><f.icon size={24} /></div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="landing-cta">
        <h2>{t('landing.cta_title')}</h2>
        <p>{t('landing.cta_desc')}</p>
        <div className="landing-cta-actions">
          <Link to="/register" className="landing-btn-primary">{t('landing.create_free')}</Link>
          <Link to="/login" className="landing-btn-secondary">{t('landing.have_account')}</Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
