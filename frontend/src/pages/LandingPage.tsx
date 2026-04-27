import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useT } from '../i18n/LanguageContext';
import {
  HeartPulse, ClipboardCheck, Stethoscope, ArrowRight,
  UserPlus, Heart, Activity, Wind, Shield, Droplets,
  CalendarCheck, Zap, CheckCircle2, XCircle,
  Smartphone, AlertTriangle, Truck, Building2,
  Users, TrendingUp, Package, ChevronRight, Info,
} from 'lucide-react';

export default function LandingPage() {

  /* ── Value props shown in top strip ── */
  const valueProps = [
    { icon: Zap,          label: 'Acesso rápido' },
    { icon: Stethoscope,  label: 'Médico real, decisão humana' },
    { icon: HeartPulse,   label: 'Continuidade de cuidados' },
    { icon: Smartphone,   label: 'Conveniência total' },
    { icon: Shield,       label: 'Prevenção' },
    { icon: Building2,    label: 'Integração com parceiros' },
  ];

  /* ── The 4 differentiator layers ── */
  const layers = [
    {
      num: 'Layer 1', color: '#0d9488', label: 'Melhor experiência',
      points: ['UI/UX premium', 'Rápido e intuitivo', 'Reminders fortes', 'Histórico organizado'],
    },
    {
      num: 'Layer 2', color: '#0891b2', label: 'Suporte à decisão médica',
      points: ['Sinais vitais em casa', 'Triagem guiada por protocolo', 'Score de risco com alertas'],
    },
    {
      num: 'Layer 3', color: '#7c3aed', label: 'Continuidade de cuidados',
      points: ['Refill medicação via médico', 'Reminders de adesão', 'Follow-up de crónicos'],
    },
    {
      num: 'Layer 4', color: '#b45309', label: 'Acesso acelerado',
      points: ['Pre-book em hospital parceiro', 'Queue assist urgências', 'Teleconsulta imediata'],
    },
  ];

  /* ── Smart flow steps ── */
  const flowSteps = [
    { num: '1', icon: Smartphone,   label: 'Regista sintomas na app' },
    { num: '2', icon: Activity,     label: 'Mede sinais vitais em casa' },
    { num: '3', icon: ClipboardCheck, label: 'Score calculado por protocolo clínico' },
    { num: '4', icon: Stethoscope,  label: 'Médico digital analisa e recomenda' },
  ];

  /* ── Triage KPI examples ── */
  const kpiAlerts = [
    { label: 'Tensão arterial', value: '138/88 mmHg', score: 'Risco Moderado', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
    { label: 'SpO₂ (Oxigénio)', value: '91%',         score: 'Atenção',        color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
    { label: 'Temperatura',      value: '36.8 °C',     score: 'Normal',         color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
    { label: 'Glicémia',         value: '126 mg/dL',   score: 'Verificar',      color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  ];

  /* ── Flow outcomes ── */
  const flowOutcomes = [
    { color: '#ef4444', bg: '#fef2f2', border: '#fecaca', icon: AlertTriangle,  label: 'Urgência Imediata',  sub: 'Book chegada em hospital parceiro' },
    { color: '#0891b2', bg: '#eff6ff', border: '#bfdbfe', icon: Stethoscope,    label: 'Teleconsulta',       sub: 'Médico disponível · sem espera' },
    { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: CalendarCheck,  label: 'Consulta Agendada',  sub: 'Marcação em clínica parceira' },
  ];

  /* ── Connected devices ── */
  const devices = [
    { icon: Activity,   label: 'Tensão arterial smart' },
    { icon: Wind,       label: 'Oxímetro smart' },
    { icon: TrendingUp, label: 'Balança smart' },
    { icon: Zap,        label: 'Termómetro' },
    { icon: Droplets,   label: 'Glicómetro' },
    { icon: HeartPulse, label: 'ECG portátil' },
  ];

  /* ── Ecosystem nodes ── */
  const ecosystemNodes = [
    { label: 'Médicos Digitais',      color: '#0d9488', desc: 'Validam triagem, emitem receitas e orientam o paciente' },
    { label: 'Clínicas & Hospitais',  color: '#0891b2', desc: 'Parceiros para bookings, urgências e consultas presenciais' },
    { label: 'Farmácias Parceiras',   color: '#7c3aed', desc: 'Recebem a receita digital emitida pelo médico parceiro' },
    { label: 'Devices Conectados',    color: '#b45309', desc: 'Enviam sinais vitais em tempo real para o historial' },
    { label: 'Historial Clínico',     color: '#db2777', desc: 'Dados do paciente acessíveis ao médico em qualquer consulta' },
  ];

  /* ── Roadmap phases ── */
  const phases = [
    {
      phase: 'Fase 1', range: '0 – 6 meses', label: 'Base Sólida', color: '#0d9488',
      items: ['Bookings', 'Reminders', 'Teleconsulta', 'Refill via médico', 'Perfil do paciente'],
    },
    {
      phase: 'Fase 2', range: '6 – 18 meses', label: 'Expansão', color: '#0891b2',
      items: ['Rede de farmácias', 'Programas crónicos', 'Planos familiares', 'Parcerias estratégicas'],
    },
    {
      phase: 'Fase 3', range: '18+ meses', label: 'Diferenciação', color: '#7c3aed',
      items: ['Devices integrados', 'Triagem guiada (protocolo)', 'Urgent arrival booking', 'Queue assist'],
    },
  ];

  /* ── Pricing packs (devices) ── */
  const packs = [
    { label: 'Pack Básico Família', color: '#0d9488', items: ['Tensiómetro', 'Termómetro', 'Oxímetro'] },
    { label: 'Pack Crónico',        color: '#0891b2', items: ['Tensiómetro', 'Glicómetro', 'Balança smart'] },
    { label: 'Pack Sénior',         color: '#7c3aed', items: ['Tensão', 'Oxímetro', 'Deteção de quedas (wearable)'] },
    { label: 'Pack Premium',        color: '#b45309', items: ['Todos os dispositivos', 'Smartwatch', 'Monitorização completa'], highlight: true },
  ];

  /* ── Honest commitments: what IS and ISN'T promised ── */
  const promised = [
    'Triagem guiada com score de risco claro',
    'Médico real a validar cada recomendação',
    'Receitas emitidas por médico licenciado',
    'Booking imediato em hospital parceiro',
    'Historial clínico seguro e acessível',
    'Alertas baseados em protocolos clínicos validados',
  ];
  const notPromised = [
    'A app não diagnostica — o médico diagnostica',
    'Não substituímos o serviço de emergência (112)',
    'Não garantimos disponibilidade 24/7 de todos os médicos',
    'Não temos todos os especialistas em todas as regiões (ainda)',
    'A triagem não é infalível — é uma orientação inicial',
  ];

  const stats = [
    { value: '300+', label: 'Médicos parceiros' },
    { value: '20+',  label: 'Especialidades' },
    { value: '15min', label: 'Teleconsulta média' },
    { value: '100%', label: 'Decisão humana' },
  ];

  return (
    <>
      <Navbar />

      {/* ══ HERO ══ */}
      <section className="cf-hero">
        <div className="cf-hero-bg" />
        <div className="cf-hero-content">
          <div className="cf-hero-badge">🇦🇴 Luanda, Angola · Saúde Digital</div>
          <h1 className="cf-hero-title">
            O seu sistema de saúde.<br />
            <span className="cf-hero-accent">Sem pensar 2x.</span>
          </h1>
          <p className="cf-hero-sub">
            Não é só uma app. É o seu ecossistema de saúde — triagem por protocolo clínico,
            médico digital, farmácia e dispositivos conectados. Cada decisão é tomada
            por um <strong>médico real</strong>, não por um algoritmo.
          </p>
          <ul className="landing-hero-checklist">
            <li><CheckCircle2 size={15} /> Triagem guiada com score de risco e alertas visuais</li>
            <li><CheckCircle2 size={15} /> Médico digital valida e recomenda — sem substituir o 112</li>
            <li><CheckCircle2 size={15} /> Booking direto em hospital parceiro com um toque</li>
          </ul>
          <div className="cf-hero-actions">
            <Link to="/register" className="landing-btn-primary">
              Começar grátis <ArrowRight size={15} />
            </Link>
            <Link to="/services" className="landing-btn-secondary">
              Ver serviços
            </Link>
          </div>
        </div>
        <div className="cf-hero-visual">
          <div className="cf-hero-card cf-hero-card-main">
            <HeartPulse size={28} style={{ color: '#0d9488' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Score de Triagem</div>
              <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>⚠ Risco Moderado · Médico a avaliar</div>
            </div>
          </div>
          <div className="cf-hero-card cf-hero-card-alert">
            <Stethoscope size={22} style={{ color: '#0891b2' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0891b2' }}>Dr. António disponível</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Teleconsulta · Clínico geral</div>
            </div>
          </div>
          <div className="cf-hero-card cf-hero-card-device">
            <Building2 size={18} style={{ color: '#7c3aed' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>Hospital São Lucas</div>
              <div style={{ fontSize: '0.7rem', color: '#7c3aed' }}>Parceiro · Book chegada →</div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ VALUE PROPS STRIP ══ */}
      <section className="cf-props-strip">
        {valueProps.map(p => (
          <div className="cf-prop" key={p.label}>
            <p.icon size={18} style={{ color: 'var(--accent-teal)' }} />
            <span>{p.label}</span>
          </div>
        ))}
      </section>

      {/* ══ STATS ══ */}
      <section className="landing-stats-strip">
        {stats.map(s => (
          <div className="landing-stat" key={s.label}>
            <span className="landing-stat-value">{s.value}</span>
            <span className="landing-stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* ══ 1. O NOSSO DIFERENCIAL — 4 layers ══ */}
      <section className="landing-section">
        <div className="section-header">
          <div className="cf-section-tag">O Nosso Diferencial</div>
          <h2>Muito mais que booking.</h2>
          <p>Quatro camadas de valor que nenhuma app atual oferece em conjunto.</p>
        </div>
        <div className="cf-layers-grid">
          {layers.map(l => (
            <div className="cf-layer-card" key={l.num} style={{ borderTopColor: l.color }}>
              <div className="cf-layer-badge" style={{ background: l.color }}>{l.num}</div>
              <h3 style={{ color: l.color }}>{l.label}</h3>
              <ul className="cf-layer-list">
                {l.points.map(p => <li key={p}><ChevronRight size={13} />{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ══ 2. TRIAGEM EM CASA — KPIs, SCORE, ALERTA, BOOKING ══ */}
      <section className="landing-section landing-section-alt">
        <div className="section-header">
          <div className="cf-section-tag">Triagem em Casa</div>
          <h2>Do Sintoma ao Score — Médico Decide.</h2>
          <p>
            Regista os teus sintomas e mede os sinais vitais. O protocolo clínico calcula
            um score de risco. <strong>Um médico digital analisa e recomenda a próxima ação.</strong>
          </p>
        </div>

        {/* Flow steps */}
        <div className="cf-flow-steps">
          {flowSteps.map((s, i) => (
            <div className="cf-flow-step" key={s.num}>
              <div className="cf-flow-step-num">{s.num}</div>
              <s.icon size={22} style={{ color: 'var(--accent-teal)', margin: '0.5rem 0' }} />
              <span>{s.label}</span>
              {i < flowSteps.length - 1 && <ArrowRight size={18} className="cf-flow-arrow" />}
            </div>
          ))}
        </div>

        {/* KPI dashboard preview */}
        <div className="cf-kpi-title">Exemplo de painel de KPIs da triagem:</div>
        <div className="cf-kpi-grid">
          {kpiAlerts.map(k => (
            <div className="cf-kpi-card" key={k.label} style={{ borderColor: k.border, background: k.bg }}>
              <div className="cf-kpi-label">{k.label}</div>
              <div className="cf-kpi-value">{k.value}</div>
              <div className="cf-kpi-badge" style={{ background: k.color }}>{k.score}</div>
            </div>
          ))}
        </div>

        {/* Score + booking CTA example */}
        <div className="cf-score-block">
          <div className="cf-score-left">
            <div className="cf-score-label">Score final de risco</div>
            <div className="cf-score-value" style={{ color: '#ef4444' }}>Alto · 72/100</div>
            <div className="cf-score-sub">Baseado em protocolo clínico validado · Revisado pelo médico</div>
          </div>
          <div className="cf-score-right">
            <div className="cf-score-suggestion">
              ⚠ Sugestão do médico: avaliação presencial recomendada
            </div>
            <Link to="/register" className="landing-btn-primary cf-score-btn">
              <Building2 size={15} /> Fazer booking em hospital parceiro
            </Link>
            <Link to="/register" className="landing-btn-secondary cf-score-btn">
              <Stethoscope size={15} /> Ou falar com médico agora
            </Link>
          </div>
        </div>

        {/* Outcomes */}
        <div className="cf-flow-outcomes" style={{ marginTop: '1.5rem' }}>
          {flowOutcomes.map(o => (
            <div className="cf-outcome-card" key={o.label} style={{ background: o.bg, borderColor: o.border }}>
              <o.icon size={22} style={{ color: o.color }} />
              <div>
                <div style={{ fontWeight: 700, color: o.color, fontSize: '0.88rem' }}>{o.label}</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{o.sub}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="cf-flow-tagline">Orientação clara. Médico decide. Ação imediata.</p>
      </section>

      {/* ══ 3. FARMÁCIA INTELIGENTE ══ */}
      <section className="landing-section">
        <div className="section-header">
          <div className="cf-section-tag">Farmácia Inteligente</div>
          <h2>Renewal de medicação — sempre via médico.</h2>
          <p>A receita é emitida por um médico licenciado. A plataforma facilita. A responsabilidade é humana.</p>
        </div>
        <div className="cf-pharmacy-flow">
          {[
            { icon: ClipboardCheck, label: 'Pedido do Paciente' },
            { icon: UserPlus,       label: 'Médico Parceiro Avalia' },
            { icon: ClipboardCheck, label: 'Receita Digital Emitida' },
            { icon: Package,        label: 'Farmácia Parceira' },
          ].map((s, i, arr) => (
            <div className="cf-pharmacy-step" key={s.label}>
              <div className="cf-pharmacy-icon"><s.icon size={22} /></div>
              <span>{s.label}</span>
              {i < arr.length - 1 && <ArrowRight size={16} className="cf-pharm-arrow" />}
            </div>
          ))}
        </div>
        <div className="cf-pharmacy-benefits">
          {[
            'Receita sempre emitida por médico',
            'Mais adesão ao tratamento',
            'Menos deslocações desnecessárias',
          ].map(b => (
            <div className="cf-benefit-chip" key={b}>
              <CheckCircle2 size={14} style={{ color: '#16a34a' }} /> {b}
            </div>
          ))}
        </div>
      </section>

      {/* ══ 4. DISPOSITIVOS CONECTADOS ══ */}
      <section className="landing-section landing-section-alt">
        <div className="section-header">
          <div className="cf-section-tag">Devices + Dados + Médico</div>
          <h2>Cuidado Contínuo.</h2>
          <p>Não vendemos gadgets. Os dados chegam ao médico. Ele orienta.</p>
        </div>
        <div className="cf-devices-grid">
          {devices.map(d => (
            <div className="cf-device-chip" key={d.label}>
              <d.icon size={16} style={{ color: 'var(--accent-teal)' }} />
              {d.label}
            </div>
          ))}
        </div>
        <div className="cf-device-formula">
          <div className="cf-formula-box">📡 Mede em casa</div>
          <ArrowRight size={16} />
          <div className="cf-formula-box">☁️ Envia automaticamente</div>
          <ArrowRight size={16} />
          <div className="cf-formula-box">👨‍⚕️ Médico interpreta</div>
          <ArrowRight size={16} />
          <div className="cf-formula-box">🔔 Alerta com orientação</div>
          <ArrowRight size={16} />
          <div className="cf-formula-box cf-formula-box-accent">⚡ Ação quando importa</div>
        </div>
        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.9rem' }}>
          Tensiómetro sozinho = gadget. &nbsp;|&nbsp; Tensiómetro na nossa plataforma = médico que interpreta. 💙
        </p>
      </section>

      {/* ══ 5. O ECOSSISTEMA ══ */}
      <section className="landing-section">
        <div className="section-header">
          <div className="cf-section-tag">O Ecossistema</div>
          <h2>O paciente no centro. Tudo conectado.</h2>
          <p>Cada nó do ecossistema serve o paciente. Mais integração = melhor cuidado.</p>
        </div>
        <div className="cf-ecosystem-full">
          <div className="cf-ecosystem-center-box">
            <Users size={30} style={{ color: '#fff' }} />
            <span>PACIENTE</span>
          </div>
          <div className="cf-ecosystem-cards">
            {ecosystemNodes.map(e => (
              <div className="cf-ecosystem-card" key={e.label} style={{ borderLeftColor: e.color }}>
                <div className="cf-ecosystem-card-title" style={{ color: e.color }}>{e.label}</div>
                <div className="cf-ecosystem-card-desc">{e.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 6. HONESTIDADE — O QUE PROMETEMOS E NÃO PROMETEMOS ══ */}
      <section className="landing-section landing-section-alt">
        <div className="section-header">
          <div className="cf-section-tag">Transparência total</div>
          <h2>O que prometemos. O que não prometemos.</h2>
          <p>Segurança e confiança acima de tudo. Usamos linguagem responsável.</p>
        </div>
        <div className="cf-honest-grid">
          <div className="cf-honest-col cf-honest-yes">
            <div className="cf-honest-header">
              <CheckCircle2 size={20} style={{ color: '#16a34a' }} />
              <span>O que oferecemos</span>
            </div>
            <ul>
              {promised.map(p => (
                <li key={p}><CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0 }} />{p}</li>
              ))}
            </ul>
          </div>
          <div className="cf-honest-col cf-honest-no">
            <div className="cf-honest-header">
              <Info size={20} style={{ color: '#f59e0b' }} />
              <span>Limitações importantes</span>
            </div>
            <ul>
              {notPromised.map(p => (
                <li key={p}><XCircle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />{p}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="cf-honest-note">
          ⚠ Em caso de emergência ligue sempre para o <strong>112</strong>. Esta plataforma não substitui o serviço de emergência.
        </p>
      </section>

      {/* ══ 7. ROADMAP ══ */}
      <section className="landing-section">
        <div className="section-header">
          <div className="cf-section-tag">Roadmap de Lançamento</div>
          <h2>Três fases de crescimento.</h2>
        </div>
        <div className="cf-roadmap">
          {phases.map((ph, i) => (
            <div className="cf-phase-card" key={ph.phase} style={{ borderTopColor: ph.color }}>
              <div className="cf-phase-badge" style={{ background: ph.color }}>{ph.phase}</div>
              <div className="cf-phase-range">{ph.range}</div>
              <h3 style={{ color: ph.color }}>Foco: {ph.label}</h3>
              <ul className="cf-phase-list">
                {ph.items.map(it => <li key={it}><CheckCircle2 size={13} style={{ color: ph.color }} />{it}</li>)}
              </ul>
              {i < phases.length - 1 && <ArrowRight size={18} className="cf-phase-arrow" />}
            </div>
          ))}
        </div>
      </section>

      {/* ══ 8. PACKS / DEVICES ══ */}
      <section className="landing-section landing-section-alt">
        <div className="section-header">
          <div className="cf-section-tag">Packs Inteligentes</div>
          <h2>Soluções completas para famílias e doentes crónicos.</h2>
        </div>
        <div className="cf-packs-grid">
          {packs.map(p => (
            <div className={`cf-pack-card${p.highlight ? ' cf-pack-highlight' : ''}`} key={p.label}
              style={{ borderTopColor: p.color }}>
              {p.highlight && <div className="cf-pack-tag" style={{ background: p.color }}>Premium</div>}
              <h3 style={{ color: p.color }}>{p.label}</h3>
              <ul className="cf-pack-list">
                {p.items.map(it => <li key={it}><CheckCircle2 size={13} style={{ color: p.color }} />{it}</li>)}
              </ul>
              <Link to="/register" className="landing-btn-primary" style={{ marginTop: '1rem', fontSize: '0.82rem', padding: '0.6rem 1rem' }}>
                Saber mais
              </Link>
            </div>
          ))}
        </div>
        <p className="cf-packs-tagline">Facilmente expansível. Totalmente integrado com a app.</p>
      </section>

      {/* ══ CTA ══ */}
      <section className="cf-cta">
        <div className="cf-cta-inner">
          <div className="cf-cta-tag">Saúde quando precisa. Sempre consigo.</div>
          <h2>Paz mental + Acesso rápido + Cuidado contínuo.</h2>
          <p>Não vendemos uma "app". Entregamos o seu sistema operativo de saúde — com médicos reais a cada passo.</p>
          <div className="cf-cta-actions">
            <Link to="/register" className="landing-btn-primary">Criar conta grátis <ArrowRight size={15} /></Link>
            <Link to="/login"    className="landing-btn-secondary">Já tenho conta</Link>
          </div>
          <p className="cf-cta-footnote">Execução &gt; Ideia &nbsp;·&nbsp; Saúde toca todos. Valor real. Impacto real.</p>
        </div>
      </section>

      <Footer />
    </>
  );
}


export default function LandingPage() {
  const { t } = useT();

  /* ── Value props shown in top strip ── */
  const valueProps = [
    { icon: Zap,          label: 'Acesso rápido' },
    { icon: Brain,        label: 'Decisão orientada' },
    { icon: HeartPulse,   label: 'Continuidade de cuidados' },
    { icon: Smartphone,   label: 'Conveniência total' },
    { icon: Shield,       label: 'Prevenção' },
    { icon: Building2,    label: 'Integração com parceiros' },
  ];

  /* ── The 4 differentiator layers ── */
  const layers = [
    {
      num: 'Layer 1', color: '#0d9488', label: 'Melhor experiência',
      points: ['UI/UX premium', 'Rápido e intuitivo', 'Reminders fortes', 'Histórico organizado'],
    },
    {
      num: 'Layer 2', color: '#0891b2', label: 'Decision support',
      points: ['Sinais vitais', 'Triagem guiada', 'Urgência vs consulta'],
    },
    {
      num: 'Layer 3', color: '#7c3aed', label: 'Care continuity',
      points: ['Refill medicação', 'Adherence reminders', 'Chronic follow-up'],
    },
    {
      num: 'Layer 4', color: '#b45309', label: 'Access acceleration',
      points: ['Pre-book urgência', 'Queue assist', 'Telemedicina imediata'],
    },
  ];

  /* ── Smart flow steps ── */
  const flowSteps = [
    { num: '1', icon: Smartphone,     label: 'Abre a app triagem guiada' },
    { num: '2', icon: Activity,       label: 'Respostas + dispositivos' },
    { num: '3', icon: Brain,          label: 'Análise por protocolo médico' },
    { num: '4', icon: CheckCircle2,   label: 'Recomendação orientada' },
  ];

  /* ── Flow outcomes ── */
  const flowOutcomes = [
    { color: '#ef4444', bg: '#fef2f2', border: '#fecaca', icon: AlertTriangle, label: 'Urgência Imediata', sub: 'Reservar chegada / Avisar hospital' },
    { color: '#0891b2', bg: '#eff6ff', border: '#bfdbfe', icon: Stethoscope,   label: 'Teleconsulta',     sub: 'Em 15 minutos' },
    { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: CalendarCheck, label: 'Consulta Amanhã',  sub: '+ Medicação suporte' },
  ];

  /* ── Connected devices ── */
  const devices = [
    { icon: Activity, label: 'Tensão arterial smart' },
    { icon: Wind,     label: 'Oxímetro smart' },
    { icon: TrendingUp, label: 'Balança smart' },
    { icon: Zap,      label: 'Termómetro' },
    { icon: Droplets, label: 'Glicómetro' },
    { icon: HeartPulse, label: 'ECG portátil' },
  ];

  /* ── Ecosystem nodes ── */
  const ecosystem = [
    { label: 'Médicos e Especialistas', color: '#0d9488' },
    { label: 'Clínicas e Hospitais',   color: '#0891b2' },
    { label: 'Farmácias Parceiras',    color: '#7c3aed' },
    { label: 'Devices Conectados',     color: '#b45309' },
    { label: 'Dados Históricos e IA',  color: '#db2777' },
  ];

  /* ── Roadmap phases ── */
  const phases = [
    {
      phase: 'Fase 1', range: '0 – 6 meses', label: 'Base Sólida', color: '#0d9488',
      items: ['Bookings', 'Reminders', 'Telemedicina', 'Refill requests', 'Patient profile'],
    },
    {
      phase: 'Fase 2', range: '6 – 18 meses', label: 'Expansão', color: '#0891b2',
      items: ['Pharmacy network', 'Chronic programs', 'Premium UX', 'Planos familiares', 'Parcerias estratégicas'],
    },
    {
      phase: 'Fase 3', range: '18+ meses', label: 'Diferenciação', color: '#7c3aed',
      items: ['Devices integrados', 'Triagem guiada com IA', 'Urgent arrival booking', 'Queue assist', 'Predictive care'],
    },
  ];

  /* ── Pricing packs (devices) ── */
  const packs = [
    { label: 'Pack Básico Família',  color: '#0d9488', items: ['Tensiómetro', 'Termómetro', 'Oxímetro'] },
    { label: 'Pack Crónico',         color: '#0891b2', items: ['Tensiómetro', 'Glicómetro', 'Balança smart'] },
    { label: 'Pack Sénior',          color: '#7c3aed', items: ['Tensão', 'Oxímetro', 'Deteção de quedas (wearable)'] },
    { label: 'Pack Premium',         color: '#b45309', items: ['Todos os dispositivos', 'Smartwatch', 'Monitorização completa'], highlight: true },
  ];

  /* ── Testimonials ── */
  const testimonials = [
    { name: 'Ana Rodrigues', role: 'Paciente',       text: 'Consegui marcar uma consulta em minutos. A orientação foi clara e o médico excelente. Sem pensar 2x mesmo!', rating: 5 },
    { name: 'Dr. Carlos Mendes', role: 'Cardiologista', text: 'O painel de gestão de pacientes crónicos é o melhor que já usei. Poupa-me horas por semana e melhora o seguimento.', rating: 5 },
    { name: 'João Silva', role: 'Paciente',           text: 'O glicómetro liga-se à app e recebo alertas antes que eu próprio perceba que há problema. Cuidado contínuo de verdade.', rating: 5 },
  ];

  const stats = [
    { value: '50K+', label: 'Pacientes' },
    { value: '300+', label: 'Especialistas' },
    { value: '98%',  label: 'Satisfação' },
    { value: '20+',  label: 'Especialidades' },
  ];

  return (
    <>
      <Navbar />

      {/* ══ HERO ══ */}
      <section className="cf-hero">
        <div className="cf-hero-bg" />
        <div className="cf-hero-content">
          <div className="cf-hero-badge">🇦🇴 Luanda, Angola · Saúde Digital</div>
          <h1 className="cf-hero-title">
            O seu sistema de saúde.<br />
            <span className="cf-hero-accent">Sem pensar 2x.</span>
          </h1>
          <p className="cf-hero-sub">
            Não é só uma app. É o seu ecossistema de saúde — triagem inteligente,
            teleconsulta, farmácia, dispositivos e IA num único lugar.
          </p>
          <ul className="landing-hero-checklist">
            <li><CheckCircle2 size={15} /> Triagem guiada do sintoma à ação em segundos</li>
            <li><CheckCircle2 size={15} /> Teleconsulta com especialistas em 15 minutos</li>
            <li><CheckCircle2 size={15} /> Monitorização contínua com dispositivos conectados</li>
          </ul>
          <div className="cf-hero-actions">
            <Link to="/register" className="landing-btn-primary">
              Começar grátis <ArrowRight size={15} />
            </Link>
            <Link to="/services" className="landing-btn-secondary">
              Ver serviços
            </Link>
          </div>
        </div>
        <div className="cf-hero-visual">
          <div className="cf-hero-card cf-hero-card-main">
            <HeartPulse size={28} style={{ color: '#0d9488' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Triagem Activa</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Protocolo médico em curso…</div>
            </div>
          </div>
          <div className="cf-hero-card cf-hero-card-alert">
            <span style={{ fontSize: '1.1rem' }}>⚡</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0891b2' }}>Teleconsulta disponível</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Médico em 15 min</div>
            </div>
          </div>
          <div className="cf-hero-card cf-hero-card-device">
            <Activity size={18} style={{ color: '#7c3aed' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>Tensão: 120/80</div>
              <div style={{ fontSize: '0.72rem', color: '#16a34a' }}>✓ Normal</div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ VALUE PROPS STRIP ══ */}
      <section className="cf-props-strip">
        {valueProps.map(p => (
          <div className="cf-prop" key={p.label}>
            <p.icon size={20} style={{ color: 'var(--accent-teal)' }} />
            <span>{p.label}</span>
          </div>
        ))}
      </section>

      {/* ══ STATS ══ */}
      <section className="landing-stats-strip">
        {stats.map(s => (
          <div className="landing-stat" key={s.label}>
            <span className="landing-stat-value">{s.value}</span>
            <span className="landing-stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* ══ 1. O NOSSO DIFERENCIAL — 4 layers ══ */}
      <section className="landing-section">
        <div className="section-header">
          <div className="cf-section-tag">O Nosso Diferencial</div>
          <h2>Muito mais que booking.</h2>
          <p>Quatro camadas de valor que nenhuma app atual oferece em conjunto.</p>
        </div>
        <div className="cf-layers-grid">
          {layers.map(l => (
            <div className="cf-layer-card" key={l.num} style={{ borderTopColor: l.color }}>
              <div className="cf-layer-badge" style={{ background: l.color }}>{l.num}</div>
              <h3 style={{ color: l.color }}>{l.label}</h3>
              <ul className="cf-layer-list">
                {l.points.map(p => <li key={p}><ChevronRight size={13} />{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ══ 2. FLUXO INTELIGENTE ══ */}
      <section className="landing-section landing-section-alt">
        <div className="section-header">
          <div className="cf-section-tag">Fluxo Inteligente</div>
          <h2>Do Sintoma à Ação.</h2>
          <p>Exemplo: dor no peito / falta de ar / febre alta</p>
        </div>
        <div className="cf-flow-steps">
          {flowSteps.map((s, i) => (
            <div className="cf-flow-step" key={s.num}>
              <div className="cf-flow-step-num">{s.num}</div>
              <s.icon size={22} style={{ color: 'var(--accent-teal)', margin: '0.5rem 0' }} />
              <span>{s.label}</span>
              {i < flowSteps.length - 1 && <ArrowRight size={18} className="cf-flow-arrow" />}
            </div>
          ))}
        </div>
        <div className="cf-flow-outcomes">
          {flowOutcomes.map(o => (
            <div className="cf-outcome-card" key={o.label}
              style={{ background: o.bg, borderColor: o.border }}>
              <o.icon size={22} style={{ color: o.color }} />
              <div>
                <div style={{ fontWeight: 700, color: o.color, fontSize: '0.9rem' }}>{o.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{o.sub}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="cf-flow-tagline">Orientação clara. Decisão segura. Ação imediata.</p>
      </section>

      {/* ══ 3. FARMÁCIA INTELIGENTE ══ */}
      <section className="landing-section">
        <div className="section-header">
          <div className="cf-section-tag">Farmácia Inteligente</div>
          <h2>Renewal de medicação sem complicação.</h2>
        </div>
        <div className="cf-pharmacy-flow">
          {[
            { icon: ClipboardCheck, label: 'Pedido do Paciente' },
            { icon: UserPlus,       label: 'Médico Parceiro Avalia' },
            { icon: ClipboardCheck, label: 'Receita Digital Emitida' },
            { icon: Package,        label: 'Farmácia Parceira' },
          ].map((s, i, arr) => (
            <div className="cf-pharmacy-step" key={s.label}>
              <div className="cf-pharmacy-icon"><s.icon size={22} /></div>
              <span>{s.label}</span>
              {i < arr.length - 1 && <ArrowRight size={16} className="cf-pharm-arrow" />}
            </div>
          ))}
        </div>
        <div className="cf-pharmacy-benefits">
          {[
            'Mais adesão ao tratamento',
            'Menos idas desnecessárias',
            'Segurança + Conveniência',
          ].map(b => (
            <div className="cf-benefit-chip" key={b}>
              <CheckCircle2 size={14} style={{ color: '#16a34a' }} /> {b}
            </div>
          ))}
        </div>
      </section>

      {/* ══ 4. DISPOSITIVOS CONECTADOS ══ */}
      <section className="landing-section landing-section-alt">
        <div className="section-header">
          <div className="cf-section-tag">Devices + Interpretação + Ação</div>
          <h2>Cuidado Contínuo.</h2>
          <p>Não vendemos gadgets. Entregamos valor clínico.</p>
        </div>
        <div className="cf-devices-grid">
          {devices.map(d => (
            <div className="cf-device-chip" key={d.label}>
              <d.icon size={16} style={{ color: 'var(--accent-teal)' }} />
              {d.label}
            </div>
          ))}
        </div>
        <div className="cf-device-formula">
          <div className="cf-formula-box">📡 Medir em casa</div>
          <ArrowRight size={16} />
          <div className="cf-formula-box">☁️ Enviar automaticamente</div>
          <ArrowRight size={16} />
          <div className="cf-formula-box">🧠 Analisar com inteligência</div>
          <ArrowRight size={16} />
          <div className="cf-formula-box">🔔 Alertar e orientar</div>
          <ArrowRight size={16} />
          <div className="cf-formula-box cf-formula-box-accent">⚡ Ação rápida quando importa</div>
        </div>
        <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
          Tensiómetro sozinho = gadget. &nbsp;|&nbsp; Tensiómetro na nossa plataforma = cuidado contínuo. 💙
        </p>
      </section>

      {/* ══ 5. O ECOSSISTEMA ══ */}
      <section className="landing-section">
        <div className="section-header">
          <div className="cf-section-tag">O Grande Moat</div>
          <h2>O Ecossistema.</h2>
          <p>Mais integração = mais valor = mais retenção = melhor cuidado.</p>
        </div>
        <div className="cf-ecosystem">
          <div className="cf-ecosystem-center">
            <Users size={32} style={{ color: '#fff' }} />
            <span>PACIENTE</span>
          </div>
          <div className="cf-ecosystem-nodes">
            {ecosystem.map(e => (
              <div className="cf-ecosystem-node" key={e.label} style={{ borderColor: e.color, color: e.color }}>
                {e.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 6. ROADMAP ══ */}
      <section className="landing-section landing-section-alt">
        <div className="section-header">
          <div className="cf-section-tag">Roadmap de Lançamento</div>
          <h2>Três fases de crescimento.</h2>
        </div>
        <div className="cf-roadmap">
          {phases.map((ph, i) => (
            <div className="cf-phase-card" key={ph.phase} style={{ borderTopColor: ph.color }}>
              <div className="cf-phase-badge" style={{ background: ph.color }}>{ph.phase}</div>
              <div className="cf-phase-range">{ph.range}</div>
              <h3 style={{ color: ph.color }}>Foco: {ph.label}</h3>
              <ul className="cf-phase-list">
                {ph.items.map(it => <li key={it}><CheckCircle2 size={13} style={{ color: ph.color }} />{it}</li>)}
              </ul>
              {i < phases.length - 1 && <ArrowRight size={18} className="cf-phase-arrow" />}
            </div>
          ))}
        </div>
      </section>

      {/* ══ 7. PACKS / DEVICES ══ */}
      <section className="landing-section">
        <div className="section-header">
          <div className="cf-section-tag">Packs Inteligentes</div>
          <h2>Soluções completas para famílias e doentes crónicos.</h2>
        </div>
        <div className="cf-packs-grid">
          {packs.map(p => (
            <div className={`cf-pack-card${p.highlight ? ' cf-pack-highlight' : ''}`} key={p.label}
              style={{ borderTopColor: p.color }}>
              {p.highlight && <div className="cf-pack-tag" style={{ background: p.color }}>Premium</div>}
              <h3 style={{ color: p.color }}>{p.label}</h3>
              <ul className="cf-pack-list">
                {p.items.map(it => <li key={it}><CheckCircle2 size={13} style={{ color: p.color }} />{it}</li>)}
              </ul>
              <Link to="/register" className="landing-btn-primary" style={{ marginTop: '1rem', fontSize: '0.82rem', padding: '0.6rem 1rem' }}>
                Saber mais
              </Link>
            </div>
          ))}
        </div>
        <p className="cf-packs-tagline">Facilmente expansível. Totalmente integrado com a app.</p>
      </section>

      {/* ══ TESTIMONIALS ══ */}
      <section className="landing-section landing-section-alt">
        <div className="section-header">
          <div className="cf-section-tag">O que dizem os utilizadores</div>
          <h2>Histórias reais. Cuidado real.</h2>
        </div>
        <div className="landing-testimonials-grid">
          {testimonials.map(t2 => (
            <div className="landing-testimonial-card" key={t2.name}>
              <div className="landing-testimonial-stars">
                {Array.from({ length: t2.rating }).map((_, i) => (
                  <Star key={i} size={13} fill="currentColor" />
                ))}
              </div>
              <p className="landing-testimonial-text">"{t2.text}"</p>
              <div className="landing-testimonial-author">
                <div className="landing-testimonial-avatar">{t2.name.charAt(0)}</div>
                <div>
                  <div className="landing-testimonial-name">{t2.name}</div>
                  <div className="landing-testimonial-role">{t2.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="cf-cta">
        <div className="cf-cta-inner">
          <div className="cf-cta-tag">Saúde quando precisa. Sempre consigo.</div>
          <h2>Paz mental + Acesso rápido + Cuidado contínuo.</h2>
          <p>Não vendemos uma "app". Entregamos o seu sistema operativo de saúde.</p>
          <div className="cf-cta-actions">
            <Link to="/register" className="landing-btn-primary">Criar conta grátis <ArrowRight size={15} /></Link>
            <Link to="/login"    className="landing-btn-secondary">Já tenho conta</Link>
          </div>
          <p className="cf-cta-footnote">Execução &gt; Ideia &nbsp;·&nbsp; Saúde toca todos. Valor real. Impacto real.</p>
        </div>
      </section>

      <Footer />
    </>
  );
}
