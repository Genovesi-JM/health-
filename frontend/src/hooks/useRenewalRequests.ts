import { useCallback, useEffect, useRef, useState } from 'react';
import api, { getSession } from '../api';
import { apiErrorMessage, apiErrorStatus } from '../utils/apiError';
import { isReadingConsentDenial } from '../utils/readingConsent';
import { mergeRenewalRows, parseRenewalPage, type RenewalRequest } from '../utils/prescriptionRenewals';

export function useRenewalRequests(kind: 'patient' | 'doctor', filter = 'pending') {
  const [session] = useState(getSession);
  const [loadedView, setLoadedView] = useState('');
  const view = `${kind}:${filter}`;
  const [items, setItems] = useState<RenewalRequest[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [restartRequired, setRestartRequired] = useState(false);
  const [accessLost, setAccessLost] = useState(false);
  const [accessEpoch, setAccessEpoch] = useState(0);
  const mounted = useRef(false); const sequence = useRef(0); const authority = useRef(0); const denied = useRef(false); const reading = useRef(false);
  const advanceRead = useCallback(() => ++sequence.current, []);
  const current = useCallback(() => mounted.current && !!session?.userId && !!session.token && getSession()?.userId === session.userId && getSession()?.token === session.token, [session]);
  const config = useCallback(() => ({ headers: { Authorization: `Bearer ${session?.token ?? ''}` } }), [session]);
  const capture = useCallback(() => { const epoch = authority.current; return () => current() && epoch === authority.current && !denied.current; }, [current]);
  const invalidateAccess = useCallback((failure: unknown) => {
    if (![401, 403].includes(apiErrorStatus(failure) ?? 0) || isReadingConsentDenial(failure)) return false;
    denied.current = true; ++authority.current; ++sequence.current; reading.current = false;
    setAccessLost(true); setAccessEpoch(authority.current); setItems([]); setNextCursor(null); setLoaded(false); setLoading(false); return true;
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; advanceRead(); }; }, [advanceRead]);
  const load = useCallback(async (cursor?: string) => {
    if (!current() || (cursor && (reading.current || denied.current))) return;
    const request = ++sequence.current; reading.current = true; setLoading(true); setError('');
    try {
      const response = await api.get(`/api/v1/${kind === 'doctor' ? 'doctor/' : ''}prescription-requests/page`, {
        ...config(), params: { limit: 20, ...(kind === 'doctor' ? { status: filter } : {}), ...(cursor ? { cursor } : {}) },
      });
      if (!current() || request !== sequence.current) return;
      const page = parseRenewalPage(response.data);
      denied.current = false; setAccessLost(false); setLoaded(true); setLoadedView(`${kind}:${filter}`); setRestartRequired(false);
      setItems(previous => cursor ? mergeRenewalRows(previous, page.items) : page.items); setNextCursor(page.next_cursor);
    } catch (failure) {
      if (!current() || request !== sequence.current) return;
      invalidateAccess(failure);
      if (apiErrorStatus(failure) === 422 && cursor) setRestartRequired(true);
      setError(apiErrorMessage(failure, cursor ? 'Não foi possível carregar mais pedidos. Atualize a lista se a continuação expirou.' : 'Não foi possível carregar os pedidos. Tente atualizar.'));
    } finally { if (current() && request === sequence.current) { reading.current = false; setLoading(false); } }
  }, [config, current, filter, invalidateAccess, kind]);
  useEffect(() => { void Promise.resolve().then(() => load()); return () => { advanceRead(); }; }, [advanceRead, load]);
  const apply = (request: RenewalRequest) => {
    if (!current() || denied.current) return;
    advanceRead(); reading.current = false; setLoading(false);
    setLoaded(true); setLoadedView(view);
    setItems(previous => {
      const updated = previous.some(item => item.id === request.id) ? previous.map(item => item.id === request.id ? request : item) : [request, ...previous];
      return kind === 'doctor' && filter === 'pending' ? updated.filter(item => item.status === 'pending') : updated;
    });
  };
  return { owner: session?.userId ?? '', current, capture, config, invalidateAccess, accessLost, accessEpoch, items: loadedView === view ? items : [], nextCursor: loadedView === view ? nextCursor : null, loading, loaded: loadedView === view && loaded, error, restartRequired, load, apply };
}
