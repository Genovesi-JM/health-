import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, AppState, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import type { AppStackParamList } from '../navigation/AppStack';
import { useAuth } from '../contexts/AuthContext';
import api, { sessions } from '../services/api';
import { requireCurrentCareConsent } from './consents';
import { createRenewalHistory, emptyRenewalHistory, newRenewalPending, parseRenewalDoctors, readRenewalPending, recoverRenewal, renewalAccessLost, renewalCountryName, renewalDoctorsPath, renewalError, renewalMatches, renewalNotCommitted, renewalPayload, RENEWAL_STATUS, submitRenewal } from './prescriptionRequests';
import type { RenewalCountry, RenewalDoctor, RenewalPayload, RenewalPending, RenewalRequest } from './prescriptionRequests';

export default function PrescriptionRequestScreen() {
  const { user } = useAuth();
  return <RenewalWorkspace key={`${user?.id}:${user?.role}`} owner={user?.id ?? ''} />;
}
function RenewalWorkspace({ owner }: { owner: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [country, setCountry] = useState<RenewalCountry>('AO');
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState<RenewalDoctor[]>([]);
  const [doctorLoading, setDoctorLoading] = useState(true);
  const [doctorError, setDoctorError] = useState('');
  const [medication, setMedication] = useState('');
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState('');
  const [reason, setReason] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState<RenewalPending | null>(null);
  const [bodyInMemory, setBodyInMemory] = useState<RenewalPayload | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(true);
  const [recoveryError, setRecoveryError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [accessLost, setAccessLost] = useState(false);
  const [history, setHistory] = useState(emptyRenewalHistory);
  const focused = useRef(false), denied = useRef(false), busy = useRef(false);
  const generation = useRef(0), doctorSequence = useRef(0), recoverySequence = useRef(0);
  const version = useRef(sessions.version());
  const countryRef = useRef(country); countryRef.current = country;
  const denyRef = useRef<() => void>(() => {});
  const pager = useRef(createRenewalHistory(setHistory, () => denyRef.current()));
  const current = useCallback(() => focused.current && !!owner && sessions.current(version.current), [owner]);
  const config = useCallback((): AxiosRequestConfig & { _sessionVersion: number } => ({ _sessionVersion: version.current }), []);
  const client = useCallback(() => ({ get: (path: string) => api.get(path, config()), post: (path: string, body: unknown, options: { headers: Record<string, string> }) => api.post(path, body, { ...config(), ...options }) }), [config]);
  const deny = useCallback(() => {
    denied.current = true; ++generation.current; ++doctorSequence.current; ++recoverySequence.current;
    setAccessLost(true); setDoctors([]); setDoctorId(''); setDoctorLoading(false); setRecoveryLoading(false);
    setMedication(''); setDose(''); setFrequency(''); setReason(''); setBodyInMemory(null); setPending(null); setNotice('');
    pager.current.clearAccess();
  }, []);
  denyRef.current = deny;
  const loadDoctors = useCallback(async () => {
    if (!current() || denied.current) return;
    const scope = countryRef.current; const sequence = ++doctorSequence.current; const epoch = generation.current;
    setDoctorLoading(true); setDoctorError(''); setDoctors([]); setDoctorId('');
    try {
      const response = await client().get(renewalDoctorsPath(scope));
      if (!current() || epoch !== generation.current || sequence !== doctorSequence.current || scope !== countryRef.current) return;
      setDoctors(parseRenewalDoctors(response.data, scope));
    } catch (failure) {
      if (!current() || epoch !== generation.current || sequence !== doctorSequence.current) return;
      if (renewalAccessLost(failure)) deny();
      setDoctorError('Não foi possível confirmar os médicos disponíveis. Atualize antes de escolher.');
    } finally { if (current() && epoch === generation.current && sequence === doctorSequence.current) setDoctorLoading(false); }
  }, [client, current, deny]);
  const restore = useCallback(async () => {
    if (!current() || denied.current) return;
    const sequence = ++recoverySequence.current; const epoch = generation.current;
    setRecoveryLoading(true); setRecoveryError('');
    try {
      const saved = await readRenewalPending(SecureStore, owner);
      if (!current() || epoch !== generation.current || sequence !== recoverySequence.current) return;
      setPending(saved);
      setBodyInMemory(previous => saved && previous && renewalMatches(saved, previous) ? previous : null);
      if (saved) { setCountry(saved.country); countryRef.current = saved.country; setShowForm(true); }
    } catch {
      if (current() && epoch === generation.current && sequence === recoverySequence.current) setRecoveryError('Não foi possível ler a referência guardada. Verifique o armazenamento antes de enviar outro pedido.');
    } finally { if (current() && epoch === generation.current && sequence === recoverySequence.current) setRecoveryLoading(false); }
  }, [current, owner]);
  const refresh = useCallback(async (explicit = false) => {
    if (!current() || busy.current || denied.current && !explicit) return;
    const epoch = generation.current;
    if (!denied.current) await restore();
    if (!current() || epoch !== generation.current) return;
    await pager.current.load(client());
    if (!current() || epoch !== generation.current || pager.current.snapshot().accessLost || pager.current.snapshot().error) return;
    denied.current = false; setAccessLost(false);
    await restore();
    if (!current() || epoch !== generation.current) return;
    await loadDoctors();
  }, [client, current, loadDoctors, restore]);
  useFocusEffect(useCallback(() => {
    focused.current = true; pager.current.activate(owner);
    if (!busy.current) setSaving(false);
    void refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { focused.current = false; ++generation.current; ++doctorSequence.current; ++recoverySequence.current; pager.current.deactivate(); subscription.remove(); };
  }, [owner, refresh]));
  const chooseCountry = (next: RenewalCountry) => {
    if (pending || busy.current || recoveryLoading || recoveryError) return;
    countryRef.current = next; setCountry(next); setDoctorId(''); setDoctors([]); setNotice(''); void loadDoctors();
  };
  const afterReceipt = async (row: RenewalRequest, epoch: number) => {
    if (!current() || epoch !== generation.current) return;
    setNotice(`Pedido confirmado: ${RENEWAL_STATUS[row.status]}. Consulte a decisão no histórico.`);
    setBodyInMemory(null); setMedication(''); setDose(''); setFrequency(''); setReason('');
    pager.current.accept(row);
    const saved = await readRenewalPending(SecureStore, owner);
    if (!current() || epoch !== generation.current) return;
    setPending(saved); setShowForm(!!saved);
    if (saved) setRecoveryError('O servidor confirmou o pedido, mas a referência local ainda precisa de confirmação. Verifique o pedido guardado antes de criar outro.');
  };
  const run = async (lookup: boolean, frozenBody?: RenewalPayload) => {
    if (!current() || denied.current || busy.current || recoveryLoading || !lookup && recoveryError) return;
    const epoch = generation.current;
    const assertCurrent = () => { sessions.assertCurrent(version.current); if (!current() || epoch !== generation.current) throw new Error('Reabra os pedidos na sessão atual para continuar.'); };
    let attempt = pending;
    busy.current = true; setSaving(true); setActionError(''); setNotice('');
    try {
      if (lookup) {
        if (!attempt) return;
        const row = await recoverRenewal(client(), SecureStore, attempt, assertCurrent);
        if (row) await afterReceipt(row, epoch);
        else setActionError('Ainda não há um pedido confirmado com esta referência. O envio anterior pode continuar em curso. A referência foi mantida; não crie um novo pedido para substituir este.');
      } else {
        const payload = frozenBody ?? bodyInMemory ?? renewalPayload({ doctor_id: pending?.doctor_id ?? doctorId, country: pending?.country ?? country, medication_name: medication, dose, frequency, reason });
        if (!attempt) {
          if (doctorLoading || doctorError || !doctors.some(doctor => doctor.id === payload.doctor_id && doctor.practice_country === payload.country)) throw new Error('Atualize os médicos e escolha explicitamente um médico para este país.');
          await requireCurrentCareConsent(client(), payload.country, assertCurrent);
          assertCurrent();
          attempt = newRenewalPending(owner, payload); setPending(attempt); setBodyInMemory(payload);
        } else if (!renewalMatches(attempt, payload)) throw new Error('Os dados não correspondem ao pedido original. Reintroduza exatamente os dados anteriores para repetir com a mesma referência.');
        const row = await submitRenewal(client(), SecureStore, attempt, payload, assertCurrent);
        await afterReceipt(row, epoch);
      }
    } catch (failure) {
      if (!current() || epoch !== generation.current) return;
      if (renewalAccessLost(failure)) { deny(); setActionError('O acesso mudou. Atualize o acesso para recuperar a referência guardada.'); return; }
      try {
        const saved = await readRenewalPending(SecureStore, owner); assertCurrent(); setPending(saved);
        if (!saved) { setBodyInMemory(null); if (renewalNotCommitted(failure)) { setDoctors([]); setDoctorId(''); setDoctorError('O pedido não foi guardado. Atualize os médicos e reveja os consentimentos antes de escolher novamente.'); } }
        setActionError(renewalError(failure, saved ? 'O resultado não foi confirmado. Verifique ou repita o mesmo pedido; a referência original foi mantida.' : 'Não foi possível guardar ou enviar o pedido.'));
      } catch { if (current() && epoch === generation.current) { setRecoveryError('Não foi possível confirmar a referência no armazenamento. Não inicie outro pedido.'); setPending(attempt); } }
    } finally { busy.current = false; if (current()) setSaving(false); }
  };
  const submit = () => {
    if (busy.current || accessLost) return;
    if (pending) { void run(false); return; }
    let payload: RenewalPayload;
    try { payload = renewalPayload({ doctor_id: doctorId, country, medication_name: medication, dose, frequency, reason }); }
    catch (failure) { setActionError(renewalError(failure, 'Reveja os dados do pedido.')); return; }
    const epoch = generation.current;
    Alert.alert('Enviar pedido de avaliação?', `País: ${renewalCountryName(country)}. Médico: ${doctors.find(doctor => doctor.id === doctorId)?.display_name ?? 'Médico selecionado'}. Este pedido não é uma receita emitida.`, [
      { text: 'Voltar', style: 'cancel' }, { text: 'Enviar pedido', onPress: () => { if (current() && epoch === generation.current) void run(false, payload); } },
    ]);
  };
  const locked = saving || accessLost || recoveryLoading || !!recoveryError;
  const textLocked = locked || !!pending && !!bodyInMemory;
  const header = <>
    <Text style={styles.title2}>Pedidos de renovação</Text>
    <Text style={styles.intro}>O médico analisa o pedido e pode pedir consulta ou exames. O envio não emite uma receita nem autoriza alterações ao tratamento.</Text>
    <TouchableOpacity accessibilityRole="button" onPress={() => void refresh(true)} disabled={saving || history.loading}><Text style={styles.link}>Atualizar pedidos e acesso</Text></TouchableOpacity>
    {accessLost && <Text accessibilityRole="alert" style={styles.error}>O acesso mudou. Os dados foram ocultados. A referência mínima foi mantida para recuperação na mesma conta.</Text>}
    {history.error ? <Text accessibilityRole="alert" style={styles.error}>{history.error}</Text> : null}
    {recoveryError ? <Text accessibilityRole="alert" style={styles.error}>{recoveryError}</Text> : null}
    {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}
    {notice ? <Text accessibilityRole="alert" style={styles.intro}>{notice}</Text> : null}
    {(history.loading || recoveryLoading) && <ActivityIndicator color="#0d9488" />}
    {pending && !accessLost && <View style={styles.form}>
      <Text style={styles.cardMed}>Pedido por confirmar · {renewalCountryName(pending.country)}</Text>
      <Text style={styles.intro}>Foi guardada uma referência de recuperação, sem o medicamento, dose ou motivo. Verifique primeiro se o pedido já foi registado. Um resultado vazio não prova que o envio falhou.</Text>
      <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => void run(true)}><Text style={styles.link}>Verificar pedido guardado</Text></TouchableOpacity>
      {!bodyInMemory && <Text style={styles.intro}>Para repetir, reintroduza exatamente o medicamento, a dose, a frequência e o motivo originais. O médico e o país guardados serão mantidos. Só será enviada a mesma referência se os dados coincidirem.</Text>}
    </View>}
    {!accessLost && <>
      <TouchableOpacity style={styles.addBtn} disabled={locked || !!pending} onPress={() => setShowForm(previous => !previous)}><Text style={styles.addBtnText}>{showForm ? 'Fechar formulário' : 'Novo pedido'}</Text></TouchableOpacity>
      {(showForm || pending) && <View style={styles.form}>
        <Text style={styles.formLabel}>País do pedido · documentos em Português</Text>
        <View style={styles.options}>{(['AO','PT'] as const).map(item => <TouchableOpacity key={item} accessibilityRole="button" accessibilityState={{ selected: country === item }} disabled={locked || !!pending} style={[styles.option, country === item && styles.selected]} onPress={() => chooseCountry(item)}><Text>{renewalCountryName(item)}</Text></TouchableOpacity>)}</View>
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('ConsentGate', { country: pending?.country ?? country })}><Text style={styles.link}>Rever consentimentos deste país</Text></TouchableOpacity>
        {!pending && <>
          <Text style={styles.formLabel}>Escolha um médico</Text>
          {doctorLoading ? <ActivityIndicator color="#0d9488" /> : doctorError ? <Text accessibilityRole="alert" style={styles.error}>{doctorError}</Text> : doctors.length === 0 ? <Text style={styles.intro}>Não há médicos atualmente disponíveis para este país.</Text> : doctors.map(doctor => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: doctorId === doctor.id }} disabled={locked} key={doctor.id} style={[styles.option, doctorId === doctor.id && styles.selected]} onPress={() => setDoctorId(doctor.id)}><Text>{[doctor.title, doctor.display_name || 'Médico', doctor.specialization].filter(Boolean).join(' · ')}</Text></TouchableOpacity>)}
          <TouchableOpacity disabled={saving || doctorLoading} onPress={() => void loadDoctors()}><Text style={styles.link}>Atualizar médicos</Text></TouchableOpacity>
        </>}
        <TextInput accessibilityLabel="Medicamento" editable={!textLocked} maxLength={300} style={styles.input} placeholder="Medicamento" value={medication} onChangeText={setMedication} />
        <TextInput accessibilityLabel="Dose atual" editable={!textLocked} maxLength={100} style={styles.input} placeholder="Dose atual (opcional)" value={dose} onChangeText={setDose} />
        <TextInput accessibilityLabel="Frequência atual" editable={!textLocked} maxLength={100} style={styles.input} placeholder="Frequência atual (opcional)" value={frequency} onChangeText={setFrequency} />
        <TextInput accessibilityLabel="Motivo do pedido" editable={!textLocked} maxLength={4000} multiline style={[styles.input, styles.notes]} placeholder="Motivo do pedido (opcional)" value={reason} onChangeText={setReason} />
        <TouchableOpacity accessibilityRole="button" disabled={locked || !pending && (doctorLoading || !!doctorError || !doctorId)} style={styles.submitBtn} onPress={submit}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{pending ? 'Repetir o mesmo pedido' : 'Rever e enviar pedido'}</Text>}</TouchableOpacity>
      </View>}
    </>}
    <Text style={styles.sectionTitle}>Histórico pessoal · todos os países</Text>
    <Text style={styles.intro}>O histórico continua disponível após retirar consentimentos. {history.items.length > 0 ? `${history.items.length} pedidos carregados${history.cursor ? ' · há mais registos' : ''}.` : ''}</Text>
  </>;
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><FlatList
    contentContainerStyle={styles.inner} data={history.items} keyExtractor={item => item.id} ListHeaderComponent={header}
    refreshControl={<RefreshControl refreshing={history.loading} onRefresh={() => void refresh(true)} tintColor="#0d9488" />}
    ListEmptyComponent={history.loaded && !history.loading && !history.error ? <Text style={styles.intro}>Ainda não há pedidos nesta lista.</Text> : null}
    ListFooterComponent={<>{history.loadingMore && <ActivityIndicator color="#0d9488" />}{history.cursor && !history.restartRequired && <TouchableOpacity disabled={saving || history.loading || history.loadingMore || accessLost} onPress={() => void pager.current.load(client(), true)}><Text style={styles.link}>Carregar mais pedidos</Text></TouchableOpacity>}{history.restartRequired && <TouchableOpacity disabled={saving} onPress={() => void refresh(true)}><Text style={styles.link}>Recomeçar histórico</Text></TouchableOpacity>}</>}
    renderItem={({ item }) => <View style={styles.card}>
      <Text style={styles.cardMed}>{item.medication_name}</Text><Text style={styles.status}>{RENEWAL_STATUS[item.status]}</Text>
      <Text style={styles.intro}>{renewalCountryName(item.country)}{item.doctor_name ? ` · ${item.doctor_name}` : ''}</Text>
      <Text style={styles.intro}>{[item.dose,item.frequency].filter(Boolean).join(' · ')}</Text>
      {item.reason && <Text style={styles.intro}>Motivo apresentado: {item.reason}</Text>}
      {item.decision_state === 'legacy_review_required' && <Text style={styles.error}>Registo anterior que exige confirmação da equipa. Não comprova uma receita válida.</Text>}
      {(item.adjusted_dose || item.adjusted_frequency) && <Text style={styles.intro}>Ajuste registado pelo médico: {[item.adjusted_dose,item.adjusted_frequency].filter(Boolean).join(' · ')}</Text>}
      {item.doctor_note && <Text style={styles.intro}>Nota do médico: {item.doctor_note}</Text>}
      {['approved','adjusted'].includes(item.status) && <Text style={styles.intro}>Consulte a receita formal e as orientações do médico antes de alterar a medicação. Este registo de pedido não é um documento de dispensa.</Text>}
      <Text style={styles.date}>Pedido: {new Date(item.created_at).toLocaleString('pt-PT')}{item.decided_at ? ` · Decisão: ${new Date(item.decided_at).toLocaleString('pt-PT')}` : ''}</Text>
    </View>} /></KeyboardAvoidingView>;
}
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:'#f0fdfb'},inner:{padding:20,paddingBottom:40},title2:{fontSize:22,fontWeight:'700',color:'#0f172a',marginBottom:12},sectionTitle:{fontSize:18,fontWeight:'700',marginVertical:16,color:'#0f172a'},intro:{fontSize:14,lineHeight:21,color:'#475569',marginVertical:6},link:{fontSize:14,color:'#0f766e',fontWeight:'600',paddingVertical:10},error:{color:'#991b1b',lineHeight:21,marginVertical:8},form:{backgroundColor:'#fff',padding:16,borderRadius:12,borderWidth:1,borderColor:'#e2e8f0',marginVertical:14},formLabel:{fontWeight:'600',marginVertical:8,color:'#334155'},options:{flexDirection:'row',gap:8},option:{padding:12,borderWidth:1,borderColor:'#cbd5e1',borderRadius:8,marginVertical:4},selected:{backgroundColor:'#ccfbf1',borderColor:'#0d9488'},input:{borderWidth:1,borderColor:'#cbd5e1',borderRadius:8,padding:12,marginTop:10,color:'#0f172a',backgroundColor:'#f8fafc'},notes:{height:90,textAlignVertical:'top'},addBtn:{backgroundColor:'#0d9488',borderRadius:8,padding:12,alignSelf:'flex-start',marginVertical:10},addBtnText:{color:'#fff',fontWeight:'600'},submitBtn:{backgroundColor:'#0d9488',padding:14,borderRadius:8,alignItems:'center',marginTop:12},submitBtnText:{color:'#fff',fontWeight:'600'},card:{backgroundColor:'#fff',padding:16,borderRadius:12,borderWidth:1,borderColor:'#e2e8f0',marginBottom:12},cardMed:{fontSize:16,fontWeight:'700',color:'#0f172a'},status:{fontWeight:'600',color:'#0f766e',marginVertical:6},date:{fontSize:12,color:'#64748b',marginTop:8},
});
