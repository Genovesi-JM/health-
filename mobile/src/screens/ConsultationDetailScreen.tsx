import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import type { AppStackParamList } from '../navigation/AppStack';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  CONSULTATION_OUTCOME, CONSULTATION_STATUS, FOLLOW_UP_STATUS,
  canCancelConsultation, canRetainConsultationAfterError, consultationDate, consultationError, consultationNextStep,
  loadPatientConsultation, patientSummaryPublication, videoAvailabilityMessage, type PatientConsultationDetail,
} from './consultations';
import { APPOINTMENT_MARKETS, appointmentDate } from './appointmentAvailability';
import { canRescheduleConsultation, rescheduleStorageKey } from './appointmentRescheduling';

const TEAL = '#0d9488';

export default function ConsultationDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const ownerId = user?.id == null ? null : String(user.id);
  const currentOwner = useRef(ownerId);
  currentOwner.current = ownerId;
  const { params: { consultationId } } = useRoute<RouteProp<AppStackParamList, 'ConsultationDetail'>>();
  const [loaded, setDetail] = useState<{ ownerId: string; detail: PatientConsultationDetail } | null>(null);
  const detail = loaded?.ownerId === ownerId && loaded?.detail.result.consultation_id === consultationId ? loaded.detail : null;
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [rescheduleRecovery, setRescheduleRecovery] = useState({ present: false, verified: false });
  const active = useRef(false);
  const requestVersion = useRef(0);
  const busy = useRef(false);
  const currentStatus = useRef<string | null>(null);
  const focusedConsultationId = useRef<string | null>(null);
  const viewVersion = useRef(0);

  const load = useCallback(async (quiet = false) => {
    const version = ++requestVersion.current;
    if (!ownerId) { setDetail(null); setLoading(false); return; }
    if (!quiet) setLoading(true);
    try {
      const [loadedDetail, recovery] = await Promise.allSettled([
        loadPatientConsultation(api, consultationId),
        SecureStore.getItemAsync(rescheduleStorageKey(ownerId, consultationId)),
      ]);
      if (!active.current || version !== requestVersion.current || currentOwner.current !== ownerId) return;
      setRescheduleRecovery({ present: recovery.status === 'fulfilled' && recovery.value !== null, verified: recovery.status === 'fulfilled' });
      if (loadedDetail.status === 'rejected') throw loadedDetail.reason;
      const latest = loadedDetail.value;
      setDetail({ ownerId, detail: latest });
      currentStatus.current = latest.result.status;
      setError('');
    } catch (failure) {
      if (!active.current || version !== requestVersion.current || currentOwner.current !== ownerId) return;
      // Clear sensitive cached content if authorization changes. Other failures
      // keep the last view, clearly marked as not refreshed.
      if (!canRetainConsultationAfterError(failure)) setDetail(null);
      setError(consultationError(failure, 'Não foi possível atualizar a consulta. Os dados apresentados podem estar desatualizados.'));
    } finally {
      if (active.current && version === requestVersion.current && currentOwner.current === ownerId) setLoading(false);
    }
  }, [consultationId, ownerId]);

  useFocusEffect(useCallback(() => {
    viewVersion.current++;
    focusedConsultationId.current = consultationId;
    active.current = true;
    busy.current = false;
    currentStatus.current = null;
    setDetail(null);
    setError('');
    setCancelling(false);
    setHistoryExpanded(false);
    setRescheduleRecovery({ present: false, verified: false });
    void load();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && !busy.current) void load(true);
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active' && !busy.current &&
          (!currentStatus.current || ['requested', 'scheduled', 'in_progress'].includes(currentStatus.current))) void load(true);
    }, 30_000);
    return () => {
      active.current = false;
      focusedConsultationId.current = null;
      viewVersion.current++;
      requestVersion.current++;
      subscription.remove();
      clearInterval(timer);
    };
  }, [load, consultationId]));

  const cancel = async () => {
    if (!active.current || focusedConsultationId.current !== consultationId ||
        busy.current || !detail || !canCancelConsultation(detail.result.status) || rescheduleRecovery.present || !rescheduleRecovery.verified) return;
    const version = viewVersion.current;
    const sameView = () => active.current && viewVersion.current === version &&
      focusedConsultationId.current === consultationId && currentOwner.current === ownerId;
    busy.current = true;
    setCancelling(true);
    requestVersion.current++;
    try {
      await api.patch(`/api/v1/consultations/${encodeURIComponent(consultationId)}`, {});
      if (sameView()) await load();
    } catch (failure) {
      if (!sameView()) return;
      Alert.alert('Não foi possível confirmar o cancelamento', consultationError(failure, 'Atualize a consulta para verificar o estado antes de tentar novamente.'));
      await load();
    } finally {
      if (sameView()) {
        busy.current = false;
        setCancelling(false);
      }
    }
  };

  const closeout = detail?.result.closeout;
  const publication = closeout ? patientSummaryPublication(closeout) : null;
  const status = detail?.result.status;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { if (!busy.current) void load(); }} tintColor={TEAL} />}>
      {!!error && <View style={styles.warning} accessibilityRole="alert">
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity accessibilityRole="button" disabled={loading || cancelling} onPress={() => void load()}>
          <Text style={styles.link}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>}
      {loading && !detail && <ActivityIndicator color={TEAL} />}
      {detail && <>
        <View style={styles.card}>
          <Text style={styles.title}>{detail.consultation?.specialty.replace(/_/g, ' ') || 'Consulta'}</Text>
          <Text style={styles.status}>{CONSULTATION_STATUS[detail.result.status] || 'Estado por confirmar'}</Text>
          <Text style={styles.body}>{consultationNextStep(detail.result.status)}</Text>
          {detail.consultation?.country && <Text style={styles.body}>País de atendimento: {APPOINTMENT_MARKETS[detail.consultation.country]}</Text>}
          {detail.consultation?.scheduled_at && <Text style={styles.body}>
            {status === 'requested' ? 'Horário pedido: ' : 'Horário: '}{appointmentDate(detail.consultation.scheduled_at, detail.consultation.timezone)}
            {detail.consultation.scheduled_end_at ? ` — ${appointmentDate(detail.consultation.scheduled_end_at, detail.consultation.timezone)}` : ''}
          </Text>}
          {status === 'requested' && detail.consultation?.slot_id && <Text style={styles.hint}>Este horário está reservado para o seu pedido enquanto aguarda aceitação do médico. O cancelamento liberta o horário.</Text>}
          {status === 'requested' && detail.consultation && !detail.consultation.scheduled_at && <Text style={styles.hint}>Pedido sem horário; não garante atendimento imediato.</Text>}
          {detail.consultation?.started_at && <Text style={styles.body}>Início: {consultationDate(detail.consultation.started_at)}</Text>}
          {detail.consultation?.ended_at && <Text style={styles.body}>Fim: {consultationDate(detail.consultation.ended_at)}</Text>}
          {detail.metadataUnavailable && <Text style={styles.hint}>Não foi possível atualizar os horários. O estado e o resumo foram atualizados.</Text>}
          <Text style={styles.hint}>A marcação indica o fuso do local de atendimento. Os restantes eventos são apresentados no fuso do seu dispositivo.</Text>
          {!rescheduleRecovery.verified && <Text style={styles.hint}>Não foi possível verificar se existe uma alteração de horário pendente. Atualize antes de cancelar.</Text>}
          {rescheduleRecovery.present && <Text style={styles.hint}>Existe uma alteração de horário por confirmar. Recupere o resultado antes de cancelar ou pedir outra alteração.</Text>}
          {(rescheduleRecovery.present || !rescheduleRecovery.verified || canRescheduleConsultation(detail.consultation)) && <TouchableOpacity accessibilityRole="button"
            disabled={loading || cancelling || !!error}
            onPress={() => navigation.navigate('RescheduleConsultation', { consultationId })}>
            <Text style={styles.link}>{rescheduleRecovery.present ? 'Recuperar alteração de horário' : 'Alterar horário'}</Text>
          </TouchableOpacity>}
          {canCancelConsultation(detail.result.status) && <TouchableOpacity accessibilityRole="button"
            disabled={loading || cancelling || !!error || rescheduleRecovery.present || !rescheduleRecovery.verified}
            onPress={() => Alert.alert('Cancelar consulta?', 'O cancelamento será registado no seu pedido.', [
              { text: 'Manter', style: 'cancel' },
              { text: 'Cancelar consulta', style: 'destructive', onPress: () => void cancel() },
            ])}>
            <Text style={styles.cancel}>{cancelling ? 'A cancelar…' : 'Cancelar consulta'}</Text>
          </TouchableOpacity>}
        </View>

        {['requested', 'scheduled', 'in_progress'].includes(detail.result.status) && <View style={styles.card}>
          <Text style={styles.heading}>Videochamada</Text>
          <Text style={styles.body}>{videoAvailabilityMessage(detail.capabilities)}</Text>
          <Text style={styles.hint}>A aceitação da consulta não confirma uma ligação de vídeo.</Text>
        </View>}

        <View style={styles.card}>
          <Text style={styles.heading}>Resumo e próximos passos</Text>
          {closeout ? <>
            <Text style={styles.status}>{CONSULTATION_OUTCOME[closeout.outcome] || 'Orientação do médico'}</Text>
            <Text selectable style={styles.body}>{closeout.patient_summary}</Text>
            <Text style={styles.hint}>Disponibilizado por {publication?.author_name || 'médico responsável'} em {consultationDate(publication?.published_at)}.</Text>
            {(closeout.published_history?.length || 0) > 1 && <View style={styles.history}>
              <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: historyExpanded }}
                onPress={() => setHistoryExpanded(value => !value)}>
                <Text style={styles.link}>{historyExpanded ? 'Ocultar versões publicadas' : `Ver versões publicadas (${closeout.published_history!.length})`}</Text>
              </TouchableOpacity>
              {historyExpanded && <>
                <Text style={styles.hint}>O resumo acima é a versão publicada mais recente. As versões anteriores ficam disponíveis para consulta.</Text>
                {closeout.published_history!.map(entry => <View key={entry.revision} style={styles.historyEntry}>
                  <Text style={styles.label}>{entry.revision === closeout.published_revision ? 'Versão atual' : entry.revision === 0 ? 'Resumo inicial' : 'Versão anterior'}</Text>
                  <Text selectable style={styles.body}>{entry.patient_summary}</Text>
                  <Text style={styles.hint}>Disponibilizado por {entry.author_name || 'médico responsável'} em {consultationDate(entry.published_at)}.</Text>
                </View>)}
              </>}
            </View>}
            {!!closeout.follow_up_instructions && <>
              <Text style={styles.label}>Orientações de acompanhamento</Text>
              <Text selectable style={styles.body}>{closeout.follow_up_instructions}</Text>
            </>}
            {closeout.follow_up && <View style={styles.followup}>
              <Text style={styles.label}>Acompanhamento pela equipa</Text>
              <Text style={styles.body}>Responsável: {closeout.follow_up.assigned_name || 'Equipa clínica'}</Text>
              <Text style={styles.body}>Prazo: {consultationDate(closeout.follow_up.due_at)}</Text>
              <Text style={styles.body}>Estado: {FOLLOW_UP_STATUS[closeout.follow_up.status] || 'Por confirmar'}</Text>
            </View>}
            {closeout.follow_up_required && !closeout.follow_up && <Text style={styles.hint}>Foi indicado acompanhamento. Consulte as orientações do médico; os dados da equipa responsável ainda não estão disponíveis.</Text>}
          </> : <Text style={styles.body}>
            {status === 'cancelled' || status === 'no_show'
              ? 'Não existe resumo clínico disponível para esta consulta.'
              : status === 'completed'
                ? 'O resumo desta consulta ainda não foi disponibilizado.'
                : 'O resumo ficará disponível depois de o médico concluir o registo clínico.'}
          </Text>}
        </View>
      </>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0fdfb' },
  content: { padding: 20, gap: 16, paddingBottom: 36 },
  card: { padding: 18, gap: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a', textTransform: 'capitalize' },
  heading: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  label: { fontSize: 14, fontWeight: '700', color: '#334155' },
  body: { fontSize: 14, lineHeight: 22, color: '#475569' },
  status: { fontSize: 14, fontWeight: '600', color: '#0f766e' },
  hint: { fontSize: 12, lineHeight: 19, color: '#64748b' },
  warning: { padding: 14, borderRadius: 10, backgroundColor: '#fff7ed' },
  error: { color: '#9a3412', lineHeight: 21 },
  link: { color: '#0f766e', paddingVertical: 10, fontWeight: '600' },
  cancel: { color: '#b91c1c', paddingVertical: 8, fontWeight: '600' },
  followup: { padding: 12, gap: 8, backgroundColor: '#f0fdfa', borderRadius: 8 },
  history: { borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 10 },
  historyEntry: { padding: 12, gap: 8, borderRadius: 8, backgroundColor: '#f8fafc' },
});
