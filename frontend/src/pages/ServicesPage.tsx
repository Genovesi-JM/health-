import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/LanguageContext';
import {
  Activity, Stethoscope, FileText, HeartPulse, Building2, Layers,
  User, UserCog, Briefcase, Check, ChevronDown, ChevronUp, Phone,
} from 'lucide-react';
import { useState } from 'react';

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="landing-service-card" style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => setOpen(!open)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: 600, margin: 0 }}>{q}</h3>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </div>
      {open && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: '0.75rem', marginBottom: 0 }}>{a}</p>}
    </div>
  );
}

export default function ServicesPage() {
  const { t } = useT();

  const services = [
    { icon: Activity, title: t('services.triage_title'), desc: t('services.triage_desc'), color: '#00b894' },
    { icon: Stethoscope, title: t('services.teleconsult_title'), desc: t('services.teleconsult_desc'), color: '#0984e3' },
    { icon: FileText, title: t('services.prescriptions_title'), desc: t('services.prescriptions_desc'), color: '#6c5ce7' },
    { icon: HeartPulse, title: t('services.followup_title'), desc: t('services.followup_desc'), color: '#d63031' },
    { icon: Building2, title: t('services.corporate_title'), desc: t('services.corporate_desc'), color: '#e17055' },
    { icon: Layers, title: t('services.emergency_title'), desc: t('services.emergency_desc'), color: '#0984e3' },
  ];

  const audiences = [
    { icon: User, title: t('services.for_patients'), desc: t('services.for_patients_desc') },
    { icon: UserCog, title: t('services.for_doctors'), desc: t('services.for_doctors_desc') },
    { icon: Briefcase, title: t('services.for_companies'), desc: t('services.for_companies_desc') },
  ];

  const plans = [
    {
      name: t('services.plan_free'), price: t('services.plan_free_price'), popular: false,
      features: [t('services.plan_free_f1'), t('services.plan_free_f2'), t('services.plan_free_f3')],
    },
    {
      name: t('services.plan_pro'), price: t('services.plan_pro_price'), popular: true,
      features: [t('services.plan_pro_f1'), t('services.plan_pro_f2'), t('services.plan_pro_f3'), t('services.plan_pro_f4')],
    },
    {
      name: t('services.plan_enterprise'), price: t('services.plan_enterprise_price'), popular: false,
      features: [t('services.plan_enterprise_f1'), t('services.plan_enterprise_f2'), t('services.plan_enterprise_f3'), t('services.plan_enterprise_f4')],
    },
  ];

  const faqs = [
    { q: t('services.faq1_q'), a: t('services.faq1_a') },
    { q: t('services.faq2_q'), a: t('services.faq2_a') },
    { q: t('services.faq3_q'), a: t('services.faq3_a') },
    { q: t('services.faq4_q'), a: t('services.faq4_a') },
    { q: t('services.faq5_q'), a: t('services.faq5_a') },
  ];

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="landing-hero" style={{ minHeight: '45vh' }}>
        <div className="landing-hero-bg" />
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">{t('services.hero_title')}</h1>
          <p className="landing-hero-subtitle" style={{ maxWidth: '560px' }}>{t('services.hero_desc')}</p>
        </div>
      </section>

      {/* Services Grid */}
      <section className="landing-section">
        <div className="landing-services-grid">
          {services.map(s => (
            <div className="landing-service-card" key={s.title}>
              <div className="landing-service-icon" style={{ color: s.color }}><s.icon size={24} /></div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* For whom */}
      <section className="landing-section landing-section-alt">
        <div className="landing-steps-grid">
          {audiences.map(a => (
            <div className="landing-step-card" key={a.title}>
              <div className="landing-step-icon"><a.icon size={28} /></div>
              <h3>{a.title}</h3>
              <p>{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="landing-section">
        <div className="section-header">
          <h2>{t('services.pricing_title')}</h2>
          <p>{t('services.pricing_subtitle')}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', maxWidth: '960px', margin: '0 auto' }}>
          {plans.map(plan => (
            <div key={plan.name} style={{
              background: 'var(--bg-card)', borderRadius: '16px', padding: '2rem 1.5rem',
              border: plan.popular ? '2px solid var(--accent-teal)' : '1px solid var(--border)',
              position: 'relative', display: 'flex', flexDirection: 'column',
            }}>
              {plan.popular && (
                <span style={{
                  position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--accent-teal)', color: '#fff', fontSize: '0.72rem', fontWeight: 700,
                  padding: '0.25rem 0.85rem', borderRadius: '99px', letterSpacing: '0.05em',
                }}>{t('services.most_popular')}</span>
              )}
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>{plan.name}</h3>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-teal)', marginBottom: '1.25rem' }}>{plan.price}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', flex: 1 }}>
                {plan.features.map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
                    <Check size={15} style={{ color: 'var(--accent-teal)', flexShrink: 0 }} /> {f}
                  </li>
                ))}
              </ul>
              <Link to="/register" className={plan.popular ? 'landing-btn-primary' : 'landing-btn-secondary'} style={{ textAlign: 'center', width: '100%', display: 'block' }}>
                {plan.name === t('services.plan_enterprise') ? t('services.contact_us') : t('services.select_plan')}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="landing-section landing-section-alt">
        <div className="section-header">
          <h2>{t('services.faq_title')}</h2>
        </div>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {faqs.map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} />)}
        </div>
      </section>

      {/* Emergency */}
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
