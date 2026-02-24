import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Heart, Shield, Users, Award, Target, Lightbulb } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/LanguageContext';

export default function AboutPage() {
  const { t } = useT();

  const values = [
    { icon: Heart, title: t('about.val.patient_care'), desc: t('about.val.patient_care_desc') },
    { icon: Shield, title: t('about.val.security'), desc: t('about.val.security_desc') },
    { icon: Users, title: t('about.val.inclusion'), desc: t('about.val.inclusion_desc') },
    { icon: Award, title: t('about.val.excellence'), desc: t('about.val.excellence_desc') },
    { icon: Target, title: t('about.val.innovation'), desc: t('about.val.innovation_desc') },
    { icon: Lightbulb, title: t('about.val.transparency'), desc: t('about.val.transparency_desc') },
  ];

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="hero" style={{ minHeight: '65vh' }}>
        <div className="hero-content">
          <div className="hero-badge">
            <Heart size={14} /> {t('about.badge')}
          </div>
          <h1>
            {t('about.hero_title1')}<br />
            <span className="gradient-text">{t('about.hero_title2')}</span>
          </h1>
          <p>{t('about.hero_desc')}</p>
        </div>
      </section>

      {/* Mission */}
      <section className="section" style={{ background: 'var(--bg-darker)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            <div className="card">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                <span className="gradient-text">{t('about.mission')}</span>
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {t('about.mission_desc')}
              </p>
            </div>
            <div className="card">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                <span className="gradient-text">{t('about.vision')}</span>
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {t('about.vision_desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section">
        <div className="section-header">
          <h2>{t('about.values_title')}</h2>
          <p>{t('about.values_subtitle')}</p>
        </div>
        <div className="features-grid">
          {values.map(v => (
            <div className="feature-card" key={v.title}>
              <div className="feature-card-icon"><v.icon size={22} /></div>
              <h3>{v.title}</h3>
              <p>{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <h2>{t('about.cta_title')}</h2>
        <p>{t('about.cta_desc')}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" className="btn btn-primary btn-lg">{t('about.create_account')}</Link>
          <Link to="/login" className="btn btn-outline btn-lg">{t('nav.portal')}</Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
