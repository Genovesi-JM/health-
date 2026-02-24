import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Activity, Stethoscope, Shield, Clock, Heart, Users,
  Zap, Lock, BarChart3, Smartphone, Globe, HeartPulse,
} from 'lucide-react';

export default function LandingPage() {
  const services = [
    { icon: Activity, title: 'Triagem Inteligente', desc: 'Sistema de avaliação baseado em sintomas com classificação de risco automática e recomendação de ação clínica.' },
    { icon: Stethoscope, title: 'Teleconsulta Médica', desc: 'Consultas online com médicos verificados, agendamento flexível e histórico clínico integrado.' },
    { icon: Shield, title: 'Prescrições Digitais', desc: 'Receitas médicas digitais seguras, com validação e acompanhamento de tratamento.' },
    { icon: Clock, title: 'Acompanhamento Contínuo', desc: 'Monitorização do estado de saúde, lembretes de medicação e acompanhamento pós-consulta.' },
    { icon: Users, title: 'Gestão Corporativa', desc: 'Soluções para empresas e organizações com painel de saúde ocupacional e relatórios.' },
    { icon: HeartPulse, title: 'Urgência & Emergência', desc: 'Identificação rápida de casos urgentes com encaminhamento prioritário para serviços de emergência.' },
  ];

  const features = [
    { icon: Zap, title: 'Resposta Imediata', desc: 'Triagem em menos de 3 minutos com recomendações baseadas em protocolos clínicos.' },
    { icon: Lock, title: 'Dados Seguros', desc: 'Encriptação ponta-a-ponta, conformidade com LGPD e controlo total dos seus dados de saúde.' },
    { icon: BarChart3, title: 'Analytics Clínico', desc: 'Dashboards com KPIs de saúde, tendências e relatórios para gestão clínica.' },
    { icon: Smartphone, title: 'Acesso Universal', desc: 'Plataforma responsiva acessível de qualquer dispositivo, a qualquer hora.' },
    { icon: Globe, title: 'Cobertura Nacional', desc: 'Rede de médicos verificados em todo o território, disponíveis para teleconsulta.' },
    { icon: Heart, title: 'Cuidado Humanizado', desc: 'Tecnologia ao serviço da saúde, mantendo o foco no paciente e na qualidade de vida.' },
  ];

  const stats = [
    { value: '150+', label: 'Pacientes' },
    { value: '25+', label: 'Médicos' },
    { value: '98%', label: 'Satisfação' },
    { value: '24/7', label: 'Disponível' },
  ];

  return (
    <>
      <Navbar />

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            <HeartPulse size={14} /> Plataforma Digital de Saúde
          </div>
          <h1>
            Saúde Digital<br />
            <span className="gradient-text">Triagem & Teleconsulta</span>
          </h1>
          <p>
            Plataforma inteligente de triagem médica e teleconsulta.
            Avalie sintomas, receba recomendações clínicas e conecte-se com médicos — tudo num único portal.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary btn-lg">Começar Agora</Link>
            <Link to="/about" className="btn btn-outline btn-lg">Saber Mais</Link>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            {stats.map(s => (
              <div className="stat-item" key={s.label}>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section className="section" style={{ background: 'var(--bg-darker)' }}>
        <div className="section-header">
          <h2>Os Nossos Serviços</h2>
          <p>Soluções digitais completas para o seu percurso de saúde</p>
        </div>
        <div className="services-grid">
          {services.map(s => (
            <div className="service-card" key={s.title}>
              <div className="service-card-icon"><s.icon size={22} /></div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="section">
        <div className="section-header">
          <h2>Porque Escolher-nos</h2>
          <p>Tecnologia avançada ao serviço da sua saúde</p>
        </div>
        <div className="features-grid">
          {features.map(f => (
            <div className="feature-card" key={f.title}>
              <div className="feature-card-icon"><f.icon size={22} /></div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <h2>Pronto para cuidar da sua saúde?</h2>
        <p>Registe-se gratuitamente e comece a sua triagem em menos de 3 minutos.</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" className="btn btn-primary btn-lg">Criar Conta Grátis</Link>
          <Link to="/login" className="btn btn-outline btn-lg">Já tenho conta</Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
