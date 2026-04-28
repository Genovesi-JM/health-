import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Building2, TrendingUp, Calendar, Video, Activity,
  Shield, Clock, Users, ArrowRight, CheckCircle2,
  BarChart2, Bell, Zap, FileText, Mail,
} from 'lucide-react';

const BENEFITS = [
  { icon: Calendar,  color: '#0d9488', title: 'Receba marcações online 24/7',         desc: 'Os pacientes marcam directamente no portal. Sem telefonemas, sem burocracia. Confirmação automática.' },
  { icon: Activity,  color: '#dc2626', title: 'Receba leituras antes da chegada',      desc: 'Tensão, glicemia, SpO₂ — o médico recebe os dados do paciente antes da consulta. Visitas mais eficientes.' },
  { icon: Clock,     color: '#0891b2', title: 'Reduza tempos de espera',               desc: 'Pré-consulta digital organiza chegadas. Menos congestionamento na recepção, mais satisfação do paciente.' },
  { icon: Video,     color: '#7c3aed', title: 'Teleconsulta integrada',                desc: 'Ofereça consultas por vídeo sem investimento em infraestrutura. Aumente a área de influência da clínica.' },
  { icon: BarChart2, color: '#d97706', title: 'Dashboard analytics',                   desc: 'Ocupação, receita por especialidade, tendências de cancellamento — dados para tomar decisões melhores.' },
  { icon: Users,     color: '#059669', title: 'Fidelize os seus pacientes',            desc: 'Lembretes automáticos, renovação de receitas e seguimento de crónicos mantêm os pacientes activos.' },
  { icon: Shield,    color: '#0d9488', title: 'Conformidade e segurança',              desc: 'Dados clínicos encriptados. Conformidade com regulação local. Auditoria completa de acessos.' },
  { icon: Zap,       color: '#dc2626', title: 'Onboarding em 48 horas',               desc: 'A sua clínica no portal em 2 dias. Formação incluída, suporte dedicado no primeiro mês.' },
];

const PLANS = [
  {
    label: 'Starter',
    price: '15.000 Kz/mês',
    sub: 'Clínicas pequenas (1–3 médicos)',
    features: ['50 marcações/mês', 'Perfil na rede CareFast+', '1 especialidade', 'Suporte por email', 'Relatórios básicos'],
    cta: 'Começar Starter',
    featured: false,
    color: '#0d9488',
  },
  {
    label: 'Business',
    price: '35.000 Kz/mês',
    sub: 'Clínicas médias (4–10 médicos)',
    features: ['Marcações ilimitadas', 'Teleconsulta incluída', 'Vitals pre-chegada', 'Dashboard analytics', '3 especialidades', 'Suporte prioritário'],
    cta: 'Mais escolhido',
    featured: true,
    color: '#0891b2',
  },
  {
    label: 'Enterprise',
    price: 'Personalizado',
    sub: 'Hospitais e grupos clínicos',
    features: ['Especialidades ilimitadas', 'API integração HIS/EHR', 'SLA 99.9%', 'Gestor de conta dedicado', 'Auditoria e compliance', 'Formação presencial'],
    cta: 'Contactar equipa',
    featured: false,
    color: '#7c3aed',
  },
];

const PROCESS = [
  { step: '01', icon: Mail,        color: '#0d9488', title: 'Submeta o interesse',      desc: 'Preencha o formulário ou contacte-nos. Respondemos em menos de 24 horas.' },
  { step: '02', icon: FileText,    color: '#0891b2', title: 'Verificação da clínica',    desc: 'Validamos as credenciais, licenças e especialidades. Processo rápido e confidencial.' },
  { step: '03', icon: Zap,         color: '#7c3aed', title: 'Onboarding e formação',     desc: 'Configuramos o perfil, formamos a equipa e ativamos o portal em 48 horas.' },
  { step: '04', icon: TrendingUp,  color: '#d97706', title: 'Comece a receber pacientes',desc: 'A clínica fica visível na rede CareFast+. Pacientes marcam em tempo real.' },
];

export default function ClinicsPage() {
  return (
    <div className="landing-wrapper">
      <Navbar />

      {/* ── Hero ── */}
      <section className="lp-page-hero">
        <div className="lp-tag"><Building2 size={12} /> Para Clínicas e Hospitais</div>
        <h1>Modernize a sua clínica.<br /><span className="lp-hero__accent">Traga mais pacientes.</span></h1>
        <p>
          Receba marcações online, leituras antes da chegada e consultas por vídeo.
          Reduza tempos de espera e aumente a ocupação — sem mudar o seu sistema actual.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/contacto" className="lp-cta lp-cta--primary"><Building2 size={15} /> Tornar-se parceiro</Link>
          <Link to="#planos" className="lp-cta lp-cta--secondary"><BarChart2 size={15} /> Ver planos</Link>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <div className="clinic-stats-bar">
        {[
          { val: '48h',   label: 'Onboarding rápido' },
          { val: '8+',    label: 'Parceiros activos' },
          { val: '24/7',  label: 'Marcações online' },
          { val: '100%',  label: 'Verificados' },
        ].map(s => (
          <div key={s.label} className="clinic-stat">
            <span className="clinic-stat__val">{s.val}</span>
            <span className="clinic-stat__lbl">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Benefits grid ── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">Benefícios</div>
          <h2>O que o CareFast+ traz para a sua clínica.</h2>
          <p>Mais do que um portal de marcações — um parceiro de crescimento digital.</p>
        </div>
        <div className="feat-grid">
          {BENEFITS.map(b => (
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

      {/* ── Partner process ── */}
      <section className="lp-section">
        <div className="lp-section__header">
          <div className="lp-tag">Processo de parceria</div>
          <h2>Quatro passos para estar no portal.</h2>
          <p>Simples, rápido e sem custos iniciais ocultos.</p>
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

      {/* ── Pricing ── */}
      <section id="planos" className="lp-section lp-section--alt">
        <div className="lp-section__header">
          <div className="lp-tag">Planos para clínicas</div>
          <h2>Preços transparentes, sem surpresas.</h2>
          <p>Cancele quando quiser. Sem contratos anuais obrigatórios.</p>
        </div>
        <div className="lp-pricing">
          {PLANS.map(p => (
            <div key={p.label} className={`lp-price-card${p.featured ? ' lp-price-card--featured' : ''}`}>
              <div className="lp-price-label">{p.label}</div>
              <div className="lp-price-amount">{p.price}</div>
              <div className="lp-price-sub">{p.sub}</div>
              <ul>
                {p.features.map(f => (
                  <li key={f}><CheckCircle2 size={13} style={{ color: p.featured ? '#fff' : p.color }} /> {f}</li>
                ))}
              </ul>
              <Link to="/contacto" className="lp-price-cta" style={p.featured ? { background: '#fff', color: '#0d9488' } : {}}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── ROI callout ── */}
      <section className="lp-section">
        <div className="page-callout" style={{ borderColor: 'rgba(20,184,166,0.3)', background: 'rgba(20,184,166,0.04)' }}>
          <div className="lp-tag" style={{ marginBottom: '1rem' }}>Por que aderir agora</div>
          <h2 style={{ fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 800, marginBottom: '1rem' }}>
            Cada consulta não realizada é receita perdida.
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.65, maxWidth: 600, marginBottom: '1.5rem' }}>
            Clínicas no CareFast+ reportam redução de 30% em no-shows com lembretes automáticos
            e aumento médio de 22% na ocupação mensal nos primeiros 3 meses.
          </p>
          <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            {[{ val: '−30%', lbl: 'No-shows' }, { val: '+22%', lbl: 'Ocupação' }, { val: '4.8★', lbl: 'Satisfação média' }].map(s => (
              <div key={s.lbl}>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--accent-teal)' }}>{s.val}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.lbl}</div>
              </div>
            ))}
          </div>
          <Link to="/contacto" className="lp-cta lp-cta--primary"><ArrowRight size={15} /> Quero ser parceiro</Link>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="lp-final-cta">
        <div className="lp-tag" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>Parceria CareFast+</div>
        <h2>A sua clínica merece crescer digitalmente.</h2>
        <p>Junte-se à rede de clínicas e hospitais que já confiam no CareFast+ para modernizar o atendimento.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/contacto" className="lp-cta lp-cta--white"><Building2 size={15} /> Tornar-se parceiro <ArrowRight size={14} /></Link>
          <Link to="/faq" className="lp-cta lp-cta--white-outline">Perguntas frequentes</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
