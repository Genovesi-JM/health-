import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../navigation/AppStack';
import api from '../services/api';

// Portuguese specialties (value stored directly as consultation.specialty)
const SPECIALTIES = [
  'Clínica Geral', 'Cardiologia', 'Dermatologia', 'Pediatria',
  'Ginecologia', 'Psiquiatria', 'Ortopedia', 'Oftalmologia',
  'Neurologia', 'Otorrinolaringologia',
];

export default function BookConsultationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [specialty, setSpecialty] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const handleBook = async () => {
    if (!specialty) { Alert.alert('Selecione uma especialidade', 'Escolha a área da sua consulta.'); return; }
    setSaving(true);
    try {
      await api.post('/api/v1/consultations/book', {
        specialty,
        next_available: true,
      });
      Alert.alert(
        'Consulta marcada',
        'A sua consulta foi marcada. Pode agora efetuar o pagamento em "As minhas consultas".',
        [{ text: 'Ver consultas', onPress: () => navigation.navigate('Consultations' as any) }],
      );
      setSpecialty('');
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.detail ?? 'Não foi possível marcar a consulta.');
    }
    setSaving(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Text style={styles.subtitle}>
        Escolha a especialidade. Marcamos com o próximo profissional disponível.
      </Text>

      <Text style={styles.label}>Especialidade</Text>
      <View style={styles.chips}>
        {SPECIALTIES.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, specialty === s && styles.chipSelected]}
            onPress={() => setSpecialty(s)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, specialty === s && styles.chipTextSelected]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.btn, (!specialty || saving) && styles.btnDisabled]}
        onPress={handleBook}
        disabled={!specialty || saving}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Marcar consulta</Text>}
      </TouchableOpacity>

      <Text style={styles.note}>
        Serviço de coordenação de saúde. Não é um serviço de emergência — em caso de urgência
        contacte o número de emergência local.
      </Text>
    </ScrollView>
  );
}

const TEAL = '#0d9488';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdfb' },
  inner: { padding: 20 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 10, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip: {
    backgroundColor: '#fff', borderRadius: 20, paddingVertical: 9, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  chipSelected: { borderColor: TEAL, backgroundColor: 'rgba(13,148,136,0.08)' },
  chipText: { fontSize: 13, color: '#334155', fontWeight: '500' },
  chipTextSelected: { color: TEAL, fontWeight: '700' },
  btn: { backgroundColor: TEAL, borderRadius: 10, padding: 15, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  note: { fontSize: 11, color: '#94a3b8', marginTop: 20, lineHeight: 16 },
});
