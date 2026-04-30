import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import api from '../services/api';

interface Profile {
  date_of_birth?: string;
  gender?: string;
  blood_type?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export default function PatientProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [chronic, setChronic] = useState('');
  const [emergName, setEmergName] = useState('');
  const [emergPhone, setEmergPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/api/v1/patients/me')
      .then(r => {
        const p: Profile = r.data;
        setProfile(p);
        setDob(p.date_of_birth ?? '');
        setGender(p.gender ?? '');
        setBloodType(p.blood_type ?? '');
        setAllergies((p.allergies ?? []).join(', '));
        setChronic((p.chronic_conditions ?? []).join(', '));
        setEmergName(p.emergency_contact_name ?? '');
        setEmergPhone(p.emergency_contact_phone ?? '');
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    const body = {
      date_of_birth: dob || null,
      gender: gender || null,
      blood_type: bloodType || null,
      allergies: allergies ? allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
      chronic_conditions: chronic ? chronic.split(',').map(s => s.trim()).filter(Boolean) : [],
      emergency_contact_name: emergName || null,
      emergency_contact_phone: emergPhone || null,
    };
    try {
      if (profile) {
        await api.patch('/api/v1/patients/me', body);
      } else {
        await api.post('/api/v1/patients/profile', body);
        setProfile(body as Profile);
      }
      setMsg('Profile saved successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail ?? 'Failed to save profile.');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>My Profile</Text>

        <Field label="Date of Birth (YYYY-MM-DD)" value={dob} onChangeText={setDob} placeholder="1990-01-15" />
        <Field label="Gender" value={gender} onChangeText={setGender} placeholder="male / female / other" />
        <Field label="Blood Type" value={bloodType} onChangeText={setBloodType} placeholder="A+, B-, O+…" />
        <Field label="Allergies (comma-separated)" value={allergies} onChangeText={setAllergies} placeholder="penicillin, latex" />
        <Field label="Chronic Conditions (comma-separated)" value={chronic} onChangeText={setChronic} placeholder="diabetes, hypertension" />
        <Field label="Emergency Contact Name" value={emergName} onChangeText={setEmergName} placeholder="Jane Doe" />
        <Field label="Emergency Contact Phone" value={emergPhone} onChangeText={setEmergPhone} placeholder="+351 912 345 678" keyboardType="phone-pad" />

        {msg ? <Text style={styles.successMsg}>{msg}</Text> : null}

        <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Profile</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}

const TEAL = '#0d9488';

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdfb' },
  container: { flex: 1, backgroundColor: '#f0fdfb' },
  inner: { padding: 20, paddingTop: 48 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#0f172a', backgroundColor: '#fff',
  },
  successMsg: { color: '#10b981', fontSize: 14, marginBottom: 12, textAlign: 'center' },
  btn: { backgroundColor: TEAL, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
