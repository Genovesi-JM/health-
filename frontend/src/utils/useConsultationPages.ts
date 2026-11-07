import { useCallback, useEffect, useRef, useState } from 'react';
import api, { getSession } from '../api';

type Page<T> = { items: T[]; next_cursor: string | null };
export function useConsultationPages<T extends { id: string }>(path: string, view?: string, onAccessLost?: () => void) {
  const owner = getSession()?.userId;
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [moreError, setMoreError] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [accessLost, setAccessLost] = useState(false);
  const [accessEpoch, setAccessEpoch] = useState(0);
  const sequence = useRef(0);
  const busy = useRef(false);
  const active = useRef(true);
  const load = useCallback(async (cursor: string | null, reset: boolean) => {
    if (!reset && busy.current) return;
    const ticket = ++sequence.current;
    busy.current = true;
    if (reset) { setLoading(true); setError(''); setMoreError(''); setNextCursor(null); }
    else { setLoadingMore(true); setMoreError(''); }
    const current = () => active.current && sequence.current === ticket && getSession()?.userId === owner;
    try {
      const response = await api.get<Page<T>>(path, { params: { limit: 20, ...(view ? { view } : {}), ...(cursor ? { cursor } : {}) } });
      if (!current()) return;
      const page = response.data;
      if (!page || !Array.isArray(page.items) || page.items.length > 100 ||
          !page.items.every(item => item && typeof item.id === 'string') ||
          (page.next_cursor !== null && typeof page.next_cursor !== 'string')) throw new Error('Invalid page');
      setItems(previous => reset ? page.items : Array.from(new Map([...previous, ...page.items].map(item => [item.id, item])).values()));
      setNextCursor(page.next_cursor);
      setAccessLost(false);
    } catch (failure) {
      if (!current()) return;
      const status = (failure as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) { setAccessEpoch(value => value + 1); setAccessLost(true); setItems([]); setNextCursor(null); setError('O acesso mudou. Atualize a sessão para continuar.'); onAccessLost?.(); }
      else if (reset) setError('Não foi possível carregar as consultas. Tente atualizar a lista.');
      else setMoreError(status === 422 ? 'A referência da página expirou. Atualize a lista para continuar.' : 'Não foi possível carregar mais consultas. Tente novamente.');
    } finally {
      if (current()) { busy.current = false; setLoading(false); setLoadingMore(false); }
    }
  }, [path, view, owner, onAccessLost]);
  useEffect(() => {
    active.current = true; setItems([]); void load(null, true);
    return () => { active.current = false; sequence.current += 1; busy.current = false; };
  }, [load]);
  return { items, setItems, loading, loadingMore, error, moreError, nextCursor, accessLost, accessEpoch,
    refresh: () => load(null, true), loadMore: () => nextCursor ? load(nextCursor, false) : Promise.resolve() };
}
