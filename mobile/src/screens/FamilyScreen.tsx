import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import api from '../services/api';

interface FamilyMember {
  id: number;
  full_name: string;
  relationship: string;
  date_of_birth?: string;
  notes?: string;
}

export default function FamilyScreen() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [dob, setDob] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/api/v1/family/me');
      setMembers(res.data ?? []);
    } catch { setMembers([]); }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const handleAdd = async () => {
    if (!name.trim() || !relationship.trim()) {
      Alert.alert('Error', 'Name and relationship are required.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/v1/family', {
        full_name: name.trim(),
        relationship: relationship.trim(),
        date_of_birth: dob || null,
        notes: notes || null,
      });
      setName(''); setRelationship(''); setDob(''); setNotes('');
      setShowForm(false);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail ?? 'Failed to add family member.');
    }
    setSaving(false);
  };

  const handleDelete = (id: number) => {
    Alert.alert('Remove member', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/api/v1/family/${id}`);
            setMembers(prev => prev.filter(m => m.id !== id));
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail ?? 'Failed to remove member.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0d9488" /></View>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.inner}
        data={members}
        keyExtractor={item => String(item.id)}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Family Members</Text>
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(s => !s)}>
                <Text style={styles.addBtnText}>{showForm ? '✕ Cancel' : '+ Add'}</Text>
              </TouchableOpacity>
            </View>

            {showForm && (
              <View style={styles.form}>
                <TextInput style={styles.input} placeholder="Full name *" placeholderTextColor="#94a3b8" value={name} onChangeText={setName} />
                <TextInput style={styles.input} placeholder="Relationship (e.g. spouse, child) *" placeholderTextColor="#94a3b8" value={relationship} onChangeText={setRelationship} />
                <TextInput style={styles.input} placeholder="Date of birth (YYYY-MM-DD)" placeholderTextColor="#94a3b8" value={dob} onChangeText={setDob} />
                <TextInput style={styles.input} placeholder="Notes (optional)" placeholderTextColor="#94a3b8" value={notes} onChangeText={setNotes} />
                <TouchableOpacity style={styles.saveBtn} onPress={handleAdd} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Add Member</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No family members added yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardMain}>
              <Text style={styles.cardName}>{item.full_name}</Text>
              <Text style={styles.cardRel}>{item.relationship}</Text>
              {item.date_of_birth ? <Text style={styles.cardDetail}>DOB: {item.date_of_birth}</Text> : null}
              {item.notes ? <Text style={styles.cardDetail}>{item.notes}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
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
  inner: { padding: 20, paddingTop: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  addBtn: { backgroundColor: TEAL, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  form: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14, color: '#0f172a', backgroundColor: '#f8fafc', marginBottom: 10 },
  saveBtn: { backgroundColor: TEAL, borderRadius: 8, padding: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center' },
  cardMain: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  cardRel: { fontSize: 13, color: TEAL, marginTop: 2 },
  cardDetail: { fontSize: 12, color: '#64748b', marginTop: 2 },
  deleteBtn: { padding: 8 },
  deleteText: { color: '#ef4444', fontSize: 16, fontWeight: '700' },
});
