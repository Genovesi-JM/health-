import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, AppState, RefreshControl, SafeAreaView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../navigation/AppStack';
import { useLanguage } from '../i18n/LanguageContext';
import { canRetainNotificationsAfterError, loadUnreadNotificationCount } from './notifications';
import { loadRenewalPresence, renewalAccessLost } from './prescriptionRequests';

interface DashboardData {
  has_requests?: boolean;
  unread_notifications?: number;
}

const TEAL = '#0d9488';
const TEAL_LIGHT = '#f0fdfb';
const TEAL_SOFT = '#ccfbf1';
const TEAL_DARK = '#0a7a6e';
const SLATE = '#0f172a';
const MUTED = '#64748b';

export default function HomeScreen() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [cachedData, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationError, setNotificationError] = useState(false);
  const [renewalError, setRenewalError] = useState(false);
  const active = useRef(false);
  const requestVersion = useRef(0);
  const owner = useRef(user?.id);
  // Hide the previous account's badge in the render before focus effects run.
  const sameOwner = owner.current === user?.id;
  const data = sameOwner ? cachedData : {};

  const fetchDashboard = useCallback(async () => {
    const requestedOwner = user?.id;
    if (!requestedOwner) return;
    const version = ++requestVersion.current;
    try {
      const [notifRes, rxRes] = await Promise.allSettled([
        loadUnreadNotificationCount(api),
        loadRenewalPresence(api),
      ]);
      if (!active.current || version !== requestVersion.current || owner.current !== requestedOwner) return;
      setNotificationError(notifRes.status === 'rejected');
      setRenewalError(rxRes.status === 'rejected');
      if (notifRes.status === 'rejected' && !canRetainNotificationsAfterError(notifRes.reason) || rxRes.status === 'rejected' && renewalAccessLost(rxRes.reason)) {
        setData({});
      } else {
        setData(current => ({
          unread_notifications: notifRes.status === 'fulfilled' ? notifRes.value : current.unread_notifications,
          has_requests: rxRes.status === 'fulfilled' ? rxRes.value : current.has_requests,
        }));
      }
    } catch { /* silent */ }
    finally {
      if (active.current && version === requestVersion.current && owner.current === requestedOwner) { setLoading(false); setRefreshing(false); }
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    active.current = true;
    if (owner.current !== user?.id) {
      owner.current = user?.id;
      setData({});
      setNotificationError(false);
      setRenewalError(false);
      setLoading(!!user?.id);
      setRefreshing(false);
    }
    void fetchDashboard();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void fetchDashboard();
    });
    return () => { active.current = false; requestVersion.current++; subscription.remove(); };
  }, [fetchDashboard, user?.id]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
  };

  const firstName = user?.full_name?.split(' ')[0] ?? 'Olá';
  const actions = [
    { icon: '✦', label: t('home.triage'), screen: 'Triage' as const },
    { icon: '📅', label: t('home.book'), screen: 'BookConsultation' as const },
    { icon: '📋', label: 'As minhas consultas', screen: 'Consultations' as const },
    { icon: '📄', label: 'Os meus documentos', screen: 'PatientDocuments' as const },
    { icon: '💊', label: t('home.prescription'), screen: 'PrescriptionRequest' as const },
    { icon: '❤️', label: t('home.measurements'), screen: 'Readings' as const },
    { icon: '👨‍👩‍👧', label: t('home.family'), screen: 'Family' as const },
  ];

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
            <Text style={styles.greeting}>{t('home.hello')}, {firstName} 👋</Text>
            <Text style={styles.subGreeting}>{t('home.question')}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn} activeOpacity={0.75}>
            <Text style={styles.logoutText}>{t('common.sign_out')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Notification / pending badge ── */}
        {((data.unread_notifications ?? 0) > 0 || data.has_requests) && (
          <View style={styles.alertRow}>
            {(data.unread_notifications ?? 0) > 0 && (
              <TouchableOpacity
                style={styles.alertBadge}
                onPress={() => navigation.navigate('Notifications' as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.alertBadgeText}>
                  🔔 {data.unread_notifications} por ler{notificationError ? ' · por atualizar' : ''}
                </Text>
              </TouchableOpacity>
            )}
            {data.has_requests && (
              <View style={[styles.alertBadge, { backgroundColor: '#ede9fe' }]}>
                <Text style={[styles.alertBadgeText, { color: '#6d28d9' }]}>
                  💊 Ver pedidos de renovação{renewalError ? ' · por atualizar' : ''}
                </Text>
              </View>
            )}
          </View>
        )}
        {sameOwner && notificationError && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Atualização de notificações indisponível. Abrir notificações."
          style={styles.notificationWarning} onPress={() => navigation.navigate('Notifications')}>
          <Text style={styles.notificationWarningText}>Não foi possível atualizar a contagem. Abrir notificações.</Text>
        </TouchableOpacity>}

        {/* ── Quick actions ── */}
        <Text style={styles.sectionTitle}>{t('home.quick')}</Text>
        <View style={styles.actionsGrid}>
          {actions.map(a => (
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
          <Text style={styles.portalTitle}>{t('home.portal')}</Text>
          <Text style={styles.portalDesc}>
            {t('home.portal_desc')}
          </Text>
          <TouchableOpacity
            style={styles.portalBtn}
            onPress={() => navigation.navigate('Profile' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.portalBtnText}>{t('home.profile_cta')}</Text>
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
  notificationWarning: { marginBottom: 18 },
  notificationWarningText: { color: '#b45309', fontSize: 13, lineHeight: 19 },

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
