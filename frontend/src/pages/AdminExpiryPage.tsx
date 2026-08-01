import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, Loader2, RefreshCw } from 'lucide-react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';

interface ExpiryRow {
  credential_id: string;
  legal_name: string;
  profession: string;
  licence_country: string;
  licence_number: string;
  issuing_authority: string;
  status: string;
  expiry_date: string;
  days_remaining: number;
}

interface ExpiryResponse {
  cutoff_days: number;
  total: number;
  items: ExpiryRow[];
}

function daysBadge(days: number, t: (k: string) => string) {
  if (days < 0) {
    return { label: t('exp.expired'), bg: 'rgba(239,68,68,0.12)', fg: '#b91c1c' };
  }
  if (days <= 14) {
    return { label: `${days} ${t('exp.days')}`, bg: 'rgba(234,179,8,0.15)', fg: '#a16207' };
  }
  return { label: `${days} ${t('exp.days')}`, bg: 'rgba(100,116,139,0.12)', fg: '#475569' };
}

export default function AdminExpiryPage() {
  const { t } = useT();
  const [days, setDays] = useState(90);
  const [items, setItems] = useState<ExpiryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get<ExpiryResponse>(`/api/v1/compliance/expiry/upcoming?days=${days}`);
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || 'Não foi possível carregar.');
    } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const runScan = async () => {
    setScanning(true); setError(null);
    try {
      const res = await api.post('/api/v1/compliance/expiry/scan');
      const fired = res.data?.reminders_fired ?? 0;
      const expired = res.data?.credentials_expired ?? 0;
      setToast(`${t('exp.scan_done')} — ${fired} lembrete(s), ${expired} expirado(s)`);
      await load();
      window.setTimeout(() => setToast(null), 3000);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || 'Falha na verificação.');
    } finally { setScanning(false); }
  };

  return (
    <div style={{ padding: '1.5rem 1.25rem 4rem' }}>
      <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.35rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
        <CalendarClock size={22} style={{ color: 'var(--brand-primary)' }} /> {t('exp.title')}
      </h1>
      <p style={{ margin: '0 0 1.25rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
        {t('exp.subtitle')}
      </p>

      <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
          {t('exp.window')}:
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            style={{ padding: '0.35rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-primary)', fontSize: '0.85rem' }}>
            <option value={30}>30 {t('exp.days')}</option>
            <option value={60}>60 {t('exp.days')}</option>
            <option value={90}>90 {t('exp.days')}</option>
            <option value={180}>180 {t('exp.days')}</option>
          </select>
        </label>
        <button className="btn btn-primary btn-sm" onClick={runScan} disabled={scanning}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {scanning ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
          {scanning ? t('exp.scanning') : t('exp.run_scan')}
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={16} className="spin" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />
            {t('exp.loading')}
          </div>
        ) : error ? (
          <div style={{ padding: '1.25rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} /> {error}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {t('exp.empty')}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: '0.5rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              <span>{t('exp.col_name')}</span>
              <span>{t('exp.col_authority')}</span>
              <span>{t('exp.col_expiry')}</span>
              <span>{t('exp.col_remaining')}</span>
            </div>
            {items.map(row => {
              const b = daysBadge(row.days_remaining, t);
              return (
                <div key={row.credential_id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 600 }}>{row.legal_name}
                    <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.78rem' }}>· {row.profession} · {row.licence_country}</span>
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{row.issuing_authority} — {row.licence_number}</span>
                  <span>{row.expiry_date}</span>
                  <span>
                    <span style={{ padding: '0.2rem 0.55rem', borderRadius: 999, background: b.bg, color: b.fg, fontSize: '0.73rem', fontWeight: 700 }}>{b.label}</span>
                  </span>
                </div>
              );
            })}
            <div style={{ padding: '0.6rem 1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{items.length} / {total}</div>
          </>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#059669', color: '#fff', padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.85rem', boxShadow: '0 6px 24px rgba(0,0,0,0.15)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
