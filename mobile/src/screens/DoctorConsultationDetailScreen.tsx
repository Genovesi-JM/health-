import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import type { AxiosRequestConfig } from 'axios';
import type { ClinicianStackParamList } from '../navigation/ClinicianStack';
import { useAuth } from '../contexts/AuthContext';
import api, { sessions } from '../services/api';
import { CONSULTATION_STATUS, consultationDate, patientSummaryPublication } from './consultations';
import { loadDoctorCloseout, canRetainDoctorCloseout, type DoctorCloseout } from './doctorConsultationCloseout';

export default function DoctorConsultationDetailScreen() {
  const { user } = useAuth();
  if (user?.role !== 'doctor') return <View style={styles.content}><Text style={styles.error}>Esta consulta exige acesso de médico verificado.</Text></View>;
  return <DoctorRecord />;
}

function DoctorRecord() {
  const { params: { consultationId, patientName } } = useRoute<RouteProp<ClinicianStackParamList, 'DoctorConsultationDetail'>>();
  const [record, setRecord] = useState<DoctorCloseout | null>(null);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const active = useRef(false); const request = useRef(0);
  const load = useCallback(async () => {
    const ticket = ++request.current; const sessionVersion = sessions.version();
    setLoading(true); setError('');
    const current = () => active.current && request.current === ticket && sessions.current(sessionVersion);
    try {
      const scopedApi = { get: (path: string) => api.get(path, { _sessionVersion: sessionVersion } as AxiosRequestConfig) };
      const result = await loadDoctorCloseout(scopedApi, consultationId);
      if (current()) setRecord(result);
    } catch (failure) {
      if (!current()) return;
      if (!canRetainDoctorCloseout(failure)) setRecord(null);
      setError('Não foi possível atualizar o registo clínico. Os dados que continuam visíveis podem estar desatualizados.');
    } finally { if (current()) setLoading(false); }
  }, [consultationId]);
  useFocusEffect(useCallback(() => {
    active.current = true; setRecord(null); void load();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { active.current = false; request.current++; subscription.remove(); };
  }, [load]));
  const detail = record?.consultation_id === consultationId ? record : null;
  const closeout = detail?.closeout; const publication = closeout ? patientSummaryPublication(closeout.published) : null;
  const sections = [ ['subjective', 'Relato do paciente'], ['objective', 'Dados objetivos'], ['assessment', 'Avaliação'], ['plan', 'Plano'] ] as const;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor="#0d9488" />}>
    <Text style={styles.title}>{detail && patientName ? patientName : 'Registo da consulta'}</Text>
    <Text style={styles.body}>Consulta clínica em leitura. A revisão do acesso e a integridade do registo são verificadas pelo serviço.</Text>
    {loading && <ActivityIndicator color="#0d9488" />}
    {!!error && <View accessibilityRole="alert" style={styles.card}><Text style={styles.error}>{error}</Text>
      <TouchableOpacity accessibilityRole="button" disabled={loading} onPress={() => void load()}><Text style={styles.link}>Atualizar registo</Text></TouchableOpacity>
    </View>}
    {detail && <Text style={styles.heading}>{CONSULTATION_STATUS[detail.status] || 'Estado por confirmar'}</Text>}
    {detail && !closeout && <Text style={styles.body}>Não existe um registo de encerramento disponível para esta consulta.</Text>}
    {closeout && <>
      <Text style={styles.body}>Versão clínica {closeout.current_revision} · {closeout.author_name} · {consultationDate(closeout.recorded_at)}</Text>
      {sections.map(([key, label]) => <View key={key} style={styles.card}><Text style={styles.heading}>{label}</Text>
        <Text selectable style={styles.body}>{closeout.notes[key] || 'Sem informação registada.'}</Text></View>)}
      <View style={styles.card}><Text style={styles.heading}>Resumo do registo atual</Text>
        <Text style={styles.body}>{closeout.current_is_published ? 'Esta versão foi publicada para o paciente.' : 'Esta versão ainda não foi publicada para o paciente.'}</Text>
        <Text selectable style={styles.body}>{closeout.patient_summary}</Text>
      </View>
      <View style={styles.card}><Text style={styles.heading}>Último resumo publicado para o paciente</Text>
        <Text selectable style={styles.body}>{closeout.published.patient_summary}</Text>
        <Text style={styles.body}>{publication?.author_name} · {consultationDate(publication?.published_at)}</Text>
        {closeout.published.follow_up_instructions && <Text selectable style={styles.body}>{closeout.published.follow_up_instructions}</Text>}
      </View>
    </>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' }, content: { padding: 20, paddingBottom: 48, gap: 14 },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a' }, heading: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  body: { fontSize: 14, lineHeight: 21, color: '#475569' }, error: { color: '#991b1b', lineHeight: 21 },
  card: { padding: 17, gap: 10, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  link: { color: '#0f766e', fontWeight: '700' },
});
