import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  connectHealth,
  disconnectHealth,
  getLastHealthSync,
  healthIsAvailable,
  healthPlatformName,
  isHealthConnected,
  syncHealth,
} from '../health/healthSync';

interface Reading {
  id: string;
  reading_type: string;
  value: number | null;
  unit: string | null;
  measured_at: string;
  source?: string;
  device_brand?: string;
  device_model?: string;
  notes?: string;
}

const METRIC_TYPES = ['heart_rate', 'glucose', 'weight', 'temperature', 'oxygen_saturation'];

export default function ReadingsScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [metric, setMetric] = useState('heart_rate');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('bpm');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [healthConnected, setHealthConnected] = useState(false);
  const [healthSyncing, setHealthSyncing] = useState(false);
  const [lastHealthSync, setLastHealthSync] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.get('/api/v1/readings/me?limit=30');
      setReadings(res.data?.readings ?? res.data ?? []);
    } catch {
      setReadings([]);
    }
  };

  const loadHealthState = async () => {
    if (!user) return;
    const [available, connected, lastSync] = await Promise.all([
      healthIsAvailable().catch(() => false),
      isHealthConnected(user.id),
      getLastHealthSync(),
    ]);
    setHealthAvailable(available);
    setHealthConnected(connected);
    setLastHealthSync(lastSync);
  };

  useEffect(() => {
    Promise.all([load(), loadHealthState()]).finally(() => setLoading(false));
  }, [user?.id]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleAdd = async () => {
    if (!value || isNaN(Number(value))) { Alert.alert('Error', 'Please enter a valid numeric value.'); return; }
    setSaving(true);
    try {
      await api.post('/api/v1/readings', { reading_type: metric, value: Number(value), unit, notes: notes || null });
      setValue(''); setNotes(''); setShowAdd(false);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail ?? 'Failed to save reading.');
    }
    setSaving(false);
  };

  const handleHealthConnect = async () => {
    if (!user) return;
    setHealthSyncing(true);
    try {
      const connected = await connectHealth(user.id);
      if (!connected) {
        Alert.alert(healthPlatformName(), t('readings.permission_denied'));
        return;
      }
      setHealthConnected(true);
      const result = await syncHealth(user.id);
      setLastHealthSync(result.lastSync);
      await load();
    } catch (error: any) {
      Alert.alert(healthPlatformName(), error?.message ?? t('readings.permission_denied'));
    } finally {
      setHealthSyncing(false);
    }
  };

  const handleHealthSync = async () => {
    if (!user) return;
    setHealthSyncing(true);
    try {
      const result = await syncHealth(user.id);
      setLastHealthSync(result.lastSync);
      await load();
      Alert.alert(t('readings.sync_complete'), `${result.imported} + ${result.updated}`);
    } catch (error: any) {
      Alert.alert(healthPlatformName(), error?.message ?? t('readings.permission_denied'));
    } finally {
      setHealthSyncing(false);
    }
  };

  const handleHealthDisconnect = () => {
    Alert.alert(
      healthPlatformName(),
      t('readings.disconnect'),
      [
        { text: t('readings.cancel'), style: 'cancel' },
        {
          text: t('readings.disconnect'),
          style: 'destructive',
          onPress: () => {
            void disconnectHealth().then(() => {
              setHealthConnected(false);
              setLastHealthSync(null);
            });
          },
        },
      ],
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0d9488" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('readings.title')}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(s => !s)}>
          <Text style={styles.addBtnText}>{showAdd ? `✕ ${t('readings.cancel')}` : `+ ${t('readings.add')}`}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.healthCard}>
        <View style={styles.healthTitleRow}>
          <View style={styles.healthIcon}><Text style={styles.healthIconText}>♥</Text></View>
          <View style={styles.healthHeading}>
            <Text style={styles.healthTitle}>{t('readings.health_title')}</Text>
            <Text style={styles.healthPlatform}>{healthPlatformName()}</Text>
          </View>
          {healthConnected && <Text style={styles.connectedBadge}>{t('readings.connected')}</Text>}
        </View>
        <Text style={styles.healthDescription}>{t('readings.health_desc')}</Text>
        {!healthAvailable ? (
          <Text style={styles.unavailableText}>{t('readings.unavailable')}</Text>
        ) : healthConnected ? (
          <>
            {lastHealthSync && (
              <Text style={styles.lastSync}>
                {t('readings.last_sync')}: {new Date(lastHealthSync).toLocaleString()}
              </Text>
            )}
            <View style={styles.healthActions}>
              <TouchableOpacity style={styles.syncBtn} onPress={handleHealthSync} disabled={healthSyncing}>
                {healthSyncing
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.syncBtnText}>{t('readings.sync')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleHealthDisconnect}>
                <Text style={styles.disconnectText}>{t('readings.disconnect')}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity style={styles.syncBtn} onPress={handleHealthConnect} disabled={healthSyncing}>
            {healthSyncing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.syncBtnText}>{t('readings.connect')} {healthPlatformName()}</Text>}
          </TouchableOpacity>
        )}
      </View>

      {showAdd && (
        <View style={styles.addForm}>
          <Text style={styles.formLabel}>Metric type</Text>
          <View style={styles.tagsRow}>
            {METRIC_TYPES.map(m => (
              <TouchableOpacity key={m} style={[styles.tag, metric === m && styles.tagActive]} onPress={() => setMetric(m)}>
                <Text style={[styles.tagText, metric === m && styles.tagTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} placeholder="Value" placeholderTextColor="#94a3b8"
            keyboardType="decimal-pad" value={value} onChangeText={setValue} />
          <TextInput style={styles.input} placeholder="Unit (e.g. bpm, mmHg, kg)" placeholderTextColor="#94a3b8"
            value={unit} onChangeText={setUnit} />
          <TextInput style={styles.input} placeholder="Notes (optional)" placeholderTextColor="#94a3b8"
            value={notes} onChangeText={setNotes} />
          <TouchableOpacity style={styles.saveBtn} onPress={handleAdd} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('readings.save')}</Text>}
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={readings}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0d9488" />}
        ListEmptyComponent={<Text style={styles.empty}>{t('readings.empty')}</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.cardMetric}>{item.reading_type.replace(/_/g, ' ')}</Text>
              <Text style={styles.cardDate}>{new Date(item.measured_at).toLocaleString()}</Text>
              {(item.device_brand || item.source) && (
                <Text style={styles.cardNotes}>
                  {[item.device_brand, item.device_model, item.source?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
                </Text>
              )}
            </View>
            <Text style={styles.cardValue}>{item.value ?? '—'} <Text style={styles.cardUnit}>{item.unit}</Text></Text>
          </View>
        )}
      />
    </View>
  );
}

const TEAL = '#0d9488';

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdfb' },
  container: { flex: 1, backgroundColor: '#f0fdfb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 52 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  addBtn: { backgroundColor: TEAL, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  addForm: { margin: 16, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  healthCard: { marginHorizontal: 16, marginBottom: 4, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#99f6e4' },
  healthTitleRow: { flexDirection: 'row', alignItems: 'center' },
  healthIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#ccfbf1', alignItems: 'center', justifyContent: 'center' },
  healthIconText: { color: '#0f766e', fontSize: 20 },
  healthHeading: { flex: 1, marginLeft: 10 },
  healthTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  healthPlatform: { fontSize: 12, color: '#0f766e', marginTop: 1 },
  connectedBadge: { color: '#047857', backgroundColor: '#d1fae5', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11, fontWeight: '700' },
  healthDescription: { color: '#64748b', fontSize: 12, lineHeight: 18, marginVertical: 12 },
  unavailableText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  lastSync: { color: '#64748b', fontSize: 11, marginBottom: 10 },
  healthActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  syncBtn: { minHeight: 40, backgroundColor: '#0f766e', borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  syncBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  disconnectText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  formLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tag: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  tagActive: { backgroundColor: TEAL, borderColor: TEAL },
  tagText: { fontSize: 11, color: '#64748b' },
  tagTextActive: { color: '#fff' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14, color: '#0f172a', backgroundColor: '#f8fafc', marginBottom: 8 },
  saveBtn: { backgroundColor: TEAL, borderRadius: 8, padding: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 60, fontSize: 14 },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  cardLeft: { flex: 1 },
  cardMetric: { fontSize: 14, fontWeight: '600', color: '#0f172a', textTransform: 'capitalize' },
  cardDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  cardNotes: { fontSize: 12, color: '#64748b', marginTop: 2 },
  cardValue: { fontSize: 22, fontWeight: '700', color: TEAL },
  cardUnit: { fontSize: 13, fontWeight: '400', color: '#64748b' },
});
