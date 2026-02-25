import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Heart, Target, Eye, Code2, Stethoscope, Headphones, Users, FileCheck, Clock, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/LanguageContext';

export default function AboutPage() {
  const { t } = useT();

  const timeline = [
    { period: 'Q1 2024', text: t('about.timeline_2024_q1') },
    { period: 'Q3 2024', text: t('about.timeline_2024_q3') },
    { period: 'Q1 2025', text: t('about.timeline_2025_q1') },
    { period: 'Q4 2025', text: t('about.timeline_2025_q4') },
  ];

  const teamAreas = [
    { icon: Code2, title: t('about.team_dev'), desc: t('about.team_dev_desc') },
    { icon: Stethoscope, title: t('about.team_clinical'), desc: t('about.team_clinical_desc') },
    { icon: Headphones, title: t('about.team_ops'), desc: t('about.team_ops_desc') },
  ];

  const numbers = [
    { icon: Users, value: '150+', label: t('landing.stat_patients') },
    { icon: Stethoscope, value: '25+', label: t('landing.stat_doctors') },
    { icon: FileCheck, value: '2.5K+', label: 'Triagens' },
    { icon: Clock, value: '<3 min', label: 'Tempo médio' },
    { icon: Globe, value: '3', label: 'Idiomas' },
    { icon: Heart, value: '98%', label: t('landing.stat_satisfaction') },
  ];

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="landing-hero" style={{ minHeight: '55vh' }}>
        <div className="landing-hero-bg" />
        <div className="landing-hero-content">
          <div className="landing-hero-icon" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Heart size={40} />
          </div>
          <p style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', marginBottom: '0.5rem' }}>
            {t('about.badge')}
          </p>
          <h1 className="landing-hero-title">
            {t('about.hero_title1')} <span style={{ color: 'var(--accent-teal)' }}>{t('about.hero_title2')}</span>
          </h1>
          <p className="landing-hero-subtitle" style={{ maxWidth: '600px' }}>{t('about.hero_desc')}</p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="landing-section">
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
          <div className="landing-service-card" style={{ textAlign: 'left' }}>
            <div className="landing-service-icon"><Target size={24} /></div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--accent-teal)' }}>{t('about.mission')}</h3>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>{t('about.mission_desc')}</p>
          </div>
          <div className="landing-service-card" style={{ textAlign: 'left' }}>
            <div className="landing-service-icon"><Eye size={24} /></div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--accent-teal)' }}>{t('about.vision')}</h3>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>{t('about.vision_desc')}</p>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="landing-section landing-section-alt">
        <div className="section-header">
          <h2>{t('about.timeline_title')}</h2>
          <p>{t('about.timeline_subtitle')}</p>
        </div>
        <div style={{ maxWidth: '720px', margin: '0 auto', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', background: 'var(--accent-teal)', opacity: 0.25, transform: 'translateX(-50%)' }} />
          {timeline.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '1.5rem', marginBottom: '2rem',
              flexDirection: i % 2 === 0 ? 'row' : 'row-reverse', textAlign: i % 2 === 0 ? 'right' : 'left',
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'inline-block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-teal)', background: 'rgba(0,184,148,0.1)', padding: '0.25rem 0.75rem', borderRadius: '99px', marginBottom: '0.5rem' }}>
                  {item.period}
                </span>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{item.text}</p>
              </div>
              <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'var(--accent-teal)', border: '3px solid var(--bg-card)', flexShrink: 0, marginTop: '0.25rem', zIndex: 1 }} />
              <div style={{ flex: 1 }} />
            </div>
          ))}
        </div>
      </section>

      {/* Team Areas */}
      <section className="landing-section">
        <div className="section-header">
          <h2>{t('about.team_title')}</h2>
          <p>{t('about.team_subtitle')}</p>
        </div>
        <div className="landing-steps-grid">
          {teamAreas.map(area => (
            <div className="landing-step-card" key={area.title}>
              <div className="landing-step-icon"><area.icon size={28} /></div>
              <h3>{area.title}</h3>
              <p>{area.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Numbers */}
      <section className="landing-section landing-section-alt">
        <div className="section-header">
          <h2>{t('about.numbers_title')}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
          {numbers.map(n => (
            <div key={n.label} style={{ textAlign: 'center', padding: '1.5rem 0.75rem' }}>
              <n.icon size={24} style={{ color: 'var(--accent-teal)', marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>{n.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{n.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta">
        <h2>{t('about.cta_title')}</h2>
        <p>{t('about.cta_desc')}</p>
        <div className="landing-cta-actions">
          <Link to="/register" className="landing-btn-primary">{t('about.create_account')}</Link>
          <Link to="/login" className="landing-btn-secondary">{t('landing.have_account')}</Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
