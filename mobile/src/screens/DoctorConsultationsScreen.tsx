import React, { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ClinicianStackParamList } from '../navigation/ClinicianStack';
import { useAuth } from '../contexts/AuthContext';
import { useConsultationPage } from './useConsultationPage';
import { CONSULTATION_VIEWS, type ConsultationView } from './consultationPages';
import { CONSULTATION_STATUS, type PatientConsultation } from './consultations';
import { appointmentDate, APPOINTMENT_MARKETS } from './appointmentAvailability';
import { consultationExpiryMessage } from './consultationExpiry';

export default function DoctorConsultationsScreen() {
  const { user } = useAuth();
  if (user?.role !== 'doctor') return <View style={styles.content}><Text style={styles.error}>Esta lista exige acesso de médico verificado.</Text></View>;
  return <AssignedConsultations />;
}

function AssignedConsultations() {
  const navigation = useNavigation<NativeStackNavigationProp<ClinicianStackParamList>>();
  const [view, setView] = useState<ConsultationView>('all');
  const page = useConsultationPage<PatientConsultation>('doctor-history', view);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={page.loading} onRefresh={() => void page.refresh()} tintColor="#0d9488" />}>
    <Text style={styles.title}>As minhas consultas</Text>
    <Text style={styles.body}>Consulte os pedidos que lhe foram atribuídos. A abertura do processo do paciente depende do seu acesso clínico atual.</Text>
    <View style={styles.filters}>{CONSULTATION_VIEWS.map(option => <TouchableOpacity key={option.value} accessibilityRole="button"
      accessibilityState={{ selected: view === option.value }} onPress={() => setView(option.value)}
      style={[styles.filter, view === option.value && styles.selectedFilter]}>
      <Text style={view === option.value ? styles.selectedText : styles.filterText}>{option.label}</Text>
    </TouchableOpacity>)}</View>
    {!!page.error && <View accessibilityRole="alert" style={styles.card}>
      <Text style={styles.error}>{page.error}</Text>
      <TouchableOpacity accessibilityRole="button" disabled={page.loading} onPress={() => void page.refresh()}>
        <Text style={styles.link}>{page.restartRequired ? 'Recomeçar lista' : 'Atualizar lista'}</Text>
      </TouchableOpacity>
    </View>}
    {page.loading && <ActivityIndicator color="#0d9488" />}
    {page.loaded && !page.error && !page.loading && page.items.length === 0 && <Text style={styles.body}>
      {page.nextCursor ? 'Carregue a página seguinte para consultar mais registos.' : 'Não existem consultas atribuídas nesta vista.'}
    </Text>}
    {page.items.length > 0 && <Text style={styles.body}>{page.items.length} registos carregados{page.nextCursor ? ' · há mais consultas' : ''}</Text>}
    {page.items.map(item => <View key={item.id} style={styles.card}>
      <Text style={styles.heading}>{item.patient_name || 'Paciente'}</Text>
      <Text style={styles.body}>{item.specialty.replace(/_/g, ' ')}</Text>
      <Text style={styles.status}>{CONSULTATION_STATUS[item.status] || 'Estado por confirmar'}</Text>
      {item.country && <Text style={styles.body}>{APPOINTMENT_MARKETS[item.country]}</Text>}
      <Text style={styles.body}>Horário: {appointmentDate(item.scheduled_at, item.timezone)}</Text>
      {consultationExpiryMessage(item, { clinician: true }) && <Text style={styles.body}>{consultationExpiryMessage(item, { clinician: true })}</Text>}
      {item.status === 'completed' && <TouchableOpacity accessibilityRole="button" disabled={page.loading || !!page.error}
        onPress={() => navigation.navigate('DoctorConsultationDetail', { consultationId: item.id, patientName: item.patient_name || undefined })}>
        <Text style={styles.link}>Ler registo desta consulta</Text>
      </TouchableOpacity>}
      {item.patient_id && <TouchableOpacity accessibilityRole="button" disabled={page.loading || !!page.error}
        onPress={() => navigation.navigate('Patient360', { patientId: item.patient_id! })}>
        <Text style={styles.link}>Abrir processo do paciente</Text>
      </TouchableOpacity>}
    </View>)}
    {page.loadingMore && <ActivityIndicator color="#0d9488" />}
    {page.nextCursor && !page.restartRequired && <TouchableOpacity accessibilityRole="button" style={styles.button}
      disabled={page.loading || page.loadingMore} onPress={() => void page.loadMore()}>
      <Text style={styles.selectedText}>Carregar mais consultas</Text>
    </TouchableOpacity>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' }, content: { padding: 20, paddingBottom: 48, gap: 14 },
  title: { fontSize: 25, fontWeight: '800', color: '#0f172a' }, heading: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  body: { fontSize: 14, lineHeight: 21, color: '#475569' }, status: { fontSize: 14, fontWeight: '700', color: '#0f766e' },
  error: { color: '#991b1b', lineHeight: 21 }, card: { padding: 18, gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, filter: { borderWidth: 1, borderColor: '#0d9488', padding: 9, borderRadius: 20 },
  selectedFilter: { backgroundColor: '#0d9488' }, filterText: { color: '#0f766e', fontWeight: '600' }, selectedText: { color: '#fff', fontWeight: '600' },
  button: { padding: 14, alignItems: 'center', borderRadius: 9, backgroundColor: '#0d9488' }, link: { color: '#0f766e', fontWeight: '700', paddingVertical: 7 },
});
