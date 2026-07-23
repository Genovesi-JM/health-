import { useEffect, useRef, useState } from 'react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import { X, CheckCircle2, Copy, Loader2, Smartphone } from 'lucide-react';

interface CheckoutResponse {
  payment_id: string;
  status: string;
  amount: number;              // in centavos
  currency: string;
  provider?: string;
  provider_reference?: string;
  qr_code?: string;
  redirect_url?: string;
}

interface Props {
  open: boolean;
  consultationId: string;
  onClose: () => void;
  onPaid: () => void;
}

function formatAoa(centavos: number): string {
  const value = centavos / 100;
  return `${value.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;
}

const spinStyle: React.CSSProperties = { animation: 'spin 1s linear infinite' };

export default function PaymentModal({ open, consultationId, onClose, onPaid }: Props) {
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);
  const [status, setStatus] = useState<string>('idle'); // idle, pending, paid, failed
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);

  // Start checkout when the modal opens.
  useEffect(() => {
    if (!open || !consultationId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setStatus('idle');
    api.post('/api/v1/billing/consultation/checkout', {
      consultation_id: consultationId,
      payment_method: 'multicaixa_express',
    })
      .then((res) => {
        if (cancelled) return;
        const data: CheckoutResponse = res.data;
        setCheckout(data);
        setStatus(data.status === 'paid' ? 'paid' : 'pending');
        if (data.status === 'paid') onPaid();
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.detail || t('pay.error_start'));
        setStatus('failed');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, consultationId]);

  // Poll payment status every 4s while pending.
  useEffect(() => {
    if (status !== 'pending') return;
    const tick = async () => {
      try {
        const res = await api.get(`/api/v1/billing/consultation/${consultationId}/payment-status`);
        if (res.data.consultation_paid || res.data.status === 'paid') {
          setStatus('paid');
          onPaid();
        } else if (res.data.status === 'failed') {
          setStatus('failed');
          setError(t('pay.error_failed'));
        }
      } catch { /* transient — keep polling */ }
    };
    pollRef.current = window.setInterval(tick, 4000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [status, consultationId]);

  if (!open) return null;

  const copyReference = () => {
    if (!checkout?.provider_reference) return;
    navigator.clipboard?.writeText(checkout.provider_reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const backdrop = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); };

  return (
    <div
      onClick={backdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '16px', width: '100%', maxWidth: '440px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', animation: 'fadeIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '10px',
              background: 'rgba(20,184,166,0.1)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--accent-teal)',
            }}>
              <Smartphone size={20} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('pay.title')}
            </h3>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
          {loading && (
            <p style={{ display: 'flex', justifyContent: 'center', gap: 8, color: 'var(--text-secondary)' }}>
              <Loader2 size={18} style={spinStyle} /> {t('pay.starting')}
            </p>
          )}

          {status === 'paid' && (
            <div style={{ padding: '0.5rem 0' }}>
              <CheckCircle2 size={48} style={{ color: '#22c55e' }} />
              <h4 style={{ margin: '0.75rem 0 0.25rem', color: 'var(--text-primary)' }}>{t('pay.paid_title')}</h4>
              <p style={{ color: 'var(--text-secondary)' }}>{t('pay.paid_desc')}</p>
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={onClose}>
                {t('common.close')}
              </button>
            </div>
          )}

          {status === 'failed' && (
            <div style={{ padding: '0.5rem 0' }}>
              <p style={{ color: '#ef4444' }}>{error || t('pay.error_start')}</p>
              <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={onClose}>
                {t('common.close')}
              </button>
            </div>
          )}

          {status === 'pending' && checkout && (
            <>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{t('pay.amount')}</p>
              <p style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {formatAoa(checkout.amount)}
              </p>

              <div style={{
                background: 'var(--bg-subtle, rgba(148,163,184,0.12))', borderRadius: 12,
                padding: '1rem', margin: '1rem 0', textAlign: 'left',
              }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.25rem' }}>
                  {t('pay.reference')}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                  <code style={{ fontSize: '1.05rem', fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-primary)' }}>
                    {checkout.provider_reference}
                  </code>
                  <button className="btn btn-ghost btn-sm" onClick={copyReference}>
                    <Copy size={14} /> {copied ? t('pay.copied') : t('pay.copy')}
                  </button>
                </div>
              </div>

              <ol style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.9rem', paddingLeft: '1.25rem', lineHeight: 1.6, margin: 0 }}>
                <li>{t('pay.step1')}</li>
                <li>{t('pay.step2')}</li>
                <li>{t('pay.step3')}</li>
              </ol>

              <p style={{ display: 'flex', justifyContent: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '1rem' }}>
                <Loader2 size={14} style={spinStyle} /> {t('pay.waiting')}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
