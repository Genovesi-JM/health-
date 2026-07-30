import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/AuthStack';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'> };

const REQUIRED_CONSENTS = [
  'terms_of_service',
  'privacy_policy',
  'medical_disclaimer',
  'health_data_processing',
  'telemedicine_consent',
] as const;

const CONSENT_LABELS: Record<string, string> = {
  terms_of_service: 'Terms of Service',
  privacy_policy: 'Privacy Policy',
  medical_disclaimer: 'Medical Disclaimer',
  health_data_processing: 'Health Data Processing',
  telemedicine_consent: 'Telemedicine Consent',
};

export default function RegisterScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [role, setRole] = useState<'patient' | 'doctor' | 'nurse'>('patient');
  const [practiceCountry, setPracticeCountry] = useState('AO');
  const [licenceCountry, setLicenceCountry] = useState('AO');
  const [diplomaCountry, setDiplomaCountry] = useState('AO');
  const [authority, setAuthority] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');
  const [institution, setInstitution] = useState('');
  const [degreeTitle, setDegreeTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [consents, setConsents] = useState<Record<string, boolean>>(
    Object.fromEntries(REQUIRED_CONSENTS.map(c => [c, false])),
  );

  const allChecked = REQUIRED_CONSENTS.every(c => consents[c]);

  const toggleConsent = (key: string) =>
    setConsents(prev => ({ ...prev, [key]: !prev[key] }));

  const handleRegister = async () => {
    if (!email || !password) { Alert.alert('Error', 'Email and password are required.'); return; }
    if (password !== confirmPw) { Alert.alert('Error', 'Passwords do not match.'); return; }
    if (password.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters.'); return; }
    if (!allChecked) { Alert.alert('Error', 'Please accept all required consents.'); return; }
    if (role !== 'patient' && (!fullName || !authority || !licenceNumber || !institution || !degreeTitle)) {
      Alert.alert('Professional details required', 'Complete your licence and diploma details before continuing.');
      return;
    }

    setLoading(true);
    try {
      const body = {
        email: email.toLowerCase().trim(),
        password,
        full_name: fullName || email.split('@')[0],
        sector_focus: 'health',
        org_name: 'KAYA',
        account_name: fullName || email.split('@')[0],
        entity_type: 'individual',
        modules_enabled: ['triage', 'teleconsulta'],
        role,
        ...(role !== 'patient' ? {
          practice_country: practiceCountry,
          licence_country: licenceCountry,
          diploma_country: diplomaCountry,
          issuing_authority: authority,
          licence_number: licenceNumber,
          diploma_institution: institution,
          degree_title: degreeTitle,
        } : {}),
      };
      const res = await api.post('/auth/register', body);
      // Post consents (best-effort)
      for (const ct of REQUIRED_CONSENTS) {
        api.post('/api/v1/compliance/consent', { consent_type: ct }).catch(() => {});
      }
      await login(res.data);
    } catch (err: any) {
      Alert.alert('Registration failed', err.response?.data?.detail ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Text style={styles.brandText}>❤ HEALTH PLATFORM</Text>
        </View>

        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join the health platform</Text>

        <Text style={styles.sectionLabel}>ACCOUNT TYPE</Text>
        <View style={styles.roleRow}>
          {([['patient', 'Patient'], ['nurse', 'Nurse'], ['doctor', 'Doctor']] as const).map(([value, label]) => (
            <TouchableOpacity key={value} onPress={() => setRole(value)}
              style={[styles.roleCard, role === value && styles.roleCardActive]}>
              <Text style={[styles.roleText, role === value && styles.roleTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput style={styles.input} placeholder="Full name" placeholderTextColor="#94a3b8"
          value={fullName} onChangeText={setFullName} />
        <TextInput style={styles.input} placeholder="Email address" placeholderTextColor="#94a3b8"
          keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Password (min. 6 chars)" placeholderTextColor="#94a3b8"
          secureTextEntry value={password} onChangeText={setPassword} />
        <TextInput style={styles.input} placeholder="Confirm password" placeholderTextColor="#94a3b8"
          secureTextEntry value={confirmPw} onChangeText={setConfirmPw} />

        {role !== 'patient' && (
          <View style={styles.professionalBox}>
            <Text style={styles.consentHeader}>PROFESSIONAL CREDENTIALS</Text>
            <Text style={styles.hint}>Use ISO country codes: AO, PT, ES, CU, RU, BR, CV, MZ, CD, ST or ZW.</Text>
            <View style={styles.countryRow}>
              <TextInput style={[styles.input, styles.countryInput]} placeholder="Practice (AO)" placeholderTextColor="#94a3b8"
                autoCapitalize="characters" value={practiceCountry} onChangeText={v => setPracticeCountry(v.toUpperCase().slice(0, 2))} />
              <TextInput style={[styles.input, styles.countryInput]} placeholder="Licence" placeholderTextColor="#94a3b8"
                autoCapitalize="characters" value={licenceCountry} onChangeText={v => setLicenceCountry(v.toUpperCase().slice(0, 2))} />
              <TextInput style={[styles.input, styles.countryInput]} placeholder="Diploma" placeholderTextColor="#94a3b8"
                autoCapitalize="characters" value={diplomaCountry} onChangeText={v => setDiplomaCountry(v.toUpperCase().slice(0, 2))} />
            </View>
            {practiceCountry !== diplomaCountry && <Text style={styles.warning}>Foreign diploma: recognition/equivalence evidence will be required.</Text>}
            <TextInput style={styles.input} placeholder="Issuing authority / professional order" placeholderTextColor="#94a3b8"
              value={authority} onChangeText={setAuthority} />
            <TextInput style={styles.input} placeholder="Professional licence number" placeholderTextColor="#94a3b8"
              value={licenceNumber} onChangeText={setLicenceNumber} />
            <TextInput style={styles.input} placeholder="Diploma institution" placeholderTextColor="#94a3b8"
              value={institution} onChangeText={setInstitution} />
            <TextInput style={[styles.input, { marginBottom: 0 }]} placeholder="Degree title" placeholderTextColor="#94a3b8"
              value={degreeTitle} onChangeText={setDegreeTitle} />
          </View>
        )}

        {/* Consent checkboxes */}
        <View style={styles.consentBox}>
          <Text style={styles.consentHeader}>REQUIRED CONSENTS</Text>
          {REQUIRED_CONSENTS.map(c => (
            <TouchableOpacity key={c} style={styles.consentRow} onPress={() => toggleConsent(c)} activeOpacity={0.7}>
              <View style={[styles.checkbox, consents[c] && styles.checkboxChecked]}>
                {consents[c] && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.consentLabel}>{CONSENT_LABELS[c]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.btn, !allChecked && styles.btnDisabled]} onPress={handleRegister} disabled={loading || !allChecked}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.link}>
          <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign in</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const TEAL = '#0d9488';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdfb' },
  inner: { flexGrow: 1, padding: 24, paddingTop: 48 },
  brand: { alignItems: 'center', marginBottom: 24 },
  brandText: { fontSize: 18, fontWeight: '700', color: TEAL, letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', letterSpacing: 1, marginBottom: 8 },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  roleCard: { flex: 1, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, backgroundColor: '#fff' },
  roleCardActive: { borderColor: TEAL, backgroundColor: '#ecfdf5' },
  roleText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  roleTextActive: { color: TEAL },
  input: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    padding: 14, fontSize: 15, color: '#0f172a', backgroundColor: '#fff', marginBottom: 12,
  },
  consentBox: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    padding: 14, backgroundColor: '#fff', marginBottom: 16,
  },
  professionalBox: { borderWidth: 1, borderColor: '#99f6e4', borderRadius: 10, padding: 14, backgroundColor: '#f0fdfa', marginBottom: 16 },
  countryRow: { flexDirection: 'row', gap: 7 },
  countryInput: { flex: 1 },
  hint: { color: '#64748b', fontSize: 11, lineHeight: 16, marginBottom: 10 },
  warning: { color: '#92400e', fontSize: 11, lineHeight: 16, marginBottom: 10, backgroundColor: '#fffbeb', padding: 8, borderRadius: 6 },
  consentHeader: { fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 1, marginBottom: 12 },
  consentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2,
    borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  checkboxChecked: { backgroundColor: TEAL, borderColor: TEAL },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  consentLabel: { fontSize: 13, color: '#0f172a', flex: 1 },
  btn: { backgroundColor: TEAL, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 4 },
  btnDisabled: { backgroundColor: '#94a3b8' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#64748b', fontSize: 14 },
  linkBold: { color: TEAL, fontWeight: '600' },
});
