/* Stylised, interactive map of Luanda's municipalities. Not a geographic
   survey: zones are indicative shapes placed roughly where they sit relative
   to the bay. Hovering or focusing a zone shows what the pilot offers there. */
import { useState } from 'react';

type Zone = {
  id: string; name: string; cx: number; cy: number; rx: number; ry: number; rot?: number;
  status: 'piloto' | 'preparacao'; offer: string;
};

const ZONES: Zone[] = [
  { id: 'ingombota',  name: 'Ingombota',      cx: 250, cy: 150, rx: 46, ry: 36, rot: -12, status: 'piloto',     offer: 'Consulta, receita digital e transporte agendado' },
  { id: 'maianga',    name: 'Maianga',        cx: 300, cy: 215, rx: 52, ry: 40, rot: 8,   status: 'piloto',     offer: 'Consulta, receita digital e transporte agendado' },
  { id: 'rangel',     name: 'Rangel',         cx: 372, cy: 170, rx: 48, ry: 34, rot: 0,   status: 'piloto',     offer: 'Consulta e receita digital' },
  { id: 'sambizanga', name: 'Sambizanga',     cx: 330, cy: 100, rx: 54, ry: 34, rot: -6,  status: 'preparacao', offer: 'Em preparação' },
  { id: 'kilamba',    name: 'Kilamba Kiaxi',  cx: 405, cy: 255, rx: 62, ry: 42, rot: 10,  status: 'piloto',     offer: 'Consulta e transporte agendado' },
  { id: 'talatona',   name: 'Talatona',       cx: 300, cy: 330, rx: 78, ry: 48, rot: -4,  status: 'piloto',     offer: 'Consulta, receita digital, transporte e pré-alerta' },
  { id: 'viana',      name: 'Viana',          cx: 500, cy: 300, rx: 70, ry: 50, rot: 6,   status: 'preparacao', offer: 'Em preparação' },
  { id: 'cacuaco',    name: 'Cacuaco',        cx: 470, cy: 110, rx: 70, ry: 46, rot: 12,  status: 'preparacao', offer: 'Em preparação' },
  { id: 'belas',      name: 'Belas',          cx: 420, cy: 395, rx: 92, ry: 42, rot: -8,  status: 'preparacao', offer: 'Em preparação' },
];

export default function LuandaMap() {
  const [active, setActive] = useState<string>('talatona');
  const z = ZONES.find(x => x.id === active) ?? ZONES[0];

  return (
    <div className="lmap">
      <svg className="lmap__svg" viewBox="0 0 600 440" xmlns="http://www.w3.org/2000/svg" role="img"
        aria-label="Mapa estilizado de Luanda com as zonas do piloto KAYA">
        {/* ocean + bay */}
        <path d="M0 0 H600 V440 H0 Z" fill="#0b1f1b" />
        <path d="M0 0 H215 C 200 70, 190 120, 215 175 C 232 215, 205 250, 160 300 C 120 345, 90 400, 60 440 H0 Z" fill="#0e2a25" />
        <path d="M215 175 C 232 215, 205 250, 160 300" fill="none" stroke="#2f5a52" strokeWidth="1.2" strokeDasharray="3 5" />
        {/* graticule */}
        {[80, 160, 240, 320, 400].map(y => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#1a3a34" strokeWidth=".6" />)}
        {[100, 200, 300, 400, 500].map(x => <line key={x} y1="0" y2="440" x1={x} x2={x} stroke="#1a3a34" strokeWidth=".6" />)}
        {/* zones */}
        {ZONES.map(zone => {
          const on = zone.id === active;
          const pilot = zone.status === 'piloto';
          return (
            <g key={zone.id} className={`lmap__zone${on ? ' is-on' : ''}${pilot ? '' : ' is-planned'}`}
              transform={`rotate(${zone.rot ?? 0} ${zone.cx} ${zone.cy})`}
              onMouseEnter={() => setActive(zone.id)} onFocus={() => setActive(zone.id)} onClick={() => setActive(zone.id)}
              tabIndex={0} role="button" aria-label={`${zone.name}: ${zone.offer}`}>
              <ellipse cx={zone.cx} cy={zone.cy} rx={zone.rx} ry={zone.ry} />
              <text x={zone.cx} y={zone.cy + 4} textAnchor="middle" transform={`rotate(${-(zone.rot ?? 0)} ${zone.cx} ${zone.cy})`}>{zone.name}</text>
            </g>
          );
        })}
        {/* compass + scale */}
        <text x="24" y="28" className="lmap__tiny">N</text>
        <line x1="30" y1="34" x2="30" y2="60" stroke="#8fcfc3" strokeWidth="1" />
        <text x="24" y="420" className="lmap__tiny">LUANDA · 8°50′S 13°14′E</text>
      </svg>
      <div className="lmap__panel" aria-live="polite">
        <span className="ed-num">{z.status === 'piloto' ? 'Fase piloto' : 'Próximas zonas'}</span>
        <strong>{z.name}</strong>
        <p>{z.offer}</p>
        <small>Zonas indicativas. A cobertura é confirmada no momento do pedido.</small>
      </div>
    </div>
  );
}
