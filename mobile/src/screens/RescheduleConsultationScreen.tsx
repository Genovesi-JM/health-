import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import type { AppStackParamList } from '../navigation/AppStack';
import { useAuth } from '../contexts/AuthContext';
import api, { sessions } from '../services/api';
import type { AxiosRequestConfig } from 'axios';
import { appointmentDate, appointmentRange, appointmentWindow, APPOINTMENT_MARKETS, type AppointmentCapabilities, type AppointmentSlot } from './appointmentAvailability';
import { newUploadKey } from './patientDocuments';
import type { PatientConsultation } from './consultations';
import { canRescheduleConsultation, createRescheduleAttempt, loadRescheduleConsultation, rescheduleError,
  rescheduleSlots, rescheduleSlotsPath, rescheduleStorageKey, restoreRescheduleAttempt, sendRecoverableReschedule,
  type RescheduleAttempt } from './appointmentRescheduling';

export default function RescheduleConsultationScreen() {
  const { user } = useAuth();
  const owner = user?.id || null;
  const { params: { consultationId } } = useRoute<RouteProp<AppStackParamList, 'RescheduleConsultation'>>();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [consultation, setConsultation] = useState<PatientConsultation | null>(null);
  const [capabilities, setCapabilities] = useState<AppointmentCapabilities | null>(null);
  const [pending, setPending] = useState<RescheduleAttempt | null>(null);
  const [recoveryError, setRecoveryError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const active = useRef(false);
  const busy = useRef(false);
  const view = useRef(0);
  const slotRequest = useRef(0);
  const anchor = useRef(Date.now());
  const window = appointmentWindow(page, anchor.current, capabilities?.max_window_days, capabilities?.max_publish_days);

  const load = useCallback(async () => {
    if (busy.current || !owner) return;
    const version = ++view.current;
    const sessionVersion = sessions.version();
    setLoading(true); setError(''); setRecoveryError(''); setSelected(null);
    const [saved, current, caps] = await Promise.allSettled([
      SecureStore.getItemAsync(rescheduleStorageKey(owner, consultationId)),
      loadRescheduleConsultation(api, consultationId),
      api.get<AppointmentCapabilities>('/api/v1/appointments/capabilities'),
    ]);
    if (!active.current || version !== view.current || !sessions.current(sessionVersion)) return;
    try {
      if (saved.status !== 'fulfilled') throw saved.reason;
      setPending(restoreRescheduleAttempt(saved.value, consultationId));
    } catch { setRecoveryError('Não foi possível verificar a alteração anterior. Tente atualizar antes de iniciar outro pedido.'); }
    if (current.status === 'fulfilled') setConsultation(current.value);
    else { setConsultation(null); setError(rescheduleError(current.reason, 'Não foi possível confirmar a consulta atual.')); }
    setCapabilities(caps.status === 'fulfilled' ? caps.value.data : null);
    if (caps.status !== 'fulfilled') setError('Não foi possível atualizar a disponibilidade. Um pedido já guardado pode ser repetido com a mesma identidade.');
    setLoading(false);
  }, [owner, consultationId]);

  useFocusEffect(useCallback(() => {
    active.current = true; void load();
    const remove = navigation.addListener('beforeRemove', event => {
      if (busy.current) { event.preventDefault(); Alert.alert('Aguarde', 'A alteração ainda está em curso.'); }
    });
    return () => { active.current = false; view.current++; slotRequest.current++; remove(); };
  }, [load, navigation]));

  useFocusEffect(useCallback(() => {
    const version = ++slotRequest.current;
    setSlots([]); setSelected(null); setSlotsError('');
    if (!consultation || !canRescheduleConsultation(consultation) || pending || loading || recoveryError || !capabilities?.enabled) {
      setSlotsLoading(false); return;
    }
    setSlotsLoading(true);
    api.get<AppointmentSlot[]>(rescheduleSlotsPath(consultation, window)).then(response => {
      if (active.current && version === slotRequest.current) setSlots(rescheduleSlots(response.data, consultation));
    }).catch(failure => {
      if (active.current && version === slotRequest.current) setSlotsError(rescheduleError(failure, 'Não foi possível consultar os horários. Atualize para tentar novamente.'));
    }).finally(() => { if (active.current && version === slotRequest.current) setSlotsLoading(false); });
    return () => { slotRequest.current++; };
  }, [consultation, pending, loading, recoveryError, capabilities?.enabled, window.from_at, window.to_at]));

  const send = async (attempt: RescheduleAttempt) => {
    if (!active.current || busy.current || !owner || recoveryError) return;
    busy.current = true; setSaving(true); setError(''); setPending(attempt);
    const version = view.current;
    const sessionVersion = sessions.version();
    const currentView = () => active.current && view.current === version && sessions.current(sessionVersion);
    try {
      const scopedApi = { post: (path: string, payload: RescheduleAttempt['payload'], options: { headers: Record<string, string> }) => {
        const config: AxiosRequestConfig & { _sessionVersion: number } = { ...options, _sessionVersion: sessionVersion };
        return api.post<PatientConsultation>(path, payload, config);
      } };
      const result = await sendRecoverableReschedule(scopedApi, SecureStore, owner, attempt);
      if (!currentView()) return;
      setPending(null);
      if (result.kind === 'success') {
        Alert.alert('Resultado confirmado', 'Consulte o horário atual da consulta. Uma alteração guardada fica a aguardar nova aceitação do médico.');
        busy.current = false; setSaving(false);
        navigation.replace('ConsultationDetail', { consultationId });
      } else {
        setError(result.message); setConsultation(null); setSelected(null);
      }
    } catch (failure) {
      if (currentView()) setError(rescheduleError(failure, 'Não foi possível confirmar o resultado. O pedido exato foi mantido; repita-o para recuperar o resultado.'));
    } finally {
      busy.current = false;
      if (currentView()) setSaving(false);
    }
  };

  const confirm = () => {
    if (saving || loading || recoveryError) return;
    if (pending) { void send(pending); return; }
    const slot = slots.find(item => item.id === selected);
    if (!consultation || !slot || slotsLoading || slotsError) return;
    const version = view.current;
    const sessionVersion = sessions.version();
    Alert.alert('Pedir alteração de horário?', `Atual: ${appointmentDate(consultation.scheduled_at, consultation.timezone)}\nNovo: ${appointmentRange(slot)}\n\nO horário atual só é substituído quando a alteração é guardada. O novo horário fica a aguardar aceitação do mesmo médico.`, [
      { text: 'Manter horário', style: 'cancel' },
      { text: 'Pedir alteração', onPress: () => {
        if (!active.current || version !== view.current || !sessions.current(sessionVersion) || busy.current) return;
        try { void send(createRescheduleAttempt(consultation, slot, newUploadKey())); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Atualize os horários.'); }
      } },
    ]);
  };

  const eligible = canRescheduleConsultation(consultation);
  const locked = saving || loading || !!pending || !!recoveryError;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Alterar horário</Text>
    <Text style={styles.body}>Escolha outro horário do mesmo médico e no mesmo país. A alteração exige nova aceitação; não confirma atendimento imediato.</Text>
    {(loading || saving) && <ActivityIndicator color="#0d9488" />}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!!recoveryError && <Text accessibilityRole="alert" style={styles.error}>{recoveryError}</Text>}
    <Button label="Atualizar consulta e horários" disabled={saving} onPress={() => void load()} />
    {consultation && <View style={styles.card}>
      <Text style={styles.heading}>Marcação atual</Text>
      <Text style={styles.body}>{appointmentDate(consultation.scheduled_at, consultation.timezone)}</Text>
      {consultation.country && <Text style={styles.body}>{APPOINTMENT_MARKETS[consultation.country]}</Text>}
    </View>}
    {pending ? <View style={styles.card}>
      <Text style={styles.heading}>Alteração por confirmar</Text>
      <Text style={styles.body}>{pending.selected.doctor_name} · {APPOINTMENT_MARKETS[pending.selected.country]}</Text>
      <Text style={styles.body}>{appointmentRange(pending.selected)}</Text>
      <Text style={styles.body}>O horário pode já ter mudado. Repita o pedido guardado para recuperar o resultado; o mesmo pedido pode ser guardado agora se o envio anterior não chegou ao serviço. Não escolha outro horário enquanto este resultado estiver por confirmar.</Text>
      <Button label="Repetir pedido guardado" disabled={saving || loading || !!recoveryError} onPress={confirm} />
    </View> : !loading && !recoveryError && <>
      {!eligible ? <Text style={styles.body}>Só pode alterar uma consulta pedida ou confirmada, com médico e país conhecidos. Consultas pagas ou associadas a um pagamento não permitem esta alteração.</Text>
        : !capabilities?.enabled ? <Text style={styles.body}>A alteração de horários não está disponível neste momento.</Text> : <>
          <Text style={styles.heading}>Horários publicados</Text>
          <Text style={styles.body}>{window.label}</Text>
          <View style={styles.row}>
            <Button label="Anterior" disabled={locked || page <= 0} onPress={() => setPage(value => value - 1)} />
            <Button label="Seguinte" disabled={locked || page >= window.lastPage} onPress={() => setPage(value => value + 1)} />
          </View>
          {slotsLoading && <ActivityIndicator color="#0d9488" />}
          {!!slotsError && <Text accessibilityRole="alert" style={styles.error}>{slotsError}</Text>}
          {!slotsLoading && !slotsError && slots.length === 0 && <Text style={styles.body}>Não há horários publicados disponíveis neste período. Consulte outro período ou atualize mais tarde.</Text>}
          {slots.map(slot => <TouchableOpacity key={slot.id} accessibilityRole="button" accessibilityState={{ selected: selected === slot.id, disabled: locked }}
            disabled={locked} onPress={() => setSelected(slot.id)} style={[styles.card, selected === slot.id && styles.selected]}>
            <Text style={styles.heading}>{slot.doctor_name}</Text><Text style={styles.body}>{appointmentRange(slot)}</Text>
          </TouchableOpacity>)}
          <Button label="Confirmar novo pedido de horário" disabled={locked || slotsLoading || !!slotsError || !selected} onPress={confirm} />
        </>}
    </>}
  </ScrollView>;
}

function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' }, content: { padding: 20, gap: 14, paddingBottom: 44 },
  title: { color: '#0f172a', fontSize: 25, fontWeight: '700' }, heading: { color: '#0f172a', fontSize: 16, fontWeight: '700' },
  body: { color: '#475569', fontSize: 14, lineHeight: 22 }, error: { color: '#991b1b', backgroundColor: '#fef2f2', padding: 12, lineHeight: 22 },
  card: { backgroundColor: '#fff', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 12, padding: 16, gap: 10 }, selected: { borderColor: '#0d9488', backgroundColor: '#f0fdfa' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, button: { padding: 13, backgroundColor: '#0d9488', borderRadius: 9 },
  buttonText: { color: '#fff', fontWeight: '700', textAlign: 'center' }, disabled: { opacity: 0.45 },
});
