import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  HeartPulse, Calendar, Video, RefreshCw, Search,
  Activity, ArrowRight, CheckCircle2, Shield, Zap,
  Stethoscope, Users, Building2, Phone,
  Clock, ChevronRight, Heart, Pill, AlertTriangle,
  TrendingUp, Lock, Smartphone, MonitorSmartphone,
  Baby, Brain, Eye, Bone, Apple, Wind,
} from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

const AUDIENCES = [
  { key: 'pacientes',     labelKey: 'lp.aud_patients',    icon: '🧑‍⚕️', color: '#0d9488', imgColor: '#f0fdf9' },
  { key: 'medicos',       labelKey: 'lp.aud_doctors',     icon: '👨‍⚕️', color: '#2563eb', imgColor: '#eff6ff' },
  { key: 'especialistas', labelKey: 'lp.aud_specialists', icon: '🔬',   color: '#7c3aed', imgColor: '#f5f3ff' },
  { key: 'clinicas',      labelKey: 'lp.aud_clinics',     icon: '🏥',   color: '#0891b2', imgColor: '#ecfeff' },
  { key: 'dispositivos',  labelKey: 'lp.aud_devices',     icon: '📱',   color: '#ea580c', imgColor: '#fff7ed' },
];

export default function LandingPage() {
  const { t } = useT();
  const SPECIALTIES = [
    { icon: Stethoscope, label: t('spec.clinica_geral'), color: '#0d9488' },
    { icon: Baby,        label: t('spec.pediatria'),     color: '#0891b2' },
    { icon: Heart,       label: t('spec.ginecologia'),   color: '#db2777' },
    { icon: HeartPulse,  label: t('spec.cardiologia'),   color: '#dc2626' },
    { icon: Activity,    label: t('spec.dermatologia'),  color: '#ea580c' },
    { icon: Brain,       label: t('spec.psicologia'),    color: '#7c3aed' },
    { icon: Brain,       label: t('spec.psiquiatria'),   color: '#6d28d9' },
    { icon: Eye,         label: t('spec.oftalmologia'),  color: '#0369a1' },
    { icon: Stethoscope, label: t('esp.dentaria'),       color: '#0891b2' },
    { icon: Wind,        label: t('spec.fisioterapia'),  color: '#059669' },
    { icon: Activity,    label: t('spec.neurologia'),    color: '#4f46e5' },
    { icon: Bone,        label: t('spec.ortopedia'),     color: '#b45309' },
    { icon: Apple,       label: t('spec.nutricao'),      color: '#16a34a' },
  ];
  const HOW_STEPS = [
    { num: '01', icon: Search,     title: t('lp.h1_title'), desc: t('lp.h1_desc'), color: '#0d9488' },
    { num: '02', icon: Video,      title: t('lp.h2_title'), desc: t('lp.h2_desc'), color: '#0891b2' },
    { num: '03', icon: HeartPulse, title: t('lp.h3_title'), desc: t('lp.h3_desc'), color: '#7c3aed' },
  ];
  const PREMIUM_PLANS = [
    { icon: Users,     label: t('lp.pp1_label'), color: '#0d9488', desc: t('lp.pp1_desc'), features: [t('lp.pp1_f1'), t('lp.pp1_f2'), t('lp.pp1_f3'), t('lp.pp1_f4')], cta: t('lp.pp1_cta'), featured: false },
    { icon: Heart,     label: t('lp.pp2_label'), color: '#dc2626', desc: t('lp.pp2_desc'), features: [t('lp.pp2_f1'), t('lp.pp2_f2'), t('lp.pp2_f3'), t('lp.pp2_f4')], cta: t('lp.pp2_cta'), featured: true },
    { icon: Building2, label: t('lp.pp3_label'), color: '#7c3aed', desc: t('lp.pp3_desc'), features: [t('lp.pp3_f1'), t('lp.pp3_f2'), t('lp.pp3_f3'), t('lp.pp3_f4')], cta: t('lp.pp3_cta'), featured: false },
    { icon: Zap,       label: t('lp.pp4_label'), color: '#b45309', desc: t('lp.pp4_desc'), features: [t('lp.pp4_f1'), t('lp.pp4_f2'), t('lp.pp4_f3'), t('lp.pp4_f4')], cta: t('lp.pp4_cta'), featured: false },
  ];
  const PARTNERSHIP_TYPES = [
    { icon: Stethoscope, color: '#0d9488', title: t('lp.ptn1_title'), desc: t('lp.ptn1_desc'), cta: t('lp.ptn1_cta') },
    { icon: Building2,   color: '#2563eb', title: t('lp.ptn2_title'), desc: t('lp.ptn2_desc'), cta: t('lp.ptn2_cta') },
    { icon: HeartPulse,  color: '#7c3aed', title: t('lp.ptn3_title'), desc: t('lp.ptn3_desc'), cta: t('lp.ptn3_cta') },
  ];
  const TRUST_POINTS = [
    { icon: Shield,       label: t('lp.tp1_label'), desc: t('lp.tp1_desc') },
    { icon: Lock,         label: t('lp.tp2_label'), desc: t('lp.tp2_desc') },
    { icon: CheckCircle2, label: t('lp.tp3_label'), desc: t('lp.tp3_desc') },
    { icon: TrendingUp,   label: t('lp.tp4_label'), desc: t('lp.tp4_desc') },
  ];
  const TRIAGE_OUTCOMES = [
    { icon: AlertTriangle,     color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', label: t('lp.tri1_label'), sub: t('lp.tri1_sub') },
    { icon: MonitorSmartphone, color: '#0891b2', bg: 'rgba(8,145,178,0.08)', border: 'rgba(8,145,178,0.2)', label: t('lp.tri2_label'), sub: t('lp.tri2_sub') },
    { icon: Calendar,          color: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.2)', label: t('lp.tri3_label'), sub: t('lp.tri3_sub') },
  ];
  const [activeAudience, setActiveAudience] = useState(0);
  const [animating, setAnimating] = useState(false);

  // Auto-rotate every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setActiveAudience(a => (a + 1) % AUDIENCES.length);
        setAnimating(false);
      }, 200);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const switchAudience = (idx: number) => {
    if (idx === activeAudience) return;
    setAnimating(true);
    setTimeout(() => { setActiveAudience(idx); setAnimating(false); }, 200);
  };

  const aud = AUDIENCES[activeAudience];

  return (
    <div className="landing-wrapper">
      <Navbar />

      {/* ══ HERO ══════════════════════════════════════════ */}
      <section className="kaya-hero">
        {/* LEFT — text */}
        <div className="kaya-hero__left">
          <div className="lp-hero__badge">
            <HeartPulse size={13} /> {t('lp.hero_badge')}
          </div>
          <h1 className="kaya-hero__title">
            {t('lp.hero_title')}<br />
            <span className="lp-hero__accent">KAYA.</span>
          </h1>
          <p className="kaya-hero__sub">
            {t('lp.hero_sub')}
          </p>
          <div className="kaya-hero__ctas">
            <Link to="/register" className="lp-cta lp-cta--primary"><Calendar size={17} /> {t('lp.cta_register')}</Link>
            <Link to="/login" className="lp-cta lp-cta--secondary"><ArrowRight size={17} /> {t('lp.cta_login')}</Link>
          </div>
          <div className="lp-hero__stats" style={{ justifyContent: 'flex-start', marginTop: '2rem' }}>
            {[
              { value: '13', label: t('lp.stat_specialties') },
              { value: '24/7', label: t('lp.stat_support') },
              { value: '100%', label: t('lp.stat_realdoctor') },
              { value: t('lp.stat_free'), label: t('lp.stat_registration') },
            ].map(s => (
              <div key={s.label} className="lp-stat">
                <span className="lp-stat__val">{s.value}</span>
                <span className="lp-stat__lbl">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — interactive panel */}
        <div className="kaya-panel">
          {/* Panel header with status */}
          <div className="kaya-panel__header">
            <span className="kaya-panel__title">Portal KAYA</span>
            <span className="kaya-panel__status">● {t('lp.panel_status')}</span>
          </div>

          {/* Audience buttons */}
          <div className="kaya-panel__tabs">
            {AUDIENCES.map((a, i) => (
              <button
                key={a.key}
                className={`kaya-tab${i === activeAudience ? ' kaya-tab--active' : ''}`}
                style={i === activeAudience ? { borderColor: a.color, color: a.color } : {}}
                onClick={() => switchAudience(i)}
              >
                {a.icon} {t(a.labelKey)}
              </button>
            ))}
          </div>

          {/* Panel content — image only */}
          <div className={`kaya-panel__body kaya-panel__body--img${animating ? ' kaya-panel__body--out' : ''}`}
               style={{ background: aud.imgColor }}>
            <img
              src={`/kaya-panel-${aud.key}.png`}
              alt={t(aud.labelKey)}
              className="kaya-panel__img"
              onError={(e) => { (e.target as HTMLImageElement).src = `/kaya-panel-${aud.key}.svg`; }}
            />
          </div>
        </div>
      </section>

      {/* ══ COMO FUNCIONA ════════════════════════════════ */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">{t('lp.how_tag')}</div>
          <h2>{t('lp.how_title')}</h2>
          <p>{t('lp.how_desc')}</p>
        </div>
        <div className="lp-steps">
          {HOW_STEPS.map(s => (
            <div key={s.num} className="lp-step">
              <div className="lp-step__num" style={{ color: s.color }}>{s.num}</div>
              <div className="lp-step__icon" style={{ background: `${s.color}18`, color: s.color }}><s.icon size={22} /></div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ VERIFICAÇÃO PRÉ-CONSULTA ══════════════════════ */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">{t('lp.pre_tag')}</div>
          <h2>{t('lp.pre_title')}</h2>
          <p>{t('lp.pre_desc')} <strong>{t('lp.pre_desc_bold')}</strong></p>
        </div>
        <div className="lp-triage-outcomes">
          {TRIAGE_OUTCOMES.map(o => (
            <div key={o.label} className="lp-outcome" style={{ background: o.bg, border: `1px solid ${o.border}` }}>
              <o.icon size={24} style={{ color: o.color }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: o.color }}>{o.label}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{o.sub}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link to="/register" className="lp-cta lp-cta--primary" style={{ display: 'inline-flex' }}><Activity size={16} /> {t('lp.pre_cta')}</Link>
        </div>
      </section>

      {/* ══ ECOSYSTEM ══════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">{t('lp.eco_tag')}</div>
          <h2>{t('lp.eco_title')}</h2>
          <p>{t('lp.eco_desc')}</p>
        </div>
        <div className="ecosystem-grid">
          {[
            { icon: Users,     color: '#0d9488', to: '/patients',    label: t('lp.eco1_label'), desc: t('lp.eco1_desc') },
            { icon: Building2, color: '#0891b2', to: '/clinics',     label: t('lp.eco2_label'), desc: t('lp.eco2_desc') },
            { icon: Heart,     color: '#dc2626', to: '/chronic-care',label: t('lp.eco3_label'), desc: t('lp.eco3_desc') },
            { icon: Activity,  color: '#d97706', to: '/devices',     label: t('lp.eco4_label'), desc: t('lp.eco4_desc') },
            { icon: TrendingUp,color: '#7c3aed', to: '/pricing',     label: t('lp.eco5_label'), desc: t('lp.eco5_desc') },
            { icon: Phone,     color: '#059669', to: '/contacto',    label: t('lp.eco6_label'), desc: t('lp.eco6_desc') },
          ].map(item => (
            <Link key={item.to} to={item.to} className="ecosystem-card">
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${item.color}15`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <item.icon size={22} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.3rem' }}>{item.label}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</div>
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: item.color, fontWeight: 600 }}>
                {t('lp.learn_more')} <ArrowRight size={13} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ══ ESPECIALIDADES ══════════════════════════════ */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">{t('lp.spec_tag')}</div>
          <h2>{t('lp.spec_title')}</h2>
          <p>{t('lp.spec_desc')}</p>
        </div>
        <div className="lp-specialties">
          {SPECIALTIES.map(sp => (
            <Link to="/especialistas" key={sp.label} className="lp-specialty-card">
              <div className="lp-specialty-icon" style={{ background: `${sp.color}18`, color: sp.color }}><sp.icon size={20} /></div>
              <span>{sp.label}</span>
              <ChevronRight size={14} style={{ color: 'var(--text-muted)', marginLeft: 'auto' }} />
            </Link>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/especialistas" className="lp-link-more">{t('lp.spec_all')} <ArrowRight size={15} /></Link>
        </div>
      </section>

      {/* ══ SOLUÇÕES PREMIUM ════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">{t('lp.prem_tag')}</div>
          <h2>{t('lp.prem_title')}</h2>
          <p>{t('lp.prem_desc')}</p>
        </div>
        <div className="lp-plans">
          {PREMIUM_PLANS.map(plan => (
            <div key={plan.label} className={`lp-plan-card${plan.featured ? ' lp-plan-card--featured' : ''}`} style={{ '--plan-color': plan.color } as React.CSSProperties}>
              <div className="lp-plan-card__head">
                <div className="lp-plan-icon" style={{ background: `${plan.color}18`, color: plan.color }}><plan.icon size={20} /></div>
                <h3>{plan.label}</h3>
                {plan.featured && <span className="lp-plan-badge">{t('lp.most_popular')}</span>}
              </div>
              <p>{plan.desc}</p>
              <ul>{plan.features.map(f => (<li key={f}><CheckCircle2 size={14} style={{ color: plan.featured ? 'rgba(255,255,255,0.8)' : plan.color }} /> {f}</li>))}</ul>
              <Link to="/login" className="lp-plan-cta" style={{ background: plan.featured ? '#fff' : plan.color, color: plan.featured ? plan.color : '#fff' }}>
                {plan.cta} <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ══ PORQUÊ CAREFAST+ ════════════════════════════ */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">{t('lp.why_tag')}</div>
          <h2>{t('lp.why_title')}</h2>
        </div>
        <div className="lp-trust-grid">
          {TRUST_POINTS.map(tp => (
            <div key={tp.label} className="lp-trust-card">
              <tp.icon size={22} style={{ color: 'var(--accent-teal)' }} />
              <h4>{tp.label}</h4>
              <p>{tp.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ PARCEIROS ════════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">{t('lp.part_tag')}</div>
          <h2>{t('lp.part_title')}</h2>
          <p>
            {t('lp.part_desc')}
          </p>
        </div>
        <div className="feat-grid" style={{ maxWidth: 900, margin: '0 auto' }}>
          {PARTNERSHIP_TYPES.map(p => (
            <div key={p.title} className="feat-card hover-lift" style={{ borderTop: `3px solid ${p.color}` }}>
              <div className="feat-icon" style={{ background: `${p.color}15`, color: p.color }}>
                <p.icon size={22} />
              </div>
              <div>
                <h3 className="feat-title">{p.title}</h3>
                <p className="feat-desc">{p.desc}</p>
                <a href="mailto:parcerias@kaya.ao" className="btn btn-ghost btn-sm"
                  style={{ marginTop: '0.75rem', color: p.color, borderColor: `${p.color}40` }}>
                  {p.cta} →
                </a>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {t('lp.part_contact')} <a href="mailto:parcerias@kaya.ao" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>parcerias@kaya.ao</a>
        </div>
      </section>

      {/* ══ URGÊNCIA ════════════════════════════════════ */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>{t('lp.urg_tag')}</div>
          <h2>{t('lp.urg_title')}</h2>
          <p>{t('lp.urg_desc')}</p>
        </div>
        <div className="lp-urgency-flow">
          {[{ icon: Smartphone, label: t('lp.uf1') }, { icon: AlertTriangle, label: t('lp.uf2') }, { icon: Building2, label: t('lp.uf3') }, { icon: CheckCircle2, label: t('lp.uf4') }].map((s, i, arr) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="lp-urgency-step"><s.icon size={20} style={{ color: '#ef4444' }} /><span>{s.label}</span></div>
              {i < arr.length - 1 && <ArrowRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/urgencia" className="lp-cta lp-cta--danger" style={{ display: 'inline-flex' }}><AlertTriangle size={16} /> {t('lp.urg_cta')}</Link>
        </div>
      </section>

      {/* ══ B2B ══════════════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">{t('lp.b2b_tag')}</div>
          <h2>{t('lp.b2b_title')}</h2>
          <p>{t('lp.b2b_desc')}</p>
        </div>
        <div className="lp-b2b-grid">
          {[
            { icon: Users,     label: t('lp.b1_label'), desc: t('lp.b1_desc') },
            { icon: TrendingUp,label: t('lp.b2_label'), desc: t('lp.b2_desc') },
            { icon: RefreshCw, label: t('lp.b3_label'), desc: t('lp.b3_desc') },
            { icon: Pill,      label: t('lp.b4_label'), desc: t('lp.b4_desc') },
            { icon: Shield,    label: t('lp.b5_label'), desc: t('lp.b5_desc') },
            { icon: Clock,     label: t('lp.b6_label'), desc: t('lp.b6_desc') },
          ].map(item => (
            <div key={item.label} className="lp-b2b-card">
              <item.icon size={20} style={{ color: '#7c3aed' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.label}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/empresas" className="lp-cta lp-cta--secondary" style={{ display: 'inline-flex' }}><Building2 size={16} /> {t('lp.b2b_cta')}</Link>
        </div>
      </section>

      {/* ══ DEVICES ══════════════════════════════════════ */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">{t('lp.dev_tag')}</div>
          <h2>{t('lp.dev_title')}</h2>
          <p>{t('lp.dev_desc')}</p>
        </div>
        <div className="lp-devices-row">
          {[{ icon: Activity, label: t('lp.dv1_label'), sub: t('lp.dv1_sub') }, { icon: Wind, label: t('lp.dv2_label'), sub: t('lp.dv2_sub') }, { icon: TrendingUp, label: t('lp.dv3_label'), sub: t('lp.dv3_sub') }, { icon: Zap, label: t('lp.dv4_label'), sub: t('lp.dv4_sub') }, { icon: HeartPulse, label: t('lp.dv5_label'), sub: t('lp.dv5_sub') }].map(d => (
            <div key={d.label} className="lp-device-card">
              <d.icon size={24} style={{ color: '#0d9488' }} />
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.5rem' }}>{d.label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{d.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/devices" className="lp-link-more">{t('lp.dev_more')} <ArrowRight size={15} /></Link>
        </div>
      </section>

      {/* ══ PRICING ══════════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">{t('lp.price_tag')}</div>
          <h2>{t('lp.price_title')}</h2>
        </div>
        <div className="lp-pricing">
          {[
            { label: 'Basic',   price: t('lp.stat_free'), sub: t('lp.pr1_sub'), features: [t('lp.pr1_f1'), t('lp.pr1_f2'), t('lp.pr1_f3'), t('lp.pr1_f4')], cta: t('lp.pr1_cta'), featured: false },
            { label: 'Premium', price: '3.500 Kz/mês',    sub: t('lp.pr2_sub'), features: [t('lp.pr2_f1'), t('lp.pr2_f2'), t('lp.pr2_f3'), t('lp.pr2_f4'), t('lp.pr2_f5'), t('lp.pr2_f6')], cta: t('lp.pr2_cta'), featured: true  },
            { label: 'Família', price: '7.500 Kz/mês',    sub: t('lp.pr3_sub'), features: [t('lp.pr3_f1'), t('lp.pr3_f2'), t('lp.pr3_f3'), t('lp.pr3_f4'), t('lp.pr3_f5')], cta: t('lp.pr3_cta'), featured: false },
          ].map(p => (
            <div key={p.label} className={`lp-price-card${p.featured ? ' lp-price-card--featured' : ''}`}>
              <div className="lp-price-label">{p.label}</div>
              <div className="lp-price-amount">{p.price}</div>
              <div className="lp-price-sub">{p.sub}</div>
              <ul>{p.features.map(f => (<li key={f}><CheckCircle2 size={13} style={{ color: p.featured ? '#fff' : '#0d9488' }} /> {f}</li>))}</ul>
              <Link to="/register" className="lp-price-cta" style={p.featured ? { background: '#fff', color: '#0d9488' } : {}}>{p.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FINAL CTA ════════════════════════════════════ */}
      <section className="lp-final-cta">
        <div className="lp-tag" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>{t('lp.final_tag')}</div>
        <h2>{t('lp.final_title')}</h2>
        <p>{t('lp.final_desc')}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/register" className="lp-cta lp-cta--white">{t('lp.final_cta1')}</Link>
          <Link to="/contacto" className="lp-cta lp-cta--white-outline"><Phone size={15} /> {t('lp.final_cta2')}</Link>
        </div>
        <div style={{ marginTop: '2rem', display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[t('lp.chip1'), t('lp.chip2'), t('lp.chip3'), t('lp.chip4')].map(item => (
            <span key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.83rem', color: 'rgba(255,255,255,0.7)' }}>
              <CheckCircle2 size={13} style={{ color: 'rgba(255,255,255,0.5)' }} /> {item}
            </span>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
