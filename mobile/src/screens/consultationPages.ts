export type ConsultationPageKind = 'patient' | 'doctor-queue' | 'doctor-history';
export type ConsultationView = 'all' | 'upcoming' | 'past';
export type ConsultationPageItem = { id: string; status: string; reschedule_revision?: number };
export type ConsultationPage<T> = { items: T[]; next_cursor: string | null };
export type ConsultationPageState<T> = {
  scope: string; items: T[]; nextCursor: string | null; loading: boolean; loadingMore: boolean;
  loaded: boolean; error: string; restartRequired: boolean; accessLost: boolean;
};
type PageApi = { get(path: string): Promise<{ data: unknown }> };
const paths: Record<ConsultationPageKind, string> = {
  patient: '/api/v1/consultations/me/page', 'doctor-queue': '/api/v1/doctor/queue/page',
  'doctor-history': '/api/v1/doctor/consultations/page',
};

export const CONSULTATION_VIEWS: { value: ConsultationView; label: string }[] = [
  { value: 'all', label: 'Todas' }, { value: 'upcoming', label: 'Em acompanhamento' }, { value: 'past', label: 'Histórico' },
];

export function consultationPagePath(kind: ConsultationPageKind, view: ConsultationView, cursor: string | null): string {
  return paths[kind] + '?limit=20' + (kind === 'doctor-queue' ? '' : `&view=${view}`) +
    (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
}

export async function loadConsultationPage<T extends ConsultationPageItem>(
  api: PageApi, kind: ConsultationPageKind, view: ConsultationView, cursor: string | null = null,
): Promise<ConsultationPage<T>> {
  const { data } = await api.get(consultationPagePath(kind, view, cursor));
  const page = data as Partial<ConsultationPage<T>> | null;
  if (!page || !Array.isArray(page.items) ||
      (page.next_cursor !== null && (typeof page.next_cursor !== 'string' || !page.next_cursor || page.next_cursor === cursor)) ||
      page.items.some(item => !item || typeof item.id !== 'string' || !item.id || typeof item.status !== 'string')) {
    throw new Error('Não foi possível verificar a página de consultas.');
  }
  return { items: page.items, next_cursor: page.next_cursor };
}

export function mergeConsultationPages<T extends ConsultationPageItem>(previous: T[], incoming: T[]): T[] {
  const items = new Map(previous.map(item => [item.id, item]));
  for (const item of incoming) {
    const current = items.get(item.id);
    if (!current || (item.reschedule_revision ?? -1) >= (current.reschedule_revision ?? -1)) items.set(item.id, item);
  }
  return Array.from(items.values());
}

export function emptyConsultationPage<T>(scope = ''): ConsultationPageState<T> {
  return { scope, items: [], nextCursor: null, loading: false, loadingMore: false, loaded: false, error: '', restartRequired: false, accessLost: false };
}

/** Owns page results by account/filter and request generation. A late response cannot
 * replace a refreshed page, a new filter, or a different account's list. */
export function createConsultationPager<T extends ConsultationPageItem>(publish: (state: ConsultationPageState<T>) => void, onAccessLost?: () => void) {
  let state = emptyConsultationPage<T>();
  let generation = 0;
  let active = false;
  const set = (next: ConsultationPageState<T>) => { state = next; publish(state); };
  return {
    snapshot: () => state,
    activate(scope: string) {
      active = true;
      if (scope !== state.scope) { generation++; set(emptyConsultationPage<T>(scope)); }
    },
    deactivate() { active = false; generation++; },
    clearAccess() {
      generation++;
      set({ ...emptyConsultationPage<T>(state.scope), accessLost: true, error: 'O acesso clínico mudou. Atualize o acesso antes de continuar.' });
    },
    update(item: T, view: ConsultationView) {
      if (!active) return;
      generation++;
      const isActive = ['requested', 'scheduled', 'in_progress'].includes(item.status);
      const keep = view === 'all' || (view === 'upcoming' ? isActive : !isActive);
      set({ ...state, loading: false, loadingMore: false, items: keep ? state.items.map(existing => existing.id === item.id ? item : existing)
        : state.items.filter(existing => existing.id !== item.id) });
    },
    async load(api: PageApi, kind: ConsultationPageKind, view: ConsultationView, append = false) {
      if (!active || (append && (state.loading || state.loadingMore || state.restartRequired || !state.nextCursor))) return;
      const ticket = ++generation;
      const scope = state.scope;
      const cursor = append ? state.nextCursor : null;
      set({ ...state, loading: !append, loadingMore: append, error: '' });
      try {
        const page = await loadConsultationPage<T>(api, kind, view, cursor);
        if (!active || ticket !== generation || scope !== state.scope) return;
        set({ ...state, items: mergeConsultationPages(append ? state.items : [], page.items), nextCursor: page.next_cursor,
          loading: false, loadingMore: false, loaded: true, error: '', restartRequired: false, accessLost: false });
      } catch (failure) {
        if (!active || ticket !== generation || scope !== state.scope) return;
        const status = (failure as { response?: { status?: number } })?.response?.status;
        const accessLost = status === 401 || status === 403;
        const expired = status === 422 && append;
        set({ ...(accessLost ? emptyConsultationPage<T>(scope) : state), loading: false, loadingMore: false,
          restartRequired: expired || state.restartRequired, accessLost: accessLost || state.accessLost,
          error: accessLost ? 'O acesso às consultas mudou. Inicie sessão novamente para continuar.' : expired
            ? 'Esta página deixou de estar disponível. Recomece a lista; os registos já carregados foram mantidos.'
            : append ? 'Não foi possível carregar mais consultas. Os registos anteriores foram mantidos.'
              : 'Não foi possível atualizar as consultas. Os dados apresentados podem estar desatualizados.' });
        if (accessLost) onAccessLost?.();
      }
    },
  };
}

/** A denial from one authoritative clinical feed invalidates every parallel feed. */
export function createClinicalFeedGuard(onAccessLost: () => void) {
  let generation = 0; let denied = false;
  return {
    version: () => generation,
    current: (version: number) => version === generation,
    isDenied: () => denied,
    deny() { generation++; denied = true; onAccessLost(); },
    recover(version: number) { if (version !== generation) return false; denied = false; return true; },
  };
}
