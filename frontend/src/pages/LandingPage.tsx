import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useT } from '../i18n/LanguageContext';
import {
  HeartPulse, ClipboardCheck, Stethoscope, ArrowRight,
  Phone, UserPlus, Star, Quote, Heart, Brain,
  Activity, Pill, Wind, Smile,
} from 'lucide-react';

export default function LandingPage() {
  const { t } = useT();

  const stats = [
    { value: '150+', label: t('landing.stat_patients') },
    { value: '25+', label: t('landing.stat_doctors') },
    { value: '98%', label: t('landing.stat_satisfaction') },
    { value: '15+', label: t('landing.stat_available') },
  ];

  const steps = [
    { icon: UserPlus, num: '01', title: t('landing.step1_title'), desc: t('landing.step1_desc') },
    { icon: ClipboardCheck, num: '02', title: t('landing.step2_title'), desc: t('landing.step2_desc') },
    { icon: Stethoscope, num: '03', title: t('landing.step3_title'), desc: t('landing.step3_desc') },
  ];

  const testimonials = [
    { text: t('landing.testimonial1'), author: t('landing.testimonial1_author'), stars: 5 },
    { text: t('landing.testimonial2'), author: t('landing.testimonial2_author'), stars: 5 },
    { text: t('landing.testimonial3'), author: t('landing.testimonial3_author'), stars: 5 },
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
            <span className="landing-stat-value">{s.value}</span>
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
            { icon: Activity, label: t('landing.spec_endocrinology') },
            { icon: Wind, label: t('landing.spec_pulmonology') },
            { icon: Smile, label: t('landing.spec_dermatology') },
            { icon: Brain, label: t('landing.spec_neurology') },
            { icon: ClipboardCheck, label: t('landing.spec_orthopedics') },
            { icon: HeartPulse, label: t('landing.spec_psychiatry') },
            { icon: Stethoscope, label: t('landing.spec_general') },
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
            { icon: Activity, title: t('landing.chronic_diabetes'), desc: t('landing.chronic_diabetes_desc'), color: '#0984e3' },
            { icon: Heart, title: t('landing.chronic_hypertension'), desc: t('landing.chronic_hypertension_desc'), color: '#d63031' },
            { icon: Wind, title: t('landing.chronic_asthma'), desc: t('landing.chronic_asthma_desc'), color: '#00b894' },
            { icon: Brain, title: t('landing.chronic_mental'), desc: t('landing.chronic_mental_desc'), color: '#6c5ce7' },
          ].map(c => (
            <div className="landing-service-card" key={c.title}>
              <div className="landing-service-icon" style={{ color: c.color }}><c.icon size={24} /></div>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="landing-section landing-section-alt">
        <div className="section-header">
          <h2>{t('landing.trust_title')}</h2>
        </div>
        <div className="landing-testimonials-grid">
          {testimonials.map((tm, i) => (
            <div className="landing-testimonial-card" key={i}>
              <Quote size={24} className="landing-quote-icon" />
              <p className="landing-testimonial-text">{tm.text}</p>
              <div className="landing-testimonial-stars">
                {[...Array(tm.stars)].map((_, j) => <Star key={j} size={14} fill="var(--accent-teal)" color="var(--accent-teal)" />)}
              </div>
              <span className="landing-testimonial-author">{tm.author}</span>
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

      {/* ── Emergency Bar ── */}
      <div className="emergency-bar">
        <a href="tel:112" className="emergency-bar-item emergency-bar-red">
          <Phone size={18} />
          <div>
            <span className="emergency-bar-number">112</span>
            <span className="emergency-bar-label">{t('landing.emergency_112')}</span>
          </div>
        </a>
        <a href="tel:808242424" className="emergency-bar-item emergency-bar-blue">
          <Phone size={18} />
          <div>
            <span className="emergency-bar-number">SNS 24</span>
            <span className="emergency-bar-label">{t('landing.emergency_061')}</span>
          </div>
        </a>
      </div>

      <Footer />
    </>
  );
}
