import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { AppStackParamList } from '../navigation/AppStack';
import { useAuth } from '../contexts/AuthContext';
import api, { sessions } from '../services/api';
import type { AxiosRequestConfig } from 'axios';
import { consultationError } from './consultations';
import {
  APPOINTMENT_MARKETS, APPOINTMENT_SPECIALTIES, appointmentRange, appointmentSlotsPath, appointmentWindow, availableSlots,
  bookingConflict, bookingStorageKey, createBookingAttempt, definitiveBookingFailure,
  restoreBookingAttempt, sendRecoverableBooking,
  type AppointmentCapabilities, type AppointmentCountry, type AppointmentSlot, type BookingAttempt,
} from './appointmentAvailability';

export default function BookConsultationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const [country, setCountry] = useState<AppointmentCountry>('AO');
  const [specialty, setSpecialty] = useState('clinica_geral');
  const [mode, setMode] = useState<'slot' | 'queue'>('slot');
  const [windowPage, setWindowPage] = useState(0);
  const [doctorId, setDoctorId] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [capabilities, setCapabilities] = useState<AppointmentCapabilities | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [slotsError, setSlotsError] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<BookingAttempt | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(true);
  const [recoveryError, setRecoveryError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const active = useRef(false);
  const slotRequest = useRef(0);
  const catalogRequest = useRef(0);
  const windowAnchor = useRef(Date.now());
  const storageKey = user?.id ? bookingStorageKey(user.id) : null;
  const window = appointmentWindow(windowPage, windowAnchor.current, capabilities?.max_window_days, capabilities?.max_publish_days);

  const loadSlots = useCallback(async () => {
    const request = ++slotRequest.current;
    setSlotsLoading(true);
    setSlotsError('');
    setSlots([]);
    setSelectedSlot(null);
    try {
      const response = await api.get<AppointmentSlot[]>(appointmentSlotsPath(country, specialty, window));
      if (!active.current || request !== slotRequest.current) return;
      setSlots(availableSlots(response.data, country, specialty));
    } catch (failure) {
      if (!active.current || request !== slotRequest.current) return;
      setSlotsError(consultationError(failure, 'Não foi possível consultar os horários. Tente novamente.'));
    } finally {
      if (active.current && request === slotRequest.current) setSlotsLoading(false);
    }
  }, [country, specialty, window.from_at, window.to_at]);

  const loadCapabilities = useCallback(async () => {
    const request = ++catalogRequest.current;
    setCatalogLoading(true);
    setCatalogError('');
    setCapabilities(null);
    try {
      const response = await api.get<AppointmentCapabilities>('/api/v1/appointments/capabilities');
      if (active.current && request === catalogRequest.current) setCapabilities(response.data);
    } catch (failure) {
      if (active.current && request === catalogRequest.current) {
        setCatalogError(consultationError(failure, 'Não foi possível confirmar a disponibilidade das marcações.'));
      }
    } finally {
      if (active.current && request === catalogRequest.current) setCatalogLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    active.current = true;
    void loadCapabilities();
    return () => {
      active.current = false;
      catalogRequest.current++;
      slotRequest.current++;
    };
  }, [loadCapabilities]));

  useFocusEffect(useCallback(() => {
    let current = true;
    setRecoveryLoading(true);
    setRecoveryError('');
    setPending(null);
    (async () => {
      try {
        if (!storageKey) throw new Error('Sessão indisponível.');
        const attempt = restoreBookingAttempt(await SecureStore.getItemAsync(storageKey));
        if (!current) return;
        setPending(attempt);
        if (attempt) {
          setCountry(attempt.payload.country);
          setSpecialty(attempt.payload.specialty);
          setMode(attempt.payload.slot_id ? 'slot' : 'queue');
        }
      } catch {
        if (current) setRecoveryError('Não foi possível verificar se existe um pedido anterior. Tente novamente antes de criar outra marcação.');
      } finally {
        if (current) setRecoveryLoading(false);
      }
    })();
    return () => { current = false; };
  }, [storageKey]));

  useFocusEffect(useCallback(() => {
    void loadSlots();
    return () => { slotRequest.current++; };
  }, [loadSlots]));

  const handleBook = async () => {
    if (busy.current || !user?.id || !storageKey || recoveryLoading || recoveryError || !capabilities?.enabled) return;
    if (!pending && !capabilities.markets.some(market => market.country === country)) return;
    busy.current = true;
    setSaving(true);
    setError('');
    let attempt = pending;
    const previouslySent = !!pending;
    const sessionVersion = sessions.version();
    try {
      if (!attempt) {
        const slot = slots.find(item => item.id === selectedSlot);
        if (mode === 'slot' && (!slot || slotsLoading || slotsError)) throw new Error('Atualize os horários e escolha uma opção disponível.');
        attempt = createBookingAttempt(country, specialty, mode === 'slot' ? slot : undefined);
        setPending(attempt);
      }
      const scopedApi = { post: (path: string, payload: BookingAttempt['payload'], options: { headers: Record<string, string> }) =>
        api.post(path, payload, { ...options, _sessionVersion: sessionVersion } as AxiosRequestConfig) };
      const consultation = await sendRecoverableBooking(scopedApi, SecureStore, user.id, attempt, previouslySent);
      if (!sessions.current(sessionVersion)) return;
      setPending(null);
      if (active.current) navigation.replace('ConsultationDetail', { consultationId: consultation.id });
    } catch (failure) {
      if (!sessions.current(sessionVersion)) return;
      const definitive = attempt && definitiveBookingFailure(failure, previouslySent);
      if (definitive) setPending(null);
      if (active.current) {
        if (bookingConflict(failure)) {
          setError(consultationError(failure, 'O horário ou o seu pedido mudou. Consulte os horários atualizados e escolha novamente.'));
          setDoctorId('');
          await loadSlots();
        } else {
          setError(consultationError(failure, attempt && !definitive
            ? 'Não foi possível confirmar o pedido. Pode repetir o mesmo pedido com segurança ou verificar As minhas consultas.'
            : 'Não foi possível preparar ou enviar o pedido. Tente novamente.'));
        }
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const locked = saving || recoveryLoading || !!recoveryError || !!pending;
  const ready = capabilities?.enabled && capabilities.markets.some(market => market.country === country);
  const doctors = Array.from(new Map(slots.map(slot => [slot.doctor_id, slot.doctor_name])).entries());
  const visibleSlots = slots.filter(slot => !doctorId || slot.doctor_id === doctorId);
  const chosen = slots.find(slot => slot.id === selectedSlot);
  const canBook = !saving && !recoveryLoading && !recoveryError && capabilities?.enabled &&
    (pending || (ready && (mode === 'queue' || (!slotsLoading && !slotsError && chosen))));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Text style={styles.subtitle}>Escolha um horário publicado por um médico ou faça um pedido sem horário. A consulta só fica confirmada após aceitação do médico.</Text>
      {(catalogLoading || recoveryLoading) && <ActivityIndicator color={TEAL} />}
      {!!catalogError && <View accessibilityRole="alert">
        <Text style={styles.error}>{catalogError}</Text>
        <TouchableOpacity disabled={saving} accessibilityRole="button" onPress={() => void loadCapabilities()}><Text style={styles.link}>Tentar novamente</Text></TouchableOpacity>
      </View>}
      {capabilities && !capabilities.enabled && <Text accessibilityRole="alert" style={styles.error}>As marcações ainda não estão disponíveis.</Text>}
      {!!recoveryError && <View accessibilityRole="alert"><Text style={styles.error}>{recoveryError}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Consultations')}><Text style={styles.link}>Ver As minhas consultas</Text></TouchableOpacity>
      </View>}
      {pending && <View style={styles.notice} accessibilityRole="alert">
        <Text style={styles.body}>Existe um pedido por confirmar: {APPOINTMENT_MARKETS[pending.payload.country]}, {APPOINTMENT_SPECIALTIES.find(item => item.code === pending.payload.specialty)?.label}. {pending.payload.slot_id ? 'Foi escolhido um horário.' : 'Pedido sem horário.'}</Text>
        <Text style={styles.body}>Repita o mesmo pedido para recuperar o resultado. O país, a especialidade e o horário ficam guardados até confirmar o resultado.</Text>
      </View>}
      <Text style={styles.label}>País de atendimento</Text>
      <View style={styles.chips}>
        {(Object.entries(APPOINTMENT_MARKETS) as [AppointmentCountry, string][]).map(([code, label]) => <TouchableOpacity key={code}
          accessibilityRole="button" accessibilityState={{ selected: country === code }} disabled={locked}
          style={[styles.chip, country === code && styles.chipSelected]}
          onPress={() => { setCountry(code); setDoctorId(''); setSelectedSlot(null); setError(''); }}>
          <Text style={[styles.chipText, country === code && styles.chipTextSelected]}>{label}</Text>
        </TouchableOpacity>)}
      </View>
      <Text style={styles.label}>Especialidade</Text>
      <View style={styles.chips}>
        {APPOINTMENT_SPECIALTIES.map(item => <TouchableOpacity key={item.code}
          accessibilityRole="button" accessibilityState={{ selected: specialty === item.code }} disabled={locked}
          style={[styles.chip, specialty === item.code && styles.chipSelected]}
          onPress={() => { setSpecialty(item.code); setDoctorId(''); setSelectedSlot(null); setError(''); }}>
          <Text style={[styles.chipText, specialty === item.code && styles.chipTextSelected]}>{item.label}</Text>
        </TouchableOpacity>)}
      </View>
      <View style={styles.chips}>
        {([{ code: 'slot', label: 'Escolher horário' }, { code: 'queue', label: 'Pedir sem horário' }] as const).map(item => <TouchableOpacity key={item.code}
          accessibilityRole="button" accessibilityState={{ selected: mode === item.code }} disabled={locked}
          style={[styles.chip, mode === item.code && styles.chipSelected]}
          onPress={() => { setMode(item.code); setError(''); }}>
          <Text style={[styles.chipText, mode === item.code && styles.chipTextSelected]}>{item.label}</Text>
        </TouchableOpacity>)}
      </View>
      {mode === 'slot' && !pending && <>
        <Text style={styles.body}>Período de pesquisa: {window.label}. Cada horário indica o fuso do local de atendimento.</Text>
        <View style={styles.chips}>
          <TouchableOpacity accessibilityRole="button" disabled={locked || slotsLoading || window.page === 0}
            style={[styles.chip, (locked || slotsLoading || window.page === 0) && styles.btnDisabled]}
            onPress={() => { setWindowPage(window.page - 1); setDoctorId(''); setSelectedSlot(null); }}><Text style={styles.chipText}>Período anterior</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={locked || slotsLoading || window.page >= window.lastPage}
            style={[styles.chip, (locked || slotsLoading || window.page >= window.lastPage) && styles.btnDisabled]}
            onPress={() => { setWindowPage(window.page + 1); setDoctorId(''); setSelectedSlot(null); }}><Text style={styles.chipText}>Período seguinte</Text></TouchableOpacity>
        </View>
        <TouchableOpacity disabled={locked || slotsLoading} accessibilityRole="button" onPress={() => { setDoctorId(''); void loadSlots(); }}><Text style={styles.link}>Atualizar horários</Text></TouchableOpacity>
        {slotsLoading && <ActivityIndicator color={TEAL} />}
        {!!slotsError && <Text accessibilityRole="alert" style={styles.error}>{slotsError}</Text>}
        {!slotsLoading && !slotsError && slots.length === 0 && <Text style={styles.body}>Não há horários publicados disponíveis para esta especialidade neste país e período. Pode consultar outro período ou pedir sem horário.</Text>}
        {doctors.length > 1 && <View style={styles.chips}>
          <TouchableOpacity accessibilityRole="button" disabled={locked} style={[styles.chip, !doctorId && styles.chipSelected]}
            onPress={() => { setDoctorId(''); setSelectedSlot(null); }}><Text style={styles.chipText}>Todos os médicos</Text></TouchableOpacity>
          {doctors.map(([id, name]) => <TouchableOpacity key={id} accessibilityRole="button" disabled={locked}
            style={[styles.chip, doctorId === id && styles.chipSelected]} onPress={() => { setDoctorId(id); setSelectedSlot(null); }}><Text style={styles.chipText}>{name}</Text></TouchableOpacity>)}
        </View>}
        {visibleSlots.map(slot => <TouchableOpacity key={slot.id} accessibilityRole="button" accessibilityState={{ selected: selectedSlot === slot.id }}
          disabled={locked || slotsLoading} style={[styles.slot, selectedSlot === slot.id && styles.chipSelected]}
          onPress={() => setSelectedSlot(slot.id)}>
          <Text style={styles.doctor}>{slot.doctor_name}</Text>
          <Text style={styles.body}>{appointmentRange(slot)}</Text>
        </TouchableOpacity>)}
        {chosen && <Text style={styles.body}>Este horário ficará reservado para o seu pedido enquanto aguarda aceitação. Pode cancelar em As minhas consultas.</Text>}
      </>}
      {mode === 'queue' && !pending && <Text style={styles.body}>O pedido entra na fila de aceitação de um médico desta especialidade e deste país. Não reserva um horário nem garante atendimento imediato.</Text>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <TouchableOpacity style={[styles.btn, !canBook && styles.btnDisabled]} accessibilityRole="button"
        disabled={!canBook} onPress={() => void handleBook()}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{pending ? 'Repetir o mesmo pedido' : mode === 'slot' ? 'Pedir este horário' : 'Pedir consulta sem horário'}</Text>}
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => navigation.navigate('Consultations')}><Text style={styles.link}>Ver As minhas consultas</Text></TouchableOpacity>
      <Text style={styles.note}>Serviço de coordenação de saúde. Em caso de urgência contacte o número de emergência local.</Text>
    </ScrollView>
  );
}

const TEAL = '#0d9488';
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdfb' },
  inner: { padding: 20, gap: 12 },
  subtitle: { fontSize: 14, color: '#475569', lineHeight: 21 },
  body: { fontSize: 14, color: '#475569', lineHeight: 21 },
  label: { fontSize: 12, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#fff', borderRadius: 20, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  chipSelected: { borderColor: TEAL, backgroundColor: 'rgba(13,148,136,0.08)' },
  chipText: { fontSize: 13, color: '#334155', fontWeight: '500' },
  chipTextSelected: { color: TEAL, fontWeight: '700' },
  slot: { backgroundColor: '#fff', borderRadius: 10, padding: 15, borderWidth: 1, borderColor: '#e2e8f0', gap: 5 },
  doctor: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  notice: { backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderWidth: 1, borderRadius: 10, padding: 14, gap: 8 },
  error: { color: '#b91c1c', fontSize: 14, lineHeight: 21 },
  link: { color: '#0f766e', paddingVertical: 10, fontWeight: '600' },
  btn: { backgroundColor: TEAL, borderRadius: 10, padding: 15, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  note: { fontSize: 11, color: '#64748b', lineHeight: 16 },
});
