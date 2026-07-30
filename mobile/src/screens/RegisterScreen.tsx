import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/AuthStack';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'> };

const COUNTRIES = [
  { code: 'AO', name: 'Angola' },
  { code: 'PT', name: 'Portugal' },
  { code: 'ES', name: 'Spain' },
  { code: 'CU', name: 'Cuba' },
  { code: 'RU', name: 'Russia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CV', name: 'Cape Verde' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'CD', name: 'Democratic Republic of the Congo' },
  { code: 'ST', name: 'São Tomé and Príncipe' },
  { code: 'ZW', name: 'Zimbabwe' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NA', name: 'Namibia' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'FR', name: 'France' },
] as const;

type CountryField = 'practice' | 'licence' | 'diploma';

function countryName(code: string) {
  return COUNTRIES.find(country => country.code === code)?.name || code;
}

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
  const [countryPicker, setCountryPicker] = useState<CountryField | null>(null);
  const [loading, setLoading] = useState(false);
  const [consents, setConsents] = useState<Record<string, boolean>>(
    Object.fromEntries(REQUIRED_CONSENTS.map(c => [c, false])),
  );

  const allChecked = REQUIRED_CONSENTS.every(c => consents[c]);

  const toggleConsent = (key: string) =>
    setConsents(prev => ({ ...prev, [key]: !prev[key] }));

  const chooseCountry = (code: string) => {
    if (countryPicker === 'practice') setPracticeCountry(code);
    if (countryPicker === 'licence') setLicenceCountry(code);
    if (countryPicker === 'diploma') setDiplomaCountry(code);
    setCountryPicker(null);
  };

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
            <Text style={styles.hint}>Select the country connected to each professional document.</Text>
            <Text style={styles.countryLabel}>Country of practice / professional registration</Text>
            <TouchableOpacity style={styles.countryButton} onPress={() => setCountryPicker('practice')}>
              <Text style={styles.countryButtonText}>{countryName(practiceCountry)}</Text>
              <Text style={styles.countryChevron}>⌄</Text>
            </TouchableOpacity>
            <Text style={styles.countryLabel}>Country that issued the professional licence</Text>
            <TouchableOpacity style={styles.countryButton} onPress={() => setCountryPicker('licence')}>
              <Text style={styles.countryButtonText}>{countryName(licenceCountry)}</Text>
              <Text style={styles.countryChevron}>⌄</Text>
            </TouchableOpacity>
            <Text style={styles.countryLabel}>Country that issued the diploma / certificate</Text>
            <TouchableOpacity style={styles.countryButton} onPress={() => setCountryPicker('diploma')}>
              <Text style={styles.countryButtonText}>{countryName(diplomaCountry)}</Text>
              <Text style={styles.countryChevron}>⌄</Text>
            </TouchableOpacity>
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

        <Modal visible={countryPicker !== null} transparent animationType="slide"
          onRequestClose={() => setCountryPicker(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.countrySheet}>
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetTitle}>Select country</Text>
                  <Text style={styles.sheetSubtitle}>
                    {countryPicker === 'practice' ? 'Practice / registration' :
                      countryPicker === 'licence' ? 'Professional licence issued in' :
                        'Diploma or certificate issued in'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setCountryPicker(null)} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.countryList}>
                {COUNTRIES.map(country => {
                  const selectedCode = countryPicker === 'practice' ? practiceCountry :
                    countryPicker === 'licence' ? licenceCountry : diplomaCountry;
                  const selected = selectedCode === country.code;
                  return (
                    <TouchableOpacity key={country.code} style={[styles.countryOption, selected && styles.countryOptionSelected]}
                      onPress={() => chooseCountry(country.code)}>
                      <Text style={[styles.countryOptionText, selected && styles.countryOptionTextSelected]}>{country.name}</Text>
                      {selected && <Text style={styles.countryCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

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
  hint: { color: '#64748b', fontSize: 11, lineHeight: 16, marginBottom: 10 },
  countryLabel: { color: '#475569', fontSize: 11, fontWeight: '600', marginBottom: 5 },
  countryButton: {
    minHeight: 48, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingHorizontal: 14, marginBottom: 12, backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  countryButtonText: { color: '#0f172a', fontSize: 14, fontWeight: '600', flex: 1 },
  countryChevron: { color: '#0d9488', fontSize: 20, marginLeft: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  countrySheet: {
    maxHeight: '78%', backgroundColor: '#fff', borderTopLeftRadius: 22,
    borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: '#0f172a', fontSize: 19, fontWeight: '800' },
  sheetSubtitle: { color: '#64748b', fontSize: 12, marginTop: 3 },
  closeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { color: '#475569', fontSize: 15, fontWeight: '700' },
  countryList: { flexGrow: 0 },
  countryOption: {
    minHeight: 48, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  countryOptionSelected: { backgroundColor: '#f0fdfa' },
  countryOptionText: { color: '#334155', fontSize: 15 },
  countryOptionTextSelected: { color: '#0f766e', fontWeight: '700' },
  countryCheck: { color: '#0d9488', fontSize: 17, fontWeight: '800' },
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
