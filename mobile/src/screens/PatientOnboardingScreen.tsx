import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Linking, Platform,
  ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import {
  PATIENT_SCOPE, patientDataForDraft, patientDraftComplete, submitPatientDraft,
  validatePatientStep, type PatientData, type PatientDraft,
} from './patientOnboarding';

const TITLES = ['Idioma e contacto', 'Os seus contactos', 'Dados pessoais', 'Localização', 'Informação de saúde', 'Contacto de emergência', 'Consentimentos', 'Rever e concluir'];
const REQUIRED_CHOICES = [
  ['c_terms', 'Aceito os Termos de Serviço.'],
  ['c_privacy', 'Aceito a Política de Privacidade.'],
  ['c_health', 'Autorizo o processamento dos meus dados de saúde para fins clínicos.'],
  ['c_telemedicine', 'Aceito receber cuidados por teleconsulta.'],
  ['c_medical_disclaimer', 'Li o Aviso Médico e compreendo que o KAYA não é um serviço de emergência.'],
] as const;
const OPTIONAL_CHOICES = [
  ['c_family_share', 'Permito partilhar informação com familiares que eu autorize.'],
  ['c_analytics', 'Autorizo estatísticas anónimas para melhorar o serviço.'],
  ['c_marketing', 'Aceito receber comunicações de marketing.'],
  ['c_research', 'Autorizo o uso anonimizado dos meus dados em investigação.'],
] as const;

export default function PatientOnboardingScreen() {
  const { user, refreshUser, logout } = useAuth();
  const [draft, setDraft] = useState<PatientDraft | null>(null);
  const [data, setData] = useState<PatientData>({});
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const busy = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const identity = { email: user?.email || '', full_name: user?.full_name || '' };

  const reportError = (err: any) => {
    const detail = err.response?.data?.detail;
    if (detail?.fields && typeof detail.fields === 'object') {
      const key = Object.keys(detail.fields)[0];
      const target = Number(key?.split('.')[0]);
      if (target >= 1 && target <= 8) setStep(target);
      setError(Object.values(detail.fields).filter(value => typeof value === 'string').join(' '));
    } else if (Array.isArray(detail?.missing_steps)) {
      setStep(detail.missing_steps[0] || 1);
      setError('Reveja e conclua as etapas em falta.');
    } else {
      setError(typeof detail === 'string' ? detail : detail?.message || err.message || 'Não foi possível guardar. Tente novamente.');
    }
    scroll.current?.scrollTo({ y: 0, animated: true });
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const status = await api.get(`/api/v1/onboarding/status${PATIENT_SCOPE}`);
      if (patientDraftComplete(status.data.draft)) {
        setDraft(status.data.draft);
        await refreshUser();
        return;
      }
      const response = await api.post('/api/v1/onboarding/start', { role: 'patient' });
      const current = response.data as PatientDraft;
      setDraft(current);
      setData(patientDataForDraft(identity, current.data));
      setStep(Math.max(1, Math.min(current.current_step, 8)));
      if (patientDraftComplete(current)) await refreshUser();
    } catch (err) { reportError(err); }
    finally { setLoading(false); }
    // Re-initialize only when the signed-in account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  useEffect(() => { void load(); }, [load]);

  const change = (key: string, value: string | boolean) => {
    setData(previous => ({ ...previous, [String(step)]: { ...previous[String(step)], [key]: value } }));
    setSaved(false); setError('');
  };
  const text = (key: string, number = step) => typeof data[String(number)]?.[key] === 'string' ? data[String(number)][key] as string : '';

  const saveCurrent = async (completed: boolean) => {
    const response = await api.put(`/api/v1/onboarding/steps/${step}${PATIENT_SCOPE}`, {
      data: data[String(step)] || {}, completed,
    });
    setDraft(response.data);
    setData(patientDataForDraft(identity, response.data.data));
    setSaved(true);
  };

  const act = async (operation: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true; setWorking(true); setError(''); Keyboard.dismiss();
    try { await operation(); }
    catch (err) { setSaved(false); reportError(err); }
    finally { busy.current = false; setWorking(false); }
  };

  const move = (target: number) => act(async () => {
    await saveCurrent(false);
    setStep(target); setSaved(false); scroll.current?.scrollTo({ y: 0, animated: true });
  });

  const next = () => act(async () => {
    if (patientDraftComplete(draft)) { await refreshUser(); return; }
    const checks = step === 8 ? [1, 2, 3, 4, 5, 6, 7] : [step];
    for (const current of checks) {
      const message = validatePatientStep(current, data, identity);
      if (message) { setStep(current); setError(message); scroll.current?.scrollTo({ y: 0, animated: true }); return; }
    }
    if (step < 8) {
      await saveCurrent(true);
      setStep(step + 1); setSaved(false); scroll.current?.scrollTo({ y: 0, animated: true });
    } else {
      const completed = await submitPatientDraft(api, data['8'] || {});
      setDraft(completed);
      await refreshUser();
    }
  });

  const input = (key: string, label: string, options: { required?: boolean; placeholder?: string; phone?: boolean; multiline?: boolean; limit?: number } = {}) => (
    <View style={styles.field} key={key}>
      <Text style={styles.label}>{label}{options.required ? ' *' : ' (opcional)'}</Text>
      <TextInput style={[styles.input, options.multiline && styles.multiline]} value={text(key)} onChangeText={value => change(key, value)}
        editable={!working} accessibilityLabel={label} placeholder={options.placeholder} placeholderTextColor="#64748b"
        keyboardType={options.phone ? 'phone-pad' : 'default'} autoCapitalize={key === 'dob' ? 'none' : 'sentences'}
        multiline={options.multiline} maxLength={options.limit ?? 200} />
    </View>
  );

  const choices = (key: string, label: string, values: readonly (readonly [string, string])[]) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choices}>
        {values.map(([value, title]) => <TouchableOpacity key={value} onPress={() => change(key, value)} disabled={working}
          accessibilityRole="radio" accessibilityState={{ selected: text(key) === value, disabled: working }}
          style={[styles.choice, text(key) === value && styles.selected]}>
          <Text style={styles.choiceText}>{title}</Text>
        </TouchableOpacity>)}
      </View>
    </View>
  );

  const toggle = (key: string, label: string) => <View key={key} style={styles.toggle}>
    <Switch value={data[String(step)]?.[key] === true} onValueChange={value => change(key, value)} disabled={working}
      accessibilityLabel={label} trackColor={{ true: '#0d9488' }} />
    <Text style={styles.toggleLabel}>{label}</Text>
  </View>;

  const legalLink = (path: string, title: string) => <TouchableOpacity key={path} style={styles.legalLink}
    onPress={() => Linking.openURL(`https://genovesi-jm.github.io/health-/${path}`).catch(reportError)} accessibilityRole="link">
    <Text style={styles.linkText}>{title} ↗</Text>
  </TouchableOpacity>;

  const body = () => {
    switch (step) {
      case 1: return <>
        <Text style={styles.hint}>Este formulário e os consentimentos estão em português. Escolha a sua preferência de comunicação.</Text>
        {choices('language', 'Idioma preferido', [['pt', 'Português'], ['en', 'English'], ['fr', 'Français'], ['es', 'Español'], ['zh', '中文']])}
        {choices('channel', 'Contacto preferido', [['email', 'Email'], ['sms', 'SMS'], ['both', 'Email e SMS']])}
      </>;
      case 2: return <>
        <Text style={styles.label}>Email da conta</Text><Text style={styles.readOnly}>{identity.email}</Text>
        {input('phone', 'Telemóvel', { phone: true, required: ['sms', 'both'].includes(text('channel', 1)), placeholder: '+244900000000', limit: 40 })}
        <Text style={styles.hint}>O contacto é declarado por si; este formulário não verifica a sua titularidade. Um número já associado à conta deve ser alterado nas definições de segurança.</Text>
      </>;
      case 3: return <>
        {input('full_name', 'Nome completo', { required: true })}
        {input('dob', 'Data de nascimento', { required: true, placeholder: 'AAAA-MM-DD', limit: 10 })}
        {input('preferred_name', 'Nome preferido')}{input('nationality', 'Nacionalidade')}
        {choices('sex', 'Sexo (opcional)', [['', 'Prefiro não indicar'], ['female', 'Feminino'], ['male', 'Masculino'], ['intersex', 'Intersexo'], ['other', 'Outro']])}
      </>;
      case 4: return <>
        {choices('country', 'País *', [['AO', 'Angola'], ['PT', 'Portugal']])}
        {input('city', 'Cidade')}{input('province', 'Província ou distrito')}{input('address', 'Morada', { limit: 500 })}
      </>;
      case 5: return <>
        <Text style={styles.hint}>Esta etapa é opcional. Pode continuar sem acrescentar dados de saúde.</Text>
        {choices('blood_type', 'Grupo sanguíneo', [['', 'Não indicar'], ['unknown', 'Não sei'], ['A+', 'A+'], ['A-', 'A−'], ['B+', 'B+'], ['B-', 'B−'], ['AB+', 'AB+'], ['AB-', 'AB−'], ['O+', 'O+'], ['O-', 'O−']])}
        {input('allergies', 'Alergias, separadas por vírgulas', { multiline: true, limit: 2000 })}
        {input('chronic', 'Condições crónicas, separadas por vírgulas', { multiline: true, limit: 2000 })}
        {input('medications', 'Medicação atual', { multiline: true, limit: 4000 })}
        {input('surgeries', 'Cirurgias anteriores', { multiline: true, limit: 4000 })}
      </>;
      case 6: return <>
        {input('ec_name', 'Nome do contacto', { required: true })}
        {input('ec_phone', 'Telefone do contacto', { required: true, phone: true, placeholder: '+244900000000', limit: 40 })}
        {input('ec_relation', 'Relação consigo')}{input('ec_alt_phone', 'Telefone alternativo', { phone: true, limit: 40 })}
        {toggle('ec_consent', 'Confirmo que este contacto autorizou ser chamado em caso de emergência.')}
      </>;
      case 7: return <>
        <Text style={styles.label}>Obrigatórios para usar o serviço</Text>
        {REQUIRED_CHOICES.map(([key, label]) => toggle(key, label))}
        <View style={styles.choices}>{legalLink('terms', 'Termos')}{legalLink('privacy', 'Privacidade')}{legalLink('medical-disclaimer', 'Aviso Médico')}</View>
        <Text style={styles.label}>Opcionais — pode recusar</Text>
        {OPTIONAL_CHOICES.map(([key, label]) => toggle(key, label))}
      </>;
      default: return <>
        <Text style={styles.hint}>Ao concluir, o perfil e os cinco consentimentos serão guardados em conjunto. Reveja os dados antes de continuar.</Text>
        {[
          [1, 'Preferências', `${text('language', 1)} · ${text('channel', 1)}`],
          [2, 'Contactos', `${identity.email}\n${text('phone', 2) || 'Telefone não indicado'}`],
          [3, 'Dados pessoais', `${text('full_name', 3)}\n${text('dob', 3)}`],
          [4, 'Localização', `${text('country', 4) === 'PT' ? 'Portugal' : 'Angola'}${text('city', 4) ? ` · ${text('city', 4)}` : ''}`],
          [5, 'Saúde', ['blood_type', 'allergies', 'chronic', 'medications', 'surgeries'].map(key => text(key, 5)).filter(Boolean).join('\n') || 'Sem informação adicional'],
          [6, 'Emergência', `${text('ec_name', 6)}\n${text('ec_phone', 6)}`],
          [7, 'Consentimentos', 'Rever escolhas obrigatórias e opcionais'],
        ].map(([number, title, summary]) => <View key={number} style={styles.review}>
          <View style={{ flex: 1 }}><Text style={styles.label}>{title}</Text><Text style={styles.summary}>{summary}</Text></View>
          <TouchableOpacity disabled={working} onPress={() => move(Number(number))} accessibilityRole="button"><Text style={styles.linkText}>Editar</Text></TouchableOpacity>
        </View>)}
      </>;
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0d9488" /></View>;
  if (!draft) return <View style={styles.center}>
    <Text style={styles.error} accessibilityRole="alert">{error || 'Não foi possível abrir o perfil.'}</Text>
    <TouchableOpacity style={styles.primary} onPress={load}><Text style={styles.primaryText}>Tentar novamente</Text></TouchableOpacity>
    <TouchableOpacity style={styles.secondary} onPress={logout}><Text style={styles.linkText}>Terminar sessão</Text></TouchableOpacity>
  </View>;
  if (patientDraftComplete(draft)) return <View style={styles.center}>
    <Text style={styles.title}>Perfil guardado</Text><Text style={styles.hint}>O perfil foi concluído. Atualize a sessão para continuar.</Text>
    {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
    <TouchableOpacity style={styles.primary} onPress={next} disabled={working}>{working ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Continuar</Text>}</TouchableOpacity>
    <TouchableOpacity style={styles.secondary} onPress={logout} disabled={working}><Text style={styles.linkText}>Terminar sessão</Text></TouchableOpacity>
  </View>;

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.brand}>KAYA · O SEU PERFIL</Text>
      <Text style={styles.hint}>Passo {step} de 8</Text><Text style={styles.title}>{TITLES[step - 1]}</Text>
      <View style={styles.progress}><View style={[styles.progressFill, { width: `${step / 8 * 100}%` }]} /></View>
      {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
      <View style={styles.card}>{body()}</View>
      <Text style={styles.hint} accessibilityLiveRegion="polite">{working ? 'A guardar…' : saved ? 'Guardado.' : 'As alterações são guardadas ao continuar ou ao tocar em Guardar.'}</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondary} onPress={() => move(step - 1)} disabled={working || step === 1}><Text style={[styles.linkText, step === 1 && styles.muted]}>Anterior</Text></TouchableOpacity>
        <TouchableOpacity style={styles.primary} onPress={next} disabled={working}>{working ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{step === 8 ? 'Concluir perfil' : 'Continuar'}</Text>}</TouchableOpacity>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondary} disabled={working} onPress={() => act(() => saveCurrent(false))}><Text style={styles.linkText}>Guardar</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary} disabled={working} onPress={() => act(async () => { await saveCurrent(false); await logout(); })}><Text style={styles.linkText}>Guardar e sair</Text></TouchableOpacity>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0fdfa' }, center: { flex: 1, padding: 28, justifyContent: 'center', backgroundColor: '#f0fdfa' },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 }, brand: { color: '#0f766e', fontSize: 13, fontWeight: '700', marginBottom: 18 },
  title: { fontSize: 26, fontWeight: '700', color: '#0f172a', marginBottom: 12 }, hint: { color: '#475569', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  progress: { height: 5, backgroundColor: '#ccfbf1', borderRadius: 4, marginBottom: 22 }, progressFill: { height: 5, backgroundColor: '#0d9488', borderRadius: 4 },
  card: { backgroundColor: '#fff', padding: 18, borderRadius: 14, marginBottom: 14 }, field: { marginBottom: 18 },
  label: { color: '#0f172a', fontSize: 14, fontWeight: '600', marginBottom: 7 }, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 15, color: '#0f172a', minHeight: 48 },
  multiline: { minHeight: 85, textAlignVertical: 'top' }, readOnly: { fontSize: 15, color: '#334155', paddingVertical: 12, marginBottom: 18 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }, choice: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 11, minHeight: 44, justifyContent: 'center' },
  selected: { borderColor: '#0d9488', backgroundColor: '#ccfbf1' }, choiceText: { color: '#0f172a', fontSize: 14 },
  toggle: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 18 }, toggleLabel: { flex: 1, color: '#334155', fontSize: 14, lineHeight: 20 },
  legalLink: { paddingVertical: 12, marginRight: 6 }, linkText: { color: '#0f766e', fontWeight: '600', fontSize: 14 }, muted: { color: '#94a3b8' },
  error: { color: '#b91c1c', backgroundColor: '#fef2f2', padding: 14, borderRadius: 8, marginBottom: 16, lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }, primary: { backgroundColor: '#0d9488', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 9, alignItems: 'center', minHeight: 48 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 }, secondary: { paddingVertical: 14, paddingHorizontal: 8, minHeight: 48, justifyContent: 'center' },
  review: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }, summary: { color: '#475569', fontSize: 14, lineHeight: 21 },
});
