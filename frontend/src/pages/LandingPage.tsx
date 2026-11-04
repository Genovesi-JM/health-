import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import CareJourneyScene from '../components/CareJourneyScene';
import JourneyScroll from '../components/JourneyScroll';
import Spot, { type SpotName } from '../components/Spots';
import {
  HeartPulse, Calendar, Video, RefreshCw, Search,
  Activity, ArrowRight, CheckCircle2, Shield, Zap,
  Stethoscope, Users, Building2, Phone,
  Clock, ChevronRight, Heart, Pill, AlertTriangle,
  TrendingUp, Lock, Smartphone, MonitorSmartphone,
  Baby, Brain, Eye, Bone, Apple, Wind,
  Ambulance, Plane, Navigation, Accessibility, Siren,
  FileText, UserCheck, Home,
} from 'lucide-react';
import '../landing-cinematic.css';

const TRANSPORT_TIERS = [
  { spot: 'accessible', color: '#2dd4bf', title: 'Mobilidade acessível',     desc: 'Apoio não-clínico ao passageiro — chegar à consulta com dignidade.' },
  { spot: 'scheduled', color: '#22d3ee', title: 'Transporte agendado',       desc: 'Transporte de paciente planeado, com operador qualificado e destino certo.' },
  { spot: 'assisted', color: '#5eead4', title: 'Transferência assistida',   desc: 'Apoio clínico definido, equipa e equipamento para o percurso.' },
  { spot: 'emergency', color: '#ef4444', title: 'Emergência pré-hospitalar', desc: 'Despacho, governação clínica e resposta quando o tempo conta.' },
];

const CARE_PILLARS = [
  { spot: 'family', title: 'Saúde pessoal & familiar', desc: 'Historial, documentos, medicação e lembretes organizados. Cuidadores acedem com permissões explícitas.' },
  { spot: 'professional', title: 'Cuidado profissional',     desc: 'Médicos e enfermeiros: consulta, revisão e acompanhamento dentro do âmbito verificado.' },
  { spot: 'prescription', title: 'Receita digital · e-prescription', desc: 'Receba e renove receitas digitalmente — com decisão médica autorizada e dispensa em farmácias parceiras.' },
  { spot: 'ambulance', title: 'Transporte & ambulância',  desc: 'O caminho físico até ao cuidado — agendado ou de emergência — ligado à sua consulta.' },
];

const SPECIALTIES = [
  { icon: Stethoscope, label: 'Clínica Geral',   color: '#0d9488' },
  { icon: Baby,        label: 'Pediatria',        color: '#0891b2' },
  { icon: Heart,       label: 'Ginecologia',      color: '#db2777' },
  { icon: HeartPulse,  label: 'Cardiologia',      color: '#dc2626' },
  { icon: Activity,    label: 'Dermatologia',     color: '#ea580c' },
  { icon: Brain,       label: 'Psicologia',       color: '#7c3aed' },
  { icon: Brain,       label: 'Psiquiatria',      color: '#6d28d9' },
  { icon: Eye,         label: 'Oftalmologia',     color: '#0369a1' },
  { icon: Stethoscope, label: 'Dentária',         color: '#0891b2' },
  { icon: Wind,        label: 'Fisioterapia',     color: '#059669' },
  { icon: Activity,    label: 'Neurologia',       color: '#4f46e5' },
  { icon: Bone,        label: 'Ortopedia',        color: '#b45309' },
  { icon: Apple,       label: 'Nutrição',         color: '#16a34a' },
];

const HOW_STEPS = [
  { num: '01', icon: Search,     title: 'Escolhe o serviço',       desc: 'Marcação, teleconsulta, renovação de receita ou triagem — tudo num só lugar.', color: '#0d9488' },
  { num: '02', icon: Video,      title: 'Recebe orientação médica', desc: 'Um médico real analisa a sua situação. Nenhuma decisão clínica é tomada por software.', color: '#0891b2' },
  { num: '03', icon: HeartPulse, title: 'Continua o cuidado',      desc: 'O seu historial, medicação e próximas consultas ficam acessíveis a qualquer momento.', color: '#7c3aed' },
];

const PREMIUM_PLANS = [
  { icon: Users,     label: 'Plano Família',     color: '#0d9488', desc: 'Cobertura total para toda a família num único portal.', features: ['Perfis ilimitados', 'Consultas partilhadas', 'Alertas familiares', 'Historial integrado'], cta: 'Plano Família', featured: false },
  { icon: Heart,     label: 'Cuidado Crónico',    color: '#dc2626', desc: 'Acompanhamento contínuo para condições crónicas.', features: ['Monitorização de vitais', 'Renovação automática', 'Coach de aderência', 'Alertas de risco'], cta: 'Cuidado Crónico', featured: true },
  { icon: Building2, label: 'Empresas',       color: '#7c3aed', desc: 'Saúde ocupacional para equipas sem burocracia.', features: ['Painel RH anónimo', 'Teleconsulta staff', 'Check-ups anuais', 'Gestão absentismo'], cta: 'Empresas', featured: false },
  { icon: Zap,       label: 'Acesso Prioritário', color: '#b45309', desc: 'Acesso prioritário e chegada pre-alerta em hospitais.', features: ['Fila prioritária', 'Pre-alerta hospitalar', 'Médico dedicado', 'Teleconsulta imediata'], cta: 'Prioritário', featured: false },
];

const PARTNERSHIP_TYPES = [
  {
    icon: Stethoscope,
    color: '#0d9488',
    title: 'Médico individual / independente',
    desc: 'Consulta presencial ou teleconsulta. Integração simples, sem mensalidades de entrada. O portal trata das marcações e do historial do paciente.',
    cta: 'Candidatar-me como médico',
  },
  {
    icon: Building2,
    color: '#2563eb',
    title: 'Clínica ou centro de saúde',
    desc: 'Gestão de agenda, triagem digital pré-consulta e acesso ao histórico do paciente. Painel próprio para a equipa clínica.',
    cta: 'Candidatar a minha clínica',
  },
  {
    icon: HeartPulse,
    color: '#7c3aed',
    title: 'Hospital ou instituição',
    desc: 'Integração de fluxos de urgência, pré-alertas e continuidade de cuidados pós-alta. Fale connosco para uma proposta à medida.',
    cta: 'Falar com a equipa',
  },
];

const TRUST_POINTS = [
  { icon: Shield,       label: 'Médico real valida tudo',  desc: 'Nenhuma decisão clínica é tomada por IA ou software.' },
  { icon: Lock,         label: 'Dados protegidos',         desc: 'Historial clínico encriptado. Só você e o seu médico acedem.' },
  { icon: CheckCircle2, label: 'Transparente',             desc: 'Mostramos o que fazemos e o que não fazemos. Sempre.' },
  { icon: TrendingUp,   label: 'Continuidade real',        desc: 'O cuidado não termina com a consulta. Acompanhamos.' },
];

const AUDIENCES = [
  {
    key: 'pacientes',
    label: 'Pacientes',
    icon: '🧑‍⚕️',
    color: '#0d9488',
    imgColor: '#f0fdf9',
  },
  {
    key: 'medicos',
    label: 'Médicos',
    icon: '👨‍⚕️',
    color: '#2563eb',
    imgColor: '#eff6ff',
  },
  {
    key: 'especialistas',
    label: 'Especialistas',
    icon: '🔬',
    color: '#7c3aed',
    imgColor: '#f5f3ff',
  },
  {
    key: 'clinicas',
    label: 'Clínicas',
    icon: '🏥',
    color: '#0891b2',
    imgColor: '#ecfeff',
  },
  {
    key: 'dispositivos',
    label: 'Dispositivos',
    icon: '📱',
    color: '#ea580c',
    imgColor: '#fff7ed',
  },
];

const TRIAGE_OUTCOMES = [
  { icon: AlertTriangle,    color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   label: '🔴 Urgência',          sub: 'Dirige-se imediatamente. Hospital pré-alertado.' },
  { icon: MonitorSmartphone,color: '#0891b2', bg: 'rgba(8,145,178,0.08)',   border: 'rgba(8,145,178,0.2)',   label: '🟠 Teleconsulta',       sub: 'Médico disponível em minutos.' },
  { icon: Calendar,         color: '#16a34a', bg: 'rgba(22,163,74,0.08)',   border: 'rgba(22,163,74,0.2)',   label: '🟢 Consulta Agendada',  sub: 'Marcação na clínica mais próxima.' },
];

const AUDIENCE_HIGHLIGHTS: Record<string, string[]> = {
  pacientes:     ['Triagem e teleconsulta', 'Receitas e renovações', 'Historial sempre acessível', 'Perfis para a família'],
  medicos:       ['Agenda e marcações', 'Teleconsulta integrada', 'Historial clínico do paciente', 'Sem mensalidades de entrada'],
  especialistas: ['Segunda opinião médica', 'Encaminhamentos simples', 'Rede de especialidades', 'Presencial ou online'],
  clinicas:      ['Painel para a equipa', 'Triagem digital pré-consulta', 'Gestão de agenda', 'Continuidade de cuidados'],
  dispositivos:  ['Tensiómetro e glicómetro', 'Oxímetro e balança', 'Dados enviados ao médico', 'Alertas de risco'],
};

export default function LandingPage() {
  const [activeAudience, setActiveAudience] = useState(0);
  const [animating, setAnimating] = useState(false);

  // Auto-rotate every 4 seconds
  useEffect(() => {
    const t = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setActiveAudience(a => (a + 1) % AUDIENCES.length);
        setAnimating(false);
      }, 200);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  // Cinematic scroll reveal
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.reveal:not(.reveal--in)'));
    if (!('IntersectionObserver' in window) || els.length === 0) {
      els.forEach(el => el.classList.add('reveal--in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('reveal--in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  const switchAudience = (idx: number) => {
    if (idx === activeAudience) return;
    setAnimating(true);
    setTimeout(() => { setActiveAudience(idx); setAnimating(false); }, 200);
  };

  const aud = AUDIENCES[activeAudience];

  return (
    <div className="landing-wrapper cine">
      <Navbar />

      {/* ══ CINEMATIC HERO ════════════════════════════════ */}
      <section className="cine-hero">
        <div className="cine-aurora" />
        <div className="cine-hero__grid">
          <div className="reveal reveal--in">
            <span className="cine-eyebrow"><Navigation size={13} /> Luanda · Angola — Cuidado digital + transporte</span>
            <h1 className="cine-title">Cuidado que <span className="accent">chega até si.</span></h1>
            <p className="cine-sub">
              Consultas, receitas e acompanhamento contínuo — e o <strong style={{ color: '#eafbf7' }}>transporte seguro
              ou a ambulância</strong> que o leva ao cuidado certo. A sua saúde começa em casa.
            </p>
            <div className="cine-ctas">
              <Link to="/register" className="cine-btn cine-btn--primary"><Calendar size={17} /> Criar conta grátis</Link>
              <Link to="/login" className="cine-btn cine-btn--ghost"><ArrowRight size={17} /> Entrar no Portal</Link>
              <a href="#transporte" className="cine-btn cine-btn--alert"><Ambulance size={17} /> Transporte &amp; ambulância</a>
            </div>
            <div className="cine-stats">
              {[
                { v: '4 + 1', l: 'Serviços de cuidado + transporte' },
                { v: '24/7',  l: 'Coordenação digital' },
                { v: '100%',  l: 'Médico real decide' },
                { v: 'Luanda', l: 'Primeiro piloto' },
              ].map(s => (
                <div key={s.l}><span className="cine-stat__v">{s.v}</span><span className="cine-stat__l">{s.l}</span></div>
              ))}
            </div>
          </div>

          {/* Journey card — the route to care */}
          <div className="cine-stage reveal" data-d="2">
            <CareJourneyScene />
            <div className="kaya-scene__cap"><span className="cine-live" /> Da casa ao cuidado — e de volta.</div>
          </div>
        </div>
      </section>

      {/* ══ SCROLL-DRIVEN JOURNEY ══════════════════════════ */}
      <JourneyScroll />

      {/* ══ TRANSPORTE & AMBULÂNCIA — PRIORIDADE ═══════════ */}
      <section id="transporte" className="cine-transport">
        <div className="cine-wrap">
          <div className="cine-head reveal">
            <span className="cine-tag"><Ambulance size={13} /> Transporte &amp; Ambulância · Para pacientes e hospitais</span>
            <h2 className="cine-h2">O caminho até ao cuidado — resolvido.</h2>
            <p className="cine-lead">
              Transporte de pacientes e ambulância para quem precisa de chegar ao cuidado e para hospitais que
              recebem e transferem doentes. Do agendamento à chegada, com operador qualificado e handover clínico.
            </p>
          </div>
          <div className="cine-tgrid">
            {TRANSPORT_TIERS.map((t, i) => (
              <div key={t.title} className="cine-tcard reveal" data-d={String((i % 4) + 1)} style={{ '--tc': t.color } as React.CSSProperties}>
                <span className="cine-tcard__step">0{i + 1}</span>
                <div className="cine-tcard__art"><Spot name={t.spot as SpotName} /></div>
                <div className="cine-tcard__t">{t.title}</div>
                <div className="cine-tcard__d">{t.desc}</div>
              </div>
            ))}
          </div>
          <div className="cine-transport__cta reveal">
            <Link to="/urgencia" className="cine-btn cine-btn--alert"><Siren size={17} /> Emergência &amp; pré-alerta</Link>
            <Link to="/register" className="cine-btn cine-btn--ghost"><ArrowRight size={17} /> Pedir transporte</Link>
          </div>
          <p className="cine-note">
            Transporte agendado e ambulância médica são serviços distintos, com operador qualificado e requisitos próprios. Luanda — fase piloto.
          </p>
        </div>
      </section>

      {/* ══ PILARES DE CUIDADO ═════════════════════════════ */}
      <section className="cine-care">
        <div className="cine-wrap">
          <div className="cine-head center reveal">
            <span className="cine-eyebrow"><HeartPulse size={13} /> Cuidado conectado</span>
            <h2 className="cine-h2">Saúde pessoal. Cuidado profissional. Continuidade.</h2>
            <p className="cine-lead" style={{ margin: '0 auto' }}>
              Quatro serviços de cuidado ligados ao transporte — para que nada se perca entre a necessidade e a chegada.
            </p>
          </div>
          <div className="cine-pillars">
            {CARE_PILLARS.map((p, i) => (
              <div key={p.title} className="cine-pillar reveal" data-d={String((i % 4) + 1)}>
                <div className="cine-pillar__art"><Spot name={p.spot as SpotName} /></div>
                <div className="cine-pillar__t">{p.title}</div>
                <div className="cine-pillar__d">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ COMO FUNCIONA ════════════════════════════════ */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">Como funciona</div>
          <h2>Três passos para cuidado completo.</h2>
          <p>De qualquer sintoma a um plano de saúde claro — simples, seguro e sempre acompanhado por um médico.</p>
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

      {/* ══ ECOSYSTEM ══════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">Ecossistema KAYA</div>
          <h2>Um sistema de saúde completo.</h2>
          <p>Do paciente ao hospital, do pedido à chegada — cuidado, receita digital e transporte numa só plataforma.</p>
        </div>
        <div className="ecosystem-grid">
          {[
            { icon: Users,     color: '#0d9488', to: '/patients',    label: 'Para Pacientes',    desc: 'Consultas, receita digital, família e transporte.' },
            { icon: Building2, color: '#0891b2', to: '/clinics',     label: 'Para Hospitais & Clínicas', desc: 'Médicos, clínicas e hospitais — e transporte de doentes.' },
            { icon: Pill,      color: '#0f766e', to: '/clinics',     label: 'Farmácias parceiras', desc: 'Dispensa de receitas em farmácias parceiras.' },
            { icon: Heart,     color: '#dc2626', to: '/chronic-care',label: 'Cuidado Crónico',   desc: 'Hipertensão, diabetes, asma — contínuos.' },
            { icon: Ambulance, color: '#0e7490', to: '/urgencia',    label: 'Transporte & Urgência', desc: 'Transporte agendado, ambulância e pré-alerta.' },
            { icon: Phone,     color: '#059669', to: '/contacto',    label: 'Contacto',          desc: 'Fale com a equipa KAYA.' },
          ].map(item => (
            <Link key={item.to} to={item.to} className="ecosystem-card">
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${item.color}15`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <item.icon size={22} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.3rem' }}>{item.label}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</div>
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: item.color, fontWeight: 600 }}>
                Saber mais <ArrowRight size={13} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ══ PORQUÊ CAREFAST+ ════════════════════════════ */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">Porque nos escolher</div>
          <h2>Cuidados de saúde simplificados. Sem atalhos.</h2>
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

      {/* ══ FINAL CTA ════════════════════════════════════ */}
      <section className="lp-final-cta">
        <div className="lp-tag" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>KAYA — O seu sistema de saúde</div>
        <h2>Acesso rápido à saúde começa aqui.</h2>
        <p>Junte-se a um ecossistema de saúde digital construído para Angola — e para o mundo.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/register" className="lp-cta lp-cta--white">Criar conta gratuita</Link>
          <Link to="/login" className="lp-cta lp-cta--white-outline"><ArrowRight size={15} /> Entrar no Portal</Link>
          <Link to="/contacto" className="lp-cta lp-cta--white-outline"><Phone size={15} /> Falar connosco</Link>
        </div>
        <div style={{ marginTop: '2rem', display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {['Sem diagnóstico por IA', 'Médico real valida tudo', 'Dados encriptados', 'Transparente'].map(t => (
            <span key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.83rem', color: 'rgba(255,255,255,0.7)' }}>
              <CheckCircle2 size={13} style={{ color: 'rgba(255,255,255,0.5)' }} /> {t}
            </span>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
