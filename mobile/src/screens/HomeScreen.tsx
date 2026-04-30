import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../navigation/AppStack';

interface DashboardData {
  pending_requests?: number;
  unread_notifications?: number;
  last_reading?: { value: number; unit: string; recorded_at: string } | null;
}

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
    fetchDashboard().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
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
  actionsGrid: { gap: 12 },
  actionCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  actionIcon: { fontSize: 28 },
  actionLabel: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
});
