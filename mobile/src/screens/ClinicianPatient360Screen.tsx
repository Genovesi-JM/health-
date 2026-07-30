import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import api from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import type { ClinicianStackParamList } from '../navigation/ClinicianStack';

type Props = NativeStackScreenProps<ClinicianStackParamList, 'Patient360'>;

type Patient360 = {
  access: { role: 'doctor' | 'nurse'; scope: string; capabilities: Record<string, boolean> };
  identity: {
    id: string; name: string; age?: number | null; gender?: string | null;
    blood_type?: string | null; emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
  };
  safety: { allergies: string[]; chronic_conditions: string[]; risk_flags: Array<{ severity: string; label: string }> };
  active_episode?: { id: string; specialty: string; status: string; created_at?: string | null } | null;
  latest_triage?: {
    id?: string;
    chief_complaint?: string | null; risk_level?: string | null;
    recommended_action?: string | null; score?: number | null;
  } | null;
  readings: Array<{
    id: string; type: string; value?: number | null; systolic?: number | null;
    diastolic?: number | null; unit?: string | null; source?: string | null;
  }>;
  medications: Array<{ id: string; name: string; dosage?: string | null; frequency?: string | null; is_current: boolean }>;
  consultations: Array<{ id: string; specialty: string; status: string; scheduled_at?: string | null; created_at?: string | null }>;
};

const TEAL = '#0d9488';

function readingValue(item: Patient360['readings'][number]) {
  if (item.type === 'blood_pressure') return `${item.systolic ?? '—'}/${item.diastolic ?? '—'} ${item.unit || 'mmHg'}`;
  return `${item.value ?? '—'} ${item.unit || ''}`.trim();
}

export default function ClinicianPatient360Screen({ route }: Props) {
  const { t } = useLanguage();
  const [data, setData] = useState<Patient360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showEscalation, setShowEscalation] = useState(false);
  const [urgency, setUrgency] = useState<'routine' | 'priority' | 'urgent' | 'emergency'>('priority');
  const [reason, setReason] = useState('');
  const [summary, setSummary] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError('');
    try {
      const response = await api.get(`/api/v1/clinician/patients/${route.params.patientId}/360`);
      setData(response.data);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || t('clinician.load_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [route.params.patientId, t]);

  useEffect(() => { void load(); }, [load]);

  const openEscalation = () => {
    if (!data) return;
    setReason(data.latest_triage?.chief_complaint || '');
    setSummary(
      `${t('clinician.situation')}: ${data.latest_triage?.chief_complaint || '—'}\n` +
      `${t('clinician.risk')}: ${data.latest_triage?.risk_level || '—'}\n` +
      `${t('clinician.recommendation')}: ${data.latest_triage?.recommended_action || '—'}`,
    );
    setShowEscalation(true);
  };

  const submitEscalation = async () => {
    if (!data || !reason.trim() || !summary.trim()) return;
    setSending(true);
    try {
      await api.post('/api/v1/clinical-operations/escalations', {
        patient_id: data.identity.id,
        consultation_id: data.active_episode?.id,
        triage_session_id: data.latest_triage?.id,
        urgency,
        reason: reason.trim(),
        clinical_summary: summary.trim(),
      });
      setShowEscalation(false);
      Alert.alert(t('clinician.sent_title'), t('clinician.sent_message'));
    } catch (requestError: any) {
      Alert.alert(t('common.error'), requestError?.response?.data?.detail || t('clinician.accept_error'));
    } finally {
      setSending(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={TEAL} /></View>;
  if (!data) return <View style={styles.center}><Text style={styles.error}>{String(error)}</Text></View>;

  const currentMedication = data.medications.filter(item => item.is_current);
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={TEAL} />}
    >
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{data.identity.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{t('clinician.patient360')} · {data.access.role === 'doctor' ? t('clinician.doctor') : t('clinician.nurse')}</Text>
          <Text style={styles.name}>{data.identity.name}</Text>
          <Text style={styles.meta}>
            {data.identity.age ?? '—'} · {data.identity.gender || '—'} · {data.identity.blood_type || '—'}
          </Text>
        </View>
      </View>

      <View style={styles.safety}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#b91c1c" />
          <Text style={styles.safetyTitle}>{t('clinician.safety')}</Text>
        </View>
        <View style={styles.tags}>
          {data.safety.allergies.map(item => <Text key={item} style={[styles.tag, styles.dangerTag]}>{t('clinician.allergies')}: {item}</Text>)}
          {data.safety.chronic_conditions.map(item => <Text key={item} style={styles.tag}>{item}</Text>)}
          {!data.safety.allergies.length && !data.safety.chronic_conditions.length && <Text style={styles.muted}>{t('clinician.no_data')}</Text>}
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('clinician.risk')}</Text>
          <Text style={[styles.cardValue, { color: '#b91c1c' }]}>{data.latest_triage?.risk_level || '—'}</Text>
          <Text style={styles.cardText}>{data.latest_triage?.chief_complaint || t('clinician.no_data')}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('clinician.episode')}</Text>
          <Text style={[styles.cardValue, { color: TEAL }]}>{data.active_episode?.status || '—'}</Text>
          <Text style={styles.cardText}>{data.active_episode?.specialty || t('clinician.no_data')}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="pulse-outline" size={18} color={TEAL} />
          <Text style={styles.sectionTitle}>{t('clinician.readings')}</Text>
          <Text style={styles.count}>{data.readings.length}</Text>
        </View>
        {!data.readings.length ? <Text style={styles.empty}>{t('clinician.no_data')}</Text> : data.readings.slice(0, 8).map(item => (
          <View key={item.id} style={styles.listRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>{item.type.replace(/_/g, ' ')}</Text>
              <Text style={styles.listMeta}>{item.source || 'manual'}</Text>
            </View>
            <Text style={styles.listValue}>{readingValue(item)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="medical-outline" size={18} color="#7c3aed" />
          <Text style={styles.sectionTitle}>{t('clinician.medication')}</Text>
          <Text style={styles.count}>{currentMedication.length}</Text>
        </View>
        {!currentMedication.length ? <Text style={styles.empty}>{t('clinician.no_data')}</Text> : currentMedication.map(item => (
          <View key={item.id} style={styles.listRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>{item.name} {item.dosage || ''}</Text>
              <Text style={styles.listMeta}>{item.frequency || '—'}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="calendar-outline" size={18} color="#2563eb" />
          <Text style={styles.sectionTitle}>{t('clinician.consultations')}</Text>
          <Text style={styles.count}>{data.consultations.length}</Text>
        </View>
        {data.consultations.slice(0, 8).map(item => (
          <View key={item.id} style={styles.listRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>{item.specialty}</Text>
              <Text style={styles.listMeta}>{item.status}</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color="#94a3b8" />
          </View>
        ))}
      </View>

      <View style={styles.boundary}>
        <Ionicons name="information-circle-outline" size={18} color="#92400e" />
        <Text style={styles.boundaryText}>
          {data.access.role === 'nurse' ? t('clinician.nurse_boundary') : t('clinician.doctor_boundary')}
        </Text>
      </View>

      {data.access.role === 'nurse' && data.access.capabilities.create_handoff && (
        <TouchableOpacity style={styles.escalationButton} onPress={openEscalation} accessibilityRole="button">
          <Ionicons name="medkit-outline" size={18} color="#fff" />
          <Text style={styles.escalationButtonText}>{t('clinician.escalate')}</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showEscalation} animationType="slide" transparent onRequestClose={() => setShowEscalation(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalEyebrow}>{t('doctor.coordination')}</Text>
                <Text style={styles.modalTitle}>{t('clinician.escalate')}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowEscalation(false)}
                accessibilityRole="button"
                accessibilityLabel={t('clinician.close')}
              >
                <Ionicons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>{t('clinician.priority')}</Text>
            <View style={styles.priorityRow}>
              {(['routine', 'priority', 'urgent', 'emergency'] as const).map(value => (
                <TouchableOpacity
                  key={value}
                  style={[styles.priorityChip, urgency === value && styles.priorityChipActive]}
                  onPress={() => setUrgency(value)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.priorityText, urgency === value && styles.priorityTextActive]}>
                    {t(`clinician.priority_${value}` as any)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t('clinician.reason')}</Text>
            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={setReason}
              multiline
              placeholder={t('clinician.reason')}
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.fieldLabel}>{t('clinician.handoff')}</Text>
            <TextInput
              style={[styles.input, styles.summaryInput]}
              value={summary}
              onChangeText={setSummary}
              multiline
              textAlignVertical="top"
              placeholder={t('clinician.handoff')}
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.legalNote}>{t('clinician.nurse_boundary')}</Text>
            <TouchableOpacity
              style={[styles.sendButton, (!reason.trim() || !summary.trim() || sending) && styles.disabled]}
              disabled={!reason.trim() || !summary.trim() || sending}
              onPress={() => void submitEscalation()}
              accessibilityRole="button"
            >
              {sending && <ActivityIndicator size="small" color="#fff" />}
              <Text style={styles.sendButtonText}>{t('clinician.send_doctor')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 36 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  error: { color: '#b91c1c', textAlign: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, backgroundColor: '#0f766e', marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  eyebrow: { color: '#99f6e4', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  name: { color: '#fff', fontSize: 21, fontWeight: '900', marginTop: 3 },
  meta: { color: '#ccfbf1', fontSize: 11, marginTop: 3 },
  safety: { padding: 14, borderWidth: 1, borderColor: '#fecaca', borderRadius: 14, backgroundColor: '#fff', marginBottom: 12 },
  safetyTitle: { color: '#991b1b', fontSize: 13, fontWeight: '900' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { color: '#334155', fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, backgroundColor: '#f1f5f9' },
  dangerTag: { color: '#b91c1c', backgroundColor: '#fee2e2' },
  muted: { color: '#64748b', fontSize: 11 },
  grid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  card: { flex: 1, minHeight: 112, padding: 13, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, backgroundColor: '#fff' },
  cardLabel: { color: '#64748b', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  cardValue: { fontSize: 18, fontWeight: '900', marginTop: 8 },
  cardText: { color: '#475569', fontSize: 10, lineHeight: 14, marginTop: 6 },
  section: { marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, backgroundColor: '#fff', overflow: 'hidden' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 13 },
  sectionTitle: { flex: 1, color: '#0f172a', fontSize: 14, fontWeight: '900' },
  count: { minWidth: 25, color: '#0f766e', backgroundColor: '#ccfbf1', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99, textAlign: 'center', fontSize: 10, fontWeight: '900' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  listTitle: { color: '#0f172a', fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  listMeta: { color: '#64748b', fontSize: 10, marginTop: 2 },
  listValue: { color: '#0f172a', fontSize: 12, fontWeight: '900' },
  empty: { color: '#64748b', padding: 16, paddingTop: 0, fontSize: 11 },
  boundary: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 13, borderRadius: 12, backgroundColor: '#fffbeb' },
  boundaryText: { flex: 1, color: '#92400e', fontSize: 10.5, lineHeight: 15 },
  escalationButton: { minHeight: 48, marginTop: 12, borderRadius: 12, backgroundColor: TEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  escalationButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.48)' },
  modalCard: { maxHeight: '90%', padding: 18, paddingBottom: 30, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  modalEyebrow: { color: TEAL, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  modalTitle: { color: '#0f172a', fontSize: 19, fontWeight: '900', marginTop: 3 },
  modalClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#f1f5f9' },
  fieldLabel: { color: '#334155', fontSize: 10, fontWeight: '900', marginBottom: 6, marginTop: 10 },
  priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  priorityChip: { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 99, backgroundColor: '#fff' },
  priorityChipActive: { borderColor: TEAL, backgroundColor: '#ccfbf1' },
  priorityText: { color: '#64748b', fontSize: 9, fontWeight: '800' },
  priorityTextActive: { color: '#0f766e' },
  input: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, color: '#0f172a', fontSize: 12, backgroundColor: '#f8fafc' },
  summaryInput: { minHeight: 120 },
  legalNote: { color: '#92400e', fontSize: 10, lineHeight: 15, padding: 10, marginTop: 10, borderRadius: 9, backgroundColor: '#fffbeb' },
  sendButton: { minHeight: 48, marginTop: 12, borderRadius: 11, backgroundColor: TEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  sendButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.5 },
});
