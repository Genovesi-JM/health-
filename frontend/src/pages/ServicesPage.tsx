import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/LanguageContext';
import {
  Activity, Stethoscope, FileText, HeartPulse, Building2, Layers,
  User, UserCog, Briefcase, ChevronDown, ChevronUp,
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

      {/* FAQ */}
      <section className="landing-section landing-section-alt">
        <div className="section-header">
          <h2>{t('services.faq_title')}</h2>
        </div>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {faqs.map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} />)}
        </div>
      </section>

      <Footer />
    </>
  );
}
