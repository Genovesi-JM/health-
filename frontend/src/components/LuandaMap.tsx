/* Interactive map of Luanda's municipalities, drawn from real OpenStreetMap
   outlines (see luandaShapes.ts). Hovering or focusing a municipality shows
   what the pilot offers there. Outlines draw themselves in when the map
   scrolls into view; the active one glows. */
import { useEffect, useRef, useState } from 'react';
import { LUANDA_SHAPES, LUANDA_VIEW } from './luandaShapes';

type Status = 'piloto' | 'preparacao';
const INFO: Record<string, { status: Status; offer: string }> = {
  luanda:   { status: 'piloto',     offer: 'Consulta, receita digital e transporte agendado' },
  cazenga:  { status: 'piloto',     offer: 'Consulta e receita digital' },
  kilamba:  { status: 'piloto',     offer: 'Consulta e transporte agendado' },
  talatona: { status: 'piloto',     offer: 'Consulta, receita digital, transporte e pré-alerta' },
  cacuaco:  { status: 'preparacao', offer: 'Em preparação' },
  viana:    { status: 'preparacao', offer: 'Em preparação' },
  belas:    { status: 'preparacao', offer: 'Em preparação' },
  quicama:  { status: 'preparacao', offer: 'Em preparação' },
};

export default function LuandaMap() {
  const [active, setActive] = useState('talatona');
  const [drawn, setDrawn] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const z = LUANDA_SHAPES.find(s => s.id === active) ?? LUANDA_SHAPES[0];
  const info = INFO[z.id] ?? { status: 'preparacao' as Status, offer: 'Em preparação' };

  // Draw the outlines when the map enters the viewport
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { el?.classList.add('is-drawn'); return; }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { el.classList.add('is-drawn'); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="lmap" ref={ref} onAnimationEnd={() => setDrawn(true)}>
      <svg className="lmap__svg" viewBox={LUANDA_VIEW} xmlns="http://www.w3.org/2000/svg" role="img"
        aria-label="Mapa dos municípios de Luanda com as zonas do piloto KAYA">
        <defs>
          <radialGradient id="lmSea" cx="20%" cy="30%" r="90%">
            <stop offset="0" stopColor="#123a3a" /><stop offset="1" stopColor="#0b1f1b" />
          </radialGradient>
          <filter id="lmGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>
        <rect width="600" height="440" fill="url(#lmSea)" />
        {[80, 160, 240, 320, 400].map(y => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#1a3a34" strokeWidth=".6" />)}
        {[100, 200, 300, 400, 500].map(x => <line key={x} y1="0" y2="440" x1={x} x2={x} stroke="#1a3a34" strokeWidth=".6" />)}

        {/* glow under the active municipality */}
        <path d={z.d} fill="#5eead4" opacity=".35" filter="url(#lmGlow)" className="lmap__halo" />

        {LUANDA_SHAPES.map((s, n) => {
          const on = s.id === active;
          const planned = (INFO[s.id]?.status ?? 'preparacao') === 'preparacao';
          return (
            <g key={s.id} className={`lmap__zone${on ? ' is-on' : ''}${planned ? ' is-planned' : ''}${drawn ? ' is-static' : ''}`}
              style={{ ['--i' as string]: n }}
              onMouseEnter={() => setActive(s.id)} onFocus={() => setActive(s.id)} onClick={() => setActive(s.id)}
              tabIndex={0} role="button" aria-label={`${s.name}: ${INFO[s.id]?.offer ?? ''}`}>
              <path d={s.d} pathLength={1} />
              <text x={s.cx} y={s.cy + 4} textAnchor="middle">{s.name}</text>
            </g>
          );
        })}
        <text x="24" y="28" className="lmap__tiny">N</text>
        <line x1="30" y1="34" x2="30" y2="60" stroke="#8fcfc3" strokeWidth="1" />
        <text x="24" y="424" className="lmap__tiny">LUANDA · 8°50′S 13°14′E · © OPENSTREETMAP</text>
      </svg>
      <div className="lmap__panel" aria-live="polite" key={z.id}>
        <span className="ed-num">{info.status === 'piloto' ? 'Fase piloto' : 'Próximas zonas'}</span>
        <strong>{z.name}</strong>
        <p>{info.offer}</p>
        <small>Limites municipais de dados abertos; cobertura indicativa, confirmada no momento do pedido.</small>
      </div>
    </div>
  );
}
