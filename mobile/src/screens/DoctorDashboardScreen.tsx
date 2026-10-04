import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import api, { sessions } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import type { ClinicianStackParamList } from '../navigation/ClinicianStack';
import { openDisplayedQueueItem } from './doctorQueue';
import { useConsultationPage } from './useConsultationPage';
import { consultationExpiryMessage, requestAllowsNewScheduleAction, type ConsultationExpiry } from './consultationExpiry';
import { appointmentDate } from './appointmentAvailability';
import { CONSULTATION_STATUS } from './consultations';
import { createClinicalFeedGuard } from './consultationPages';

type Navigation = NativeStackNavigationProp<ClinicianStackParamList, 'DoctorDashboard'>;

type Dashboard = {
  today: { total: number; confirmed: number; waiting: number; in_progress: number };
  week: { completed: number };
  pending_prescription_requests: number;
  unique_patients: number;
  doctor: { display_name?: string | null; specialization?: string | null };
};

type QueueItem = ConsultationExpiry & {
  id: string;
  patient_id?: string;
  patient_name?: string;
  chief_complaint?: string | null;
  risk_level?: string | null;
  specialty?: string;
  status: string;
  reschedule_revision?: number;
  scheduled_at?: string | null;
  timezone?: string | null;
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
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const queueBusy = useRef(false);
  const active = useRef(false);
  const loadVersion = useRef(0);
  const [clinicalAccessLost, setClinicalAccessLost] = useState(false);
  const clearQueue = useRef<(() => void) | null>(null);
  const guardRef = useRef<ReturnType<typeof createClinicalFeedGuard> | null>(null);
  if (!guardRef.current) guardRef.current = createClinicalFeedGuard(() => {
    loadVersion.current++;
    setClinicalAccessLost(true); setDashboard(null); setEscalations([]);
    setError('O acesso clínico mudou. Atualize o acesso antes de continuar.');
    setLoading(false); setRefreshing(false);
    clearQueue.current?.();
  });
  const guard = guardRef.current;
  const queuePage = useConsultationPage<QueueItem>('doctor-queue', 'all', () => guard.deny());
  clearQueue.current = queuePage.clearAccess;
  const accessDenied = clinicalAccessLost || queuePage.accessLost;
  const queue = accessDenied ? [] : queuePage.items;

  const load = useCallback(async (refresh = false) => {
    const version = ++loadVersion.current;
    const sessionVersion = sessions.version();
    const accessVersion = guard.version();
    if (refresh) setRefreshing(true);
    setError('');
    const getClinicalFeed = (path: string, options?: Parameters<typeof api.get>[1]) => api.get(path, options).catch(failure => {
      if (active.current && version === loadVersion.current && sessions.current(sessionVersion) && guard.current(accessVersion) &&
          [401, 403].includes(failure?.response?.status)) guard.deny();
      throw failure;
    });
    const results = await Promise.allSettled([
      getClinicalFeed('/api/v1/doctor/dashboard'),
      getClinicalFeed('/api/v1/clinical-operations/escalations', { params: { status: 'pending' } }),
    ]);
    if (!active.current || version !== loadVersion.current || !sessions.current(sessionVersion) || !guard.current(accessVersion)) return;
    if (results.some(result => result.status === 'rejected' && [401, 403].includes(result.reason?.response?.status))) {
      guard.deny(); return;
    }
    if (results[0].status === 'fulfilled') setDashboard(results[0].value.data);
    if (results[1].status === 'fulfilled') setEscalations(results[1].value.data.items || []);
    if (results.some(result => result.status === 'rejected')) setError(t('clinician.load_error'));
    else if (guard.recover(accessVersion)) setClinicalAccessLost(false);
    setLoading(false);
    setRefreshing(false);
  }, [t, guard]);

  useFocusEffect(useCallback(() => {
    active.current = true; void load();
    return () => { active.current = false; loadVersion.current++; };
  }, [load]));

  const acceptEscalation = async (item: Escalation) => {
    if (queueBusy.current || guard.isDenied() || queuePage.accessLost) return;
    queueBusy.current = true;
    const version = sessions.version();
    const accessVersion = guard.version();
    setAccepting(item.id);
    try {
      await api.post(`/api/v1/clinical-operations/escalations/${item.id}/accept`);
      if (!active.current || !sessions.current(version) || !guard.current(accessVersion) || guard.isDenied()) return;
      navigation.navigate('Patient360', { patientId: item.patient_id });
      setEscalations(current => current.filter(row => row.id !== item.id));
    } catch (requestError: any) {
      if (!active.current || !sessions.current(version) || !guard.current(accessVersion)) return;
      if ([401, 403].includes(requestError?.response?.status)) guard.deny();
      Alert.alert(t('common.error'), requestError?.response?.data?.detail || t('clinician.accept_error'));
    } finally {
      queueBusy.current = false;
      setAccepting(null);
    }
  };

  const acceptQueueItem = async (item: QueueItem) => {
    if (!item.patient_id || queueBusy.current || guard.isDenied() || queuePage.accessLost || queuePage.loading || queuePage.error) return;
    const version = sessions.version();
    const accessVersion = guard.version();
    queueBusy.current = true;
    setAccepting(item.id);
    try {
      const patientId = await openDisplayedQueueItem(api, item, queuePage.refresh);
      if (!active.current || !sessions.current(version) || !guard.current(accessVersion) || guard.isDenied()) return;
      navigation.navigate('Patient360', { patientId });
      void load();
    } catch (requestError: any) {
      if (!active.current || !sessions.current(version) || !guard.current(accessVersion)) return;
      if ([401, 403].includes(requestError?.response?.status)) guard.deny();
      Alert.alert(t('common.error'), requestError?.response?.data?.detail || requestError?.message || t('clinician.accept_error'));
    } finally {
      queueBusy.current = false;
      setAccepting(null);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={TEAL} /></View>;
  const visibleDashboard = accessDenied ? null : dashboard;

  const kpis = [
    { label: t('doctor.today'), value: visibleDashboard?.today.total ?? '—', icon: 'calendar-outline', color: TEAL },
    { label: `${t('doctor.waiting')} · carregados`, value: queuePage.loaded ? queue.length : '—', icon: 'hourglass-outline', color: '#d97706' },
    { label: t('doctor.active'), value: visibleDashboard?.today.in_progress ?? '—', icon: 'videocam-outline', color: '#2563eb' },
    { label: t('doctor.prescriptions'), value: visibleDashboard?.pending_prescription_requests ?? '—', icon: 'document-text-outline', color: '#7c3aed' },
    { label: t('doctor.week'), value: visibleDashboard?.week.completed ?? '—', icon: 'checkmark-circle-outline', color: '#059669' },
    { label: t('doctor.patients'), value: visibleDashboard?.unique_patients ?? '—', icon: 'people-outline', color: '#475569' },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing || queuePage.loading} onRefresh={() => {
        if (!queueBusy.current) { void load(true); void queuePage.refresh(); }
      }} tintColor={TEAL} />}
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

      {(!!error || accessDenied) && <View style={styles.errorCard}><Text style={styles.errorText}>{error || 'O acesso clínico mudou. Atualize antes de continuar.'}</Text>
        <TouchableOpacity accessibilityRole="button" disabled={refreshing || queuePage.loading} onPress={() => { void load(true); void queuePage.refresh(); }}>
          <Text style={styles.signOutText}>Atualizar acesso clínico</Text>
        </TouchableOpacity>
      </View>}
      <TouchableOpacity accessibilityRole="button" disabled={accessDenied} style={styles.primaryButton} onPress={() => navigation.navigate('DoctorConsultations')}>
        <Text style={styles.primaryButtonText}>Consultar histórico das minhas consultas</Text>
      </TouchableOpacity>

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
        {accessDenied || !escalations.length ? (
          <View style={styles.emptyRow}>
            <Ionicons name="checkmark-circle-outline" size={19} color="#059669" />
            <Text style={styles.empty}>{error || accessDenied ? 'Não foi possível confirmar as escaladas. Atualize para tentar novamente.' : t('doctor.no_escalations')}</Text>
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
                disabled={accepting !== null || !!error || accessDenied}
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
        <Text style={styles.empty}>Registos carregados por ordem de entrada{queuePage.nextCursor ? ' · há mais registos' : ''}.</Text>
        {!!queuePage.error && <View style={styles.errorCard} accessibilityRole="alert">
          <Text style={styles.errorText}>{queuePage.error}</Text>
          <TouchableOpacity accessibilityRole="button" disabled={queuePage.loading || accepting !== null} onPress={() => void queuePage.refresh()}>
            <Text style={styles.signOutText}>{queuePage.restartRequired ? 'Recomeçar fila' : 'Atualizar fila'}</Text>
          </TouchableOpacity>
        </View>}
        {queuePage.loading && <ActivityIndicator color={TEAL} />}
        {!queue.length && !queuePage.loading && !queuePage.error && queuePage.loaded ? (
          <Text style={styles.empty}>{queuePage.nextCursor ? 'Carregue a página seguinte para consultar mais pedidos.' : t('doctor.no_queue')}</Text>
        ) : queue.map(item => {
          const tone = riskTone(item.risk_level);
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.queueRow}
              onPress={() => void acceptQueueItem(item)}
              disabled={!item.patient_id || accepting !== null || queuePage.loading || !!queuePage.error || !requestAllowsNewScheduleAction(item)}
              accessibilityRole="button"
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(item.patient_name || 'P').split(' ').map(part => part[0]).slice(0, 2).join('')}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.patient}>{item.patient_name || t('clinician.patient')}</Text>
                <Text style={styles.reason}>{CONSULTATION_STATUS[item.status] || 'Estado por confirmar'}</Text>
                <Text style={styles.reason} numberOfLines={1}>{item.chief_complaint || item.specialty || '—'}</Text>
                {item.scheduled_at && <Text style={styles.reason}>{appointmentDate(item.scheduled_at, item.timezone)}</Text>}
                {item.requested_expires_at && item.status === 'requested' && <Text style={styles.reason}>Prazo: {appointmentDate(item.requested_expires_at, item.timezone)}</Text>}
                {consultationExpiryMessage(item, { clinician: true }) && <Text style={styles.reason}>{consultationExpiryMessage(item, { clinician: true })}</Text>}
              </View>
              <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                <Text style={[styles.badgeText, { color: tone.color }]}>{item.risk_level || '—'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
            </TouchableOpacity>
          );
        })}
        {queuePage.loadingMore && <ActivityIndicator color={TEAL} />}
        {queuePage.nextCursor && !queuePage.restartRequired && <TouchableOpacity accessibilityRole="button" style={styles.primaryButton}
          disabled={queuePage.loading || queuePage.loadingMore || accepting !== null} onPress={() => void queuePage.loadMore()}>
          <Text style={styles.primaryButtonText}>Carregar mais pedidos</Text>
        </TouchableOpacity>}
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
