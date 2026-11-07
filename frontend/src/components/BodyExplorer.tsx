/* Interactive body explorer for the landing hero. A translucent human figure
   with hotspots: choosing a body system (or a hotspot) lights the organ,
   shows what KAYA offers for it and links into the site. Pure SVG + CSS. */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Brain, HeartPulse, Wind, Soup, Droplets, Footprints } from 'lucide-react';

type Organ = 'brain' | 'heart' | 'lungs' | 'stomach' | 'kidneys' | 'joints';

const SYSTEMS: { organ: Organ; label: string; title: string; text: string; to: string; cta: string; icon: typeof Brain; dot: [number, number] }[] = [
  { organ: 'brain',   label: 'Neurologia',       title: 'Dor de cabeça, tonturas, sono',   text: 'Comece por uma triagem digital. Um médico real lê o resultado e decide se precisa de consulta, teleconsulta ou autocuidado.', to: '/triage', cta: 'Iniciar triagem', icon: Brain, dot: [160, 62] },
  { organ: 'heart',   label: 'Cardiovascular',   title: 'Tensão arterial e coração',        text: 'Registe a tensão e o pulso em casa, veja a tendência e partilhe com o cardiologista. Alertas quando os valores saem do intervalo.', to: '/patient/readings', cta: 'Ver medições', icon: HeartPulse, dot: [172, 150] },
  { organ: 'lungs',   label: 'Respiratório',     title: 'Asma, tosse e falta de ar',        text: 'Plano de autocuidado, renovação da medicação inalada com decisão médica e teleconsulta quando a crise aperta.', to: '/self-care', cta: 'Autocuidado', icon: Wind, dot: [142, 138] },
  { organ: 'stomach', label: 'Digestivo',        title: 'Estômago e nutrição',               text: 'Consulta de clínica geral ou nutrição, presencial ou por vídeo, com historial e receitas no mesmo lugar.', to: '/medicos', cta: 'Ver médicos', icon: Soup, dot: [150, 202] },
  { organ: 'kidneys', label: 'Metabólico e renal', title: 'Diabetes, glicose e rins',       text: 'Glicose registada em casa, lembretes de medicação e acompanhamento crónico com a sua equipa.', to: '/chronic-care', cta: 'Cuidado crónico', icon: Droplets, dot: [186, 214] },
  { organ: 'joints',  label: 'Mobilidade',       title: 'Articulações e deslocação',         text: 'Fisioterapia e, quando andar é difícil, transporte acessível ou assistido até à consulta.', to: '/urgencia', cta: 'Transporte e ambulância', icon: Footprints, dot: [138, 372] },
];

export default function BodyExplorer() {
  const [i, setI] = useState(1);
  const [touched, setTouched] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (touched) return;
    const t = window.setInterval(() => setI(v => (v + 1) % SYSTEMS.length), 4800);
    return () => window.clearInterval(t);
  }, [touched]);

  const pick = (n: number) => { setTouched(true); setI((n + SYSTEMS.length) % SYSTEMS.length); };
  const s = SYSTEMS[i];

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = wrap.current?.getBoundingClientRect(); if (!r) return;
    setTilt({ x: ((e.clientX - r.left) / r.width - .5) * 10, y: ((e.clientY - r.top) / r.height - .5) * 8 });
  };

  return (
    <div className="bx" ref={wrap} onMouseMove={onMove} onMouseLeave={() => setTilt({ x: 0, y: 0 })}>
      <div className="bx__figure" style={{ transform: `translate3d(${tilt.x}px, ${tilt.y}px, 0)` }}>
        <svg viewBox="0 0 320 520" className="bx__svg" role="img" aria-label={`Figura humana com ${s.label} em destaque`}>
          <defs>
            <linearGradient id="bxSkin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity=".92" />
              <stop offset="1" stopColor="#dfe7fb" stopOpacity=".85" />
            </linearGradient>
            <radialGradient id="bxGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#ff5a5a" stopOpacity=".95" />
              <stop offset="1" stopColor="#ff5a5a" stopOpacity="0" />
            </radialGradient>
            <filter id="bxBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
            <filter id="bxSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2" /></filter>
          </defs>

          {/* figure */}
          <g className="bx__body" fill="url(#bxSkin)" stroke="#ffffff" strokeOpacity=".9" strokeWidth="1.5">
            <circle cx="160" cy="58" r="34" />
            <path d="M138 92 h44 v18 c30 6 54 24 58 60 l10 108 c2 22 -8 30 -16 30 l-6 -96 l-6 10 c4 60 4 120 -2 180 l-10 118 c-2 10 -34 10 -36 0 l-6 -118 c-2 -36 -2 -70 -2 -70 c0 0 0 34 -2 70 l-6 118 c-2 10 -34 10 -36 0 l-10 -118 c-6 -60 -6 -120 -2 -180 l-6 -10 l-6 96 c-8 0 -18 -8 -16 -30 l10 -108 c4 -36 28 -54 58 -60 z" />
          </g>

          {/* organs */}
          <g className={`bx__organ${s.organ === 'brain' ? ' is-on' : ''}`}>
            <ellipse cx="160" cy="54" rx="24" ry="19" />
            <path d="M138 54 q10 -14 22 -6 q10 -12 24 4" fill="none" />
          </g>
          <g className={`bx__organ${s.organ === 'lungs' ? ' is-on' : ''}`}>
            <path d="M152 118 c-18 2 -28 26 -28 54 c0 12 10 18 20 14 c8 -4 10 -16 10 -30 z" />
            <path d="M168 118 c18 2 28 26 28 54 c0 12 -10 18 -20 14 c-8 -4 -10 -16 -10 -30 z" />
          </g>
          <g className={`bx__organ${s.organ === 'heart' ? ' is-on' : ''}`}>
            <path d="M172 136 c-6 -10 -22 -8 -22 6 c0 14 22 26 22 26 c0 0 22 -12 22 -26 c0 -14 -16 -16 -22 -6 z" />
          </g>
          <g className={`bx__organ${s.organ === 'stomach' ? ' is-on' : ''}`}>
            <path d="M150 190 c-14 0 -22 10 -20 24 c2 14 14 20 26 16 c12 -4 18 -14 14 -26 c-4 -10 -10 -14 -20 -14 z" />
          </g>
          <g className={`bx__organ${s.organ === 'kidneys' ? ' is-on' : ''}`}>
            <path d="M136 206 c-8 0 -12 10 -10 20 c2 10 10 12 14 6 c4 -6 2 -26 -4 -26 z" />
            <path d="M184 206 c8 0 12 10 10 20 c-2 10 -10 12 -14 6 c-4 -6 -2 -26 4 -26 z" />
          </g>
          <g className={`bx__organ${s.organ === 'joints' ? ' is-on' : ''}`}>
            <circle cx="138" cy="372" r="12" />
            <circle cx="182" cy="372" r="12" />
          </g>

          {/* glow behind the selected organ */}
          <circle className="bx__glow" cx={s.dot[0]} cy={s.dot[1]} r="38" fill="url(#bxGlow)" filter="url(#bxBlur)" />

          {/* hotspots */}
          {SYSTEMS.map((sys, n) => (
            <g key={sys.organ} className={`bx__dot${n === i ? ' is-on' : ''}`} onClick={() => pick(n)} role="button" tabIndex={0}
              aria-label={sys.label} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') pick(n); }}>
              <circle cx={sys.dot[0]} cy={sys.dot[1]} r="14" className="bx__ring" />
              <circle cx={sys.dot[0]} cy={sys.dot[1]} r="5" className="bx__core" />
            </g>
          ))}
        </svg>
      </div>

      <aside className="bx__side">
        <div className="bx__kicker">Explorar por sistema</div>
        <ul className="bx__list">
          {SYSTEMS.map((sys, n) => (
            <li key={sys.organ}>
              <button className={`bx__item${n === i ? ' is-on' : ''}`} onClick={() => pick(n)} aria-pressed={n === i}>
                <sys.icon size={18} strokeWidth={1.6} /><span>{sys.label}</span><ChevronRight size={16} />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="bx__panel" key={s.organ}>
        <div className="bx__panel-head">
          <span className="bx__chip">{s.label}</span>
          <div className="bx__arrows">
            <button onClick={() => pick(i - 1)} aria-label="Anterior"><ChevronLeft size={20} /></button>
            <button onClick={() => pick(i + 1)} aria-label="Seguinte"><ChevronRight size={20} /></button>
          </div>
        </div>
        <h3>{s.title}</h3>
        <p>{s.text}</p>
        <Link to={s.to} className="ed-link">{s.cta} <ArrowRight size={16} /></Link>
      </div>
    </div>
  );
}
