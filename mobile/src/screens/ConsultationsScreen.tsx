import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../navigation/AppStack';
import api from '../services/api';

type Consultation = {
  id: string;
  specialty: string;
  status: string;
  scheduled_at?: string | null;
};

const STATUS: Record<string, string> = {
  requested: 'A aguardar aceitação', scheduled: 'Horário confirmado',
  in_progress: 'Em curso', completed: 'Concluída',
  cancelled: 'Cancelada', no_show: 'Não realizada',
};

export default function ConsultationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [items, setItems] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get<Consultation[]>('/api/v1/consultations/me')
      .then(response => { if (active) setItems(response.data); })
      .catch(() => { if (active) setError('Não foi possível atualizar as consultas. Tente novamente.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setItems((await api.get<Consultation[]>('/api/v1/consultations/me')).data);
    } catch {
      setError('Não foi possível atualizar as consultas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const cancel = async (id: string) => {
    setCancelling(id);
    try {
      const response = await api.patch<Consultation>(`/api/v1/consultations/${id}`, {});
      setItems(current => current.map(item => item.id === id ? response.data : item));
    } catch {
      Alert.alert('Não foi possível cancelar', 'A consulta pode ter mudado de estado. Atualize a lista e tente novamente.');
    } finally {
      setCancelling(null);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#0d9488" />}>
      <Text style={styles.intro}>Acompanhe o seu pedido e os próximos passos. Um pedido só fica confirmado após aceitação do médico.</Text>
      <TouchableOpacity style={styles.primary} accessibilityRole="button" onPress={() => navigation.navigate('BookConsultation')}>
        <Text style={styles.primaryText}>Pedir consulta</Text>
      </TouchableOpacity>
      {!!error && <View accessibilityRole="alert"><Text style={styles.error}>{error}</Text>
        <TouchableOpacity onPress={refresh} accessibilityRole="button"><Text style={styles.link}>Tentar novamente</Text></TouchableOpacity>
      </View>}
      {loading && items.length === 0 && <ActivityIndicator color="#0d9488" />}
      {!loading && !error && items.length === 0 && <Text style={styles.intro}>Ainda não tem pedidos de consulta.</Text>}
      {items.map(item => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.title}>{item.specialty.replace(/_/g, ' ')}</Text>
          <Text style={styles.status}>{STATUS[item.status] || item.status}</Text>
          {!!item.scheduled_at && <Text style={styles.intro}>
            {item.status === 'requested' ? 'Horário pedido: ' : 'Horário: '}
            {new Date(item.scheduled_at).toLocaleString('pt-PT')}
          </Text>}
          {['requested', 'scheduled'].includes(item.status) && (
            <TouchableOpacity accessibilityRole="button" disabled={cancelling !== null}
              onPress={() => Alert.alert('Cancelar consulta?', 'O cancelamento será registado no seu pedido.', [
                { text: 'Manter', style: 'cancel' },
                { text: 'Cancelar consulta', style: 'destructive', onPress: () => void cancel(item.id) },
              ])}>
              <Text style={styles.cancel}>{cancelling === item.id ? 'A cancelar…' : 'Cancelar consulta'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0fdfb' },
  content: { padding: 20, gap: 16 },
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
