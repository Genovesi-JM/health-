import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import { X, Send, MessageSquare, Loader2 } from 'lucide-react';

interface Msg { id: string; sender_role: string; body: string; created_at: string; }

interface Props {
  open: boolean;
  consultationId: string;
  title?: string;          // e.g. doctor name / specialty
  myRole: 'patient' | 'doctor';
  onClose: () => void;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatModal({ open, consultationId, title, myRole, onClose }: Props) {
  const { t } = useT();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(() => {
    if (!consultationId) return;
    api.get<Msg[]>(`/api/v1/consultations/${consultationId}/messages`)
      .then(r => setMessages(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [consultationId]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    load();
    const iv = window.setInterval(load, 5000);
    return () => window.clearInterval(iv);
  }, [open, load]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  if (!open) return null;

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    try {
      await api.post(`/api/v1/consultations/${consultationId}/messages`, { body: text });
      load();
    } catch { setDraft(text); }
  };

  const backdrop = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); };

  return (
    <div onClick={backdrop} style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px',
        width: '100%', maxWidth: '440px', height: '70vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', animation: 'fadeIn 0.2s ease', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
            <MessageSquare size={18} style={{ color: 'var(--accent-teal)', flexShrink: 0 }} />
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title || t('msg.messages')}</span>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /></p>
          ) : messages.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '1rem' }}>
              {t('msg.empty')}
            </p>
          ) : messages.map(m => {
            const me = m.sender_role === myRole;
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '75%', padding: '0.6rem 0.9rem', borderRadius: me ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: me ? 'var(--accent-teal, #0d9488)' : 'var(--bg-subtle,rgba(0,0,0,0.05))', color: me ? '#fff' : 'var(--text-primary)', fontSize: '0.85rem' }}>
                  {m.body}
                  <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '0.2rem', textAlign: 'right' }}>{fmtTime(m.created_at)}</div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
          <input className="form-input" placeholder={t('msg.placeholder')} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} style={{ flex: 1 }} />
          <button onClick={send} style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', background: 'var(--accent-teal, #0d9488)', color: '#fff', border: 'none', cursor: 'pointer' }}><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}
