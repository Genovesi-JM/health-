import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

// ConsentGateScreen is reachable from both AuthStack (new users)
// and AppStack (existing users who need to re-consent).
// After successful consent, RootNavigation auto-swaps to AppStack
// because the user is already authenticated (token in SecureStore).

const REQUIRED_CONSENTS = [
  'terms_of_service',
  'privacy_policy',
  'medical_disclaimer',
  'health_data_processing',
  'telemedicine_consent',
] as const;

const CONSENT_INFO: Record<string, { label: string; description: string }> = {
  terms_of_service: {
    label: 'Terms of Service',
    description: 'Governs your use of the platform and account responsibilities.',
  },
  privacy_policy: {
    label: 'Privacy Policy',
    description: 'Describes how we collect, store, and protect your personal data (GDPR).',
  },
  medical_disclaimer: {
    label: 'Medical Disclaimer',
    description: 'This platform is not an emergency service and does not replace in-person care.',
  },
  health_data_processing: {
    label: 'Health Data Processing',
    description: 'Your health data is processed to provide care coordination services.',
  },
  telemedicine_consent: {
    label: 'Telemedicine Consent',
    description: 'You consent to receive telemedicine services through this platform.',
  },
};

export default function ConsentGateScreen() {
  const { user: _user } = useAuth(); // presence checked by RootNavigation
  const [existing, setExisting] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(REQUIRED_CONSENTS.map(c => [c, false])),
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/api/v1/compliance/consents')
      .then(r => {
        const types: string[] = r.data.map((c: { consent_type: string }) => c.consent_type);
        setExisting(types);
        setChecked(Object.fromEntries(REQUIRED_CONSENTS.map(c => [c, types.includes(c)])));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const allAccepted = REQUIRED_CONSENTS.every(c => existing.includes(c));
  const allChecked = REQUIRED_CONSENTS.every(c => checked[c]);

  const toggle = (key: string) => {
    if (existing.includes(key)) return; // already accepted, cannot uncheck
    setChecked(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async () => {
    if (!allChecked) {
      Alert.alert('Required', 'Please accept all five consents to continue.');
      return;
    }
    setSubmitting(true);
    try {
      for (const ct of REQUIRED_CONSENTS) {
        if (!existing.includes(ct)) {
          await api.post('/api/v1/compliance/consent', { consent_type: ct });
        }
      }
      // Mark all as accepted locally so the UI transitions to the
      // "already accepted" confirmation view.
      // RootNavigation will auto-swap to AppStack because the user
      // is already authenticated (token stored in SecureStore).
      setExisting([...REQUIRED_CONSENTS]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail ?? 'Failed to save consents.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <View style={styles.brand}>
        <Text style={styles.brandText}>❤ HEALTH PLATFORM</Text>
      </View>

      <Text style={styles.title}>Before you continue</Text>
      <Text style={styles.subtitle}>
        Health Platform handles sensitive health data. Please read and accept the following.
      </Text>

      <View style={styles.warning}>
        <Text style={styles.warningText}>
          🚨 Not an emergency service. If you are in a medical emergency, call 112 immediately.
        </Text>
      </View>

      {REQUIRED_CONSENTS.map(c => {
        const info = CONSENT_INFO[c];
        const isExisting = existing.includes(c);
        const isChecked = checked[c];
        return (
          <TouchableOpacity
            key={c}
            style={[styles.consentCard, isChecked && styles.consentCardChecked]}
            onPress={() => toggle(c)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
              {isChecked && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.consentLabel}>
                {info.label}
                {isExisting && <Text style={styles.alreadyTag}> (already accepted)</Text>}
              </Text>
              <Text style={styles.consentDesc}>{info.description}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={[styles.btn, (!allChecked || submitting) && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={!allChecked || submitting}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Accept and Continue</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const TEAL = '#0d9488';

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdfb' },
  container: { flex: 1, backgroundColor: '#f0fdfb' },
  inner: { padding: 24, paddingTop: 48 },
  brand: { alignItems: 'center', marginBottom: 24 },
  brandText: { fontSize: 16, fontWeight: '700', color: TEAL, letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#64748b', lineHeight: 20, marginBottom: 16 },
  warning: {
    backgroundColor: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 20,
    borderWidth: 1, borderColor: '#fca5a5',
  },
  warningText: { color: '#7f1d1d', fontSize: 13, lineHeight: 18 },
  consentCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  consentCardChecked: { borderColor: TEAL, backgroundColor: 'rgba(13,148,136,0.04)' },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2,
    borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxChecked: { backgroundColor: TEAL, borderColor: TEAL },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  consentLabel: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 3 },
  alreadyTag: { color: '#10b981', fontWeight: '400', fontSize: 12 },
  consentDesc: { fontSize: 12, color: '#64748b', lineHeight: 16 },
  btn: { backgroundColor: TEAL, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 8 },
  btnDisabled: { backgroundColor: '#94a3b8' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
