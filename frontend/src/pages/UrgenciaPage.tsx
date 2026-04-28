import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { AlertTriangle, Smartphone, Building2, CheckCircle2, Clock, ArrowRight, Phone, Activity, HeartPulse } from 'lucide-react';

export default function UrgenciaPage() {
  return (
    <div className="landing-wrapper">
      <Navbar />

      <section className="lp-page-hero" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(15,23,42,0) 60%)' }}>
        <div className="lp-tag" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
          <AlertTriangle size={13} /> Urgência
        </div>
        <h1>Vou para a urgência.<br />O hospital já sabe.</h1>
        <p>
          Envie os seus sintomas e dados vitais <strong>antes de chegar</strong>. O hospital parceiro recebe um pré-alerta
          e prepara-se para a sua chegada. Menos espera. Mais segurança.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/login" className="lp-cta lp-cta--danger"><AlertTriangle size={16} /> Activar Pré-alerta de Urgência</Link>
          <Link to="/login" className="lp-cta lp-cta--outline"><Phone size={16} /> Entrar no Portal</Link>
        </div>
      </section>

      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">Fluxo de urgência</div>
          <h2>O que acontece quando activa o pré-alerta.</h2>
        </div>
        <div className="lp-steps" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {[
            { icon: Smartphone,   title: 'Envia dados',          desc: 'Nome, sintomas, localização e ETA estimado.' },
            { icon: Activity,     title: 'Sinais vitais',         desc: 'Envie leitura de tensão, oxigénio ou temperatura se disponível.' },
            { icon: AlertTriangle,title: 'Pré-alerta gerado',     desc: 'O sistema notifica o hospital parceiro seleccionado.' },
            { icon: Building2,    title: 'Hospital prepara',      desc: 'Equipa alerta. Triagem preparada para a sua chegada.' },
            { icon: CheckCircle2, title: 'Chegada organizada',    desc: 'Recepção informada. Processo mais rápido e seguro.' },
          ].map(s => (
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
          <div className="lp-tag">Porquê é importante</div>
          <h2>Em Luanda, cada minuto conta.</h2>
          <p>Em emergências médicas, chegar a um hospital sem aviso prévio pode significar longos tempos de espera. O pré-alerta muda isso.</p>
        </div>
        <div className="lp-trust-grid">
          {[
            { icon: Clock,        label: 'Menos tempo de espera',     desc: 'Hospital preparado para receber antes da chegada.' },
            { icon: HeartPulse,   label: 'Mais segurança clínica',    desc: 'Médicos com contexto antes de o ver.' },
            { icon: Building2,    label: 'Parceiros em Luanda',       desc: 'Hospital Américo Boavida, Hospital de Luanda e mais.' },
            { icon: CheckCircle2, label: 'Simples de activar',        desc: 'Menos de 2 minutos no portal ou na app.' },
          ].map(tp => (
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
          <h2>Esteja preparado antes de precisar.</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Crie o seu perfil agora. Em caso de urgência, os dados já estão prontos para enviar.</p>
          <Link to="/register" className="lp-cta lp-cta--primary" style={{ display: 'inline-flex' }}>
            Criar conta gratuita <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
