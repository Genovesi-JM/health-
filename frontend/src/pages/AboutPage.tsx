import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Heart, Shield, Users, Award, Target, Lightbulb } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AboutPage() {
  const values = [
    { icon: Heart, title: 'Cuidado ao Paciente', desc: 'Colocamos o paciente no centro de cada decisão, garantindo uma experiência acessível e humanizada.' },
    { icon: Shield, title: 'Segurança & Privacidade', desc: 'Protecção rigorosa dos dados clínicos com encriptação e conformidade regulamentar.' },
    { icon: Users, title: 'Inclusão Digital', desc: 'Plataforma acessível a todos, independentemente da localização geográfica ou nível tecnológico.' },
    { icon: Award, title: 'Excelência Clínica', desc: 'Médicos verificados, protocolos baseados em evidência e melhoria contínua de qualidade.' },
    { icon: Target, title: 'Inovação Contínua', desc: 'Investimos em IA e machine learning para triagens cada vez mais precisas e eficientes.' },
    { icon: Lightbulb, title: 'Transparência', desc: 'Comunicação clara sobre custos, processos e resultados em todas as etapas do serviço.' },
  ];

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="hero" style={{ minHeight: '65vh' }}>
        <div className="hero-content">
          <div className="hero-badge">
            <Heart size={14} /> Sobre a Health Platform
          </div>
          <h1>
            Transformar a Saúde<br />
            <span className="gradient-text">com Tecnologia</span>
          </h1>
          <p>
            Somos uma plataforma digital de saúde que combina inteligência artificial,
            teleconsulta médica e gestão clínica para democratizar o acesso a cuidados de saúde de qualidade.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="section" style={{ background: 'var(--bg-darker)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            <div className="card">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                <span className="gradient-text">Missão</span>
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Democratizar o acesso à saúde através de uma plataforma inteligente de triagem e teleconsulta,
                conectando pacientes a profissionais de saúde qualificados de forma segura, eficiente e acessível.
              </p>
            </div>
            <div className="card">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                <span className="gradient-text">Visão</span>
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Ser a referência em saúde digital em África, liderando a transformação do acesso a cuidados
                de saúde com tecnologia de ponta e um compromisso inabalável com o bem-estar do paciente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section">
        <div className="section-header">
          <h2>Os Nossos Valores</h2>
          <p>Princípios que orientam tudo o que fazemos</p>
        </div>
        <div className="features-grid">
          {values.map(v => (
            <div className="feature-card" key={v.title}>
              <div className="feature-card-icon"><v.icon size={22} /></div>
              <h3>{v.title}</h3>
              <p>{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <h2>Junte-se a nós</h2>
        <p>Faça parte da revolução digital em saúde. Registe-se e comece hoje.</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" className="btn btn-primary btn-lg">Criar Conta</Link>
          <Link to="/login" className="btn btn-outline btn-lg">Portal</Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
