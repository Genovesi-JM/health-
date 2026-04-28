import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Video, CheckCircle2, Clock, Shield, Wifi, Monitor, ArrowRight, Stethoscope, Brain, Heart, Activity, HeartPulse } from 'lucide-react';

const STEPS = [
  { num: '01', title: 'Selecciona a especialidade', desc: 'Clínica geral, psicologia, pediatria e muitas mais disponíveis por videochamada.' },
  { num: '02', title: 'Confirma a marcação', desc: 'Escolha o horário e o médico disponível. Confirmação imediata por email.' },
  { num: '03', title: 'Entra na consulta', desc: 'Link seguro enviado por email. Consulta por vídeo, sem instalação de apps.' },
  { num: '04', title: 'Recebe seguimento', desc: 'Receita digital, relatório e próximos passos disponíveis no portal.' },
];

const SPECIALTIES_TELE = [
  { icon: Stethoscope, label: 'Clínica Geral' },
  { icon: Brain,       label: 'Psicologia' },
  { icon: Brain,       label: 'Psiquiatria' },
  { icon: Heart,       label: 'Ginecologia' },
  { icon: HeartPulse,  label: 'Cardiologia' },
  { icon: Activity,    label: 'Nutrição' },
];

const BENEFITS = [
  { icon: Clock,    label: 'Consulta em minutos',       desc: 'Sem filas. Sem espera. Médico disponível quando precisar.' },
  { icon: Shield,   label: 'Totalmente seguro',          desc: 'Videoconferência encriptada. Dados protegidos.' },
  { icon: Wifi,     label: 'Qualquer dispositivo',       desc: 'Computador, tablet ou telemóvel. Sem instalação.' },
  { icon: Monitor,  label: 'Historial integrado',        desc: 'Notas e receitas guardadas automaticamente no portal.' },
];

export default function TeleconsultaPage() {
  return (
    <div className="landing-wrapper">
      <Navbar />

      <section className="lp-page-hero">
        <div className="lp-tag" style={{ background: 'rgba(8,145,178,0.12)', color: '#22d3ee' }}>Teleconsulta</div>
        <h1>Médico em casa. Agora mesmo.</h1>
        <p>Consulta médica por vídeo com especialistas verificados — sem deslocação, sem espera, com toda a segurança.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/login" className="lp-cta lp-cta--secondary"><Video size={17} /> Iniciar Teleconsulta</Link>
          <Link to="/especialistas" className="lp-cta lp-cta--outline">Ver especialidades <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">Como funciona</div>
          <h2>Simples, rápido e seguro.</h2>
        </div>
        <div className="lp-steps">
          {STEPS.map(s => (
            <div key={s.num} className="lp-step">
              <div className="lp-step__num" style={{ color: '#0891b2' }}>{s.num}</div>
              <div className="lp-step__icon" style={{ background: 'rgba(8,145,178,0.12)', color: '#0891b2' }}><Video size={22} /></div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">Especialidades disponíveis</div>
          <h2>Teleconsulta para as principais especialidades.</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '700px', margin: '0 auto' }}>
          {SPECIALTIES_TELE.map(sp => (
            <div key={sp.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'rgba(8,145,178,0.06)', fontSize: '0.88rem', fontWeight: 500 }}>
              <sp.icon size={16} style={{ color: '#22d3ee' }} /> {sp.label}
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">Vantagens</div>
          <h2>Porque escolher teleconsulta.</h2>
        </div>
        <div className="lp-trust-grid">
          {BENEFITS.map(b => (
            <div key={b.label} className="lp-trust-card">
              <b.icon size={22} style={{ color: '#0891b2' }} />
              <h4>{b.label}</h4>
              <p>{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <div className="lp-tag" style={{ display: 'inline-flex', marginBottom: '1rem' }}>Pronto para começar?</div>
          <h2>A sua próxima consulta é agora.</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Crie conta gratuita e marque a sua primeira teleconsulta em menos de 2 minutos.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="lp-cta lp-cta--primary"><CheckCircle2 size={16} /> Criar conta gratuita</Link>
            <Link to="/login" className="lp-cta lp-cta--secondary"><Video size={16} /> Entrar no portal</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
