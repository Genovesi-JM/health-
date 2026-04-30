import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import api from '../services/api';

interface Doctor {
  id: number;
  full_name: string;
  specialty?: string;
  sector_focus?: string;
}

export default function BookConsultationScreen() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/api/v1/doctors/')
      .then(r => setDoctors(r.data ?? []))
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false));
  }, []);

  const handleBook = async () => {
    if (!selectedDoctor) { Alert.alert('Error', 'Please select a doctor.'); return; }
    if (!date) { Alert.alert('Error', 'Please enter a date and time.'); return; }
    setSaving(true);
    try {
      await api.post('/api/v1/consultations', {
        doctor_id: selectedDoctor,
        scheduled_at: date,
        reason: reason || null,
      });
      Alert.alert('Success', 'Consultation booked successfully.');
      setSelectedDoctor(null); setDate(''); setReason('');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail ?? 'Failed to book consultation.');
    }
    setSaving(false);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0d9488" /></View>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>Select a doctor and choose a date/time for your consultation.</Text>

        <Text style={styles.label}>Available Doctors</Text>
        {doctors.length === 0
          ? <Text style={styles.empty}>No doctors available.</Text>
          : doctors.map(d => (
            <TouchableOpacity
              key={d.id}
              style={[styles.doctorCard, selectedDoctor === d.id && styles.doctorCardSelected]}
              onPress={() => setSelectedDoctor(d.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.doctorName}>{d.full_name}</Text>
              {d.specialty || d.sector_focus
                ? <Text style={styles.doctorSpec}>{d.specialty ?? d.sector_focus}</Text>
                : null
              }
            </TouchableOpacity>
          ))
        }

        <Text style={styles.label}>Date & Time (ISO format)</Text>
        <TextInput
          style={styles.input}
          placeholder="2025-08-15T10:00:00"
          placeholderTextColor="#94a3b8"
          value={date}
          onChangeText={setDate}
        />

        <Text style={styles.label}>Reason (optional)</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          placeholder="Brief description of your concern"
          placeholderTextColor="#94a3b8"
          value={reason}
          onChangeText={setReason}
          multiline
        />

        <TouchableOpacity style={styles.btn} onPress={handleBook} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Book Consultation</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const TEAL = '#0d9488';

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdfb' },
  container: { flex: 1, backgroundColor: '#f0fdfb' },
  inner: { padding: 20 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 8, textTransform: 'uppercase' },
  doctorCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  doctorCardSelected: { borderColor: TEAL, backgroundColor: 'rgba(13,148,136,0.06)' },
  doctorName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  doctorSpec: { fontSize: 12, color: '#64748b', marginTop: 2 },
  input: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#0f172a', backgroundColor: '#fff', marginBottom: 16,
  },
  empty: { color: '#94a3b8', fontSize: 14, marginBottom: 16 },
  btn: { backgroundColor: TEAL, borderRadius: 10, padding: 15, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
