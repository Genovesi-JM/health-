import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Stethoscope, Pill, HeartPulse, Ambulance, Siren, Building2, Sparkles, Bell } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import JourneyScroll from '../components/JourneyScroll';
import CareComposer from '../components/CareComposer';
import LuandaMap from '../components/LuandaMap';
import Spot, { type SpotName } from '../components/Spots';
import BodyExplorer from '../components/BodyExplorer';
import '../landing-editorial.css';

const CHAPTERS: {
  id: string; num: string; title: string; em: string; lead: string; spot: SpotName;
  facts: [string, string][]; links: { to: string; label: string; alert?: boolean }[];
}[] = [
  {
    id: 'consulta', num: '01', title: 'Consulta', em: 'sem fila.',
    lead: 'Marque, fale com um médico por vídeo ou presencialmente, e guarde tudo no mesmo historial. Nenhuma decisão clínica é tomada por software.',
    spot: 'telehealth',
    facts: [['A', 'Médicos e enfermeiros verificados, dentro do âmbito autorizado.'], ['B', 'Teleconsulta integrada, sem instalar nada.'], ['C', 'Historial, exames e notas acessíveis a qualquer momento.']],
    links: [{ to: '/telemedicina', label: 'Como funciona a teleconsulta' }, { to: '/medicos', label: 'Ver médicos' }],
  },
  {
    id: 'receita', num: '02', title: 'Receita digital', em: 'que o acompanha.',
    lead: 'Peça ou renove a receita a partir de casa. Um médico decide, a farmácia parceira dispensa, e a medicação fica registada no seu perfil.',
    spot: 'prescription',
    facts: [['A', 'Renovações com revisão médica obrigatória.'], ['B', 'Dispensa em farmácias parceiras ligadas à receita.'], ['C', 'Medicação, dose e frequência sempre visíveis para si.']],
    links: [{ to: '/patients', label: 'Para pacientes' }, { to: '/clinics', label: 'Farmácias parceiras' }],
  },
  {
    id: 'transporte', num: '03', title: 'Transporte', em: 'até ao cuidado.',
    lead: 'O caminho físico até à consulta ou ao hospital faz parte do cuidado. Transporte agendado, mobilidade acessível ou transferência assistida, ligados ao seu pedido.',
    spot: 'scheduled',
    facts: [['A', 'Mobilidade acessível, apoio não clínico ao passageiro.'], ['B', 'Transporte agendado com operador qualificado.'], ['C', 'Transferência assistida com equipa e equipamento definidos.']],
    links: [{ to: '/urgencia', label: 'Transporte e ambulância' }, { to: '/clinics', label: 'Para hospitais' }],
  },
  {
    id: 'urgencia', num: '04', title: 'Urgência', em: 'com o hospital avisado.',
    lead: 'Em emergência, o KAYA ajuda a chegar ao sítio certo e avisa o hospital antes de si. Não substitui o número de emergência local.',
    spot: 'emergency',
    facts: [['A', 'Despacho e governação clínica da resposta.'], ['B', 'Pré-alerta ao hospital de destino.'], ['C', 'Luanda em fase piloto; outras zonas por confirmar.']],
    links: [{ to: '/urgencia', label: 'Emergência e pré-alerta', alert: true }],
  },
];

const INDEX = [
  ...CHAPTERS.map(c => ({ id: c.id, num: c.num, title: c.title })),
  { id: 'compor', num: '05', title: 'Compor' },
  { id: 'onde', num: '06', title: 'Onde' },
  { id: 'para-quem', num: '07', title: 'Para quem' },
];

const AUDIENCES = [
  { to: '/patients', num: '01', label: 'Pacientes e famílias', sub: 'Consultas, receitas, historial, cuidadores' },
  { to: '/medicos',  num: '02', label: 'Médicos e enfermeiros', sub: 'Agenda, teleconsulta, historial clínico' },
  { to: '/clinics',  num: '03', label: 'Hospitais e clínicas',  sub: 'Fluxos de urgência, transferências, continuidade' },
  { to: '/clinics',  num: '04', label: 'Farmácias',             sub: 'Dispensa ligada à receita digital' },
  { to: '/empresas', num: '05', label: 'Empresas',              sub: 'Saúde ocupacional para equipas' },
  { to: '/urgencia', num: '06', label: 'Transporte e urgência', sub: 'Agendado, assistido, emergência' },
];

export default function LandingPage() {
  // Skeleton → content: CSS animates the morph; this fallback flips a class on the
  // section as well, so the reveal completes even where animations are paused.
  const heroRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = heroRef.current;
    const t = window.setTimeout(() => el?.classList.add('is-ready'), 1200);
    return () => window.clearTimeout(t);
  }, []);
  const [current, setCurrent] = useState<string>('');

  // Scroll reveal
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.reveal:not(.reveal--in)'));
    if (!('IntersectionObserver' in window) || els.length === 0) { els.forEach(el => el.classList.add('reveal--in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('reveal--in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Which chapter is on screen (drives the sticky index)
  useEffect(() => {
    const sections = INDEX.map(i => document.getElementById(i.id)).filter((el): el is HTMLElement => Boolean(el));
    if (!('IntersectionObserver' in window) || sections.length === 0) return;
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setCurrent(visible.target.id);
    }, { rootMargin: '-40% 0px -50% 0px', threshold: [0, 0.2, 0.5] });
    sections.forEach(s => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <div className="landing-wrapper ed">
      <Navbar />

      {/* ══ HERO ══════════════════════════════════════════ */}
      <section className="ed-hero" ref={heroRef}>
        {/* skeleton layer: grey placeholders in the shape of the hero */}
        <div className="ed-skel" aria-hidden="true">
          <div className="ed-wrap ed-skel__grid">
            <div>
              <span className="ed-skel__b" style={{ width: '38%', height: 12 }} />
              <span className="ed-skel__b" style={{ width: '92%', height: 64, marginTop: 26 }} />
              <span className="ed-skel__b" style={{ width: '70%', height: 64 }} />
              <span className="ed-skel__b" style={{ width: '80%', height: 14, marginTop: 28 }} />
              <span className="ed-skel__b" style={{ width: '64%', height: 14 }} />
              <span className="ed-skel__b ed-skel__b--pill" style={{ width: 210, height: 52, marginTop: 30 }} />
              <div className="ed-skel__row"><span className="ed-skel__b" style={{ width: '46%', height: 84 }} /><span className="ed-skel__b" style={{ width: '46%', height: 84 }} /></div>
            </div>
            <div className="ed-skel__right">
              <span className="ed-skel__b ed-skel__b--figure" />
              <div className="ed-skel__list">{[0,1,2,3,4,5].map(i => <span key={i} className="ed-skel__b ed-skel__b--pill" style={{ height: 40 }} />)}</div>
            </div>
          </div>
        </div>

        <div className="ed-wrap ed-hero__grid ed-hero__content">
          <div>
            <div className="ed-kicker">Luanda · Angola — saúde e transporte</div>
            <h1 className="ed-title">
              <span className="ed-spark ed-spark--a"><Sparkles size={22} strokeWidth={1.4} /></span>
              Cuidado que
              <span className="ed-title__accent">chega até si.<span className="ed-spark ed-spark--b"><Sparkles size={16} strokeWidth={1.4} /></span></span>
            </h1>
            <p className="ed-sub">Toque numa parte do corpo e veja o que o KAYA faz por ela: consulta, receita digital, medições, transporte e urgência. Um médico real decide; o KAYA organiza o caminho.</p>
            <div className="ed-hero__links">
              <Link to="/register" className="ed-pill">Explorar os serviços <span className="ed-pill__arrow"><ArrowRight size={16} /></span></Link>
              <Link to="/login" className="ed-link ed-link--quiet">Entrar no portal <ArrowUpRight size={16} /></Link>
            </div>
            <div className="ed-floats">
              <Link to="/urgencia" className="ed-float">
                <span className="ed-float__ico"><Siren size={22} strokeWidth={1.4} /></span>
                <span className="ed-float__text"><strong>Estamos sempre disponíveis</strong><small>Urgência e transporte, 24 horas por dia</small></span>
                <span className="ed-float__go"><ArrowRight size={14} /></span>
              </Link>
              <Link to="/contacto" className="ed-float">
                <span className="ed-float__ico"><Bell size={22} strokeWidth={1.4} /></span>
                <span className="ed-float__text"><strong>Receber novidades</strong><small>Novas zonas e serviços em Luanda</small></span>
                <span className="ed-float__go"><ArrowRight size={14} /></span>
              </Link>
            </div>
          </div>

          <div>
            <BodyExplorer />
          </div>
        </div>
      </section>

      {/* ══ SERVICES BENTO ═══════════════════════════════ */}
      <section className="ed-bento">
        <div className="ed-wrap">
          <div className="ed-bento__head reveal">
            <h2 className="ed-h2" style={{ textAlign: 'center', margin: '0 auto .5rem' }}>Explore os principais <em>serviços.</em></h2>
            <p className="ed-lead" style={{ margin: '0 auto', textAlign: 'center' }}>Tudo o que o KAYA liga, do pedido à chegada.</p>
          </div>
          <div className="ed-bento__grid reveal" data-d="2">
            {[
              { to: '/medicos',        label: 'Consultas',               icon: Stethoscope, big: false },
              { to: '/patients',       label: 'Receita digital',         icon: Pill,        big: false },
              { to: '/patient/readings', label: 'Medições em casa',      icon: HeartPulse,  big: true },
              { to: '/clinics',        label: 'Hospitais e farmácias',   icon: Building2,   big: false },
              { to: '/urgencia',       label: 'Transporte e ambulância', icon: Ambulance,   big: false },
              { to: '/urgencia',       label: 'Urgência e pré-alerta',   icon: Siren,       big: false },
            ].map(t => (
              <Link key={t.label} to={t.to} className={`ed-bento__tile${t.big ? ' is-big' : ''}`}>
                <t.icon size={t.big ? 56 : 40} strokeWidth={1.1} />
                <span>{t.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ STICKY INDEX ══════════════════════════════════ */}
      <nav className="ed-index" aria-label="Capítulos">
        <div className="ed-wrap">
          {INDEX.map(i => <a key={i.id} href={`#${i.id}`} className={current === i.id ? 'is-on' : ''}><b>{i.num}</b>{i.title}</a>)}
        </div>
      </nav>

      {/* ══ JOURNEY (scroll-driven) ═══════════════════════ */}
      <JourneyScroll />

      {/* ══ CHAPTERS ══════════════════════════════════════ */}
      {CHAPTERS.map((c, i) => (
        <section key={c.id} id={c.id} className={`ed-chapter${i % 2 === 1 ? ' ed-chapter--flip' : ''}`}>
          <div className="ed-wrap ed-chapter__grid">
            <div className="ed-chapter__text reveal">
              <span className="ed-num">{c.num}</span>
              <h2 className="ed-h2">{c.title} <em>{c.em}</em></h2>
              <p className="ed-lead">{c.lead}</p>
              <ul className="ed-chapter__facts">
                {c.facts.map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}
              </ul>
              <div className="ed-chapter__links">
                {c.links.map(l => (
                  <Link key={l.label} to={l.to} className={`ed-link${l.alert ? ' ed-link--alert' : ''}`}>{l.label} <ArrowRight size={16} /></Link>
                ))}
              </div>
            </div>
            <div className="ed-chapter__art reveal" data-d="2">
              <div className="ed-object"><Spot name={c.spot} /></div>
            </div>
          </div>
        </section>
      ))}

      {/* ══ COMPOSER ══════════════════════════════════════ */}
      <section id="compor" className="ed-chapter">
        <div className="ed-wrap">
          <div className="reveal">
            <span className="ed-num">05</span>
            <h2 className="ed-h2">Componha <em>o seu pedido.</em></h2>
            <p className="ed-lead">Escolha para quem, o quê e como. O KAYA mostra o caminho em palavras simples.</p>
          </div>
          <div className="reveal" data-d="2"><CareComposer /></div>
        </div>
      </section>

      {/* ══ MAP ═══════════════════════════════════════════ */}
      <section id="onde" className="ed-chapter">
        <div className="ed-wrap">
          <div className="reveal">
            <span className="ed-num">06</span>
            <h2 className="ed-h2">Onde <em>chegamos.</em></h2>
            <p className="ed-lead">Luanda primeiro, em fase piloto. Passe o cursor pelas zonas para ver o que já existe em cada uma.</p>
          </div>
          <div className="reveal" data-d="2"><LuandaMap /></div>
        </div>
      </section>

      {/* ══ FOR WHOM ══════════════════════════════════════ */}
      <section id="para-quem" className="ed-list">
        <div className="ed-wrap ed-list__grid">
          <div className="reveal">
            <span className="ed-num">07</span>
            <h2 className="ed-h2">Para quem <em>é.</em></h2>
            <p className="ed-lead">Um sistema, vários pontos de entrada. Cada um vê apenas o que lhe diz respeito.</p>
          </div>
          <ul className="reveal" data-d="2">
            {AUDIENCES.map(a => (
              <li key={a.num}><Link to={a.to}><b>{a.num}</b><strong>{a.label}</strong><small>{a.sub}</small></Link></li>
            ))}
          </ul>
        </div>
      </section>

      {/* ══ PRINCIPLES ════════════════════════════════════ */}
      <section className="ed-principles">
        <div className="ed-wrap ed-principles__grid">
          {[
            ['Médico real decide', 'Software organiza, não diagnostica. Cada decisão clínica tem um nome e uma licença.'],
            ['Dados sob o seu controlo', 'Historial encriptado. Cuidadores e profissionais acedem com permissões explícitas.'],
            ['Transparente por defeito', 'Dizemos o que fazemos e o que não fazemos. Luanda primeiro, em fase piloto.'],
          ].map(([h, p], i) => (
            <div key={h} className="ed-principle reveal" data-d={String(i + 1)}>
              <span className="ed-num">0{i + 1}</span>
              <h3>{h}</h3>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ CLOSE ═════════════════════════════════════════ */}
      <section className="ed-close">
        <div className="ed-wrap ed-close__grid reveal">
          <div>
            <h2>A sua saúde <em>começa em casa.</em></h2>
            <p>Crie a conta, organize o historial e peça o primeiro cuidado. O resto do caminho é connosco.</p>
          </div>
          <div className="ed-close__links">
            <Link to="/register" className="ed-link">Criar conta <ArrowRight size={16} /></Link>
            <Link to="/contacto" className="ed-link">Falar connosco <ArrowUpRight size={16} /></Link>
            <span className="ed-close__note">Não é um serviço de emergência. Em perigo de vida ligue para o número de emergência local.</span>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
