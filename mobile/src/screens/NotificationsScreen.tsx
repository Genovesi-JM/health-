import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import api from '../services/api';

interface Notification {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  notification_type?: string;
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/api/v1/notifications/me');
      setItems(res.data?.notifications ?? res.data ?? []);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const markRead = async (id: number) => {
    try {
      await api.patch(`/api/v1/notifications/${id}/read`);
      setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch {}
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0d9488" /></View>;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.inner}
      data={items}
      keyExtractor={item => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0d9488" />}
      ListHeaderComponent={<Text style={styles.title}>Notifications</Text>}
      ListEmptyComponent={<Text style={styles.empty}>No notifications yet.</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.card, !item.is_read && styles.cardUnread]}
          onPress={() => markRead(item.id)}
          activeOpacity={0.8}
        >
          <View style={styles.row}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {!item.is_read && <View style={styles.dot} />}
          </View>
          <Text style={styles.cardMsg}>{item.message}</Text>
          <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleString()}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const TEAL = '#0d9488';

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdfb' },
  container: { flex: 1, backgroundColor: '#f0fdfb' },
  inner: { padding: 20, paddingTop: 52 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  cardUnread: { borderColor: TEAL, backgroundColor: 'rgba(13,148,136,0.04)' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: TEAL, marginLeft: 8 },
  cardMsg: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 4 },
  cardDate: { fontSize: 11, color: '#94a3b8' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 60, fontSize: 14 },
});
