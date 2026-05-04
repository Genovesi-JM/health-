import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, SafeAreaView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../navigation/AppStack';

interface DashboardData {
  pending_requests?: number;
  unread_notifications?: number;
}

const TEAL = '#0d9488';
const TEAL_LIGHT = '#f0fdfb';
const TEAL_SOFT = '#ccfbf1';
const TEAL_DARK = '#0a7a6e';
const SLATE = '#0f172a';
const MUTED = '#64748b';

// Patient quick actions
const ACTIONS = [
  { icon: '📅', label: 'Marcar consulta',   screen: 'BookConsultation'    as const },
  { icon: '💊', label: 'Pedir receita',      screen: 'PrescriptionRequest' as const },
  { icon: '❤️', label: 'As minhas medições', screen: 'Readings'            as const },
  { icon: '👨‍👩‍👧', label: 'Família',           screen: 'Family'              as const },
];

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    try {
      const [notifRes, rxRes] = await Promise.allSettled([
        api.get('/api/v1/notifications/me?limit=1'),
        api.get('/api/v1/prescription-requests?limit=1'),
      ]);
      const unread = notifRes.status === 'fulfilled'
        ? (notifRes.value.data?.unread_count ?? 0) : 0;
      const pending = rxRes.status === 'fulfilled'
        ? (rxRes.value.data?.length ?? 0) : 0;
      setData({ unread_notifications: unread, pending_requests: pending });
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchDashboard().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  };

  const firstName = user?.full_name?.split(' ')[0] ?? 'Olá';

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.inner}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá, {firstName} 👋</Text>
            <Text style={styles.subGreeting}>O que queres fazer hoje?</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn} activeOpacity={0.75}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>

        {/* ── Notification / pending badge ── */}
        {((data.unread_notifications ?? 0) > 0 || (data.pending_requests ?? 0) > 0) && (
          <View style={styles.alertRow}>
            {(data.unread_notifications ?? 0) > 0 && (
              <TouchableOpacity
                style={styles.alertBadge}
                onPress={() => navigation.navigate('Notifications' as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.alertBadgeText}>
                  🔔 {data.unread_notifications} notificação{(data.unread_notifications ?? 0) > 1 ? 'ões' : ''}
                </Text>
              </TouchableOpacity>
            )}
            {(data.pending_requests ?? 0) > 0 && (
              <View style={[styles.alertBadge, { backgroundColor: '#ede9fe' }]}>
                <Text style={[styles.alertBadgeText, { color: '#6d28d9' }]}>
                  💊 {data.pending_requests} receita{(data.pending_requests ?? 0) > 1 ? 's' : ''} pendente{(data.pending_requests ?? 0) > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Quick actions ── */}
        <Text style={styles.sectionTitle}>Acções rápidas</Text>
        <View style={styles.actionsGrid}>
          {ACTIONS.map(a => (
            <ActionCard
              key={a.label}
              icon={a.icon}
              label={a.label}
              onPress={() => navigation.navigate(a.screen as any)}
            />
          ))}
        </View>

        {/* ── Portal access ── */}
        <View style={styles.portalCard}>
          <Text style={styles.portalTitle}>Portal completo</Text>
          <Text style={styles.portalDesc}>
            Acede ao histórico clínico completo, documentos e consultas passadas.
          </Text>
          <TouchableOpacity
            style={styles.portalBtn}
            onPress={() => navigation.navigate('Profile' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.portalBtnText}>Ver o meu perfil →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionCard({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: TEAL_LIGHT },
  scroll: { flex: 1 },
  inner: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20,
  },
  greeting: { fontSize: 22, fontWeight: '700', color: SLATE },
  subGreeting: { fontSize: 13, color: MUTED, marginTop: 2 },
  logoutBtn: {
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 8, backgroundColor: '#fee2e2',
  },
  logoutText: { color: '#b91c1c', fontSize: 13, fontWeight: '600' },

  // Alert row
  alertRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  alertBadge: {
    backgroundColor: TEAL_SOFT, borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  alertBadgeText: { color: TEAL_DARK, fontSize: 13, fontWeight: '600' },

  // Sections
  sectionTitle: {
    fontSize: 15, fontWeight: '700', color: SLATE,
    marginBottom: 12,
  },

  // Actions grid — 2 columns
  actionsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24,
  },
  actionCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    alignItems: 'flex-start',
    gap: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  actionIcon: { fontSize: 30 },
  actionLabel: { fontSize: 13, fontWeight: '700', color: SLATE, lineHeight: 18 },

  // Portal card
  portalCard: {
    backgroundColor: TEAL,
    borderRadius: 16,
    padding: 20,
  },
  portalTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 6 },
  portalDesc: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 18, marginBottom: 16 },
  portalBtn: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  portalBtnText: { color: TEAL_DARK, fontWeight: '700', fontSize: 13 },
});


interface DashboardData {
  pending_requests?: number;
  unread_notifications?: number;
  last_reading?: { value: number; unit: string; recorded_at: string } | null;
}

type BackendStatus = 'checking' | 'online' | 'unavailable';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');

  const checkBackend = async () => {
    setBackendStatus('checking');
    try {
      await api.get('/api/v1/health');
      setBackendStatus('online');
    } catch {
      setBackendStatus('unavailable');
    }
  };

  const fetchDashboard = async () => {
    try {
      const [notifRes, rxRes] = await Promise.allSettled([
        api.get('/api/v1/notifications/me?limit=1'),
        api.get('/api/v1/prescription-requests/me?limit=1'),
      ]);
      const unread = notifRes.status === 'fulfilled'
        ? (notifRes.value.data?.unread_count ?? 0) : 0;
      const pending = rxRes.status === 'fulfilled'
        ? (rxRes.value.data?.total ?? 0) : 0;
      setData({ unread_notifications: unread, pending_requests: pending });
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    checkBackend();
    fetchDashboard().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([checkBackend(), fetchDashboard()]);
    setRefreshing(false);
  };

  const name = user?.full_name?.split(' ')[0] ?? 'there';

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.inner}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0d9488" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {name} 👋</Text>
          <Text style={styles.subGreeting}>Welcome to your health dashboard</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Backend status */}
      <View style={[styles.statusBadge, {
        backgroundColor: backendStatus === 'online' ? '#dcfce7'
          : backendStatus === 'unavailable' ? '#fee2e2' : '#fef9c3',
      }]}>
        <Text style={[styles.statusText, {
          color: backendStatus === 'online' ? '#15803d'
            : backendStatus === 'unavailable' ? '#b91c1c' : '#92400e',
        }]}>
          {backendStatus === 'online' ? '🟢 Backend online'
            : backendStatus === 'unavailable' ? '🔴 Backend unavailable'
            : '🟡 Checking backend…'}
        </Text>
      </View>

      {/* Quick stats */}
      <View style={styles.statsRow}>
        <StatCard label="Notifications" value={data.unread_notifications ?? 0} color="#0d9488" />
        <StatCard label="Pending Rx" value={data.pending_requests ?? 0} color="#6366f1" />
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <ActionCard
          icon="📅"
          label="Book Consultation"
          onPress={() => navigation.navigate('BookConsultation')}
        />
        <ActionCard
          icon="💊"
          label="Request Prescription"
          onPress={() => navigation.navigate('PrescriptionRequest')}
        />
        <ActionCard
          icon="👨‍👩‍👧"
          label="Family Members"
          onPress={() => navigation.navigate('Family')}
        />
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const TEAL = '#0d9488';

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdfb' },
  container: { flex: 1, backgroundColor: '#f0fdfb' },
  inner: { padding: 20, paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subGreeting: { fontSize: 13, color: '#64748b', marginTop: 2 },
  logoutBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#fee2e2' },
  logoutText: { color: '#b91c1c', fontSize: 13, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16,
    borderTopWidth: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  statValue: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#64748b' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 14 },
  statusBadge: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 20, alignSelf: 'flex-start' },
  statusText: { fontSize: 13, fontWeight: '600' },
  actionsGrid: { gap: 12 },
  actionCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  actionIcon: { fontSize: 28 },
  actionLabel: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
});
