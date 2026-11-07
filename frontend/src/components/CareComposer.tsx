/* "Compose your care": three rows of choices that assemble a request in plain
   words and show the matching illustrated object. Nothing is sent anywhere;
   the result is a sentence and a link into the account flow. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Spot, { type SpotName } from './Spots';

const WHO = [
  { id: 'eu',      label: 'Para mim',        phrase: 'para si' },
  { id: 'familia', label: 'Para um familiar', phrase: 'para um familiar ao seu cuidado' },
  { id: 'equipa',  label: 'Para a minha equipa', phrase: 'para a sua equipa' },
];
const WHAT: { id: string; label: string; phrase: string; spot: SpotName; to: string }[] = [
  { id: 'consulta',   label: 'Uma consulta',          phrase: 'uma consulta',                 spot: 'professional',  to: '/register' },
  { id: 'receita',    label: 'Renovar uma receita',   phrase: 'a renovação de uma receita',   spot: 'prescription',  to: '/register' },
  { id: 'transporte', label: 'Transporte',            phrase: 'transporte até ao cuidado',    spot: 'scheduled',     to: '/urgencia' },
  { id: 'cronico',    label: 'Acompanhamento crónico', phrase: 'acompanhamento de uma condição crónica', spot: 'chronic', to: '/chronic-care' },
];
const HOW = [
  { id: 'online',     label: 'Online',     phrase: 'por vídeo' },
  { id: 'presencial', label: 'Presencial', phrase: 'presencialmente' },
  { id: 'casa',       label: 'Em casa',    phrase: 'em casa' },
];

function Row({ title, items, value, onPick }: { title: string; items: { id: string; label: string }[]; value: number; onPick: (i: number) => void }) {
  return (
    <div className="composer__row">
      <span className="composer__q">{title}</span>
      <div className="composer__opts" role="radiogroup" aria-label={title}>
        {items.map((it, i) => (
          <button key={it.id} type="button" role="radio" aria-checked={i === value}
            className={`composer__opt${i === value ? ' is-on' : ''}`} onClick={() => onPick(i)}>{it.label}</button>
        ))}
      </div>
    </div>
  );
}

export default function CareComposer() {
  const [who, setWho] = useState(0);
  const [what, setWhat] = useState(0);
  const [how, setHow] = useState(0);
  const w = WHAT[what];

  const sentence = `${w.phrase.charAt(0).toUpperCase()}${w.phrase.slice(1)} ${HOW[how].phrase}, ${WHO[who].phrase}. Um médico real decide; o KAYA organiza o caminho.`;

  return (
    <div className="composer">
      <div className="composer__form">
        <Row title="Para quem" items={WHO} value={who} onPick={setWho} />
        <Row title="O quê" items={WHAT} value={what} onPick={setWhat} />
        <Row title="Como" items={HOW} value={how} onPick={setHow} />
      </div>
      <div className="composer__result">
        <div className="composer__stage"><div className="ed-object"><Spot name={w.spot} /></div></div>
        <p className="composer__sentence">{sentence}</p>
        <Link to={w.to} className="ed-link">Começar este pedido <ArrowRight size={16} /></Link>
      </div>
    </div>
  );
}
