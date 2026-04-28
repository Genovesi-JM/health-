import { useState } from 'react';
import { MessageSquare, Send, Search } from 'lucide-react';

const THREADS = [
  { id: 't1', name: 'Maria Fernanda Santos', last: 'O exame já ficou pronto?', time: '14:32', unread: 2, avatar: 'MS' },
  { id: 't2', name: 'José Eduardo Almeida',  last: 'Obrigado doutor, sinto-me melhor.', time: '11:15', unread: 0, avatar: 'JA' },
  { id: 't3', name: 'Beatriz Maria Lima',     last: 'Quando posso renovar a receita?', time: 'ontem', unread: 1, avatar: 'BL' },
  { id: 't4', name: 'Carlos Manuel Pinto',   last: 'Boa tarde, até amanhã!', time: 'ontem', unread: 0, avatar: 'CP' },
];

const CONVO: Record<string, { from: 'me' | 'them'; text: string; time: string }[]> = {
  t1: [
    { from: 'them', text: 'Boa tarde, doutor. O exame de sangue já ficou pronto?', time: '14:30' },
    { from: 'them', text: 'Pode verificar os resultados por favor?', time: '14:32' },
  ],
  t2: [
    { from: 'me',   text: 'Como se sente hoje, Sr. José?', time: '10:00' },
    { from: 'them', text: 'Obrigado doutor, sinto-me melhor.', time: '11:15' },
  ],
  t3: [
    { from: 'them', text: 'Quando posso renovar a receita do inalador?', time: 'ontem' },
  ],
  t4: [
    { from: 'me',   text: 'Vemo-nos amanhã às 9h, Sr. Carlos.', time: 'ontem' },
    { from: 'them', text: 'Boa tarde, até amanhã!', time: 'ontem' },
  ],
};

export default function DoctorMessagesPage() {
  const [active, setActive] = useState('t1');
  const [draft, setDraft] = useState('');
  const [convos, setConvos] = useState(CONVO);
  const thread = THREADS.find(t => t.id === active)!;
  const messages = convos[active] ?? [];

  const send = () => {
    if (!draft.trim()) return;
    setConvos(prev => ({ ...prev, [active]: [...(prev[active] ?? []), { from: 'me', text: draft.trim(), time: 'agora' }] }));
    setDraft('');
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1.25rem 2rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <MessageSquare size={20} style={{ color: 'var(--brand-primary)' }} /> Mensagens
      </h1>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1rem', height: '65vh' }}>
        {/* Thread list */}
        <div className="card" style={{ overflow: 'auto', padding: 0 }}>
          {THREADS.map(t => (
            <div key={t.id} onClick={() => setActive(t.id)} style={{ display: 'flex', gap: '0.75rem', padding: '0.9rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: active === t.id ? 'var(--brand-light)' : 'transparent' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--brand-light)', color: 'var(--brand-primary)', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{t.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{t.name}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.time}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.last}</div>
              </div>
              {t.unread > 0 && <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--brand-primary)', color: '#fff', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'center' }}>{t.unread}</span>}
            </div>
          ))}
        </div>
        {/* Chat panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>{thread.name}</div>
          <div style={{ flex: 1, overflow: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '70%', padding: '0.6rem 0.9rem', borderRadius: m.from === 'me' ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: m.from === 'me' ? 'var(--brand-primary)' : 'var(--bg-subtle,rgba(0,0,0,0.04))', color: m.from === 'me' ? '#fff' : 'var(--text-primary)', fontSize: '0.85rem' }}>
                  {m.text}
                  <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '0.2rem', textAlign: 'right' }}>{m.time}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
            <input className="form-input" placeholder="Escreva uma mensagem…" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} style={{ flex: 1 }} />
            <button onClick={send} style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', background: 'var(--brand-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}><Send size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
