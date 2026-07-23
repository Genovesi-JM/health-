import { useState } from 'react';
import api from '../api';
import { X, Star, CheckCircle2 } from 'lucide-react';

interface Props {
  open: boolean;
  consultationId: string;
  title?: string;
  onClose: () => void;
  onDone?: () => void;
}

export default function ReviewModal({ open, consultationId, title, onClose, onDone }: Props) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const submit = async () => {
    if (rating < 1) { setError('Selecione uma classificação.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/api/v1/consultations/${consultationId}/review`, { rating, comment: comment.trim() || undefined });
      setDone(true);
      onDone?.();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Não foi possível registar a avaliação.');
    } finally {
      setSubmitting(false);
    }
  };

  const backdrop = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); };

  return (
    <div onClick={backdrop} style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px',
        width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', animation: 'fadeIn 0.2s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Avaliar consulta</h3>
          <button onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
          {done ? (
            <>
              <CheckCircle2 size={44} style={{ color: '#22c55e' }} />
              <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: '0.75rem' }}>Obrigado pela sua avaliação!</p>
              <button className="btn btn-primary" style={{ marginTop: '0.5rem' }} onClick={onClose}>Fechar</button>
            </>
          ) : (
            <>
              {title && <p style={{ color: 'var(--text-secondary)', marginTop: 0, fontSize: '0.85rem' }}>{title}</p>}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem', margin: '0.75rem 0 1rem' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <button key={i} onClick={() => setRating(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <Star size={32} fill={i <= (hover || rating) ? '#f59e0b' : 'none'} style={{ color: '#f59e0b' }} />
                  </button>
                ))}
              </div>
              <textarea className="form-input" placeholder="Comentário (opcional)…" value={comment}
                onChange={e => setComment(e.target.value)} rows={3}
                style={{ width: '100%', resize: 'vertical', marginBottom: '0.75rem' }} />
              {error && <p style={{ color: '#ef4444', fontSize: '0.82rem', margin: '0 0 0.5rem' }}>{error}</p>}
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={submitting} onClick={submit}>
                {submitting ? 'A enviar…' : 'Enviar avaliação'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
