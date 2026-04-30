import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, FlatList,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import api from '../services/api';

interface RxRequest {
  id: number;
  medication_name: string;
  dosage?: string;
  status: string;
  created_at: string;
  doctor_notes?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#10b981',
  adjusted: '#6366f1',
  rejected: '#ef4444',
};

export default function PrescriptionRequestScreen() {
  const [requests, setRequests] = useState<RxRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/api/v1/prescription-requests/me');
      setRequests(res.data?.requests ?? res.data ?? []);
    } catch { setRequests([]); }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const handleSubmit = async () => {
    if (!medName.trim()) { Alert.alert('Error', 'Medication name is required.'); return; }
    setSaving(true);
    try {
      await api.post('/api/v1/prescription-requests', {
        medication_name: medName.trim(),
        dosage: dosage || null,
        patient_notes: notes || null,
      });
      Alert.alert('Submitted', 'Your prescription request has been submitted.');
      setMedName(''); setDosage(''); setNotes(''); setShowForm(false);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail ?? 'Failed to submit request.');
    }
    setSaving(false);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0d9488" /></View>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.inner}
        data={requests}
        keyExtractor={item => String(item.id)}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <Text style={styles.title2}>My Requests</Text>
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(s => !s)}>
                <Text style={styles.addBtnText}>{showForm ? '✕ Cancel' : '+ New'}</Text>
              </TouchableOpacity>
            </View>

            {showForm && (
              <View style={styles.form}>
                <TextInput style={styles.input} placeholder="Medication name *" placeholderTextColor="#94a3b8" value={medName} onChangeText={setMedName} />
                <TextInput style={styles.input} placeholder="Dosage (e.g. 500mg twice daily)" placeholderTextColor="#94a3b8" value={dosage} onChangeText={setDosage} />
                <TextInput style={[styles.input, { height: 72, textAlignVertical: 'top' }]} placeholder="Notes for doctor (optional)" placeholderTextColor="#94a3b8" value={notes} onChangeText={setNotes} multiline />
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Request</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No requests yet. Tap + New to create one.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardMed}>{item.medication_name}</Text>
              <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] ?? '#94a3b8' }]}>
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </View>
            {item.dosage ? <Text style={styles.cardDosage}>{item.dosage}</Text> : null}
            {item.doctor_notes ? <Text style={styles.cardDoctorNotes}>Doctor: {item.doctor_notes}</Text> : null}
            <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const TEAL = '#0d9488';

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdfb' },
  container: { flex: 1, backgroundColor: '#f0fdfb' },
  inner: { padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title2: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  addBtn: { backgroundColor: TEAL, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  form: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14, color: '#0f172a', backgroundColor: '#f8fafc', marginBottom: 10 },
  submitBtn: { backgroundColor: TEAL, borderRadius: 8, padding: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardMed: { fontSize: 15, fontWeight: '600', color: '#0f172a', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardDosage: { fontSize: 12, color: '#64748b', marginTop: 2 },
  cardDoctorNotes: { fontSize: 12, color: '#6366f1', marginTop: 4, fontStyle: 'italic' },
  cardDate: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
});
