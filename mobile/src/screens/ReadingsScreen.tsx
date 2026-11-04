import React, { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, AppState } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/AppStack';
import type { AxiosRequestConfig } from 'axios';
import api, { sessions } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { connectHealth, disconnectHealth, getHealthConnection, getLastHealthSync, healthIsAvailable, healthPlatformName, syncHealth } from '../health/healthSync';
import { parseReadings, readingAccessLost, readingConsentRequired, readingCountryName, readingError, readingScope, READING_METRICS, saveManualReading } from './readings';
import type { HealthConnection, Reading } from './readings';
import type { ConsentCountry } from './consents';

export default function ReadingsScreen() {
  const { user } = useAuth();
  return <ReadingsWorkspace key={`${user?.id}:${user?.role}`} owner={user?.id ?? ''} />;
}

function ReadingsWorkspace({ owner }: { owner: string }) {
  const { t } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [country, setCountry] = useState<ConsentCountry>('AO');
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [consentCountry, setConsentCountry] = useState<ConsentCountry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [metric, setMetric] = useState('heart_rate');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('bpm');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [connection, setConnection] = useState<HealthConnection | null>(null);
  const [healthSyncing, setHealthSyncing] = useState(false);
  const [lastHealthSync, setLastHealthSync] = useState<string | null>(null);
  const focused = useRef(false);
  const requests = useRef(0);
  const healthRequests = useRef(0);
  const busy = useRef(false);
  const lifecycle = useRef(0);
  const sessionVersion = useRef(sessions.version());
  const current = useCallback(() => focused.current && !!owner && sessions.current(sessionVersion.current), [owner]);
  const boundApi = useCallback((version: number) => {
    const config: AxiosRequestConfig & { _sessionVersion: number } = { _sessionVersion: version };
    return { get: (path: string) => api.get(path, config), post: (path: string, body: unknown) => api.post(path, body, config) };
  }, []);
  const clearAccess = useCallback(() => {
    ++requests.current; ++healthRequests.current; ++lifecycle.current;
    setReadings([]); setLoaded(false); setConnection(null); setLastHealthSync(null); setLoading(false);
  }, []);
  const load = useCallback(async () => {
    if (!current()) return;
    const sequence = ++requests.current; const version = sessionVersion.current;
    setLoading(true); setError('');
    try {
      const response = await boundApi(version).get('/api/v1/readings/me?limit=30');
      if (!current() || sequence !== requests.current) return;
      setReadings(parseReadings(response.data)); setLoaded(true);
    } catch (failure) {
      if (!current() || sequence !== requests.current) return;
      if (readingAccessLost(failure)) clearAccess();
      setError(readingError(failure, 'Não foi possível atualizar as medições. As anteriores podem estar desatualizadas.'));
    } finally { if (current() && sequence === requests.current) setLoading(false); }
  }, [boundApi, clearAccess, current]);
  const loadHealthState = useCallback(async () => {
    if (!current()) return;
    const sequence = ++healthRequests.current;
    try {
      const [available, saved, lastSync] = await Promise.all([healthIsAvailable(), getHealthConnection(owner), getLastHealthSync()]);
      if (!current() || sequence !== healthRequests.current) return;
      setHealthAvailable(available); setConnection(saved); setLastHealthSync(saved ? lastSync : null);
    } catch (failure) {
      if (current() && sequence === healthRequests.current) setActionError(readingError(failure, 'Não foi possível verificar a ligação de saúde.'));
    }
  }, [current, owner]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    if (!busy.current) { setSaving(false); setHealthSyncing(false); }
    void load(); void loadHealthState();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active' && !busy.current) { void load(); void loadHealthState(); } });
    return () => { focused.current = false; ++requests.current; ++healthRequests.current; ++lifecycle.current; subscription.remove(); };
  }, [load, loadHealthState]));
  const reportAction = (failure: unknown, selected: ConsentCountry, fallback: string) => {
    if (readingAccessLost(failure)) clearAccess();
    if (readingConsentRequired(failure)) setConsentCountry(selected);
    setActionError(readingError(failure, fallback));
  };
  const handleAdd = async () => {
    if (!current() || busy.current) return;
    busy.current = true; setSaving(true); setActionError(''); setConsentCountry(null);
    const epoch = lifecycle.current; const version = sessionVersion.current;
    const assertCurrent = () => { sessions.assertCurrent(version); if (!current() || epoch !== lifecycle.current) throw new Error('Reabra as medições para continuar.'); };
    try {
      await saveManualReading(boundApi(version), readingScope(country), { metric, value, unit, notes }, assertCurrent);
      assertCurrent(); setValue(''); setNotes(''); setShowAdd(false); await load();
    } catch (failure) {
      if (current() && epoch === lifecycle.current) reportAction(failure, country, 'Não foi possível confirmar a medição. Consulte o histórico antes de repetir para evitar um duplicado.');
    } finally { busy.current = false; if (current()) setSaving(false); }
  };
  const handleHealth = async (connect: boolean) => {
    if (!current() || busy.current) return;
    busy.current = true; setHealthSyncing(true); setActionError(''); setConsentCountry(null);
    const epoch = lifecycle.current; const selected = connect ? country : connection?.country;
    if (!selected) { busy.current = false; setHealthSyncing(false); return; }
    try {
      if (connect) {
        const connected = await connectHealth(owner, readingScope(selected));
        if (!current() || epoch !== lifecycle.current) return;
        if (!connected) { setActionError(t('readings.permission_denied')); return; }
        await loadHealthState();
        if (!current() || epoch !== lifecycle.current) return;
      }
      const result = await syncHealth(owner);
      if (!current() || epoch !== lifecycle.current) return;
      setLastHealthSync(result.lastSync); await load();
    } catch (failure) {
      if (current() && epoch === lifecycle.current) reportAction(failure, selected, 'Não foi possível sincronizar. Nenhum ponto de continuação novo foi guardado.');
    } finally { busy.current = false; if (current()) setHealthSyncing(false); }
  };
  const handleHealthDisconnect = () => {
    const version = sessionVersion.current; const epoch = lifecycle.current;
    Alert.alert(healthPlatformName(), 'Desligar a sincronização neste telefone? As medições guardadas continuam no seu histórico.', [
      { text: t('readings.cancel'), style: 'cancel' },
      { text: t('readings.disconnect'), style: 'destructive', onPress: () => {
        if (!current() || !sessions.current(version) || epoch !== lifecycle.current || busy.current) return;
        busy.current = true; setHealthSyncing(true);
        void disconnectHealth().then(() => { if (current() && epoch === lifecycle.current) { setConnection(null); setLastHealthSync(null); } })
          .catch(failure => { if (current() && epoch === lifecycle.current) setActionError(readingError(failure, 'Não foi possível desligar. Tente novamente.')); })
          .finally(() => { busy.current = false; if (current()) setHealthSyncing(false); });
      } },
    ]);
  };

  const header = <>
    <View style={styles.header}>
      <Text style={styles.title}>{t('readings.title')}</Text>
      <TouchableOpacity style={styles.addBtn} disabled={saving || healthSyncing} onPress={() => setShowAdd(previous => !previous)}><Text style={styles.addBtnText}>{showAdd ? `✕ ${t('readings.cancel')}` : `+ ${t('readings.add')}`}</Text></TouchableOpacity>
    </View>
    <View style={styles.healthCard}>
      <Text style={styles.healthTitle}>País para novas medições e novas ligações</Text>
      <View style={styles.tagsRow}>{(['AO', 'PT'] as const).map(selected => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: selected === country, disabled: saving || healthSyncing }} key={selected} disabled={saving || healthSyncing} style={[styles.tag, country === selected && styles.tagActive]} onPress={() => { setCountry(selected); setConsentCountry(null); }}><Text style={[styles.tagText, country === selected && styles.tagTextActive]}>{readingCountryName(selected)}</Text></TouchableOpacity>)}</View>
      <Text style={styles.healthDescription}>Documentos em Português. Escolher o país não concede autorização. As medições anteriores mantêm o país original.</Text>
      <TouchableOpacity onPress={() => navigation.navigate('ConsentGate', { country })}><Text style={styles.link}>Rever consentimentos de {readingCountryName(country)}</Text></TouchableOpacity>
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}
    {consentCountry && <TouchableOpacity style={styles.healthCard} onPress={() => navigation.navigate('ConsentGate', { country: consentCountry })}><Text style={styles.link}>Rever autorizações de {readingCountryName(consentCountry)}</Text></TouchableOpacity>}
    <View style={styles.healthCard}>
      <View style={styles.healthTitleRow}><Text style={styles.healthTitle}>{t('readings.health_title')} · {healthPlatformName()}</Text></View>
      <Text style={styles.healthDescription}>{t('readings.health_desc')} Requer os cinco consentimentos atuais e a autorização opcional de dispositivos antes de cada sincronização.</Text>
      {connection ? <>
        <Text style={styles.healthPlatform}>Ligação configurada para {readingCountryName(connection.country)} · Português</Text>
        <Text style={styles.healthDescription}>A ligação guardada não comprova consentimento atual. A seleção acima não altera o país desta ligação.</Text>
        {lastHealthSync && <Text style={styles.lastSync}>{t('readings.last_sync')}: {new Date(lastHealthSync).toLocaleString()}</Text>}
        <View style={styles.healthActions}>
          <TouchableOpacity style={styles.syncBtn} disabled={healthSyncing || saving} onPress={() => void handleHealth(false)}><Text style={styles.syncBtnText}>{healthSyncing ? 'A confirmar…' : t('readings.sync')}</Text></TouchableOpacity>
          <TouchableOpacity disabled={healthSyncing || saving} onPress={handleHealthDisconnect}><Text style={styles.disconnectText}>{t('readings.disconnect')}</Text></TouchableOpacity>
        </View>
      </> : healthAvailable ? <>
        <Text style={styles.healthDescription}>Ligações antigas sem país precisam de nova confirmação. Pode consultar o histórico sem ligar o dispositivo.</Text>
        <TouchableOpacity style={styles.syncBtn} disabled={healthSyncing || saving} onPress={() => void handleHealth(true)}><Text style={styles.syncBtnText}>{healthSyncing ? 'A confirmar…' : `${t('readings.connect')} · ${readingCountryName(country)}`}</Text></TouchableOpacity>
      </> : <Text style={styles.unavailableText}>{t('readings.unavailable')}</Text>}
    </View>
    {showAdd && <View style={styles.addForm}>
      <Text style={styles.formLabel}>Tipo de medição · {readingCountryName(country)}</Text>
      <View style={styles.tagsRow}>{READING_METRICS.map(item => <TouchableOpacity key={item} disabled={saving} style={[styles.tag, metric === item && styles.tagActive]} onPress={() => setMetric(item)}><Text style={[styles.tagText, metric === item && styles.tagTextActive]}>{item.replace(/_/g, ' ')}</Text></TouchableOpacity>)}</View>
      <TextInput editable={!saving} style={styles.input} accessibilityLabel="Valor" placeholder="Valor" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" value={value} onChangeText={setValue} />
      <TextInput editable={!saving} style={styles.input} accessibilityLabel="Unidade" placeholder="Unidade (bpm, kg…)" placeholderTextColor="#94a3b8" value={unit} onChangeText={setUnit} />
      <TextInput editable={!saving} style={styles.input} accessibilityLabel="Notas opcionais" placeholder="Notas opcionais" placeholderTextColor="#94a3b8" value={notes} onChangeText={setNotes} />
      <TouchableOpacity style={styles.saveBtn} disabled={saving || healthSyncing} onPress={() => void handleAdd}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('readings.save')}</Text>}</TouchableOpacity>
    </View>}
    {loading && <ActivityIndicator color="#0d9488" />}
    <Text style={styles.formLabel}>Medições guardadas · todos os países · até 30 mais recentes</Text>
  </>;
  return <View style={styles.container}><FlatList data={readings} keyExtractor={item => item.id} ListHeaderComponent={header}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); void loadHealthState(); }} tintColor="#0d9488" />}
    ListEmptyComponent={loaded && !error && !loading ? <Text style={styles.empty}>{t('readings.empty')}</Text> : null}
    renderItem={({ item }) => <View style={styles.card}>
      <View style={styles.cardLeft}><Text style={styles.cardMetric}>{item.reading_type.replace(/_/g, ' ')}</Text><Text style={styles.cardDate}>{new Date(item.measured_at).toLocaleString()}</Text>
        <Text style={styles.cardNotes}>{readingCountryName(item.country)}{item.consent_language ? ` · ${item.consent_language}` : ''}</Text>
        {(item.device_brand || item.source) && <Text style={styles.cardNotes}>{[item.device_brand, item.device_model, item.source?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}</Text>}
      </View><Text style={styles.cardValue}>{item.value ?? '—'} <Text style={styles.cardUnit}>{item.unit}</Text></Text>
    </View>} /></View>;
}

const TEAL = '#0d9488';

const styles = StyleSheet.create({
  error: { color: '#991b1b', marginHorizontal: 20, marginVertical: 8, lineHeight: 20 },
  link: { color: '#0f766e', fontWeight: '600', paddingVertical: 8 },
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
