import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { NOTIFICATIONS_CHANGED, validUnreadCount } from '../utils/notifications';

/** A badge is a server count for the current account, never a loaded-page count. */
export function useUnreadNotifications(pollMs = 60_000): number {
  const { user } = useAuth();
  const ownerId = user?.id || '';
  const [snapshot, setSnapshot] = useState({ ownerId: '', count: 0 });
  useEffect(() => {
    setSnapshot({ ownerId, count: 0 });
    if (!ownerId) return;
    let active = true;
    let sequence = 0;
    const fetchCount = async () => {
      const request = ++sequence;
      try {
        const { data } = await api.get<{ unread: number }>('/api/v1/notifications/unread-count');
        if (active && request === sequence && validUnreadCount(data.unread)) setSnapshot({ ownerId, count: data.unread });
      } catch { /* Retain this account's last confirmed count; the inbox exposes load errors. */ }
    };
    const onFocus = () => { void fetchCount(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void fetchCount(); };
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ ownerId?: string; unread?: unknown }>).detail;
      if (detail?.ownerId !== ownerId) return;
      if (validUnreadCount(detail.unread)) {
        sequence += 1;
        setSnapshot({ ownerId, count: detail.unread });
      } else void fetchCount();
    };
    void fetchCount();
    const interval = window.setInterval(() => { if (document.visibilityState !== 'hidden') void fetchCount(); }, pollMs);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(NOTIFICATIONS_CHANGED, onChanged);
    return () => {
      active = false; sequence += 1; window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(NOTIFICATIONS_CHANGED, onChanged);
    };
  }, [ownerId, pollMs]);
  return snapshot.ownerId === ownerId ? snapshot.count : 0;
}
