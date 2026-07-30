import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import {
  isHealthConnected,
  subscribeToHealthChanges,
  syncHealth,
} from './healthSync';

const FOREGROUND_INTERVAL_MS = 15 * 60 * 1000;

export default function HealthSyncManager() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || user.role !== 'patient') return;
    let active = true;
    let stopSubscription: (() => void) | undefined;
    let syncing = false;

    const run = async () => {
      if (!active || syncing || !(await isHealthConnected(user.id))) return;
      syncing = true;
      try {
        await syncHealth(user.id);
      } catch {
        // Network or revoked platform permission: retry on the next foreground.
      } finally {
        syncing = false;
      }
    };

    void run();
    void subscribeToHealthChanges(() => { void run(); })
      .then(stop => { stopSubscription = stop; })
      .catch(() => {});

    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') void run();
    });
    const timer = setInterval(() => { void run(); }, FOREGROUND_INTERVAL_MS);

    return () => {
      active = false;
      stopSubscription?.();
      appStateSubscription.remove();
      clearInterval(timer);
    };
  }, [user?.id, user?.role]);

  return null;
}
