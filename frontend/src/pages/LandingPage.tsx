import { Link } from 'react-router-dom';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import JourneyScroll from '../components/JourneyScroll';
import CareComposer from '../components/CareComposer';
import LuandaMap from '../components/LuandaMap';
import Spot, { type SpotName } from '../components/Spots';
import '../landing-editorial.css';

/* The four services. One object on the page at a time; the rail switches it. */
const SERVICES: { key: string; num: string; label: string; accent: string; spot: SpotName; caption: string; note: string }[] = [
  { key: 'consulta',   num: '01', label: 'Consulta',        accent: 'chega até si.',  spot: 'telehealth',   caption: 'Consulta e teleconsulta',   note: 'Um médico real, presencial ou online, dentro do âmbito verificado.' },
  { key: 'receita',    num: '02', label: 'Receita digital', accent: 'segue consigo.', spot: 'prescription', caption: 'Receita digital',            note: 'Pedida e renovada com decisão médica. Dispensa em farmácias parceiras.' },
  { key: 'transporte', num: '03', label: 'Transporte',      accent: 'vem buscá-lo.',  spot: 'scheduled',    caption: 'Transporte de doentes',     note: 'Agendado ou assistido, com operador qualificado e entrega clínica.' },
  { key: 'urgencia',   num: '04', label: 'Urgência',        accent: 'não espera.',    spot: 'emergency',    caption: 'Emergência pré-hospitalar', note: 'Despacho, pré-alerta ao hospital e resposta quando o tempo conta.' },
];

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
  const [active, setActive] = useState(0);
  const [out, setOut] = useState(false);
  const [touched, setTouched] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
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

  // Hero object drifts gently with the scroll
  useEffect(() => {
    let raf = 0;
    const onScroll = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; setScrollY(window.scrollY); }); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  // Auto-advance until the visitor touches the rail
  useEffect(() => {
    if (touched) return;
    const t = window.setInterval(() => switchTo((active + 1) % SERVICES.length, false), 5200);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, touched]);

  const switchTo = (idx: number, byUser = true) => {
    if (byUser) setTouched(true);
    if (idx === active) return;
    setOut(true);
    window.setTimeout(() => { setActive(idx); setOut(false); }, 280);
  };

  // Pointer: parallax on the object, spotlight on the canvas
  const onStageMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = stageRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; const py = (e.clientY - r.top) / r.height;
    setTilt({ x: (px - .5) * 22, y: (py - .5) * 16 });
    el.style.setProperty('--mx', `${px * 100}%`); el.style.setProperty('--my', `${py * 100}%`);
  };
  const onStageLeave = () => setTilt({ x: 0, y: 0 });

  const s = SERVICES[active];
  const drift = Math.min(scrollY, 600) * 0.12;

  return (
    <div className="landing-wrapper ed">
      <Navbar />

      {/* ══ HERO ══════════════════════════════════════════ */}
      <section className="ed-hero">
        <div className="ed-wrap ed-hero__grid">
          <div className="reveal reveal--in">
            <div className="ed-kicker">Luanda · Angola — saúde e transporte</div>
            <h1 className="ed-title">
              Cuidado que
              <span className={`ed-title__accent${out ? ' is-out' : ''}`}>{s.accent}</span>
            </h1>
            <p className="ed-sub">Consulta, receita digital, transporte e urgência num só lugar. Um médico real decide; o KAYA organiza o caminho.</p>
            <div className="ed-hero__links">
              <Link to="/register" className="ed-link">Criar conta <ArrowRight size={16} /></Link>
              <Link to="/login" className="ed-link ed-link--quiet">Entrar no portal <ArrowUpRight size={16} /></Link>
            </div>
          </div>

          <div>
            <div className="ed-stage" ref={stageRef} onMouseMove={onStageMove} onMouseLeave={onStageLeave}>
              <div className="ed-stage__meta"><span>{s.num} / 04</span><span>{s.label}</span></div>
              <div className={`ed-stage__art${out ? ' is-out' : ''}`}>
                <div className="ed-stage__object ed-object" style={{ transform: `translate3d(${tilt.x}px, ${tilt.y + drift}px, 0)` }}>
                  <Spot name={s.spot} />
                </div>
              </div>
              <div className="ed-stage__caption"><strong>{s.caption}</strong><span>{s.note}</span></div>
            </div>
            <div className="ed-rail" role="tablist" aria-label="Serviços">
              {SERVICES.map((item, i) => (
                <button key={item.key} role="tab" aria-selected={i === active}
                  className={`ed-rail__item${i === active ? ' is-on' : ''}`} onClick={() => switchTo(i)}>
                  <span className="ed-rail__num">{item.num}</span>
                  <span className="ed-rail__label">{item.label}</span>
                </button>
              ))}
            </div>
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
