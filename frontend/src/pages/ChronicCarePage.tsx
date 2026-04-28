import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Heart, Activity, Wind, TrendingUp, RefreshCw,
  Bell, Calendar, Video, Shield, CheckCircle2,
  ArrowRight, Users, Clock, AlertTriangle,
} from 'lucide-react';

const CONDITIONS = [
  { icon: Activity,      color: '#dc2626', bg: 'rgba(220,38,38,0.1)',   label: 'Hipertensão',          sub: 'Monitorização diária de tensão arterial com alertas de risco.' },
  { icon: TrendingUp,    color: '#d97706', bg: 'rgba(217,119,6,0.1)',   label: 'Diabetes',             sub: 'Glicemia em jejum, pós-prandial e HbA1c — todos registados.' },
  { icon: Wind,          color: '#0891b2', bg: 'rgba(8,145,178,0.1)',   label: 'Asma e DPOC',          sub: 'SpO₂, pico de fluxo e frequência respiratória em tempo real.' },
  { icon: Heart,         color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', label: 'Doença Cardíaca',      sub: 'ECG simplificado, frequência cardíaca, variabilidade.' },
  { icon: Users,         color: '#059669', bg: 'rgba(5,150,105,0.1)',  label: 'Obesidade',            sub: 'IMC, peso, cintura — tendências mensais com plano nutricional.' },
  { icon: Clock,         color: '#0d9488', bg: 'rgba(13,148,136,0.1)', label: 'Cuidado do Idoso',     sub: 'Medicação múltipla, mobilidade e monitorização familiar.' },
];

const FEATURES = [
  { icon: RefreshCw,  color: '#0d9488', title: 'Renovação automática de receitas',    desc: 'Medicação crónica reabastecida sem deslocação. O médico valida e emite a receita digitalmente.' },
  { icon: Calendar,   color: '#0891b2', title: 'Check-ins mensais com o médico',      desc: 'Consulta de acompanhamento mensal incluída. O médico analisa as suas leituras e ajusta o plano.' },
  { icon: Activity,   color: '#dc2626', title: 'Gráficos de evolução das leituras',   desc: 'Veja como a tensão, glicemia e outros vitais evoluem ao longo dos meses. Resultados visíveis.' },
  { icon: Bell,       color: '#d97706', title: 'Alertas de risco personalizados',     desc: 'Recebe notificação imediata quando uma leitura está fora do intervalo seguro para o seu perfil.' },
  { icon: Users,      color: '#7c3aed', title: 'Monitorização familiar',             desc: 'Um familiar pode acompanhar as suas leituras. Ideal para idosos ou doentes dependentes.' },
  { icon: Shield,     color: '#059669', title: 'Plano de saúde personalizado',        desc: 'O médico define os intervalos seguros, frequência de medição e medicação para o seu caso.' },
];

const JOURNEY = [
  { step: '01', icon: Activity, color: '#dc2626', title: 'Registe a sua condição',        desc: 'Adicione as suas condições de saúde, medicação actual e historial. Rápido e confidencial.' },
  { step: '02', icon: TrendingUp, color: '#0891b2', title: 'Meça e envie vitais',          desc: 'Use os seus dispositivos existentes ou adquira um kit CareFast+. Dados sincronizados automaticamente.' },
  { step: '03', icon: Calendar, color: '#7c3aed', title: 'Check-in com o médico',         desc: 'Reunião digital mensal. O médico vê toda a evolução e ajusta o tratamento.' },
  { step: '04', icon: RefreshCw, color: '#059669', title: 'Receita sem sair de casa',     desc: 'Renovação aprovada digitalmente e enviada à sua farmácia ou clínica parceira.' },
];

export default function ChronicCarePage() {
  return (
    <div className="landing-wrapper">
      <Navbar />

      {/* ── Hero ── */}
      <section className="lp-page-hero">
        <div className="lp-tag" style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
          <Heart size={12} /> Cuidado Crónico
        </div>
        <h1>Healthcare que continua<br /><span className="lp-hero__accent">entre consultas.</span></h1>
        <p>
          Para quem vive com hipertensão, diabetes, asma ou outra condição crónica —
          monitorização contínua, renovação automática e acompanhamento real.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/register" className="lp-cta lp-cta--primary"><Heart size={15} /> Começar programa crónico</Link>
          <Link to="/telemedicina" className="lp-cta lp-cta--secondary"><Video size={15} /> Falar com médico</Link>
        </div>
      </section>

      {/* ── Disclaimer ── */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 1.5rem 2rem', textAlign: 'center' }}>
        <div className="disclaimer-box">
          <AlertTriangle size={16} style={{ color: '#d97706', flexShrink: 0 }} />
          <span>
            O CareFast+ não substitui o seu médico. Todas as decisões clínicas são validadas por um profissional de saúde certificado.
            A plataforma apoia — nunca substitui — o acompanhamento médico tradicional.
          </span>
        </div>
      </div>

      {/* ── Conditions ── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">Condições suportadas</div>
          <h2>Desenhado para as principais doenças crónicas.</h2>
          <p>Cada condição tem um protocolo de monitorização personalizado, validado por especialistas.</p>
        </div>
        <div className="conditions-grid">
          {CONDITIONS.map(c => (
            <div key={c.label} className="condition-card" style={{ borderColor: c.color + '30', background: c.bg }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${c.color}20`, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <c.icon size={22} />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.4rem' }}>{c.label}</h3>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{c.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">Funcionalidades</div>
          <h2>Tudo o que precisa para gerir a sua saúde crónica.</h2>
        </div>
        <div className="feat-grid">
          {FEATURES.map(f => (
            <div key={f.title} className="feat-card">
              <div className="feat-icon" style={{ background: `${f.color}15`, color: f.color }}>
                <f.icon size={22} />
              </div>
              <div>
                <h3 className="feat-title">{f.title}</h3>
                <p className="feat-desc">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Journey ── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">Como funciona</div>
          <h2>Do diagnóstico ao acompanhamento contínuo.</h2>
        </div>
        <div className="journey-steps">
          {JOURNEY.map(s => (
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

      {/* ── Pricing callout ── */}
      <section className="lp-section">
        <div className="page-callout" style={{ borderColor: 'rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.03)' }}>
          <div className="lp-tag" style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>Plano Chronic Care</div>
          <h2 style={{ fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 800, margin: '0.5rem 0 0.75rem' }}>
            Acompanhamento completo desde 3.500 Kz/mês.
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Inclui check-ins mensais, renovação de receita, vitals tracking, alertas de risco e historial completo.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {['Check-in mensal', 'Renovação automática', 'Vitals tracking', 'Alertas de risco', 'Historial completo', 'Família incluída'].map(f => (
              <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.7rem', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600, color: '#dc2626' }}>
                <CheckCircle2 size={12} /> {f}
              </span>
            ))}
          </div>
          <Link to="/register" className="lp-cta lp-cta--danger"><ArrowRight size={15} /> Activar Chronic Care</Link>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="lp-final-cta">
        <div className="lp-tag" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>Cuidado Crónico</div>
        <h2>A sua saúde não deve parar entre consultas.</h2>
        <p>Monitorização contínua, médico sempre disponível e renovação automática. Começa hoje.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/register" className="lp-cta lp-cta--white">Começar programa <ArrowRight size={14} /></Link>
          <Link to="/contacto" className="lp-cta lp-cta--white-outline">Falar com especialista</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
