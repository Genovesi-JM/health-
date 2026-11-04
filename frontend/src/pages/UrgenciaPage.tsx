import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { AlertTriangle, Smartphone, Building2, CheckCircle2, Clock, ArrowRight, Phone, Activity, HeartPulse } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

export default function UrgenciaPage() {
  const { t } = useT();
  const steps = [
    { icon: Smartphone,    title: t('urg.s1_title'), desc: t('urg.s1_desc') },
    { icon: Activity,      title: t('urg.s2_title'), desc: t('urg.s2_desc') },
    { icon: AlertTriangle, title: t('urg.s3_title'), desc: t('urg.s3_desc') },
    { icon: Building2,     title: t('urg.s4_title'), desc: t('urg.s4_desc') },
    { icon: CheckCircle2,  title: t('urg.s5_title'), desc: t('urg.s5_desc') },
  ];
  const trust = [
    { icon: Clock,        label: t('urg.t1_label'), desc: t('urg.t1_desc') },
    { icon: HeartPulse,   label: t('urg.t2_label'), desc: t('urg.t2_desc') },
    { icon: Building2,    label: t('urg.t3_label'), desc: t('urg.t3_desc') },
    { icon: CheckCircle2, label: t('urg.t4_label'), desc: t('urg.t4_desc') },
  ];
  return (
    <div className="landing-wrapper">
      <Navbar />

      <section className="lp-page-hero" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(15,23,42,0) 60%)' }}>
        <div className="lp-tag" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
          <AlertTriangle size={13} /> {t('urg.tag')}
        </div>
        <h1>{t('urg.title1')}<br />{t('urg.title2')}</h1>
        <p>
          {t('urg.subtitle_pre')} <strong>{t('urg.subtitle_bold')}</strong>{t('urg.subtitle_post')}
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/login" className="lp-cta lp-cta--danger"><AlertTriangle size={16} /> {t('urg.cta1')}</Link>
          <Link to="/login" className="lp-cta lp-cta--outline"><Phone size={16} /> {t('urg.cta2')}</Link>
        </div>
      </section>

      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">{t('urg.flow_tag')}</div>
          <h2>{t('urg.flow_title')}</h2>
        </div>
        <div className="lp-steps" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {steps.map(s => (
            <div key={s.title} className="lp-step">
              <div className="lp-step__icon" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}><s.icon size={22} /></div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">{t('urg.why_tag')}</div>
          <h2>{t('urg.why_title')}</h2>
          <p>{t('urg.why_desc')}</p>
        </div>
        <div className="lp-trust-grid">
          {trust.map(tp => (
            <div key={tp.label} className="lp-trust-card">
              <tp.icon size={22} style={{ color: '#ef4444' }} />
              <h4>{tp.label}</h4>
              <p>{tp.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section lp-section--alt">
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <h2>{t('urg.final_title')}</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{t('urg.final_desc')}</p>
          <Link to="/register" className="lp-cta lp-cta--primary" style={{ display: 'inline-flex' }}>
            {t('urg.final_cta')} <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
