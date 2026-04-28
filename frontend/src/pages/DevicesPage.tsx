import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Activity, Wind, TrendingUp, Zap, Heart,
  Bluetooth, Smartphone, ArrowRight, CheckCircle2,
  Shield, AlertTriangle, Lock, BadgeCheck,
} from 'lucide-react';

const KITS = [
  {
    label: 'Kit Básico',
    color: '#0d9488',
    price: 'A partir de 25.000 Kz',
    sub: 'Para monitorização essencial',
    devices: ['Tensiómetro de braço smart', 'Termómetro digital'],
    features: ['Bluetooth 5.0 incluso', 'Sincroniza com app', 'Histórico 12 meses', 'Alertas básicos'],
    cta: 'Ver Kit Básico',
    badge: null,
  },
  {
    label: 'Kit Crónico',
    color: '#dc2626',
    price: 'A partir de 55.000 Kz',
    sub: 'Hipertensão • Diabetes • Asma',
    devices: ['Tensiómetro smart', 'Glicómetro conectado', 'Oxímetro de pulso'],
    features: ['Alertas de risco automáticos', 'Partilha com médico', 'Histórico ilimitado', 'Suporte setup incluso'],
    cta: 'Kit mais popular',
    badge: 'Mais escolhido',
  },
  {
    label: 'Kit Família Premium',
    color: '#7c3aed',
    price: 'A partir de 95.000 Kz',
    sub: 'Toda a família num só portal',
    devices: ['Tensiómetro smart', 'Glicómetro', 'Oxímetro', 'Balança smart'],
    features: ['Múltiplos utilizadores', 'Dashboard familiar', 'Perfis pediátricos', 'Financiamento disponível'],
    cta: 'Kit Família',
    badge: null,
  },
];

const DEVICES = [
  { icon: Activity,   color: '#dc2626', label: 'Tensiómetro',    sub: 'Tensão arterial sistólica, diastólica e frequência cardíaca. Sincronização imediata.' },
  { icon: TrendingUp, color: '#d97706', label: 'Glicómetro',     sub: 'Glicemia em jejum, pós-prandial e random. Historico com tendências.' },
  { icon: Wind,       color: '#0891b2', label: 'Oxímetro',       sub: 'SpO₂ e frequência respiratória. Alerta imediato abaixo de 92%.' },
  { icon: Heart,      color: '#7c3aed', label: 'Balança Smart',  sub: 'Peso, IMC e percentagem de gordura corporal. Evolução semanal.' },
  { icon: Zap,        color: '#d97706', label: 'Termómetro',     sub: 'Temperatura corporal em 3 segundos. Sem contacto.' },
  { icon: Smartphone, color: '#0d9488', label: 'App Sync',       sub: 'Todos os devices sincronizam via Bluetooth com a app CareFast+.' },
];

const HOW = [
  { step: '01', icon: Bluetooth, color: '#0d9488', title: 'Ligue o dispositivo', desc: 'Abra a app CareFast+, active o Bluetooth e o device emparelha automaticamente.' },
  { step: '02', icon: Activity,  color: '#dc2626', title: 'Faça a medição',      desc: 'A leitura é guardada instantaneamente no seu perfil clínico.' },
  { step: '03', icon: TrendingUp,color: '#0891b2', title: 'O médico recebe',     desc: 'Na próxima consulta ou teleconsulta, o médico vê toda a evolução dos seus vitais.' },
  { step: '04', icon: Shield,    color: '#7c3aed', title: 'Alertas de risco',    desc: 'Se uma leitura estiver fora do intervalo seguro, recebe notificação e o médico é informado.' },
];

export default function DevicesPage() {
  return (
    <div className="landing-wrapper">
      <Navbar />

      {/* ── Hero ── */}
      <section className="lp-page-hero">
        <div className="lp-tag"><Bluetooth size={12} /> Devices & Kits de Saúde</div>
        <h1>Os seus vitais chegam<br /><span className="lp-hero__accent">directamente ao médico.</span></h1>
        <p>
          Tensão, glicemia, SpO₂ — meça em casa, sincronize com a app e o médico recebe os dados antes da consulta.
          Não vendemos gadgets. Vendemos continuidade clínica.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="#kits" className="lp-cta lp-cta--primary"><Activity size={15} /> Ver kits disponíveis</Link>
          <Link to="/chronic-care" className="lp-cta lp-cta--secondary"><Heart size={15} /> Programa crónico</Link>
        </div>
        <div className="trust-strip" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
          <span className="trust-badge trust-badge--encrypted"><Lock size={11} /> Dados encriptados</span>
          <span className="trust-badge trust-badge--verified"><BadgeCheck size={11} /> Clínicas certificadas</span>
          <span className="trust-badge trust-badge--hipaa"><Shield size={11} /> Privacidade garantida</span>
        </div>
      </section>

      {/* ── Disclaimer ── */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 1.5rem 2rem', textAlign: 'center' }}>
        <div className="disclaimer-box">
          <AlertTriangle size={16} style={{ color: '#d97706', flexShrink: 0 }} />
          <span>
            Os dispositivos CareFast+ são auxiliares de monitorização pessoal. Não substituem exames clínicos laboratoriais.
            Todas as leituras são interpretadas por um médico certificado.
          </span>
        </div>
      </div>

      {/* ── Devices list ── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">Dispositivos compatíveis</div>
          <h2>Tudo o que precisa para monitorizar a sua saúde.</h2>
          <p>Dispositivos Bluetooth certificados, integrados directamente com o portal CareFast+.</p>
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
          <div className="lp-tag">Como funciona</div>
          <h2>Da medição ao médico em segundos.</h2>
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
          <div className="lp-tag">Kits disponíveis</div>
          <h2>Escolha o kit certo para o seu perfil.</h2>
          <p>Financiamento disponível. Entrega em Luanda e principais cidades de Angola.</p>
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
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Inclui</div>
                {k.devices.map(d => (
                  <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    <CheckCircle2 size={13} style={{ color: k.color }} /> {d}
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Funcionalidades</div>
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
          <div className="lp-tag">Financiamento disponível</div>
          <h2 style={{ fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 800, margin: '0.5rem 0 0.75rem' }}>
            Pague de forma flexível.
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Kits disponíveis em prestações mensais via Multicaixa Express, transferência bancária ou pagamento em clínica parceira.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {['Multicaixa Express', 'Transferência Bancária', 'Visa / Mastercard', 'Pagamento na Clínica'].map(m => (
              <span key={m} style={{ padding: '0.35rem 0.85rem', background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-teal)' }}>{m}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="lp-final-cta">
        <div className="lp-tag" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>Smart Devices</div>
        <h2>Monitorize. Partilhe. Melhore.</h2>
        <p>Os seus vitais no portal, o médico informado, e a sua saúde sempre em foco.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/contacto" className="lp-cta lp-cta--white">Encomendar kit <ArrowRight size={14} /></Link>
          <Link to="/chronic-care" className="lp-cta lp-cta--white-outline">Programa crónico</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
