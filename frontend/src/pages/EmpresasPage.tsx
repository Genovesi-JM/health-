import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Building2, Users, TrendingUp, Shield, RefreshCw, Clock, CheckCircle2, ArrowRight, Mail } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

export default function EmpresasPage() {
  const { t } = useT();
  const FEATURES = [
    { icon: Users,        title: t('emp.f1_title'), desc: t('emp.f1_desc') },
    { icon: TrendingUp,   title: t('emp.f2_title'), desc: t('emp.f2_desc') },
    { icon: RefreshCw,    title: t('emp.f3_title'), desc: t('emp.f3_desc') },
    { icon: Shield,       title: t('emp.f4_title'), desc: t('emp.f4_desc') },
    { icon: Clock,        title: t('emp.f5_title'), desc: t('emp.f5_desc') },
    { icon: CheckCircle2, title: t('emp.f6_title'), desc: t('emp.f6_desc') },
  ];
  const PLANS = [
    { label: 'Start',      employees: `${t('emp.up_to')} 20`,  price: t('emp.price_ondemand'), features: [t('emp.plan_start_f1'), t('emp.plan_start_f2'), t('emp.plan_start_f3')] },
    { label: 'Business',   employees: `${t('emp.up_to')} 100`, price: t('emp.price_ondemand'), features: [t('emp.plan_biz_f1'), t('emp.plan_biz_f2'), t('emp.plan_biz_f3'), t('emp.plan_biz_f4')], featured: true },
    { label: 'Enterprise', employees: '100+',    price: t('emp.price_ondemand'), features: [t('emp.plan_ent_f1'), t('emp.plan_ent_f2'), t('emp.plan_ent_f3'), t('emp.plan_ent_f4'), t('emp.plan_ent_f5')] },
  ];
  return (
    <div className="landing-wrapper">
      <Navbar />

      <section className="lp-page-hero" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(15,23,42,0) 60%)' }}>
        <div className="lp-tag" style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa' }}><Building2 size={13} /> {t('emp.tag')}</div>
        <h1>{t('emp.title1')}<br />{t('emp.title2')}</h1>
        <p>{t('emp.subtitle')}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <a href="mailto:empresas@kaya.ao" className="lp-cta lp-cta--secondary"><Mail size={16} /> {t('emp.cta_talk')}</a>
          <Link to="/contacto" className="lp-cta lp-cta--outline">{t('emp.cta_contact')} <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">{t('emp.feat_tag')}</div>
          <h2>{t('emp.feat_title')}</h2>
          <p>{t('emp.feat_desc')}</p>
        </div>
        <div className="lp-b2b-grid" style={{ maxWidth: '800px', margin: '0 auto' }}>
          {FEATURES.map(f => (
            <div key={f.title} className="lp-b2b-card">
              <f.icon size={22} style={{ color: '#7c3aed' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{f.title}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">{t('emp.plans_tag')}</div>
          <h2>{t('emp.plans_title')}</h2>
          <p>{t('emp.plans_desc')}</p>
        </div>
        <div className="lp-pricing" style={{ maxWidth: '900px', margin: '0 auto' }}>
          {PLANS.map(p => (
            <div key={p.label} className={`lp-price-card${p.featured ? ' lp-price-card--featured' : ''}`}>
              <div className="lp-price-label">{p.label}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{p.employees} {t('emp.employees')}</div>
              <div className="lp-price-amount">{p.price}</div>
              <ul>{p.features.map(f => (<li key={f}><CheckCircle2 size={13} style={{ color: p.featured ? '#fff' : '#7c3aed' }} /> {f}</li>))}</ul>
              <a href="mailto:empresas@kaya.ao" className="lp-price-cta" style={p.featured ? { background: '#fff', color: '#7c3aed' } : { background: '#7c3aed', color: '#fff' }}>
                {t('emp.request_quote')}
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section lp-section--alt">
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <h2>{t('emp.final_title')}</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{t('emp.final_desc')}</p>
          <a href="mailto:empresas@kaya.ao" className="lp-cta lp-cta--secondary" style={{ display: 'inline-flex' }}><Mail size={16} /> empresas@kaya.ao</a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
