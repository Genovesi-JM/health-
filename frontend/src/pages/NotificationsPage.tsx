import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { useT } from '../i18n/LanguageContext';
import { notificationDestination, notificationError, notificationTime, notifyInboxChanged, validUnreadCount, type InboxNotification, type NotificationCapabilities, type NotificationInbox } from '../utils/notifications';

type InboxState = NotificationInbox & { ownerId: string; unreadOnly: boolean; loaded: boolean };
const emptyInbox = (ownerId: string, unreadOnly: boolean): InboxState => ({ ownerId, unreadOnly, items: [], next_cursor: null, unread_count: 0, loaded: false });

export default function NotificationsPage() {
  const { user } = useAuth();
  const { lang } = useT();
  const ownerId = user?.id || '';
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [inbox, setInbox] = useState<InboxState>(() => emptyInbox(ownerId, unreadOnly));
  const [capabilities, setCapabilities] = useState<{ ownerId: string; data: NotificationCapabilities } | null>(null);
  const [capabilityError, setCapabilityError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [marking, setMarking] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const current = useRef({ ownerId, unreadOnly });
  current.current = { ownerId, unreadOnly };
  const generation = useRef(0);
  const mutationBusy = useRef(false);
  const shown = inbox.ownerId === ownerId && inbox.unreadOnly === unreadOnly ? inbox : emptyInbox(ownerId, unreadOnly);
  const channels = capabilities?.ownerId === ownerId ? capabilities.data.channels : null;
  const isCurrent = useCallback(() => current.current.ownerId === ownerId && current.current.unreadOnly === unreadOnly, [ownerId, unreadOnly]);

  const load = useCallback(async (cursor: string | null = null) => {
    if (!ownerId) return;
    const request = ++generation.current;
    setLoading(true); setError('');
    try {
      const { data } = await api.get<NotificationInbox>('/api/v1/notifications/inbox', { params: { limit: 20, unread_only: unreadOnly, ...(cursor ? { cursor } : {}) } });
      if (!isCurrent() || request !== generation.current) return;
      if (!validUnreadCount(data.unread_count) || !Array.isArray(data.items)) throw new Error('Invalid inbox');
      setInbox(previous => {
        const base = cursor && previous.ownerId === ownerId && previous.unreadOnly === unreadOnly ? previous.items : [];
        const merged = new Map(base.map(item => [item.id, item]));
        data.items.forEach(item => merged.set(item.id, item));
        return { ...data, items: [...merged.values()], ownerId, unreadOnly, loaded: true };
      });
      notifyInboxChanged(ownerId, data.unread_count);
    } catch (failure) {
      if (isCurrent() && request === generation.current) setError(notificationError(failure, 'Não foi possível carregar as notificações. As mensagens já recebidas continuam disponíveis.'));
    } finally { if (isCurrent() && request === generation.current) setLoading(false); }
  }, [ownerId, unreadOnly, isCurrent]);

  const loadCapabilities = useCallback(async () => {
    if (!ownerId) return;
    setCapabilityError('');
    try {
      const { data } = await api.get<NotificationCapabilities>('/api/v1/notifications/capabilities');
      if (current.current.ownerId === ownerId) setCapabilities({ ownerId, data });
    } catch {
      if (current.current.ownerId === ownerId) setCapabilityError('Não foi possível verificar os canais de notificação.');
    }
  }, [ownerId]);

  useEffect(() => {
    generation.current += 1; mutationBusy.current = false;
    setMarking(null); setMutationError(''); setNotice(''); setError('');
    void load();
    return () => { generation.current += 1; };
  }, [load]);
  useEffect(() => { setCapabilities(null); void loadCapabilities(); }, [loadCapabilities]);
  useEffect(() => {
    const refresh = () => { if (!mutationBusy.current) { void load(); void loadCapabilities(); } };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [load, loadCapabilities]);

  const mark = async (item: InboxNotification | null) => {
    if (!ownerId || mutationBusy.current) return;
    mutationBusy.current = true; generation.current += 1; setLoading(false);
    setMarking(item?.id || 'all'); setMutationError(''); setNotice('');
    try {
      if (item) {
        const { data } = await api.patch<InboxNotification>(`/api/v1/notifications/${encodeURIComponent(item.id)}/read`);
        if (!isCurrent()) return;
        setInbox(previous => previous.ownerId !== ownerId ? previous : { ...previous, items: previous.items.map(row => row.id === data.id ? data : row).filter(row => !unreadOnly || !row.is_read) });
        setNotice(data.is_read ? 'Notificação marcada como lida.' : 'O serviço manteve a notificação por ler.');
        try {
          const count = await api.get<{ unread: number }>('/api/v1/notifications/unread-count');
          if (!isCurrent()) return;
          if (!validUnreadCount(count.data.unread)) throw new Error('Invalid count');
          setInbox(previous => previous.ownerId === ownerId ? { ...previous, unread_count: count.data.unread } : previous);
          notifyInboxChanged(ownerId, count.data.unread);
        } catch {
          if (isCurrent()) { setError('A leitura foi guardada, mas não foi possível atualizar o total por ler. Atualize a lista.'); notifyInboxChanged(ownerId); }
        }
      } else {
        const { data } = await api.patch<{ ok: boolean; updated_count: number }>('/api/v1/notifications/read-all');
        if (!isCurrent()) return;
        if (data.ok !== true) throw new Error('Read-all not confirmed');
        setNotice(`${data.updated_count} notificações marcadas como lidas. A lista é atualizada para incluir novas mensagens.`);
        await load();
        if (isCurrent()) notifyInboxChanged(ownerId);
      }
    } catch (failure) {
      if (isCurrent()) setMutationError(notificationError(failure, 'Não foi possível guardar a leitura. O último estado confirmado foi mantido.'));
    } finally {
      if (isCurrent()) { mutationBusy.current = false; setMarking(null); }
    }
  };

  if (!ownerId) return <p>Inicie sessão para consultar as suas notificações.</p>;
  return <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
    <header style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' }}>
      <div><h1 style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '1.25rem' }}><Bell size={20} /> Notificações</h1><p>{shown.loaded ? `${shown.unread_count} por ler na sua conta` : loading ? 'A consultar o total por ler…' : 'Total por ler indisponível.'}</p></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}><button className="btn btn-secondary" disabled={loading || marking !== null} onClick={() => { void load(); void loadCapabilities(); }}><RefreshCw size={15} /> Atualizar</button><button className="btn btn-secondary" disabled={!shown.loaded || shown.unread_count === 0 || marking !== null || loading} onClick={() => void mark(null)}><CheckCheck size={15} /> Marcar todas como lidas</button></div>
    </header>
    {channels && <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}><p>Notificações na aplicação: {channels.in_app ? 'disponíveis' : 'indisponíveis'}.</p><p>{[['Email', channels.email], ['SMS', channels.sms], ['Push', channels.push]].map(([name, enabled]) => `${name}: ${enabled ? 'disponível' : 'indisponível'}`).join(' · ')}</p><p>Marcar como lida organiza esta caixa. Não confirma receção de cuidados nem conclui tarefas clínicas.</p></div>}
    {capabilityError && <p role="alert">{capabilityError}</p>}
    <nav aria-label="Filtrar notificações" style={{ display: 'flex', gap: 8, margin: '1rem 0' }}><button className="btn btn-secondary" aria-pressed={!unreadOnly} disabled={marking !== null} onClick={() => setUnreadOnly(false)}>Todas</button><button className="btn btn-secondary" aria-pressed={unreadOnly} disabled={marking !== null} onClick={() => setUnreadOnly(true)}>Por ler</button></nav>
    {error && <p role="alert">{error}</p>}{mutationError && <p role="alert">{mutationError}</p>}{notice && <p role="status">{notice}</p>}
    {loading && <p role="status">A carregar notificações…</p>}
    {!loading && !error && shown.loaded && shown.items.length === 0 && <p>{unreadOnly ? shown.unread_count === 0 ? 'Sem notificações por ler.' : 'Sem mensagens nesta página. Atualize ou carregue mais notificações.' : 'Ainda não existem notificações nesta página.'}</p>}
    <ul style={{ display: 'grid', gap: 12, listStyle: 'none', padding: 0 }}>{shown.items.map(item => {
      const destination = notificationDestination(item, user?.role);
      return <li key={item.id} className="card" style={{ padding: '1rem', borderLeft: `4px solid ${item.is_read ? 'var(--border)' : 'var(--brand-primary)'}` }}>
        <article aria-label={item.title}><h2 style={{ fontSize: '1rem', marginTop: 0 }}>{item.title}</h2><p style={{ whiteSpace: 'pre-wrap' }}>{item.message}</p><p><time dateTime={item.created_at}>{notificationTime(item.created_at, lang)}</time> · {item.is_read ? 'Lida' : 'Por ler'}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>{destination && <Link to={destination.to}>{destination.label}</Link>}{!item.is_read && <button className="btn btn-secondary" disabled={marking !== null || loading} onClick={() => void mark(item)} aria-label={`Marcar como lida: ${item.title}`}>{marking === item.id ? 'A guardar…' : 'Marcar como lida'}</button>}</div>
        </article>
      </li>;
    })}</ul>
    {shown.next_cursor && <button className="btn btn-secondary" disabled={loading || marking !== null} onClick={() => void load(shown.next_cursor)}>Carregar mais</button>}
  </div>;
}
