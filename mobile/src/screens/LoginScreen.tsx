import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/AuthStack';
import { useAuth } from '../contexts/AuthContext';
import api, { clearToken } from '../services/api';
import { classifyLoginResponse, normalizeAuth, type AuthUser } from '../contexts/authSession';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<'password' | 'enrollment' | 'challenge' | 'recovery'>('password');
  const [partialToken, setPartialToken] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [pendingSession, setPendingSession] = useState<AuthUser | null>(null);
  const [error, setError] = useState('');

  const errorMessage = (err: any) => typeof err.response?.data?.detail === 'string'
    ? err.response.data.detail : err.message || 'Please try again.';

  const resetFlow = () => {
    setStage('password'); setPartialToken(''); setSecret(''); setCode('');
    setRecoveryCodes([]); setPendingSession(null); setError('');
  };

  const setupEnrollment = async (token: string) => {
    const response = await api.post('/auth/mfa/setup', {}, { headers: { Authorization: `Bearer ${token}` } });
    setSecret(response.data.secret);
  };

  const retryEnrollment = async () => {
    setLoading(true); setError('');
    try { await setupEnrollment(partialToken); }
    catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  };

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Email and password are required.'); return; }
    setLoading(true); setError('');
    try {
      await clearToken();
      const res = await api.post('/auth/login', { email: email.toLowerCase().trim(), password });
      const result = classifyLoginResponse(res.data);
      if (result.kind === 'enrollment') {
        setPartialToken(result.token); setStage('enrollment');
        await setupEnrollment(result.token);
      } else if (result.kind === 'challenge') {
        setPartialToken(result.token); setStage('challenge');
      } else {
        await login(result.session);
      }
    } catch (err: any) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const verifyMfa = async () => {
    if (!code.trim()) return;
    setLoading(true); setError('');
    try {
      if (stage === 'enrollment') {
        const response = await api.post('/auth/mfa/verify', { code: code.trim() }, {
          headers: { Authorization: `Bearer ${partialToken}` },
        });
        setPendingSession(normalizeAuth(response.data.session));
        setRecoveryCodes(response.data.recovery_codes || []);
        setSecret(''); setPartialToken(''); setCode(''); setStage('recovery');
      } else {
        const response = await api.post('/auth/mfa/challenge', { mfa_token: partialToken, code: code.trim() });
        await login(normalizeAuth(response.data));
      }
    } catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  };

  const finishEnrollment = async () => {
    if (!pendingSession) return;
    setLoading(true); setError('');
    try { await login(pendingSession); }
    catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Text style={styles.brandText}>❤ HEALTH PLATFORM</Text>
        </View>

        <Text style={styles.title}>{stage === 'password' ? 'Welcome back'
          : stage === 'enrollment' ? 'Set up two-step verification'
          : stage === 'challenge' ? 'Verify your sign-in' : 'Save your recovery codes'}</Text>
        <Text style={styles.subtitle}>{stage === 'password' ? 'Sign in to your account'
          : stage === 'enrollment' ? 'Add this setup key to your authenticator app, then enter its six-digit code.'
          : stage === 'challenge' ? 'Enter your authenticator code or one unused recovery code.'
          : 'Keep these codes somewhere private. Each code works once if you lose access to your authenticator.'}</Text>

        {stage === 'password' ? <>
        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor="#94a3b8"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Sign In</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.link}>
          <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Register</Text></Text>
        </TouchableOpacity>
        </> : stage === 'recovery' ? <>
          <View style={styles.recoveryGrid}>
            {recoveryCodes.map(item => <Text key={item} selectable style={styles.recoveryCode}>{item}</Text>)}
          </View>
          <TouchableOpacity style={styles.btn} onPress={finishEnrollment} disabled={loading} accessibilityRole="button">
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>I saved the codes — Sign in</Text>}
          </TouchableOpacity>
        </> : <>
          {stage === 'enrollment' && (secret
            ? <Text selectable style={styles.setupKey}>{secret}</Text>
            : <TouchableOpacity style={styles.btn} onPress={retryEnrollment} disabled={loading} accessibilityRole="button">
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Retry setup</Text>}
              </TouchableOpacity>)}
          {(stage === 'challenge' || secret) && <>
            <TextInput style={styles.input} placeholder={stage === 'enrollment' ? 'Six-digit code' : 'Authenticator or recovery code'}
              placeholderTextColor="#94a3b8" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false}
              keyboardType={stage === 'enrollment' ? 'number-pad' : 'default'}
              accessibilityLabel={stage === 'enrollment' ? 'Authenticator code' : 'Authenticator or recovery code'} />
            <TouchableOpacity style={styles.btn} onPress={verifyMfa} disabled={loading || !code.trim()} accessibilityRole="button">
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify</Text>}
            </TouchableOpacity>
          </>}
        </>}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {stage !== 'password' && <TouchableOpacity style={styles.link} disabled={loading} onPress={resetFlow} accessibilityRole="button">
          <Text style={styles.linkText}>Back to sign-in</Text>
        </TouchableOpacity>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const TEAL = '#0d9488';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdfb' },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brand: { alignItems: 'center', marginBottom: 32 },
  brandText: { fontSize: 18, fontWeight: '700', color: TEAL, letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 28 },
  input: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    padding: 14, fontSize: 15, color: '#0f172a', backgroundColor: '#fff',
    marginBottom: 14,
  },
  btn: {
    backgroundColor: TEAL, borderRadius: 10, padding: 15,
    alignItems: 'center', marginTop: 6,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#64748b', fontSize: 14 },
  linkBold: { color: TEAL, fontWeight: '600' },
  setupKey: { padding: 16, marginBottom: 16, borderRadius: 10, backgroundColor: '#e2f3ee', color: '#0f172a', fontSize: 16, letterSpacing: 2 },
  recoveryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  recoveryCode: { width: '45%', padding: 12, borderRadius: 8, backgroundColor: '#e2f3ee', textAlign: 'center', color: '#0f172a', fontSize: 16 },
  error: { marginTop: 16, color: '#b91c1c', fontSize: 14 },
});
