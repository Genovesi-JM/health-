import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, AppState,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/AppStack';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import {
  applyNotificationRead, canRetainNotificationsAfterError, loadNotificationPage, loadUnreadNotificationCount,
  markAllNotificationsRead, markNotificationRead, mergeNotificationPages, notificationChannelsMessage, notificationConsultationTarget,
  notificationDate, notificationError,
  type KayaNotification, type NotificationCapabilities,
} from './notifications';

type InboxView = { items: KayaNotification[]; cursor: string | null; loaded: boolean };
const emptyView = (): InboxView => ({ items: [], cursor: null, loaded: false });

export default function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [views, setViews] = useState({ all: emptyView(), unread: emptyView() });
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [countStale, setCountStale] = useState(false);
  const [capabilities, setCapabilities] = useState<NotificationCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const active = useRef(false);
  const busy = useRef(false);
  const requestVersion = useRef(0);
  const owner = useRef(user?.id);
  const key = unreadOnly ? 'unread' : 'all';
  const sameOwner = owner.current === user?.id;
  const view = sameOwner ? views[key] : emptyView();
  const visibleUnreadCount = sameOwner ? unreadCount : null;

  const load = useCallback(async (cursor?: string | null) => {
    const requestedOwner = user?.id;
    if (!requestedOwner) return;
    const version = ++requestVersion.current;
    const append = !!cursor;
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    const [page, channels] = await Promise.allSettled([
      loadNotificationPage(api, unreadOnly, cursor),
      append ? Promise.resolve(null) : api.get<NotificationCapabilities>('/api/v1/notifications/capabilities'),
    ]);
    if (!active.current || version !== requestVersion.current || owner.current !== requestedOwner) return;
    if (!append) setCapabilities(channels.status === 'fulfilled' ? channels.value?.data ?? null : null);
    if (page.status === 'fulfilled') {
      const result = page.value;
      setViews(current => ({ ...current, [unreadOnly ? 'unread' : 'all']: {
        items: append ? mergeNotificationPages(current[unreadOnly ? 'unread' : 'all'].items, result.items) : result.items,
        cursor: result.next_cursor, loaded: true,
      } }));
      setUnreadCount(result.unread_count);
      setCountStale(false);
    } else {
      if (!canRetainNotificationsAfterError(page.reason)) {
        setViews({ all: emptyView(), unread: emptyView() });
        setUnreadCount(null);
      }
      setCountStale(true);
      setError(notificationError(page.reason, append
        ? 'Não foi possível carregar mais notificações. As anteriores continuam disponíveis.'
        : 'Não foi possível atualizar as notificações. Os dados apresentados podem estar desatualizados.'));
    }
    setLoading(false);
    setLoadingMore(false);
  }, [unreadOnly, user?.id]);

  useFocusEffect(useCallback(() => {
    active.current = true;
    if (owner.current !== user?.id) {
      owner.current = user?.id;
      setViews({ all: emptyView(), unread: emptyView() });
      setUnreadCount(null);
      setActionError('');
      setNotice('');
    }
    if (!busy.current) void load();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && !busy.current) void load();
    });
    return () => {
      active.current = false;
      requestVersion.current++;
      subscription.remove();
    };
  }, [load, user?.id]));

  const refreshCount = async () => {
    const requestedOwner = owner.current;
    try {
      const count = await loadUnreadNotificationCount(api);
      if (active.current && owner.current === requestedOwner) { setUnreadCount(count); setCountStale(false); }
    } catch {
      if (active.current && owner.current === requestedOwner) {
        setCountStale(true);
        setActionError('A leitura foi registada, mas não foi possível atualizar a contagem. Atualize a caixa de entrada.');
      }
    }
  };

  const markRead = async (item: KayaNotification) => {
    if (!sameOwner || busy.current || loading || loadingMore || item.is_read) return;
    const requestedOwner = owner.current;
    busy.current = true;
    setSaving(item.id);
    setActionError('');
    setNotice('');
    requestVersion.current++;
    try {
      const updated = await markNotificationRead(api, item.id);
      if (!active.current || owner.current !== requestedOwner) return;
      setViews(current => ({
        all: { ...current.all, items: applyNotificationRead(current.all.items, updated, false) },
        unread: { ...current.unread, items: applyNotificationRead(current.unread.items, updated, true) },
      }));
      setCountStale(true);
      await refreshCount();
    } catch (failure) {
      if (active.current && owner.current === requestedOwner) {
        if (!canRetainNotificationsAfterError(failure)) {
          setViews({ all: emptyView(), unread: emptyView() }); setUnreadCount(null);
        }
        setActionError(notificationError(failure, 'Não foi possível confirmar a leitura. A notificação mantém o estado anterior; pode tentar novamente.'));
      }
    } finally {
      busy.current = false;
      setSaving(null);
    }
  };

  const markAll = async () => {
    if (!sameOwner || busy.current || loading || loadingMore) return;
    const requestedOwner = owner.current;
    busy.current = true;
    setSaving('all');
    setActionError('');
    setNotice('');
    requestVersion.current++;
    try {
      await markAllNotificationsRead(api);
      if (!active.current || owner.current !== requestedOwner) return;
      setViews(current => ({
        all: { ...current.all, items: current.all.items.map(item => ({ ...item, is_read: true })) },
        unread: { ...current.unread, items: [] },
      }));
      setNotice('A leitura das notificações foi registada.');
      setCountStale(true);
      // Read-all may race with a new notice. Fetch the server count rather than
      // assuming all future notices have also been read or forcing zero.
      await load();
      if (active.current && owner.current === requestedOwner) await refreshCount();
    } catch (failure) {
      if (active.current && owner.current === requestedOwner) {
        if (!canRetainNotificationsAfterError(failure)) {
          setViews({ all: emptyView(), unread: emptyView() }); setUnreadCount(null);
        }
        setActionError(notificationError(failure, 'Não foi possível confirmar a leitura de todas as notificações. Atualize a lista antes de tentar novamente.'));
      }
    } finally {
      busy.current = false;
      setSaving(null);
    }
  };

  const disabled = loading || loadingMore || saving !== null;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.inner}
      data={view.items}
      keyExtractor={item => item.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { if (!busy.current) void load(); }} tintColor={TEAL} />}
      ListHeaderComponent={<View style={styles.header}>
        <Text style={styles.title}>Notificações</Text>
        <Text style={styles.subtitle}>{visibleUnreadCount === null ? 'Contagem por verificar' : `${visibleUnreadCount} por ler`}{countStale && visibleUnreadCount !== null ? ' · por atualizar' : ''}</Text>
        <Text style={styles.hint}>{notificationChannelsMessage(capabilities)}</Text>
        <Text style={styles.hint}>Marcar como lida não confirma que recebeu cuidados ou cumpriu orientações. As datas usam o fuso horário do seu dispositivo.</Text>
        <View style={styles.filters}>
          {[{ value: false, label: 'Todas' }, { value: true, label: 'Por ler' }].map(filter => <TouchableOpacity key={filter.label}
            accessibilityRole="button" accessibilityState={{ selected: unreadOnly === filter.value }} disabled={saving !== null}
            style={[styles.filter, unreadOnly === filter.value && styles.filterSelected]}
            onPress={() => { setUnreadOnly(filter.value); setNotice(''); setActionError(''); }}>
            <Text style={styles.link}>{filter.label}</Text>
          </TouchableOpacity>)}
        </View>
        <TouchableOpacity accessibilityRole="button" disabled={disabled || visibleUnreadCount === null || visibleUnreadCount === 0}
          onPress={() => void markAll()} style={styles.readAll}>
          <Text style={[styles.link, (disabled || visibleUnreadCount === null || visibleUnreadCount === 0) && styles.disabled]}>{saving === 'all' ? 'A registar leitura…' : 'Marcar todas como lidas'}</Text>
        </TouchableOpacity>
        {!!error && <View accessibilityRole="alert"><Text style={styles.error}>{error}</Text>
          <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={() => void load()}><Text style={styles.link}>Atualizar notificações</Text></TouchableOpacity>
        </View>}
        {!!actionError && <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text>}
        {!!notice && <Text accessibilityRole="alert" style={styles.success}>{notice}</Text>}
        {loading && !view.loaded && <ActivityIndicator color={TEAL} />}
      </View>}
      ListEmptyComponent={!loading && !error && view.loaded
        ? <Text style={styles.empty}>{unreadOnly ? 'Não tem notificações por ler.' : 'Ainda não tem notificações.'}</Text>
        : null}
      ListFooterComponent={view.cursor ? <TouchableOpacity accessibilityRole="button" disabled={disabled}
        style={styles.more} onPress={() => void load(view.cursor)}>
        {loadingMore ? <ActivityIndicator color={TEAL} /> : <Text style={styles.link}>Carregar mais</Text>}
      </TouchableOpacity> : null}
      renderItem={({ item }) => {
        const target = notificationConsultationTarget(item);
        return <View style={[styles.card, !item.is_read && styles.cardUnread]}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={item.is_read ? styles.readState : styles.unreadState}>{item.is_read ? 'Lida' : 'Por ler'}</Text>
          </View>
          <Text style={styles.cardMsg}>{item.message}</Text>
          <Text style={styles.cardDate}>{notificationDate(item.created_at)}</Text>
          <View style={styles.actions}>
            {target && <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('ConsultationDetail', target)}>
              <Text style={styles.link}>Ver consulta</Text>
            </TouchableOpacity>}
            {!item.is_read && <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={() => void markRead(item)}>
              <Text style={[styles.link, disabled && styles.disabled]}>{saving === item.id ? 'A registar…' : 'Marcar como lida'}</Text>
            </TouchableOpacity>}
          </View>
        </View>;
      }}
    />
  );
}

const TEAL = '#0d9488';
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdfb' },
  inner: { padding: 20, paddingTop: 52, paddingBottom: 40 },
  header: { gap: 10, marginBottom: 18 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 16, fontWeight: '600', color: '#0f766e' },
  hint: { fontSize: 12, lineHeight: 18, color: '#64748b' },
  filters: { flexDirection: 'row', gap: 10 },
  filter: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, backgroundColor: '#fff', paddingHorizontal: 16 },
  filterSelected: { borderColor: TEAL, backgroundColor: '#ccfbf1' },
  readAll: { alignSelf: 'flex-start' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', gap: 7 },
  cardUnread: { borderColor: TEAL, backgroundColor: 'rgba(13,148,136,0.04)' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a', flex: 1 },
  cardMsg: { fontSize: 13, color: '#475569', lineHeight: 19 },
  cardDate: { fontSize: 11, color: '#64748b' },
  readState: { color: '#64748b', fontSize: 12 },
  unreadState: { color: '#0f766e', fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  link: { color: '#0f766e', fontWeight: '600', paddingVertical: 10 },
  more: { alignItems: 'center', paddingVertical: 12 },
  disabled: { opacity: 0.45 },
  error: { color: '#b91c1c', fontSize: 13, lineHeight: 19 },
  success: { color: '#0f766e', fontSize: 13, lineHeight: 19 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 35, fontSize: 14 },
});
