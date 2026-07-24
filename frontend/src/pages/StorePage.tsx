import { useEffect, useRef, useState } from 'react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import { ShoppingBag, X, Copy, Loader2, CheckCircle2, Package } from 'lucide-react';

interface Device { id: string; name: string; category: string; description: string; price: number; price_label: string; }
interface Order { id: string; description?: string | null; amount: number; status: string; created_at: string; }
interface Checkout { payment_id: string; status: string; amount: number; provider_reference?: string; qr_code?: string; }

function kz(centavos: number) { return `${(centavos / 100).toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz`; }

export default function StorePage() {
  const { t } = useT();
  const [devices, setDevices] = useState<Device[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<Device | null>(null);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'paid' | 'failed'>('idle');
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);

  const loadOrders = () => api.get('/api/v1/shop/orders/me').then(r => setOrders(r.data || [])).catch(() => {});

  useEffect(() => {
    Promise.allSettled([api.get('/api/v1/shop/devices'), api.get('/api/v1/shop/orders/me')])
      .then(([d, o]) => {
        if (d.status === 'fulfilled') setDevices(d.value.data || []);
        if (o.status === 'fulfilled') setOrders(o.value.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const buy = (device: Device) => {
    setBuying(device); setStatus('idle'); setCheckout(null);
    api.post(`/api/v1/shop/devices/${device.id}/checkout`, { payment_method: 'multicaixa_express' })
      .then(r => { setCheckout(r.data); setStatus(r.data.status === 'paid' ? 'paid' : 'pending'); if (r.data.status === 'paid') loadOrders(); })
      .catch(() => setStatus('failed'));
  };

  // Poll while pending.
  useEffect(() => {
    if (status !== 'pending' || !checkout) return;
    const tick = () => api.get(`/api/v1/shop/payments/${checkout.payment_id}/status`)
      .then(r => { if (r.data.status === 'paid') { setStatus('paid'); loadOrders(); } else if (r.data.status === 'failed') setStatus('failed'); })
      .catch(() => {});
    pollRef.current = window.setInterval(tick, 4000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [status, checkout]);

  const close = () => { setBuying(null); setCheckout(null); setStatus('idle'); };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <ShoppingBag size={20} style={{ color: 'var(--brand-primary)' }} /> {t('store.title')}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>{t('store.desc')}</p>

      {loading ? <div className="page-loading"><div className="spinner" /></div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '0.9rem', marginBottom: '2rem' }}>
            {devices.map(d => (
              <div key={d.id} className="card" style={{ padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(20,184,166,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-teal)' }}><Package size={22} /></div>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-teal)', fontWeight: 700, textTransform: 'uppercase' }}>{d.category}</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{d.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flex: 1, lineHeight: 1.4 }}>{d.description}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{d.price_label}</span>
                  <button className="btn btn-primary btn-sm" onClick={() => buy(d)}>{t('store.buy')}</button>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.9rem' }}>{t('store.orders')}</div>
            {orders.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('store.no_orders')}</div>
            ) : orders.map((o, i) => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem', borderBottom: i < orders.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{o.description?.replace('Dispositivo: ', '') || 'Dispositivo'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleDateString('pt-PT')}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{kz(o.amount)}</span>
                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.73rem', fontWeight: 700, background: o.status === 'paid' ? 'rgba(16,185,129,0.1)' : 'rgba(234,179,8,0.1)', color: o.status === 'paid' ? '#059669' : '#d97706' }}>
                    {o.status === 'paid' ? t('store.paid') : t('store.pending')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Purchase modal */}
      {buying && (
        <div onClick={e => { if (e.target === e.currentTarget) close(); }} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{buying.name}</h3>
              <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
              {status === 'idle' && <p><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /></p>}
              {status === 'failed' && <p style={{ color: '#ef4444' }}>{t('pay.error_start')}</p>}
              {status === 'paid' && (
                <>
                  <CheckCircle2 size={44} style={{ color: '#22c55e' }} />
                  <p style={{ fontWeight: 600, marginTop: '0.75rem' }}>{t('pay.paid_title')}</p>
                  <button className="btn btn-primary" onClick={close}>{t('common.close')}</button>
                </>
              )}
              {status === 'pending' && checkout && (
                <>
                  <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.25rem' }}>{t('pay.amount')}</p>
                  <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0 0 1rem' }}>{kz(checkout.amount)}</p>
                  <div style={{ background: 'var(--bg-subtle,rgba(148,163,184,0.12))', borderRadius: 12, padding: '0.85rem 1rem', textAlign: 'left', marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.25rem' }}>{t('pay.reference')}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <code style={{ fontWeight: 600 }}>{checkout.provider_reference}</code>
                      <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(checkout.provider_reference || ''); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                        <Copy size={14} /> {copied ? t('pay.copied') : t('pay.copy')}
                      </button>
                    </div>
                  </div>
                  <p style={{ display: 'flex', justifyContent: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> {t('pay.waiting')}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
