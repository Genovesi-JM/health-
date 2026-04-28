import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Building2, Users, TrendingUp, Shield, RefreshCw, Clock, CheckCircle2, ArrowRight, Mail } from 'lucide-react';

const FEATURES = [
  { icon: Users,      title: 'Teleconsulta para staff',   desc: 'Médico disponível para toda a equipa, sem deslocação.' },
  { icon: TrendingUp, title: 'Dashboard RH anónimo',      desc: 'Tendências de saúde da equipa sem violar privacidade individual.' },
  { icon: RefreshCw,  title: 'Check-ups anuais',          desc: 'Agenda e relatórios de check-up para todos os colaboradores.' },
  { icon: Shield,     title: 'Gestão de crónicos',        desc: 'Acompanhamento e alertas para colaboradores com condições crónicas.' },
  { icon: Clock,      title: 'Resposta rápida',           desc: 'SLA de atendimento médico garantido para urgências da equipa.' },
  { icon: CheckCircle2, title: 'Compliance',              desc: 'Relatórios e certificados de saúde ocupacional para auditorias.' },
];

const PLANS = [
  { label: 'Start',      employees: 'até 20',  price: 'Sob consulta', features: ['Teleconsulta básica', 'Perfis individuais', 'Suporte email'] },
  { label: 'Business',   employees: 'até 100', price: 'Sob consulta', features: ['Tudo do Start', 'Dashboard RH', 'Check-up anual', 'Relatórios'], featured: true },
  { label: 'Enterprise', employees: '100+',    price: 'Sob consulta', features: ['Tudo do Business', 'API dedicada', 'Onboarding presencial', 'SLA garantido', 'Gestor dedicado'] },
];

export default function EmpresasPage() {
  return (
    <div className="landing-wrapper">
      <Navbar />

      <section className="lp-page-hero" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(15,23,42,0) 60%)' }}>
        <div className="lp-tag" style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa' }}><Building2 size={13} /> Para Empresas</div>
        <h1>A saúde da sua equipa,<br />organizada e acessível.</h1>
        <p>Reduza absentismo. Melhore produtividade. Ofereça aos seus colaboradores um benefício de saúde real — sem burocracia.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <a href="mailto:empresas@carefast.ao" className="lp-cta lp-cta--secondary"><Mail size={16} /> Falar com a equipa</a>
          <Link to="/contacto" className="lp-cta lp-cta--outline">Contactar <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">O que incluímos</div>
          <h2>Saúde corporativa completa.</h2>
          <p>Desde teleconsulta a compliance de saúde ocupacional — tudo numa só plataforma.</p>
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
          <div className="lp-tag">Planos</div>
          <h2>Escolha o plano certo para a sua empresa.</h2>
          <p>Todos os planos incluem onboarding, suporte e formação para a equipa.</p>
        </div>
        <div className="lp-pricing" style={{ maxWidth: '900px', margin: '0 auto' }}>
          {PLANS.map(p => (
            <div key={p.label} className={`lp-price-card${p.featured ? ' lp-price-card--featured' : ''}`}>
              <div className="lp-price-label">{p.label}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{p.employees} colaboradores</div>
              <div className="lp-price-amount">{p.price}</div>
              <ul>{p.features.map(f => (<li key={f}><CheckCircle2 size={13} style={{ color: p.featured ? '#fff' : '#7c3aed' }} /> {f}</li>))}</ul>
              <a href="mailto:empresas@carefast.ao" className="lp-price-cta" style={p.featured ? { background: '#fff', color: '#7c3aed' } : { background: '#7c3aed', color: '#fff' }}>
                Pedir proposta
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section lp-section--alt">
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <h2>Pronto para avançar?</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Fale connosco. Preparamos uma proposta personalizada para o tamanho e necessidades da sua empresa.</p>
          <a href="mailto:empresas@carefast.ao" className="lp-cta lp-cta--secondary" style={{ display: 'inline-flex' }}><Mail size={16} /> empresas@carefast.ao</a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
