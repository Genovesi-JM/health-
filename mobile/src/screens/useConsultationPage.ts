import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { AxiosRequestConfig } from 'axios';
import { useAuth } from '../contexts/AuthContext';
import api, { sessions } from '../services/api';
import { createConsultationPager, emptyConsultationPage, type ConsultationPageItem,
  type ConsultationPageKind, type ConsultationView } from './consultationPages';

export function useConsultationPage<T extends ConsultationPageItem>(kind: ConsultationPageKind, view: ConsultationView = 'all', onAccessLost?: () => void) {
  const { user } = useAuth();
  const scope = JSON.stringify([user?.id, user?.role, kind, view]);
  const [stored, setStored] = useState(() => emptyConsultationPage<T>());
  const onAccessLostRef = useRef(onAccessLost); onAccessLostRef.current = onAccessLost;
  const controllerRef = useRef<ReturnType<typeof createConsultationPager<T>> | null>(null);
  if (!controllerRef.current) controllerRef.current = createConsultationPager<T>(setStored, () => onAccessLostRef.current?.());
  const controller = controllerRef.current;
  const load = useCallback(async (append = false) => {
    if (!user?.id || controller.snapshot().scope !== scope) return;
    const version = sessions.version();
    const scopedApi = { get: (path: string) => api.get(path, { _sessionVersion: version } as AxiosRequestConfig) };
    await controller.load(scopedApi, kind, view, append);
  }, [controller, user?.id, kind, view, scope]);
  useFocusEffect(useCallback(() => {
    controller.activate(scope);
    void load();
    const subscription = AppState.addEventListener('change', state => {
      const current = controller.snapshot();
      if (state === 'active' && !current.loading && !current.loadingMore) void load();
    });
    return () => { controller.deactivate(); subscription.remove(); };
  }, [controller, scope, load]));
  const current = stored.scope === scope ? stored : emptyConsultationPage<T>(scope);
  return { ...current, refresh: useCallback(() => load(false), [load]), loadMore: useCallback(() => load(true), [load]),
    clearAccess: useCallback(() => controller.clearAccess(), [controller]),
    updateItem: useCallback((item: T) => { if (controller.snapshot().scope === scope) controller.update(item, view); }, [controller, view, scope]) };
}
