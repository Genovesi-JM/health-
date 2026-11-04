import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Activity, Wind, TrendingUp, Zap, Heart,
  Bluetooth, Smartphone, ArrowRight, CheckCircle2,
  Shield, AlertTriangle, Lock, BadgeCheck,
} from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

export default function DevicesPage() {
  const { t } = useT();
  const KITS = [
    {
      label: t('dev.k1_label'), color: '#0d9488', price: `${t('dev.price_from')} 25.000 Kz`, sub: t('dev.k1_sub'),
      devices: [t('dev.k1_d1'), t('dev.k1_d2')],
      features: [t('dev.k1_f1'), t('dev.k1_f2'), t('dev.k1_f3'), t('dev.k1_f4')],
      cta: t('dev.k1_cta'), badge: null as string | null,
    },
    {
      label: t('dev.k2_label'), color: '#dc2626', price: `${t('dev.price_from')} 55.000 Kz`, sub: t('dev.k2_sub'),
      devices: [t('dev.k2_d1'), t('dev.k2_d2'), t('dev.k2_d3')],
      features: [t('dev.k2_f1'), t('dev.k2_f2'), t('dev.k2_f3'), t('dev.k2_f4')],
      cta: t('dev.k2_cta'), badge: t('dev.k2_badge') as string | null,
    },
    {
      label: t('dev.k3_label'), color: '#7c3aed', price: `${t('dev.price_from')} 95.000 Kz`, sub: t('dev.k3_sub'),
      devices: [t('dev.k3_d1'), t('dev.k3_d2'), t('dev.k3_d3'), t('dev.k3_d4')],
      features: [t('dev.k3_f1'), t('dev.k3_f2'), t('dev.k3_f3'), t('dev.k3_f4')],
      cta: t('dev.k3_cta'), badge: null as string | null,
    },
  ];
  const DEVICES = [
    { icon: Activity,   color: '#dc2626', label: t('dev.d1_label'), sub: t('dev.d1_sub') },
    { icon: TrendingUp, color: '#d97706', label: t('dev.d2_label'), sub: t('dev.d2_sub') },
    { icon: Wind,       color: '#0891b2', label: t('dev.d3_label'), sub: t('dev.d3_sub') },
    { icon: Heart,      color: '#7c3aed', label: t('dev.d4_label'), sub: t('dev.d4_sub') },
    { icon: Zap,        color: '#d97706', label: t('dev.d5_label'), sub: t('dev.d5_sub') },
    { icon: Smartphone, color: '#0d9488', label: t('dev.d6_label'), sub: t('dev.d6_sub') },
  ];
  const HOW = [
    { step: '01', icon: Bluetooth,  color: '#0d9488', title: t('dev.h1_title'), desc: t('dev.h1_desc') },
    { step: '02', icon: Activity,   color: '#dc2626', title: t('dev.h2_title'), desc: t('dev.h2_desc') },
    { step: '03', icon: TrendingUp, color: '#0891b2', title: t('dev.h3_title'), desc: t('dev.h3_desc') },
    { step: '04', icon: Shield,     color: '#7c3aed', title: t('dev.h4_title'), desc: t('dev.h4_desc') },
  ];
  const payMethods = ['Multicaixa Express', t('dev.pay_transfer'), 'Visa / Mastercard', t('dev.pay_clinic')];
  return (
    <div className="landing-wrapper">
      <Navbar />

      {/* ── Hero ── */}
      <section className="lp-page-hero">
        <div className="lp-tag"><Bluetooth size={12} /> {t('dev.tag')}</div>
        <h1>{t('dev.title1')}<br /><span className="lp-hero__accent">{t('dev.title2')}</span></h1>
        <p>
          {t('dev.subtitle')}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="#kits" className="lp-cta lp-cta--primary"><Activity size={15} /> {t('dev.cta_kits')}</Link>
          <Link to="/chronic-care" className="lp-cta lp-cta--secondary"><Heart size={15} /> {t('dev.cta_chronic')}</Link>
        </div>
        <div className="trust-strip" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
          <span className="trust-badge trust-badge--encrypted"><Lock size={11} /> {t('dev.badge_encrypted')}</span>
          <span className="trust-badge trust-badge--verified"><BadgeCheck size={11} /> {t('dev.badge_certified')}</span>
          <span className="trust-badge trust-badge--hipaa"><Shield size={11} /> {t('dev.badge_privacy')}</span>
        </div>
      </section>

      {/* ── Disclaimer ── */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 1.5rem 2rem', textAlign: 'center' }}>
        <div className="disclaimer-box">
          <AlertTriangle size={16} style={{ color: '#d97706', flexShrink: 0 }} />
          <span>
            {t('dev.disclaimer')}
          </span>
        </div>
      </div>

      {/* ── Devices list ── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">{t('dev.list_tag')}</div>
          <h2>{t('dev.list_title')}</h2>
          <p>{t('dev.list_desc')}</p>
        </div>
        <div className="devices-grid">
          {DEVICES.map(d => (
            <div key={d.label} className="device-item">
              <div style={{ width: 48, height: 48, borderRadius: 14, background: `${d.color}15`, color: d.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <d.icon size={24} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.3rem' }}>{d.label}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{d.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">{t('dev.how_tag')}</div>
          <h2>{t('dev.how_title')}</h2>
        </div>
        <div className="journey-steps">
          {HOW.map(s => (
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

      {/* ── Kits ── */}
      <section id="kits" className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">{t('dev.kits_tag')}</div>
          <h2>{t('dev.kits_title')}</h2>
          <p>{t('dev.kits_desc')}</p>
        </div>
        <div className="kits-grid">
          {KITS.map(k => (
            <div key={k.label} className="kit-card" style={{ borderColor: `${k.color}30` }}>
              {k.badge && (
                <div className="kit-badge" style={{ background: k.color }}>{k.badge}</div>
              )}
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${k.color}15`, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <Activity size={22} />
              </div>
              <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.25rem' }}>{k.label}</h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{k.sub}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: k.color, marginBottom: '0.5rem' }}>{k.price}</div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{t('dev.includes')}</div>
                {k.devices.map(d => (
                  <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    <CheckCircle2 size={13} style={{ color: k.color }} /> {d}
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{t('dev.features')}</div>
                {k.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    <CheckCircle2 size={13} style={{ color: k.color }} /> {f}
                  </div>
                ))}
              </div>

              <Link to="/contacto" className="lp-price-cta" style={{ background: k.color }}>
                {k.cta} <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Financing callout ── */}
      <section className="lp-section">
        <div className="page-callout" style={{ borderColor: 'rgba(20,184,166,0.3)', background: 'rgba(20,184,166,0.03)' }}>
          <div className="lp-tag">{t('dev.fin_tag')}</div>
          <h2 style={{ fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 800, margin: '0.5rem 0 0.75rem' }}>
            {t('dev.fin_title')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {t('dev.fin_desc')}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {payMethods.map(m => (
              <span key={m} style={{ padding: '0.35rem 0.85rem', background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-teal)' }}>{m}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="lp-final-cta">
        <div className="lp-tag" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>{t('dev.final_tag')}</div>
        <h2>{t('dev.final_title')}</h2>
        <p>{t('dev.final_desc')}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/contacto" className="lp-cta lp-cta--white">{t('dev.final_cta1')} <ArrowRight size={14} /></Link>
          <Link to="/chronic-care" className="lp-cta lp-cta--white-outline">{t('dev.cta_chronic')}</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
