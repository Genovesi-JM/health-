import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Building2, TrendingUp, Calendar, Video, Activity,
  Shield, Clock, Users, ArrowRight,
  BarChart2, Zap, FileText, Mail, Stethoscope,
  Banknote, Smartphone, HeartPulse, UserCheck, Globe,
} from 'lucide-react';

const DOCTOR_BENEFITS = [
  {
    icon: Banknote,
    color: '#0d9488',
    title: 'Receita extra sem overhead',
    desc: 'Receba pacientes online fora do seu horário principal. Sem aluguer de consultório, sem secretária — só você e o paciente.',
  },
  {
    icon: Calendar,
    color: '#2563eb',
    title: 'Você controla a agenda',
    desc: 'Define os seus horários disponíveis. Aceita ou recusa pedidos. Total autonomia sobre quando e quantos pacientes atende.',
  },
  {
    icon: Smartphone,
    color: '#7c3aed',
    title: 'Tudo no portal — sem papelada',
    desc: 'Histórico do paciente, triagem prévia, resultados e prescrições digitais num só lugar. Consulta mais focada, menos tempo administrativo.',
  },
  {
    icon: Globe,
    color: '#d97706',
    title: 'Alcance além da sua localização',
    desc: 'Ofereça teleconsultas para pacientes em qualquer parte do país. O seu conhecimento não tem fronteiras geográficas.',
  },
  {
    icon: UserCheck,
    color: '#059669',
    title: 'Perfil verificado e visível',
    desc: 'O seu perfil aparece na rede CareFast+. Os pacientes vêem as suas especialidades, disponibilidade e podem marcar em tempo real.',
  },
  {
    icon: HeartPulse,
    color: '#dc2626',
    title: 'Dados vitais antes da consulta',
    desc: 'O paciente sincroniza os dispositivos antes de entrar. Chega com tensão, glicemia e SpO₂ já registados — consulta mais eficiente.',
  },
];

const CLINIC_BENEFITS = [
  { icon: Calendar,  color: '#0d9488', title: 'Marcações online 24/7',       desc: 'Os pacientes marcam directamente. Sem telefonemas, confirmação automática.' },
  { icon: Clock,     color: '#0891b2', title: 'Menos tempo de espera',        desc: 'Pré-consulta digital organiza chegadas. Menos congestionamento na recepção.' },
  { icon: Video,     color: '#7c3aed', title: 'Teleconsulta integrada',       desc: 'Ofereça consultas por vídeo sem investimento em infraestrutura adicional.' },
  { icon: BarChart2, color: '#d97706', title: 'Dashboard de gestão',          desc: 'Ocupação, especialidades e cancelamentos — dados para decisões melhores.' },
  { icon: Users,     color: '#059669', title: 'Fidelização de pacientes',     desc: 'Lembretes automáticos e seguimento de crónicos mantêm os pacientes activos.' },
  { icon: Shield,    color: '#0d9488', title: 'Segurança e conformidade',     desc: 'Dados clínicos encriptados. Auditoria completa de acessos.' },
];

const PROCESS = [
  { step: '01', icon: Mail,       color: '#0d9488', title: 'Envie o seu interesse',     desc: 'Preencha o formulário ou escreva para parcerias@carefast.ao. Respondemos em 24 horas.' },
  { step: '02', icon: FileText,   color: '#0891b2', title: 'Verificação rápida',         desc: 'Validamos as credenciais e especialidades. Processo confidencial e sem custos.' },
  { step: '03', icon: Zap,        color: '#7c3aed', title: 'Activação do perfil',        desc: 'Configuramos o perfil e activamos o acesso. Para médicos individuais: menos de 48h.' },
  { step: '04', icon: TrendingUp, color: '#d97706', title: 'Comece a receber pacientes', desc: 'O seu perfil fica visível na rede. Pacientes marcam em tempo real.' },
];

export default function ClinicsPage() {
  return (
    <div className="landing-wrapper">
      <Navbar />

      {/* ── Hero ── */}
      <section className="lp-page-hero">
        <div className="lp-tag"><Stethoscope size={12} /> Para Profissionais de Saúde</div>
        <h1>Trabalhe de forma<br /><span className="lp-hero__accent">independente e digital.</span></h1>
        <p>
          Seja médico individual, clínica ou instituição — há um lugar para si no CareFast+.
          Receba pacientes online, gerencie a sua agenda e cresça sem burocracia.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <a href="mailto:parcerias@carefast.ao" className="lp-cta lp-cta--primary">
            <Stethoscope size={15} /> Candidatar-me como médico
          </a>
          <Link to="/contacto" className="lp-cta lp-cta--secondary">
            <Building2 size={15} /> Inscrever a minha clínica
          </Link>
        </div>
        <p style={{ marginTop: '1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Sem compromissos. Sem custos de entrada. Respondemos em 24h.
        </p>
      </section>

      {/* ── Para médicos individuais ── */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag" style={{ background: 'rgba(15,118,110,0.1)', color: '#0d9488' }}>
            <Stethoscope size={11} /> Médicos independentes
          </div>
          <h2>A sua consulta, às suas condições.</h2>
          <p>
            Médico recém-formado, especialista em part-time, ou simplesmente quer
            uma fonte de rendimento extra — o CareFast+ funciona para si.
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
          <a href="mailto:parcerias@carefast.ao" className="lp-cta lp-cta--primary" style={{ display: 'inline-flex' }}>
            <Stethoscope size={15} /> Quero ser médico parceiro <ArrowRight size={14} />
          </a>
        </div>
      </section>

      {/* ── Para clínicas e instituições ── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag"><Building2 size={11} /> Clínicas e instituições</div>
          <h2>Digitalize o seu atendimento.</h2>
          <p>Para clínicas, centros de saúde e hospitais que querem modernizar sem mudar o sistema actual.</p>
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
          <div className="lp-tag">Quem pode aderir</div>
          <h2>A rede está aberta para todos.</h2>
          <p>Não importa a dimensão. Importa a qualidade do cuidado.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', maxWidth: 860, margin: '0 auto' }}>
          {[
            { icon: Stethoscope, color: '#0d9488', label: 'Médico em início de carreira', desc: 'Construa carteira de pacientes sem depender de uma clínica.' },
            { icon: Activity,    color: '#2563eb', label: 'Especialista em part-time',     desc: 'Monetize horas livres. Sem contrato exclusivo.' },
            { icon: HeartPulse,  color: '#7c3aed', label: 'Clínica de 1–3 médicos',        desc: 'Gestão simples, marcações automáticas, sem investimento pesado.' },
            { icon: BarChart2,   color: '#d97706', label: 'Centro ou policlínica',          desc: 'Dashboard multi-especialidade e analytics de ocupação.' },
            { icon: UserCheck,   color: '#059669', label: 'Médico reformado em part-time',  desc: 'Consulte ao seu ritmo, no conforto de casa ou no consultório.' },
            { icon: Building2,   color: '#dc2626', label: 'Instituição de saúde',           desc: 'Integração completa, API disponível, proposta à medida.' },
          ].map(c => (
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
          <div className="lp-tag">Como funciona</div>
          <h2>Quatro passos para começar.</h2>
          <p>Simples, rápido e sem custos iniciais.</p>
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
        <div className="lp-tag" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>Parcerias abertas</div>
        <h2>Pronto para começar?</h2>
        <p>Envie-nos um email ou preencha o formulário de contacto. Sem compromissos, sem custos iniciais.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <a href="mailto:parcerias@carefast.ao" className="lp-cta lp-cta--white">
            <Stethoscope size={15} /> parcerias@carefast.ao
          </a>
          <Link to="/contacto" className="lp-cta lp-cta--white-outline">
            Formulário de contacto <ArrowRight size={14} />
          </Link>
        </div>
        <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', opacity: 0.7 }}>Respondemos em menos de 24 horas.</p>
      </section>

      <Footer />
    </div>
  );
}
