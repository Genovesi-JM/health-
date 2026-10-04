import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import type { AppStackParamList } from '../navigation/AppStack';
import api from '../services/api';
import {
  CONSULTATION_OUTCOME, CONSULTATION_STATUS, FOLLOW_UP_STATUS,
  canCancelConsultation, canRetainConsultationAfterError, consultationDate, consultationError, consultationNextStep,
  loadPatientConsultation, videoAvailabilityMessage, type PatientConsultationDetail,
} from './consultations';

const TEAL = '#0d9488';

export default function ConsultationDetailScreen() {
  const { params: { consultationId } } = useRoute<RouteProp<AppStackParamList, 'ConsultationDetail'>>();
  const [loadedDetail, setDetail] = useState<PatientConsultationDetail | null>(null);
  const detail = loadedDetail?.result.consultation_id === consultationId ? loadedDetail : null;
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(false);
  const requestVersion = useRef(0);
  const busy = useRef(false);
  const currentStatus = useRef<string | null>(null);
  const focusedConsultationId = useRef<string | null>(null);
  const viewVersion = useRef(0);

  const load = useCallback(async (quiet = false) => {
    const version = ++requestVersion.current;
    if (!quiet) setLoading(true);
    try {
      const latest = await loadPatientConsultation(api, consultationId);
      if (!active.current || version !== requestVersion.current) return;
      setDetail(latest);
      currentStatus.current = latest.result.status;
      setError('');
    } catch (failure) {
      if (!active.current || version !== requestVersion.current) return;
      // Clear sensitive cached content if authorization changes. Other failures
      // keep the last view, clearly marked as not refreshed.
      if (!canRetainConsultationAfterError(failure)) setDetail(null);
      setError(consultationError(failure, 'Não foi possível atualizar a consulta. Os dados apresentados podem estar desatualizados.'));
    } finally {
      if (active.current && version === requestVersion.current) setLoading(false);
    }
  }, [consultationId]);

  useFocusEffect(useCallback(() => {
    viewVersion.current++;
    focusedConsultationId.current = consultationId;
    active.current = true;
    busy.current = false;
    currentStatus.current = null;
    setDetail(null);
    setError('');
    setCancelling(false);
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
        busy.current || !detail || !canCancelConsultation(detail.result.status)) return;
    const version = viewVersion.current;
    const sameView = () => active.current && viewVersion.current === version && focusedConsultationId.current === consultationId;
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
          {detail.consultation?.scheduled_at && <Text style={styles.body}>
            {status === 'requested' ? 'Horário pedido: ' : 'Horário: '}{consultationDate(detail.consultation.scheduled_at)}
          </Text>}
          {detail.consultation?.started_at && <Text style={styles.body}>Início: {consultationDate(detail.consultation.started_at)}</Text>}
          {detail.consultation?.ended_at && <Text style={styles.body}>Fim: {consultationDate(detail.consultation.ended_at)}</Text>}
          {detail.metadataUnavailable && <Text style={styles.hint}>Não foi possível atualizar os horários. O estado e o resumo foram atualizados.</Text>}
          <Text style={styles.hint}>Os horários são apresentados no fuso horário do seu dispositivo.</Text>
          {canCancelConsultation(detail.result.status) && <TouchableOpacity accessibilityRole="button"
            disabled={loading || cancelling || !!error}
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
            <Text style={styles.hint}>Disponibilizado por {closeout.finalized_by_name || 'médico responsável'} em {consultationDate(closeout.finalized_at)}.</Text>
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
});
