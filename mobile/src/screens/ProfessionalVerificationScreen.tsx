import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type Evidence = { kind: string; original_filename: string };
type Credential = {
  legal_name: string; profession: string; status: string; automated_score: number;
  practice_country: string; diploma_country: string; licence_country: string;
  evidence: Evidence[]; missing_evidence: string[];
};

const LABELS: Record<string, string> = {
  professional_card: 'Professional card / licence',
  diploma: 'Diploma or training certificate',
  recognition: 'Diploma recognition / equivalence',
  local_registration: 'Registration in country of practice',
};

export default function ProfessionalVerificationScreen() {
  const { logout } = useAuth();
  const [data, setData] = useState<Credential | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');

  const load = async () => {
    try {
      const response = await api.get('/api/v1/credentials/me');
      setData(response.data);
    } catch (error: any) {
      Alert.alert('Verification', error.response?.data?.detail ?? 'Could not load your credential profile.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const required = useMemo(() => {
    if (!data) return [];
    const kinds = ['professional_card', 'diploma'];
    if (data.practice_country !== data.diploma_country) kinds.push('recognition');
    if (data.practice_country !== data.licence_country) kinds.push('local_registration');
    return kinds;
  }, [data]);

  const chooseAndUpload = async (kind: string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to select the credential image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      name: asset.fileName || `${kind}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    } as any);
    setWorking(kind);
    try {
      const response = await api.post(`/api/v1/credentials/me/evidence/${kind}`, form);
      setData(response.data);
    } catch (error: any) {
      Alert.alert('Upload failed', error.response?.data?.detail ?? 'Please try again.');
    } finally { setWorking(''); }
  };

  const submit = async () => {
    setWorking('submit');
    try {
      const response = await api.post('/api/v1/credentials/me/submit');
      setData(response.data);
      Alert.alert('Submitted', 'KAYA will review your evidence. Clinical access remains locked until approval.');
    } catch (error: any) {
      Alert.alert('More information needed', error.response?.data?.detail?.message ?? 'Complete all required evidence.');
      await load();
    } finally { setWorking(''); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0d9488" /></View>;
  if (!data) return <View style={styles.center}><Text>Credential profile unavailable.</Text><TouchableOpacity onPress={logout}><Text style={styles.link}>Sign out</Text></TouchableOpacity></View>;
  const locked = ['pending_review', 'verified', 'suspended'].includes(data.status);
  const complete = required.every(kind => data.evidence.some(item => item.kind === kind));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>KAYA CLINICAL SAFETY</Text>
      <Text style={styles.title}>Professional verification</Text>
      <Text style={styles.subtitle}>Clinical features unlock only after an authorised human review.</Text>

      <View style={styles.statusCard}>
        <Text style={styles.name}>{data.legal_name}</Text>
        <Text style={styles.status}>{data.profession.toUpperCase()} · {data.status.replace('_', ' ')}</Text>
        <View style={styles.progress}><View style={[styles.progressFill, { width: `${data.automated_score}%` }]} /></View>
        <Text style={styles.score}>{data.automated_score}% document checks complete</Text>
      </View>

      <Text style={styles.section}>REQUIRED EVIDENCE</Text>
      {required.map(kind => {
        const item = data.evidence.find(e => e.kind === kind);
        return (
          <View key={kind} style={styles.document}>
            <View style={{ flex: 1 }}>
              <Text style={styles.documentTitle}>{LABELS[kind]}</Text>
              <Text style={styles.documentMeta}>{item ? `✓ ${item.original_filename}` : 'Not uploaded'}</Text>
            </View>
            {!locked && <TouchableOpacity style={styles.uploadButton} onPress={() => chooseAndUpload(kind)} disabled={!!working}>
              {working === kind ? <ActivityIndicator size="small" color="#0d9488" /> : <Text style={styles.uploadText}>{item ? 'Replace' : 'Upload'}</Text>}
            </TouchableOpacity>}
          </View>
        );
      })}
      <Text style={styles.privacy}>Accepted here: JPG/PNG up to 10 MB. PDF documents can also be uploaded in the KAYA web app. Evidence is private.</Text>

      {!locked && <TouchableOpacity style={[styles.submit, !complete && styles.disabled]} onPress={submit} disabled={!complete || !!working}>
        {working === 'submit' ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit for review</Text>}
      </TouchableOpacity>}
      {data.status === 'pending_review' && <Text style={styles.pending}>Your evidence is queued for human review. You may safely close the app.</Text>}
      {data.status === 'verified' && <Text style={styles.verified}>✓ Professional identity verified. Clinical mobile tools will appear as they are released.</Text>}
      <TouchableOpacity onPress={logout} style={styles.signOut}><Text style={styles.link}>Sign out</Text></TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0fdfa' },
  content: { padding: 24, paddingTop: 64, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0fdfa', gap: 12 },
  eyebrow: { fontSize: 11, color: '#0d9488', fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#64748b', lineHeight: 20, marginTop: 6, marginBottom: 20 },
  statusCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#ccfbf1' },
  name: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  status: { fontSize: 12, color: '#0f766e', fontWeight: '700', marginTop: 4 },
  progress: { height: 7, borderRadius: 99, backgroundColor: '#e2e8f0', overflow: 'hidden', marginTop: 16 },
  progressFill: { height: '100%', backgroundColor: '#0d9488' },
  score: { fontSize: 11, color: '#64748b', marginTop: 6 },
  section: { fontSize: 11, color: '#64748b', fontWeight: '800', letterSpacing: 1, marginTop: 24, marginBottom: 8 },
  document: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, marginBottom: 9 },
  documentTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  documentMeta: { fontSize: 11, color: '#64748b', marginTop: 4 },
  uploadButton: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#ecfdf5', borderRadius: 8 },
  uploadText: { color: '#0d9488', fontWeight: '700', fontSize: 12 },
  privacy: { color: '#64748b', fontSize: 11, lineHeight: 16, marginTop: 3 },
  submit: { backgroundColor: '#0d9488', padding: 15, borderRadius: 11, alignItems: 'center', marginTop: 20 },
  disabled: { backgroundColor: '#94a3b8' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  pending: { marginTop: 18, backgroundColor: '#fffbeb', color: '#92400e', padding: 14, borderRadius: 10, fontSize: 13, lineHeight: 19 },
  verified: { marginTop: 18, backgroundColor: '#ecfdf5', color: '#166534', padding: 14, borderRadius: 10, fontSize: 13, lineHeight: 19 },
  signOut: { alignItems: 'center', marginTop: 24 },
  link: { color: '#0d9488', fontWeight: '600' },
});
