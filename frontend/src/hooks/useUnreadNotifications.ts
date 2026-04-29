import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../AuthContext';

/**
 * Polls /api/v1/notifications/unread-count every 60 s.
 * Returns the count so the sidebar badge stays in sync.
 */
export function useUnreadNotifications(pollMs = 60_000): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetch = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get<{ unread: number }>('/api/v1/notifications/unread-count');
      setCount(data.unread);
    } catch {
      // ignore — non-critical
    }
  }, [user]);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, pollMs);
    return () => clearInterval(id);
  }, [fetch, pollMs]);

  return count;
}
