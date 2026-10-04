export type KayaNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  channel: 'in_app';
  related_entity_type: string | null;
  related_entity_id: string | null;
};

export type NotificationPage = {
  items: KayaNotification[];
  next_cursor: string | null;
  unread_count: number;
};

export type NotificationCapabilities = {
  channels: { in_app: boolean; email: boolean; sms: boolean; push: boolean };
  read_is_care_acknowledgement: boolean;
};

type ReadApi = { get: (path: string) => Promise<{ data: any }> };

export function notificationInboxPath(unreadOnly: boolean, cursor?: string | null): string {
  return `/api/v1/notifications/inbox?limit=20&unread_only=${unreadOnly}` +
    (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
}

export async function loadNotificationPage(api: ReadApi, unreadOnly: boolean, cursor?: string | null): Promise<NotificationPage> {
  const response = await api.get(notificationInboxPath(unreadOnly, cursor));
  const page = response.data as NotificationPage;
  if (!page || !Array.isArray(page.items) || !Number.isSafeInteger(page.unread_count) || page.unread_count < 0 ||
      (page.next_cursor !== null && typeof page.next_cursor !== 'string') ||
      page.items.some(item => !item || typeof item.id !== 'string' || typeof item.title !== 'string' ||
        typeof item.message !== 'string' || typeof item.is_read !== 'boolean')) {
    throw new Error('Não foi possível verificar as notificações recebidas. Tente novamente.');
  }
  return page;
}

export async function loadUnreadNotificationCount(api: ReadApi): Promise<number> {
  const response = await api.get('/api/v1/notifications/unread-count');
  const unread = response.data?.unread;
  if (!Number.isSafeInteger(unread) || unread < 0) throw new Error('A contagem de notificações não está disponível.');
  return unread;
}

export function mergeNotificationPages(current: KayaNotification[], incoming: KayaNotification[]): KayaNotification[] {
  const merged = new Map(current.map(item => [item.id, item]));
  for (const item of incoming) merged.set(item.id, item);
  return Array.from(merged.values());
}

export async function markNotificationRead(
  api: { patch: (path: string) => Promise<{ data: KayaNotification }> }, id: string,
): Promise<KayaNotification> {
  const response = await api.patch(`/api/v1/notifications/${encodeURIComponent(id)}/read`);
  if (response.data?.id !== id || response.data.is_read !== true) {
    throw new Error('Não foi possível confirmar a leitura desta notificação. Atualize a lista.');
  }
  return response.data;
}

export function applyNotificationRead(items: KayaNotification[], updated: KayaNotification, unreadOnly: boolean): KayaNotification[] {
  return items.map(item => item.id === updated.id ? updated : item).filter(item => !unreadOnly || !item.is_read);
}

export function notificationEmptyMessage(unreadOnly: boolean, unreadCount: number | null, nextCursor: string | null, countStale = false): string {
  if (nextCursor) return 'Não há notificações nesta página. Carregue mais para continuar.';
  if (unreadCount !== 0 || countStale) {
    return 'Não há notificações nesta página. Atualize a lista para verificar a caixa de entrada.';
  }
  return unreadOnly ? 'Não tem notificações por ler.' : 'Ainda não tem notificações.';
}

export async function markAllNotificationsRead(api: { patch: (path: string) => Promise<{ data: any }> }): Promise<number> {
  const response = await api.patch('/api/v1/notifications/read-all');
  if (response.data?.ok !== true || !Number.isSafeInteger(response.data.updated_count) || response.data.updated_count < 0) {
    throw new Error('Não foi possível confirmar a leitura de todas as notificações. Atualize a lista.');
  }
  return response.data.updated_count;
}

/** Server data can only identify an allowlisted, patient-owned app route.
 * It never supplies a URL or an arbitrary navigation target. */
export function notificationConsultationTarget(notification: KayaNotification): { consultationId: string } | null {
  const id = notification.related_entity_id;
  return notification.related_entity_type === 'consultation' && typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? { consultationId: id } : null;
}

export function notificationChannelsMessage(capabilities: NotificationCapabilities | null): string {
  if (!capabilities?.channels) return 'Não foi possível verificar os canais de notificação. Pode continuar a consultar esta caixa de entrada.';
  if (!capabilities.channels.in_app) return 'A caixa de entrada não está disponível neste momento.';
  if (!capabilities.channels.email && !capabilities.channels.sms && !capabilities.channels.push) {
    return 'As notificações estão disponíveis nesta aplicação. Email, SMS e notificações push ainda não estão ativos.';
  }
  return 'Consulte as atualizações nesta caixa de entrada. A entrega por email, SMS ou push não é confirmada aqui.';
}

export function notificationDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : date.toLocaleString('pt-PT');
}

export function notificationError(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' && detail.trim() ? detail : fallback;
}

export function canRetainNotificationsAfterError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status !== 401 && status !== 403;
}
