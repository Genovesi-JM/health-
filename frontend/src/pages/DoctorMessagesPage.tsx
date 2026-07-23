import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import api from '../api';
import { specialtyLabel } from '../constants/specialties';
import { useT } from '../i18n/LanguageContext';

interface Thread {
  consultation_id: string;
  specialty: string;
  status: string;
  counterparty_name?: string | null;
  last_message?: string | null;
  last_at?: string | null;
  unread: number;
}
interface Msg {
  id: string;
  sender_role: string;
  body: string;
  created_at: string;
}

function initials(name?: string | null) {
  if (!name) return 'P';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
function fmtTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
}

export default function DoctorMessagesPage() {
  const { t } = useT();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadThreads = useCallback(() => {
    api.get<Thread[]>('/api/v1/doctor/message-threads')
      .then(r => {
        setThreads(r.data);
        setActive(a => a ?? (r.data[0]?.consultation_id ?? null));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadMessages = useCallback((cid: string) => {
    api.get<Msg[]>(`/api/v1/consultations/${cid}/messages`)
      .then(r => setMessages(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // Poll active thread + thread list.
  useEffect(() => {
    if (!active) return;
    loadMessages(active);
    const iv = window.setInterval(() => { loadMessages(active); loadThreads(); }, 5000);
    return () => window.clearInterval(iv);
  }, [active, loadMessages, loadThreads]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !active) return;
    setDraft('');
    try {
      await api.post(`/api/v1/consultations/${active}/messages`, { body: text });
      loadMessages(active);
      loadThreads();
    } catch { setDraft(text); }
  };

  const thread = threads.find(t => t.consultation_id === active) || null;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1.25rem 2rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <MessageSquare size={20} style={{ color: 'var(--brand-primary)' }} /> {t('sidebar.doc_messages') !== 'sidebar.doc_messages' ? t('sidebar.doc_messages') : 'Mensagens'}
      </h1>

      {loading ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : threads.length === 0 ? (
        <div className="empty-state" style={{ padding: '3rem' }}>
          <div className="empty-state-icon"><MessageSquare size={24} style={{ color: 'var(--accent-teal)' }} /></div>
          <div className="empty-state-title">Sem conversas</div>
          <div className="empty-state-desc">As mensagens com os seus pacientes aparecem aqui quando uma consulta é aceite.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1rem', height: '65vh' }}>
          {/* Thread list */}
          <div className="card" style={{ overflow: 'auto', padding: 0 }}>
            {threads.map(t2 => (
              <div key={t2.consultation_id} onClick={() => setActive(t2.consultation_id)}
                style={{ display: 'flex', gap: '0.75rem', padding: '0.9rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: active === t2.consultation_id ? 'var(--brand-light)' : 'transparent' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--brand-light)', color: 'var(--brand-primary)', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials(t2.counterparty_name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{t2.counterparty_name || 'Paciente'}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{fmtTime(t2.last_at)}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--accent-teal)' }}>{specialtyLabel(t2.specialty, t)}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t2.last_message}</div>
                </div>
                {t2.unread > 0 && <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--brand-primary)', color: '#fff', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'center' }}>{t2.unread}</span>}
              </div>
            ))}
          </div>

          {/* Chat panel */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
              {thread?.counterparty_name || 'Paciente'}
              {thread && <span style={{ marginLeft: 8, fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>· {specialtyLabel(thread.specialty, t)}</span>}
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {messages.map(m => {
                const me = m.sender_role === 'doctor';
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '70%', padding: '0.6rem 0.9rem', borderRadius: me ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: me ? 'var(--brand-primary)' : 'var(--bg-subtle,rgba(0,0,0,0.04))', color: me ? '#fff' : 'var(--text-primary)', fontSize: '0.85rem' }}>
                      {m.body}
                      <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '0.2rem', textAlign: 'right' }}>{fmtTime(m.created_at)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
              <input className="form-input" placeholder="Escreva uma mensagem…" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} style={{ flex: 1 }} />
              <button onClick={send} style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', background: 'var(--brand-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}><Send size={16} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
