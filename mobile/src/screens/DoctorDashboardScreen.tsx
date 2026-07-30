import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import type { ClinicianStackParamList } from '../navigation/ClinicianStack';

type Navigation = NativeStackNavigationProp<ClinicianStackParamList, 'DoctorDashboard'>;

type Dashboard = {
  today: { total: number; confirmed: number; waiting: number; in_progress: number };
  week: { completed: number };
  pending_prescription_requests: number;
  unique_patients: number;
  doctor: { display_name?: string | null; specialization?: string | null };
};

type QueueItem = {
  id: string;
  patient_id?: string;
  patient_name?: string;
  chief_complaint?: string | null;
  risk_level?: string | null;
  specialty?: string;
  status: string;
};

type Escalation = {
  id: string;
  patient_id: string;
  patient_name: string;
  urgency: string;
  reason: string;
  clinical_summary: string;
  status: string;
  created_at: string;
};

const TEAL = '#0d9488';
const riskTone = (level?: string | null) => {
  const key = (level || '').toUpperCase();
  if (key === 'URGENT' || key === 'HIGH' || key === 'EMERGENCY') return { bg: '#fee2e2', color: '#b91c1c' };
  if (key === 'MEDIUM' || key === 'PRIORITY') return { bg: '#fef3c7', color: '#b45309' };
  return { bg: '#dcfce7', color: '#15803d' };
};

export default function DoctorDashboardScreen() {
  const navigation = useNavigation<Navigation>();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError('');
    const results = await Promise.allSettled([
      api.get('/api/v1/doctor/dashboard'),
      api.get('/api/v1/doctor/queue'),
      api.get('/api/v1/clinical-operations/escalations', { params: { status: 'pending' } }),
    ]);
    if (results[0].status === 'fulfilled') setDashboard(results[0].value.data);
    if (results[1].status === 'fulfilled') setQueue(results[1].value.data || []);
    if (results[2].status === 'fulfilled') setEscalations(results[2].value.data.items || []);
    if (results.every(result => result.status === 'rejected')) setError(t('clinician.load_error'));
    setLoading(false);
    setRefreshing(false);
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const acceptEscalation = async (item: Escalation) => {
    setAccepting(item.id);
    try {
      await api.post(`/api/v1/clinical-operations/escalations/${item.id}/accept`);
      navigation.navigate('Patient360', { patientId: item.patient_id });
      setEscalations(current => current.filter(row => row.id !== item.id));
    } catch (requestError: any) {
      Alert.alert(t('common.error'), requestError?.response?.data?.detail || t('clinician.accept_error'));
    } finally {
      setAccepting(null);
    }
  };

  const acceptQueueItem = async (item: QueueItem) => {
    if (!item.patient_id) return;
    setAccepting(item.id);
    try {
      if (item.status !== 'in_progress') await api.post(`/api/v1/doctor/queue/${item.id}/accept`);
      navigation.navigate('Patient360', { patientId: item.patient_id });
      void load();
    } catch (requestError: any) {
      Alert.alert(t('common.error'), requestError?.response?.data?.detail || t('clinician.accept_error'));
    } finally {
      setAccepting(null);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={TEAL} /></View>;

  const kpis = [
    { label: t('doctor.today'), value: dashboard?.today.total ?? 0, icon: 'calendar-outline', color: TEAL },
    { label: t('doctor.waiting'), value: queue.length, icon: 'hourglass-outline', color: '#d97706' },
    { label: t('doctor.active'), value: dashboard?.today.in_progress ?? 0, icon: 'videocam-outline', color: '#2563eb' },
    { label: t('doctor.prescriptions'), value: dashboard?.pending_prescription_requests ?? 0, icon: 'document-text-outline', color: '#7c3aed' },
    { label: t('doctor.week'), value: dashboard?.week.completed ?? 0, icon: 'checkmark-circle-outline', color: '#059669' },
    { label: t('doctor.patients'), value: dashboard?.unique_patients ?? 0, icon: 'people-outline', color: '#475569' },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={TEAL} />}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>KAYA CLINICAL</Text>
          <Text style={styles.title}>{t('doctor.dashboard')}</Text>
          <Text style={styles.subtitle}>
            {dashboard?.doctor.display_name || user?.full_name || user?.email}
          </Text>
        </View>
        <TouchableOpacity onPress={() => void logout()} style={styles.signOut} accessibilityRole="button">
          <Text style={styles.signOutText}>{t('common.sign_out')}</Text>
        </TouchableOpacity>
      </View>

      {!!error && <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}

      <View style={styles.kpiGrid}>
        {kpis.map(item => (
          <View key={item.label} style={styles.kpiCard}>
            <View style={[styles.iconBox, { backgroundColor: `${item.color}16` }]}>
              <Ionicons name={item.icon as any} size={17} color={item.color} />
            </View>
            <Text style={[styles.kpiValue, { color: item.color }]}>{item.value}</Text>
            <Text style={styles.kpiLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>{t('doctor.coordination')}</Text>
            <Text style={styles.sectionTitle}>{t('doctor.escalations')}</Text>
          </View>
          <Text style={styles.count}>{escalations.length}</Text>
        </View>
        {!escalations.length ? (
          <View style={styles.emptyRow}>
            <Ionicons name="checkmark-circle-outline" size={19} color="#059669" />
            <Text style={styles.empty}>{t('doctor.no_escalations')}</Text>
          </View>
        ) : escalations.map(item => {
          const tone = riskTone(item.urgency);
          return (
            <View key={item.id} style={styles.clinicalRow}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.patient}>{item.patient_name}</Text>
                  <Text style={styles.reason}>{item.reason}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                  <Text style={[styles.badgeText, { color: tone.color }]}>{item.urgency.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.summary} numberOfLines={3}>{item.clinical_summary}</Text>
              <TouchableOpacity
                style={styles.primaryButton}
                disabled={accepting === item.id}
                onPress={() => void acceptEscalation(item)}
                accessibilityRole="button"
              >
                {accepting === item.id
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="arrow-forward" size={15} color="#fff" />}
                <Text style={styles.primaryButtonText}>{t('doctor.accept_open')}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>{t('doctor.operations')}</Text>
            <Text style={styles.sectionTitle}>{t('doctor.queue')}</Text>
          </View>
          <Text style={styles.count}>{queue.length}</Text>
        </View>
        {!queue.length ? (
          <Text style={styles.empty}>{t('doctor.no_queue')}</Text>
        ) : queue.slice(0, 10).map(item => {
          const tone = riskTone(item.risk_level);
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.queueRow}
              onPress={() => void acceptQueueItem(item)}
              disabled={!item.patient_id || accepting === item.id}
              accessibilityRole="button"
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(item.patient_name || 'P').split(' ').map(part => part[0]).slice(0, 2).join('')}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.patient}>{item.patient_name || t('clinician.patient')}</Text>
                <Text style={styles.reason} numberOfLines={1}>{item.chief_complaint || item.specialty || '—'}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                <Text style={[styles.badgeText, { color: tone.color }]}>{item.risk_level || '—'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 36 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  eyebrow: { color: TEAL, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#0f172a', fontSize: 25, fontWeight: '900', marginTop: 3 },
  subtitle: { color: '#64748b', fontSize: 12, marginTop: 4 },
  signOut: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  signOutText: { color: '#475569', fontSize: 11, fontWeight: '700' },
  errorCard: { marginBottom: 12, padding: 12, borderRadius: 10, backgroundColor: '#fef2f2' },
  errorText: { color: '#b91c1c', fontSize: 12 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginBottom: 14 },
  kpiCard: { width: '48.7%', minHeight: 104, backgroundColor: '#fff', borderRadius: 13, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  iconBox: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 24, fontWeight: '900', marginTop: 8 },
  kpiLabel: { color: '#64748b', fontSize: 10.5, lineHeight: 14, fontWeight: '700', marginTop: 3 },
  section: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  sectionEyebrow: { color: TEAL, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  sectionTitle: { color: '#0f172a', fontSize: 15, fontWeight: '900', marginTop: 2 },
  count: { minWidth: 28, textAlign: 'center', color: '#0f766e', backgroundColor: '#ccfbf1', borderRadius: 99, paddingVertical: 4, fontSize: 11, fontWeight: '900' },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 18 },
  empty: { color: '#64748b', padding: 18, fontSize: 12 },
  clinicalRow: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  patient: { color: '#0f172a', fontSize: 13, fontWeight: '900' },
  reason: { color: '#475569', fontSize: 11, lineHeight: 15, marginTop: 2 },
  summary: { color: '#64748b', fontSize: 11, lineHeight: 16, marginTop: 8 },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 8.5, fontWeight: '900' },
  primaryButton: { minHeight: 42, marginTop: 11, paddingHorizontal: 13, borderRadius: 10, backgroundColor: TEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryButtonText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  avatar: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#ccfbf1' },
  avatarText: { color: '#0f766e', fontSize: 11, fontWeight: '900' },
});

