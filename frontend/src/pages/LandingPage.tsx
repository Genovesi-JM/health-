import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useT } from '../i18n/LanguageContext';
import {
  Activity, Stethoscope, Shield, Clock, Heart, Users,
  Zap, Lock, BarChart3, Smartphone, Globe, HeartPulse,
  Phone,
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

      {/* ── Hero (La Meva Salut style) ── */}
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
            </Link>
            <Link to="/about" className="landing-btn-secondary">
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

      {/* ── Services ── */}
      <section className="landing-section">
        <div className="section-header">
          <h2>{t('landing.services_title')}</h2>
          <p>{t('landing.services_subtitle')}</p>
        </div>
        <div className="landing-services-grid">
          {services.map(s => (
            <div className="landing-service-card" key={s.title}>
              <div className="landing-service-icon"><s.icon size={24} /></div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-section landing-section-alt">
        <div className="section-header">
          <h2>{t('landing.features_title')}</h2>
          <p>{t('landing.features_subtitle')}</p>
        </div>
        <div className="landing-features-grid">
          {features.map(f => (
            <div className="landing-feature-card" key={f.title}>
              <div className="landing-feature-icon"><f.icon size={22} /></div>
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

      {/* ── Emergency Bar (La Meva Salut style) ── */}
      <div className="emergency-bar">
        <a href="tel:112" className="emergency-bar-item emergency-bar-red">
          <Phone size={18} />
          <div>
            <span className="emergency-bar-number">112</span>
            <span className="emergency-bar-label">{t('landing.emergency_112')}</span>
          </div>
        </a>
        <a href="tel:061" className="emergency-bar-item emergency-bar-blue">
          <Phone size={18} />
          <div>
            <span className="emergency-bar-number">061</span>
            <span className="emergency-bar-label">{t('landing.emergency_061')}</span>
          </div>
        </a>
      </div>

      <Footer />
    </>
  );
}
