import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../navigation/AppStack';
import api, { sessions } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import * as SecureStore from 'expo-secure-store';
import type { AxiosRequestConfig } from 'axios';
import { CONSULTATION_STATUS, canCancelConsultation, type PatientConsultation } from './consultations';
import { APPOINTMENT_MARKETS, appointmentDate } from './appointmentAvailability';
import { rescheduleStorageKey } from './appointmentRescheduling';
import { useConsultationPage } from './useConsultationPage';
import { CONSULTATION_VIEWS, type ConsultationView } from './consultationPages';
import { consultationExpiryMessage, requestAllowsNewScheduleAction } from './consultationExpiry';

export default function ConsultationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const [view, setView] = useState<ConsultationView>('all');
  const page = useConsultationPage<PatientConsultation>('patient', view);
  const { items, loading, error, refresh } = page;
  const [cancelling, setCancelling] = useState<string | null>(null);
  const busy = useRef(false);

  const cancel = async (id: string) => {
    if (busy.current || !user?.id) return;
    const item = items.find(candidate => candidate.id === id);
    if (!item || !canCancelConsultation(item.status, item.request_expiry_state)) return;
    const version = sessions.version();
    busy.current = true;
    setCancelling(id);
    try {
      const pending = await SecureStore.getItemAsync(rescheduleStorageKey(user.id, id));
      sessions.assertCurrent(version);
      if (pending !== null) {
        Alert.alert('Alteração por confirmar', 'Recupere o resultado da alteração de horário antes de cancelar esta consulta.', [
          { text: 'Fechar', style: 'cancel' },
          { text: 'Recuperar pedido', onPress: () => { if (sessions.current(version)) navigation.navigate('RescheduleConsultation', { consultationId: id }); } },
        ]);
        return;
      }
      const config: AxiosRequestConfig & { _sessionVersion: number } = { _sessionVersion: version };
      const response = await api.patch<PatientConsultation>(`/api/v1/consultations/${encodeURIComponent(id)}`, {}, config);
      if (sessions.current(version)) page.updateItem(response.data);
    } catch {
      if (!sessions.current(version)) return;
      Alert.alert('Não foi possível cancelar', 'A consulta pode ter mudado de estado. Atualize a lista e tente novamente.');
    } finally {
      busy.current = false;
      setCancelling(null);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { if (!busy.current) void refresh(); }} tintColor="#0d9488" />}>
      <Text style={styles.intro}>Acompanhe o seu pedido e os próximos passos. Um pedido só fica confirmado após aceitação do médico.</Text>
      <TouchableOpacity style={styles.primary} accessibilityRole="button" onPress={() => navigation.navigate('BookConsultation')}>
        <Text style={styles.primaryText}>Pedir consulta</Text>
      </TouchableOpacity>
      <View style={styles.filters}>
        {CONSULTATION_VIEWS.map(option => <TouchableOpacity key={option.value} accessibilityRole="button"
          accessibilityState={{ selected: view === option.value, disabled: cancelling !== null }} disabled={cancelling !== null}
          onPress={() => setView(option.value)} style={[styles.filter, view === option.value && styles.activeFilter]}>
          <Text style={view === option.value ? styles.activeFilterText : styles.filterText}>{option.label}</Text>
        </TouchableOpacity>)}
      </View>
      {!!error && <View accessibilityRole="alert"><Text style={styles.error}>{error}</Text>
        <TouchableOpacity disabled={cancelling !== null || loading} onPress={() => void refresh()} accessibilityRole="button"><Text style={styles.link}>{page.restartRequired ? 'Recomeçar lista' : 'Atualizar lista'}</Text></TouchableOpacity>
      </View>}
      {loading && items.length === 0 && <ActivityIndicator color="#0d9488" />}
      {!loading && !error && page.loaded && items.length === 0 && <Text style={styles.intro}>{page.nextCursor ? 'Carregue a página seguinte para consultar mais registos.' : 'Não existem consultas nesta vista.'}</Text>}
      {items.length > 0 && <Text style={styles.intro}>{items.length} consultas carregadas{page.nextCursor ? ' · há mais registos' : ''}</Text>}
      {items.map(item => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.title}>{item.specialty.replace(/_/g, ' ')}</Text>
          <Text style={styles.status}>{CONSULTATION_STATUS[item.status] || 'Estado por confirmar'}</Text>
          {consultationExpiryMessage(item) && <Text style={styles.intro}>{consultationExpiryMessage(item)}</Text>}
          {item.status === 'requested' && item.requested_expires_at && <Text style={styles.intro}>Prazo de aceitação: {appointmentDate(item.requested_expires_at, item.timezone)}</Text>}
          {item.country && <Text style={styles.intro}>País de atendimento: {APPOINTMENT_MARKETS[item.country]}</Text>}
          {!!item.scheduled_at && <Text style={styles.intro}>
            {item.status === 'requested' ? 'Horário pedido: ' : 'Horário: '}
            {appointmentDate(item.scheduled_at, item.timezone)}
            {item.scheduled_end_at ? ` — ${appointmentDate(item.scheduled_end_at, item.timezone)}` : ''}
          </Text>}
          {item.status === 'requested' && requestAllowsNewScheduleAction(item) && <Text style={styles.intro}>{item.slot_id
            ? 'Horário reservado enquanto aguarda aceitação do médico.'
            : !item.scheduled_at ? 'Pedido sem horário. Aguarda aceitação do médico.' : 'O horário ainda não foi confirmado.'}</Text>}
          <TouchableOpacity accessibilityRole="button"
            onPress={() => navigation.navigate('ConsultationDetail', { consultationId: item.id })}>
            <Text style={styles.link}>Ver consulta e orientações</Text>
          </TouchableOpacity>
          {canCancelConsultation(item.status, item.request_expiry_state) && (
            <TouchableOpacity accessibilityRole="button" disabled={cancelling !== null || loading || !!error}
              onPress={() => Alert.alert('Cancelar consulta?', 'O cancelamento será registado no seu pedido.', [
                { text: 'Manter', style: 'cancel' },
                { text: 'Cancelar consulta', style: 'destructive', onPress: () => void cancel(item.id) },
              ])}>
              <Text style={styles.cancel}>{cancelling === item.id ? 'A cancelar…' : 'Cancelar consulta'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      {page.loadingMore && <ActivityIndicator color="#0d9488" />}
      {page.nextCursor && !page.restartRequired && <TouchableOpacity style={styles.primary} accessibilityRole="button"
        disabled={loading || page.loadingMore || cancelling !== null} onPress={() => void page.loadMore()}>
        <Text style={styles.primaryText}>Carregar mais consultas</Text>
      </TouchableOpacity>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0fdfb' },
  content: { padding: 20, gap: 16 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { borderWidth: 1, borderColor: '#0d9488', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  activeFilter: { backgroundColor: '#0d9488' }, filterText: { color: '#0f766e', fontWeight: '600' }, activeFilterText: { color: '#fff', fontWeight: '600' },
  intro: { fontSize: 14, lineHeight: 21, color: '#475569' },
  primary: { backgroundColor: '#0d9488', borderRadius: 10, padding: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  card: { padding: 18, gap: 10, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  title: { fontSize: 17, fontWeight: '600', color: '#0f172a', textTransform: 'capitalize' },
  status: { fontSize: 14, fontWeight: '600', color: '#0f766e' },
  cancel: { color: '#b91c1c', paddingVertical: 8, fontWeight: '600' },
  error: { color: '#b91c1c', lineHeight: 21 },
  link: { color: '#0f766e', paddingVertical: 10, fontWeight: '600' },
});
