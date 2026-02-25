import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useT } from '../i18n/LanguageContext';
import {
  HeartPulse, ClipboardCheck, Stethoscope, ArrowRight,
  Phone, UserPlus, Star, Quote,
} from 'lucide-react';

export default function LandingPage() {
  const { t } = useT();

  const stats = [
    { value: '150+', label: t('landing.stat_patients') },
    { value: '25+', label: t('landing.stat_doctors') },
    { value: '98%', label: t('landing.stat_satisfaction') },
    { value: '24/7', label: t('landing.stat_available') },
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
