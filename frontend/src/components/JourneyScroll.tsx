/* Scroll-driven "journey to care" illustration (scrollytelling).
   A tall section with a sticky stage; as the viewer scrolls, the route draws,
   the ambulance travels from home to the clinic, and each stage lights up. */
import { useEffect, useRef, useState } from 'react';

const ROUTE = 'M118 322 C 168 212, 250 168, 312 202 S 392 300, 406 304';

const STAGES = [
  { t: 'Pedido de cuidado',    d: 'Organize o historial e peça a consulta — ou o transporte certo.' },
  { t: 'Profissional aceita',  d: 'Um médico ou enfermeiro revê dentro do âmbito autorizado.' },
  { t: 'Transporte a caminho', d: 'Transporte agendado ou ambulância, com handover clínico.' },
  { t: 'Chegada ao cuidado',   d: 'Plano claro, próximo passo e acompanhamento visível.' },
];

export default function JourneyScroll() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [p, setP] = useState(0);
  const [car, setCar] = useState({ x: 118, y: 322, a: 0 });
  const [len, setLen] = useState(600);

  useEffect(() => { if (pathRef.current) setLen(pathRef.current.getTotalLength()); }, []);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = wrapRef.current; if (!el) return;
        const rect = el.getBoundingClientRect();
        const total = el.offsetHeight - window.innerHeight;
        const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
        setP(total > 0 ? scrolled / total : 0);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    const path = pathRef.current; if (!path) return;
    const L = path.getTotalLength();
    const pt = path.getPointAtLength(p * L);
    const pt2 = path.getPointAtLength(Math.min(p * L + 1, L));
    const a = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180 / Math.PI;
    setCar({ x: pt.x, y: pt.y, a });
  }, [p]);

  const stage = Math.min(STAGES.length - 1, Math.floor(p * STAGES.length + 1e-6));
  const homeGlow = p < 0.28 ? 1 : 0.35;
  const clinicGlow = p > 0.72 ? 1 : 0.35;
  const show = (from: number) => (p >= from ? 1 : 0);

  return (
    <section className="jscroll" ref={wrapRef}>
      <div className="jscroll__sticky">
        <div className="jscroll__grid">
          <div className="jscroll__steps">
            <span className="cine-tag"><span className="cine-live" /> Jornada de cuidado</span>
            <h2 className="cine-h2">Da casa ao cuidado — e de volta.</h2>
            <p className="cine-lead">Cada passo liga-se ao seguinte: do pedido ao profissional, do transporte à chegada.</p>
            <ul className="jsteps">
              {STAGES.map((s, i) => (
                <li key={s.t} className={`jstep${i === stage ? ' jstep--on' : ''}${i < stage ? ' jstep--done' : ''}`}>
                  <span className="jstep__dot">{i + 1}</span>
                  <span className="jstep__body">
                    <span className="jstep__t">{s.t}</span>
                    <span className="jstep__d">{s.d}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="jscroll__hint">Role para seguir a jornada ↓</div>
          </div>

          <div className="jscroll__art">
            <svg viewBox="0 0 520 420" className="jscroll__svg" xmlns="http://www.w3.org/2000/svg"
              role="img" aria-label="Jornada do cuidado, da casa à clínica, animada ao rolar">
              <defs>
                <radialGradient id="jGlow" cx="50%" cy="42%" r="60%">
                  <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="jRoof" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" /><stop offset="100%" stopColor="#0b5a53" />
                </linearGradient>
                <filter id="jSoft" x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="10" stdDeviation="13" floodColor="#02110f" floodOpacity="0.5" />
                </filter>
              </defs>

              <ellipse cx="262" cy="200" rx="250" ry="175" fill="url(#jGlow)" />

              {/* route — faint full + bright progress */}
              <path d={ROUTE} fill="none" stroke="#5eead4" strokeOpacity="0.16" strokeWidth="4" strokeLinecap="round" />
              <path ref={pathRef} d={ROUTE} fill="none" stroke="#5eead4" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={len} strokeDashoffset={len * (1 - p)} style={{ filter: 'drop-shadow(0 0 6px rgba(94,234,212,.5))' }} />

              {/* HOME */}
              <g filter="url(#jSoft)" style={{ opacity: homeGlow, transition: 'opacity .3s' }}>
                <rect x="78" y="300" width="96" height="70" rx="12" fill="#f7f4ec" />
                <path d="M70 304 L126 266 L182 304 Z" fill="url(#jRoof)" />
                <rect x="94" y="322" width="22" height="22" rx="5" fill="#bfe9df" />
                <rect x="132" y="322" width="22" height="48" rx="5" fill="#0f766e" />
              </g>

              {/* CLINIC */}
              <g filter="url(#jSoft)" style={{ opacity: clinicGlow, transition: 'opacity .3s' }}>
                <rect x="360" y="290" width="96" height="80" rx="12" fill="#f3ecdb" />
                <rect x="392" y="266" width="30" height="28" rx="8" fill="#0f766e" />
                <rect x="405" y="272" width="4" height="16" rx="2" fill="#f7f4ec" />
                <rect x="399" y="278" width="16" height="4" rx="2" fill="#f7f4ec" />
                <g fill="#bfe9df"><rect x="374" y="306" width="18" height="18" rx="4" /><rect x="424" y="306" width="18" height="18" rx="4" /></g>
                <rect x="399" y="338" width="18" height="32" rx="4" fill="#0f766e" />
              </g>

              {/* Rx request chip (stage 0) */}
              <g style={{ opacity: show(0.02), transform: `translateY(${show(0.02) ? 0 : 10}px)`, transition: 'opacity .4s, transform .4s' }} filter="url(#jSoft)">
                <g transform="translate(70 150)">
                  <rect width="104" height="60" rx="11" fill="#fff" />
                  <circle cx="22" cy="22" r="11" fill="#e6f7f2" />
                  <text x="22" y="27" textAnchor="middle" fontFamily="Georgia, serif" fontSize="13" fontWeight="700" fill="#0f766e">Rx</text>
                  <rect x="40" y="15" width="52" height="5" rx="2.5" fill="#cfe9e1" />
                  <rect x="40" y="27" width="36" height="5" rx="2.5" fill="#e2ded0" />
                  <rect x="12" y="42" width="60" height="6" rx="3" fill="#eef1ea" />
                </g>
              </g>

              {/* clinician check chip (stage 1) */}
              <g style={{ opacity: show(0.3), transform: `translateY(${show(0.3) ? 0 : 10}px)`, transition: 'opacity .4s, transform .4s' }} filter="url(#jSoft)">
                <g transform="translate(222 120)">
                  <rect width="92" height="54" rx="11" fill="#0e3a32" />
                  <circle cx="24" cy="27" r="12" fill="rgba(94,234,212,.16)" />
                  <path d="M18 27 l4 4 l8 -9" fill="none" stroke="#5eead4" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="44" y="18" width="38" height="5" rx="2.5" fill="#1d6b5e" />
                  <rect x="44" y="30" width="26" height="5" rx="2.5" fill="#1d6b5e" />
                </g>
              </g>

              {/* pulse chip (stage 3) */}
              <g style={{ opacity: show(0.72), transform: `translateY(${show(0.72) ? 0 : 10}px)`, transition: 'opacity .4s, transform .4s' }} filter="url(#jSoft)">
                <g transform="translate(372 150)">
                  <rect width="104" height="52" rx="11" fill="#0e3a32" />
                  <path d="M14 28 h14 l6 -13 l9 26 l6 -13 h18" fill="none" stroke="#5eead4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              </g>

              {/* AMBULANCE travelling the route */}
              <g filter="url(#jSoft)" transform={`translate(${car.x} ${car.y}) rotate(${car.a})`}>
                <g transform="translate(-39 -26)">
                  <rect x="0" y="12" width="78" height="38" rx="9" fill="#fff" />
                  <path d="M58 16 h12 q10 0 14 10 l4 9 q1 6 -6 6 h-24 Z" fill="#eef7f4" />
                  <rect x="60" y="22" width="18" height="12" rx="3" fill="#bfe9df" />
                  <rect x="22" y="24" width="4.5" height="15" rx="2" fill="#ef4444" />
                  <rect x="16" y="29" width="16" height="4.5" rx="2" fill="#ef4444" />
                  <rect x="0" y="39" width="96" height="6" fill="#14b8a6" />
                  <rect x="20" y="4" width="16" height="9" rx="3" fill="#ef4444" />
                  <circle cx="22" cy="52" r="8.5" fill="#123" /><circle cx="22" cy="52" r="3.5" fill="#9fb" opacity=".5" />
                  <circle cx="72" cy="52" r="8.5" fill="#123" /><circle cx="72" cy="52" r="3.5" fill="#9fb" opacity=".5" />
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
