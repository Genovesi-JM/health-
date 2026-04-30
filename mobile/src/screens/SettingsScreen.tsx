import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (!oldPw || !newPw) { Alert.alert('Error', 'All fields are required.'); return; }
    if (newPw !== confirmPw) { Alert.alert('Error', 'New passwords do not match.'); return; }
    if (newPw.length < 6) { Alert.alert('Error', 'New password must be at least 6 characters.'); return; }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { old_password: oldPw, new_password: newPw });
      Alert.alert('Success', 'Password changed successfully.');
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail ?? 'Failed to change password.');
    }
    setSaving(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Settings</Text>

        {/* Account info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{user?.full_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Role</Text>
            <Text style={styles.infoValue}>{user?.role}</Text>
          </View>
        </View>

        {/* Change password */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Change Password</Text>
          <TextInput style={styles.input} placeholder="Current password" placeholderTextColor="#94a3b8"
            secureTextEntry value={oldPw} onChangeText={setOldPw} />
          <TextInput style={styles.input} placeholder="New password (min. 6 chars)" placeholderTextColor="#94a3b8"
            secureTextEntry value={newPw} onChangeText={setNewPw} />
          <TextInput style={styles.input} placeholder="Confirm new password" placeholderTextColor="#94a3b8"
            secureTextEntry value={confirmPw} onChangeText={setConfirmPw} />
          <TouchableOpacity style={styles.btn} onPress={handleChangePassword} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Update Password</Text>}
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const TEAL = '#0d9488';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdfb' },
  inner: { padding: 20, paddingTop: 52 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 24 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  infoLabel: { fontSize: 14, color: '#64748b' },
  infoValue: { fontSize: 14, color: '#0f172a', fontWeight: '500', flex: 1, textAlign: 'right' },
  input: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#0f172a', backgroundColor: '#f8fafc', marginBottom: 10,
  },
  btn: { backgroundColor: TEAL, borderRadius: 10, padding: 13, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  logoutBtn: { backgroundColor: '#fee2e2', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 4 },
  logoutText: { color: '#b91c1c', fontSize: 15, fontWeight: '600' },
});
