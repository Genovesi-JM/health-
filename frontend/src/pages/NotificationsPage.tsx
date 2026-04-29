import { useState, useEffect, useCallback } from 'react';
import {
  Bell, CheckCircle2, AlertTriangle, Info, X,
  CheckCheck, Loader2, RefreshCw,
} from 'lucide-react';
import api from '../api';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  related_entity_type?: string;
  related_entity_id?: string;
  created_at: string;
}

const TYPE_CONFIG = {
  info:    { icon: <Info size={17} />,         color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.2)'  },
  success: { icon: <CheckCircle2 size={17} />,  color: '#059669', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)'  },
  warning: { icon: <AlertTriangle size={17} />, color: '#d97706', bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.25)'  },
  error:   { icon: <X size={17} />,            color: '#dc2626', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)'   },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora mesmo';
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} dia${d > 1 ? 's' : ''}`;
  return new Date(iso).toLocaleDateString('pt-PT');
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [marking, setMarking]   = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter]     = useState<'all' | 'unread'>('all');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get<Notification[]>('/api/v1/notifications/me');
      setNotifications(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Erro ao carregar notificações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markOne = async (id: string) => {
    setMarking(id);
    try {
      const { data } = await api.patch<Notification>(`/api/v1/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? data : n));
    } catch { /* silent */ }
    setMarking(null);
  };

  const markAll = async () => {
    setMarkingAll(true);
    try {
      await api.patch('/api/v1/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch { /* silent */ }
    setMarkingAll(false);
  };

  const shown = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={20} style={{ color: 'var(--brand-primary)' }} />
            Alertas &amp; Notificações
            {unreadCount > 0 && (
              <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#ef4444', color: '#fff', borderRadius: 999, padding: '0.15rem 0.55rem', marginLeft: '0.25rem' }}>
                {unreadCount}
              </span>
            )}
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.82rem' }}>
            As suas notificações de saúde e actualizações de pedidos
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={load}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.4rem 0.7rem', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
          >
            <RefreshCw size={13} /> Actualizar
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAll}
              disabled={markingAll}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', borderRadius: '8px', background: 'var(--brand-light)', color: 'var(--brand-primary)', border: '1px solid rgba(0,0,0,0.06)', fontWeight: 700, fontSize: '0.8rem', cursor: markingAll ? 'not-allowed' : 'pointer', opacity: markingAll ? 0.7 : 1 }}
            >
              {markingAll ? <Loader2 size={13} /> : <CheckCheck size={13} />}
              Marcar todas como lidas
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['all', 'unread'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ padding: '0.4rem 0.9rem', borderRadius: '8px', border: `1.5px solid ${filter === f ? 'var(--brand-primary)' : 'var(--border)'}`, background: filter === f ? 'var(--brand-light)' : 'var(--bg-card)', color: filter === f ? 'var(--brand-primary)' : 'var(--text-secondary)', fontWeight: filter === f ? 700 : 500, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            {f === 'all' ? `Todas (${notifications.length})` : `Não lidas (${unreadCount})`}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
          <Loader2 size={28} style={{ display: 'block', margin: '0 auto 0.5rem' }} />
          A carregar…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', color: '#dc2626', fontSize: '0.85rem' }}>{error}</div>
      )}

      {/* Empty state */}
      {!loading && !error && shown.length === 0 && (
        <div style={{ textAlign: 'center', padding: '5rem 0' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <Bell size={30} style={{ color: 'var(--brand-primary)', opacity: 0.5 }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.4rem' }}>
            {filter === 'unread' ? 'Está tudo em dia!' : 'Sem notificações'}
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            {filter === 'unread' ? 'Não tem notificações por ler.' : 'As suas notificações aparecerão aqui.'}
          </div>
        </div>
      )}

      {/* List */}
      {!loading && !error && shown.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {shown.map(n => {
            const tc = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
            const isBusy = marking === n.id;
            return (
              <div
                key={n.id}
                style={{
                  display: 'flex',
                  gap: '0.85rem',
                  padding: '1rem 1.1rem',
                  borderRadius: '12px',
                  background: 'var(--bg-card)',
                  border: n.is_read ? '1px solid var(--border)' : `1.5px solid ${tc.border}`,
                  opacity: n.is_read ? 0.72 : 1,
                  transition: 'opacity 0.2s',
                  position: 'relative',
                }}
              >
                {/* Unread dot */}
                {!n.is_read && (
                  <div style={{ position: 'absolute', top: '0.85rem', right: '0.85rem', width: 8, height: 8, borderRadius: '50%', background: tc.color }} />
                )}

                {/* Type icon */}
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: tc.bg, color: tc.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1.5px solid ${tc.border}` }}>
                  {tc.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: n.is_read ? 600 : 800, fontSize: '0.88rem', marginBottom: '0.2rem' }}>{n.title}</div>
                  <div style={{ fontSize: '0.81rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{n.message}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>{timeAgo(n.created_at)}</div>
                </div>

                {!n.is_read && (
                  <button
                    onClick={() => markOne(n.id)}
                    disabled={isBusy}
                    title="Marcar como lida"
                    style={{ background: 'none', border: 'none', cursor: isBusy ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', padding: '0.25rem', borderRadius: '6px', flexShrink: 0, alignSelf: 'flex-start', marginTop: '0.1rem' }}
                  >
                    {isBusy ? <Loader2 size={15} /> : <CheckCheck size={15} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
