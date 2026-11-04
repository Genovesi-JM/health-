import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Building2, TrendingUp, Calendar, Video, Activity,
  Shield, Clock, Users, ArrowRight,
  BarChart2, Zap, FileText, Mail, Stethoscope,
  Banknote, Smartphone, HeartPulse, UserCheck, Globe,
} from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

export default function ClinicsPage() {
  const { t } = useT();
  const DOCTOR_BENEFITS = [
    { icon: Banknote,   color: '#0d9488', title: t('clin.db1_title'), desc: t('clin.db1_desc') },
    { icon: Calendar,   color: '#2563eb', title: t('clin.db2_title'), desc: t('clin.db2_desc') },
    { icon: Smartphone, color: '#7c3aed', title: t('clin.db3_title'), desc: t('clin.db3_desc') },
    { icon: Globe,      color: '#d97706', title: t('clin.db4_title'), desc: t('clin.db4_desc') },
    { icon: UserCheck,  color: '#059669', title: t('clin.db5_title'), desc: t('clin.db5_desc') },
    { icon: HeartPulse, color: '#dc2626', title: t('clin.db6_title'), desc: t('clin.db6_desc') },
  ];
  const CLINIC_BENEFITS = [
    { icon: Calendar,  color: '#0d9488', title: t('clin.cb1_title'), desc: t('clin.cb1_desc') },
    { icon: Clock,     color: '#0891b2', title: t('clin.cb2_title'), desc: t('clin.cb2_desc') },
    { icon: Video,     color: '#7c3aed', title: t('clin.cb3_title'), desc: t('clin.cb3_desc') },
    { icon: BarChart2, color: '#d97706', title: t('clin.cb4_title'), desc: t('clin.cb4_desc') },
    { icon: Users,     color: '#059669', title: t('clin.cb5_title'), desc: t('clin.cb5_desc') },
    { icon: Shield,    color: '#0d9488', title: t('clin.cb6_title'), desc: t('clin.cb6_desc') },
  ];
  const WHO = [
    { icon: Stethoscope, color: '#0d9488', label: t('clin.w1_label'), desc: t('clin.w1_desc') },
    { icon: Activity,    color: '#2563eb', label: t('clin.w2_label'), desc: t('clin.w2_desc') },
    { icon: HeartPulse,  color: '#7c3aed', label: t('clin.w3_label'), desc: t('clin.w3_desc') },
    { icon: BarChart2,   color: '#d97706', label: t('clin.w4_label'), desc: t('clin.w4_desc') },
    { icon: UserCheck,   color: '#059669', label: t('clin.w5_label'), desc: t('clin.w5_desc') },
    { icon: Building2,   color: '#dc2626', label: t('clin.w6_label'), desc: t('clin.w6_desc') },
  ];
  const PROCESS = [
    { step: '01', icon: Mail,       color: '#0d9488', title: t('clin.p1_title'), desc: t('clin.p1_desc') },
    { step: '02', icon: FileText,   color: '#0891b2', title: t('clin.p2_title'), desc: t('clin.p2_desc') },
    { step: '03', icon: Zap,        color: '#7c3aed', title: t('clin.p3_title'), desc: t('clin.p3_desc') },
    { step: '04', icon: TrendingUp, color: '#d97706', title: t('clin.p4_title'), desc: t('clin.p4_desc') },
  ];
  return (
    <div className="landing-wrapper">
      <Navbar />

      {/* ── Hero ── */}
      <section className="lp-page-hero">
        <div className="lp-tag"><Stethoscope size={12} /> {t('clin.tag')}</div>
        <h1>{t('clin.title1')}<br /><span className="lp-hero__accent">{t('clin.title2')}</span></h1>
        <p>
          {t('clin.subtitle')}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <a href="mailto:parcerias@kaya.ao" className="lp-cta lp-cta--primary">
            <Stethoscope size={15} /> {t('clin.cta_apply_doctor')}
          </a>
          <Link to="/contacto" className="lp-cta lp-cta--secondary">
            <Building2 size={15} /> {t('clin.cta_register_clinic')}
          </Link>
        </div>
        <p style={{ marginTop: '1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {t('clin.hero_note')}
        </p>
      </section>

      {/* ── Para médicos individuais ── */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag" style={{ background: 'rgba(15,118,110,0.1)', color: '#0d9488' }}>
            <Stethoscope size={11} /> {t('clin.ind_tag')}
          </div>
          <h2>{t('clin.ind_title')}</h2>
          <p>
            {t('clin.ind_desc')}
          </p>
        </div>
        <div className="feat-grid">
          {DOCTOR_BENEFITS.map(b => (
            <div key={b.title} className="feat-card hover-lift">
              <div className="feat-icon" style={{ background: `${b.color}15`, color: b.color }}>
                <b.icon size={22} />
              </div>
              <div>
                <h3 className="feat-title">{b.title}</h3>
                <p className="feat-desc">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <a href="mailto:parcerias@kaya.ao" className="lp-cta lp-cta--primary" style={{ display: 'inline-flex' }}>
            <Stethoscope size={15} /> {t('clin.db_cta')} <ArrowRight size={14} />
          </a>
        </div>
      </section>

      {/* ── Para clínicas e instituições ── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag"><Building2 size={11} /> {t('clin.cb_tag')}</div>
          <h2>{t('clin.cb_title')}</h2>
          <p>{t('clin.cb_desc')}</p>
        </div>
        <div className="feat-grid">
          {CLINIC_BENEFITS.map(b => (
            <div key={b.title} className="feat-card">
              <div className="feat-icon" style={{ background: `${b.color}15`, color: b.color }}>
                <b.icon size={22} />
              </div>
              <div>
                <h3 className="feat-title">{b.title}</h3>
                <p className="feat-desc">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Quem pode candidatar-se ── */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">{t('clin.who_tag')}</div>
          <h2>{t('clin.who_title')}</h2>
          <p>{t('clin.who_desc')}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', maxWidth: 860, margin: '0 auto' }}>
          {WHO.map(c => (
            <div key={c.label} className="card hover-lift" style={{ borderTop: `3px solid ${c.color}` }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${c.color}12`, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <c.icon size={20} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.35rem' }}>{c.label}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Processo ── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">{t('clin.proc_tag')}</div>
          <h2>{t('clin.proc_title')}</h2>
          <p>{t('clin.proc_desc')}</p>
        </div>
        <div className="journey-steps">
          {PROCESS.map(s => (
            <div key={s.step} className="journey-step">
              <div className="journey-num" style={{ color: s.color }}>{s.step}</div>
              <div className="journey-icon" style={{ background: `${s.color}18`, color: s.color }}>
                <s.icon size={24} />
              </div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="lp-final-cta">
        <div className="lp-tag" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>{t('clin.final_tag')}</div>
        <h2>{t('clin.final_title')}</h2>
        <p>{t('clin.final_desc')}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <a href="mailto:parcerias@kaya.ao" className="lp-cta lp-cta--white">
            <Stethoscope size={15} /> parcerias@kaya.ao
          </a>
          <Link to="/contacto" className="lp-cta lp-cta--white-outline">
            {t('clin.final_form')} <ArrowRight size={14} />
          </Link>
        </div>
        <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', opacity: 0.7 }}>{t('clin.final_note')}</p>
      </section>

      <Footer />
    </div>
  );
}
