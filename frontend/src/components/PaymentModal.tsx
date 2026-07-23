import { useEffect, useRef, useState } from 'react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import { X, CheckCircle2, Copy, Loader2, Smartphone, CreditCard, Landmark, ChevronRight } from 'lucide-react';

interface CheckoutResponse {
  payment_id: string;
  status: string;
  amount: number;              // in centavos
  currency: string;
  provider?: string;
  provider_reference?: string;
  qr_code?: string;
  redirect_url?: string;
  client_secret?: string;
  transfer_details?: Record<string, string | number>;
  instructions?: string;
}

interface PaymentMethod { id: string; label: string; description: string; enabled: boolean; }

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

const METHOD_ICON: Record<string, React.ReactNode> = {
  multicaixa_express: <Smartphone size={18} />,
  visa_mastercard: <CreditCard size={18} />,
  iban_transfer: <Landmark size={18} />,
};

export default function PaymentModal({ open, consultationId, onClose, onPaid }: Props) {
  const { t } = useT();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);
  const [status, setStatus] = useState<string>('methods'); // methods, pending, paid, failed
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // Load available methods when opened.
  useEffect(() => {
    if (!open) return;
    setStatus('methods'); setChosen(null); setCheckout(null); setError('');
    api.get('/api/v1/billing/payment-methods')
      .then(r => setMethods((r.data.methods || []).filter((m: PaymentMethod) => m.enabled)))
      .catch(() => setMethods([
        { id: 'multicaixa_express', label: 'Multicaixa Express', description: '', enabled: true },
      ]));
  }, [open]);

  // Start checkout once a method is chosen.
  const selectMethod = (methodId: string) => {
    setChosen(methodId);
    setLoading(true);
    setError('');
    api.post('/api/v1/billing/consultation/checkout', {
      consultation_id: consultationId,
      payment_method: methodId,
    })
      .then((res) => {
        const data: CheckoutResponse = res.data;
        setCheckout(data);
        setStatus(data.status === 'paid' ? 'paid' : 'pending');
        if (data.status === 'paid') onPaid();
      })
      .catch((err) => {
        setError(err.response?.data?.detail || t('pay.error_start'));
        setStatus('failed');
      })
      .finally(() => setLoading(false));
  };

  // Poll status while pending — for auto-confirmable methods only.
  // Bank transfer (iban_transfer) confirms manually, so we don't poll it.
  useEffect(() => {
    if (status !== 'pending' || !checkout) return;
    if (checkout.provider === 'iban_transfer') return;
    const tick = async () => {
      try {
        const res = await api.get(`/api/v1/billing/consultation/${consultationId}/payment-status`);
        if (res.data.consultation_paid || res.data.status === 'paid') {
          setStatus('paid'); onPaid();
        } else if (res.data.status === 'failed') {
          setStatus('failed'); setError(t('pay.error_failed'));
        }
      } catch { /* transient — keep polling */ }
    };
    pollRef.current = window.setInterval(tick, 4000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [status, checkout, consultationId]);

  if (!open) return null;

  const copy = (key: string, value?: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const backdrop = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); };
  const provider = checkout?.provider;

  return (
    <div onClick={backdrop} style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px',
        width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', animation: 'fadeIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('pay.title')}
          </h3>
          <button onClick={onClose} aria-label={t('common.close')} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          {/* Method selection */}
          {status === 'methods' && (
            <>
              <p style={{ color: 'var(--text-secondary)', marginTop: 0, marginBottom: '1rem', fontSize: '0.9rem' }}>
                {t('pay.choose_method')}
              </p>
              {loading && <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                <Loader2 size={18} style={spinStyle} /></p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {methods.map(m => (
                  <button key={m.id} onClick={() => selectMethod(m.id)} disabled={loading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left',
                      padding: '0.85rem 1rem', borderRadius: 12, border: '1px solid var(--border)',
                      background: chosen === m.id ? 'rgba(20,184,166,0.08)' : 'var(--bg-card)', cursor: 'pointer',
                    }}>
                    <span style={{ color: 'var(--accent-teal)' }}>{METHOD_ICON[m.id] ?? <CreditCard size={18} />}</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>{m.label}</span>
                      {m.description && <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{m.description}</span>}
                    </span>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </button>
                ))}
              </div>
            </>
          )}

          {status === 'paid' && (
            <div style={{ padding: '0.5rem 0', textAlign: 'center' }}>
              <CheckCircle2 size={48} style={{ color: '#22c55e' }} />
              <h4 style={{ margin: '0.75rem 0 0.25rem', color: 'var(--text-primary)' }}>{t('pay.paid_title')}</h4>
              <p style={{ color: 'var(--text-secondary)' }}>{t('pay.paid_desc')}</p>
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={onClose}>{t('common.close')}</button>
            </div>
          )}

          {status === 'failed' && (
            <div style={{ padding: '0.5rem 0', textAlign: 'center' }}>
              <p style={{ color: '#ef4444' }}>{error || t('pay.error_start')}</p>
              <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => setStatus('methods')}>
                {t('pay.try_other')}
              </button>
            </div>
          )}

          {status === 'pending' && checkout && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{t('pay.amount')}</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0 0 1rem', color: 'var(--text-primary)' }}>
                {formatAoa(checkout.amount)}
              </p>

              {/* Multicaixa Express */}
              {provider === 'multicaixa_express' && (
                <>
                  <ReferenceBox label={t('pay.reference')} value={checkout.provider_reference}
                    copied={copied === 'ref'} onCopy={() => copy('ref', checkout.provider_reference)} tCopy={t('pay.copy')} tCopied={t('pay.copied')} />
                  <ol style={olStyle}>
                    <li>{t('pay.step1')}</li><li>{t('pay.step2')}</li><li>{t('pay.step3')}</li>
                  </ol>
                  <Waiting text={t('pay.waiting')} />
                </>
              )}

              {/* Card */}
              {provider === 'visa_mastercard' && (
                <>
                  {checkout.redirect_url ? (
                    <a className="btn btn-primary" href={checkout.redirect_url} target="_blank" rel="noreferrer"
                      style={{ display: 'inline-flex', marginBottom: '0.75rem' }}>
                      <CreditCard size={16} /> {t('pay.card_continue')}
                    </a>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('pay.card_processing')}</p>
                  )}
                  <Waiting text={t('pay.waiting')} />
                </>
              )}

              {/* Bank transfer */}
              {provider === 'iban_transfer' && checkout.transfer_details && (
                <div style={{ textAlign: 'left' }}>
                  <TransferRow label={t('pay.bank')} value={String(checkout.transfer_details.bank_name ?? '')} />
                  <TransferRow label={t('pay.beneficiary')} value={String(checkout.transfer_details.beneficiary ?? '')} />
                  <ReferenceBox label="IBAN" value={String(checkout.transfer_details.iban ?? '')}
                    copied={copied === 'iban'} onCopy={() => copy('iban', String(checkout.transfer_details?.iban ?? ''))} tCopy={t('pay.copy')} tCopied={t('pay.copied')} />
                  <ReferenceBox label={t('pay.reference')} value={checkout.provider_reference}
                    copied={copied === 'ref'} onCopy={() => copy('ref', checkout.provider_reference)} tCopy={t('pay.copy')} tCopied={t('pay.copied')} />
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.75rem', lineHeight: 1.5 }}>
                    {t('pay.transfer_note')}
                  </p>
                  <button className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%' }} onClick={onClose}>
                    {t('common.close')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const olStyle: React.CSSProperties = {
  textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.9rem',
  paddingLeft: '1.25rem', lineHeight: 1.6, margin: 0,
};

function ReferenceBox({ label, value, copied, onCopy, tCopy, tCopied }: {
  label: string; value?: string; copied: boolean; onCopy: () => void; tCopy: string; tCopied: string;
}) {
  return (
    <div style={{ background: 'var(--bg-subtle, rgba(148,163,184,0.12))', borderRadius: 12, padding: '0.85rem 1rem', margin: '0.5rem 0', textAlign: 'left' }}>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.25rem' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <code style={{ fontSize: '0.98rem', fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{value}</code>
        <button className="btn btn-ghost btn-sm" onClick={onCopy} style={{ flexShrink: 0 }}>
          <Copy size={14} /> {copied ? tCopied : tCopy}
        </button>
      </div>
    </div>
  );
}

function TransferRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Waiting({ text }: { text: string }) {
  return (
    <p style={{ display: 'flex', justifyContent: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '1rem' }}>
      <Loader2 size={14} style={spinStyle} /> {text}
    </p>
  );
}
