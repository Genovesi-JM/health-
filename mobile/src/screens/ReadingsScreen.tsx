import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import api from '../services/api';

interface Reading {
  id: number;
  metric_type: string;
  value: number;
  unit: string;
  recorded_at: string;
  notes?: string;
}

const METRIC_TYPES = ['blood_pressure_systolic', 'blood_pressure_diastolic', 'heart_rate', 'glucose', 'weight', 'temperature', 'oxygen_saturation'];

export default function ReadingsScreen() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [metric, setMetric] = useState('heart_rate');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('bpm');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/api/v1/readings/me?limit=30');
      setReadings(res.data?.readings ?? res.data ?? []);
    } catch {
      setReadings([]);
    }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleAdd = async () => {
    if (!value || isNaN(Number(value))) { Alert.alert('Error', 'Please enter a valid numeric value.'); return; }
    setSaving(true);
    try {
      await api.post('/api/v1/readings', { metric_type: metric, value: Number(value), unit, notes: notes || null });
      setValue(''); setNotes(''); setShowAdd(false);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail ?? 'Failed to save reading.');
    }
    setSaving(false);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0d9488" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Device Readings</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(s => !s)}>
          <Text style={styles.addBtnText}>{showAdd ? '✕ Cancel' : '+ Add'}</Text>
        </TouchableOpacity>
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
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Reading</Text>}
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={readings}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0d9488" />}
        ListEmptyComponent={<Text style={styles.empty}>No readings yet. Tap + Add to record one.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.cardMetric}>{item.metric_type.replace(/_/g, ' ')}</Text>
              <Text style={styles.cardDate}>{new Date(item.recorded_at).toLocaleString()}</Text>
              {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
            </View>
            <Text style={styles.cardValue}>{item.value} <Text style={styles.cardUnit}>{item.unit}</Text></Text>
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
