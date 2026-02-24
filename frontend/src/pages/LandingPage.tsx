import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useT } from '../i18n/LanguageContext';
import {
  Activity, Stethoscope, Shield, Clock, Heart, Users,
  Zap, Lock, BarChart3, Smartphone, Globe, HeartPulse,
} from 'lucide-react';

export default function LandingPage() {
  const { t } = useT();

  const services = [
    { icon: Activity, title: t('landing.svc.triage'), desc: t('landing.svc.triage_desc') },
    { icon: Stethoscope, title: t('landing.svc.teleconsult'), desc: t('landing.svc.teleconsult_desc') },
    { icon: Shield, title: t('landing.svc.prescriptions'), desc: t('landing.svc.prescriptions_desc') },
    { icon: Clock, title: t('landing.svc.followup'), desc: t('landing.svc.followup_desc') },
    { icon: Users, title: t('landing.svc.corporate'), desc: t('landing.svc.corporate_desc') },
    { icon: HeartPulse, title: t('landing.svc.emergency'), desc: t('landing.svc.emergency_desc') },
  ];

  const features = [
    { icon: Zap, title: t('landing.feat.immediate'), desc: t('landing.feat.immediate_desc') },
    { icon: Lock, title: t('landing.feat.secure'), desc: t('landing.feat.secure_desc') },
    { icon: BarChart3, title: t('landing.feat.analytics'), desc: t('landing.feat.analytics_desc') },
    { icon: Smartphone, title: t('landing.feat.universal'), desc: t('landing.feat.universal_desc') },
    { icon: Globe, title: t('landing.feat.coverage'), desc: t('landing.feat.coverage_desc') },
    { icon: Heart, title: t('landing.feat.humanized'), desc: t('landing.feat.humanized_desc') },
  ];

  const stats = [
    { value: '150+', label: t('landing.stat_patients') },
    { value: '25+', label: t('landing.stat_doctors') },
    { value: '98%', label: t('landing.stat_satisfaction') },
    { value: '24/7', label: t('landing.stat_available') },
  ];

  return (
    <>
      <Navbar />

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            <HeartPulse size={14} /> {t('landing.badge')}
          </div>
          <h1>
            {t('landing.hero_title1')}<br />
            <span className="gradient-text">{t('landing.hero_title2')}</span>
          </h1>
          <p>{t('landing.hero_desc')}</p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary btn-lg">{t('landing.start_now')}</Link>
            <Link to="/about" className="btn btn-outline btn-lg">{t('landing.learn_more')}</Link>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            {stats.map(s => (
              <div className="stat-item" key={s.label}>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section className="section" style={{ background: 'var(--bg-darker)' }}>
        <div className="section-header">
          <h2>{t('landing.services_title')}</h2>
          <p>{t('landing.services_subtitle')}</p>
        </div>
        <div className="services-grid">
          {services.map(s => (
            <div className="service-card" key={s.title}>
              <div className="service-card-icon"><s.icon size={22} /></div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="section">
        <div className="section-header">
          <h2>{t('landing.features_title')}</h2>
          <p>{t('landing.features_subtitle')}</p>
        </div>
        <div className="features-grid">
          {features.map(f => (
            <div className="feature-card" key={f.title}>
              <div className="feature-card-icon"><f.icon size={22} /></div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <h2>{t('landing.cta_title')}</h2>
        <p>{t('landing.cta_desc')}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" className="btn btn-primary btn-lg">{t('landing.create_free')}</Link>
          <Link to="/login" className="btn btn-outline btn-lg">{t('landing.have_account')}</Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
