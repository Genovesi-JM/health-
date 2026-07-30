import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import api from '../services/api';

type QueueItem = {
  id: string;
  patient: string;
  specialty?: string;
  risk_level?: string | null;
  chief_complaint?: string | null;
  created_at: string;
};

type Dashboard = {
  queue_count: number;
  urgent_count: number;
  triages_today: number;
  average_wait_minutes: number;
  longest_wait_minutes: number;
  waiting_over_30_count: number;
  unclassified_count: number;
  recent: QueueItem[];
};

const TEAL = '#0d9488';
const RISK: Record<string, { background: string; color: string }> = {
  URGENT: { background: '#ede9fe', color: '#6d28d9' },
  HIGH: { background: '#fee2e2', color: '#b91c1c' },
  MEDIUM: { background: '#fef3c7', color: '#b45309' },
  LOW: { background: '#dcfce7', color: '#15803d' },
};

export default function NurseDashboardScreen() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const response = await api.get('/api/v1/nurse/dashboard');
      setDashboard(response.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={TEAL} /></View>;
  }

  const kpis = [
    { label: t('nurse.kpi_queue'), value: dashboard?.queue_count ?? 0, color: TEAL },
    { label: t('nurse.kpi_urgent'), value: dashboard?.urgent_count ?? 0, color: '#dc2626' },
    { label: t('nurse.kpi_triages'), value: dashboard?.triages_today ?? 0, color: '#2563eb' },
    { label: t('nurse.kpi_wait'), value: `${dashboard?.average_wait_minutes ?? 0} min`, color: '#7c3aed' },
    { label: t('nurse.kpi_over_30'), value: dashboard?.waiting_over_30_count ?? 0, color: '#ea580c' },
    { label: t('nurse.kpi_unclassified'), value: dashboard?.unclassified_count ?? 0, color: '#64748b' },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={TEAL} />}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>KAYA CLINICAL</Text>
          <Text style={styles.title}>{t('nurse.dashboard')}</Text>
          <Text style={styles.subtitle}>{user?.full_name || user?.email}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.signOut}>
          <Text style={styles.signOutText}>{t('common.sign_out')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.kpiGrid}>
        {kpis.map(item => (
          <View key={item.label} style={styles.kpiCard}>
            <View style={[styles.kpiAccent, { backgroundColor: item.color }]} />
            <Text style={[styles.kpiValue, { color: item.color }]}>{item.value}</Text>
            <Text style={styles.kpiLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.queueCard}>
        <View style={styles.queueHeader}>
          <Text style={styles.queueTitle}>{t('nurse.recent')}</Text>
          <Text style={styles.queueMeta}>{dashboard?.queue_count ?? 0}</Text>
        </View>
        {!dashboard?.recent?.length ? (
          <Text style={styles.empty}>{t('nurse.empty')}</Text>
        ) : dashboard.recent.map(item => {
          const level = (item.risk_level || '').toUpperCase();
          const tone = RISK[level] || { background: '#f1f5f9', color: '#64748b' };
          return (
            <View key={item.id} style={styles.queueRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.patient}>{item.patient}</Text>
                <Text style={styles.complaint} numberOfLines={2}>
                  {item.chief_complaint || item.specialty || '—'}
                </Text>
              </View>
              <View style={[styles.riskBadge, { backgroundColor: tone.background }]}>
                <Text style={[styles.riskText, { color: tone.color }]}>{level || '—'}</Text>
              </View>
            </View>
          );
        })}
      </View>
      {!!dashboard?.longest_wait_minutes && (
        <Text style={styles.waitNote}>
          {t('nurse.longest_wait')}: {dashboard.longest_wait_minutes} min
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  eyebrow: { color: TEAL, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#0f172a', fontSize: 25, fontWeight: '900', marginTop: 3 },
  subtitle: { color: '#64748b', fontSize: 12, marginTop: 4 },
  signOut: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  signOutText: { color: '#475569', fontSize: 11, fontWeight: '700' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginBottom: 14 },
  kpiCard: { width: '48.7%', minHeight: 92, backgroundColor: '#fff', borderRadius: 13, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  kpiAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  kpiValue: { fontSize: 24, fontWeight: '900', marginTop: 2 },
  kpiLabel: { color: '#64748b', fontSize: 10.5, lineHeight: 14, fontWeight: '700', marginTop: 5 },
  queueCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  queueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  queueTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800' },
  queueMeta: { minWidth: 28, textAlign: 'center', color: '#0f766e', backgroundColor: '#ccfbf1', borderRadius: 99, paddingVertical: 4, fontSize: 11, fontWeight: '800' },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  patient: { color: '#0f172a', fontSize: 13, fontWeight: '800' },
  complaint: { color: '#64748b', fontSize: 11, lineHeight: 16, marginTop: 3 },
  riskBadge: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 },
  riskText: { fontSize: 9, fontWeight: '900' },
  empty: { color: '#64748b', padding: 28, textAlign: 'center', fontSize: 13 },
  waitNote: { color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 12 },
});
