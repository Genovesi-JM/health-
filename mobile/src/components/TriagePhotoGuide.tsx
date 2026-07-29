import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import api from '../services/api';
import { apiErrorMessage } from '../utils/apiError';

type ViewType = 'orientation' | 'context' | 'closeup';

type PhotoSlot = {
  viewType: ViewType;
  title: string;
  help: string;
};

const PHOTO_SLOTS: PhotoSlot[] = [
  {
    viewType: 'orientation',
    title: '1. Orientação',
    help: 'Mostre onde a alteração se encontra no corpo.',
  },
  {
    viewType: 'context',
    title: '2. Contexto',
    help: 'Inclua a pele em redor para mostrar a dimensão.',
  },
  {
    viewType: 'closeup',
    title: '3. Aproximação',
    help: 'Aproxime sem perder o foco e use boa luz.',
  },
];

type PreparedPhoto = {
  id?: string;
  uri: string;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  issues: string[];
};

async function preparePhoto(asset: ImagePicker.ImagePickerAsset): Promise<PreparedPhoto> {
  const largestSide = Math.max(asset.width, asset.height);
  const actions: ImageManipulator.Action[] = largestSide > 1600
    ? [{
        resize: asset.width >= asset.height
          ? { width: 1600 }
          : { height: 1600 },
      }]
    : [];
  const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: 0.88,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const issues = Math.min(asset.width, asset.height) < 640 ? ['low_resolution'] : [];
  return {
    uri: result.uri,
    originalWidth: asset.width,
    originalHeight: asset.height,
    width: result.width,
    height: result.height,
    issues,
  };
}

export default function TriagePhotoGuide({ sessionId }: { sessionId: string }) {
  const [consented, setConsented] = useState(false);
  const [photos, setPhotos] = useState<Partial<Record<ViewType, PreparedPhoto>>>({});
  const [uploading, setUploading] = useState<ViewType | null>(null);
  const [deleting, setDeleting] = useState<ViewType | null>(null);
  const [error, setError] = useState('');

  const selectSource = (slot: PhotoSlot) => {
    if (!consented || uploading) return;
    Alert.alert('Adicionar fotografia', slot.title, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Galeria', onPress: () => void pickAndUpload(slot, 'library') },
      { text: 'Câmara', onPress: () => void pickAndUpload(slot, 'camera') },
    ]);
  };

  const pickAndUpload = async (slot: PhotoSlot, source: 'camera' | 'library') => {
    setError('');
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('Autorize o acesso à câmara para tirar a fotografia.');
          return;
        }
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 1,
            exif: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 1,
            exif: false,
          });
      if (result.canceled) return;

      setUploading(slot.viewType);
      const prepared = await preparePhoto(result.assets[0]);
      const technicalCheck = {
        original_width: prepared.originalWidth,
        original_height: prepared.originalHeight,
        sanitized_width: prepared.width,
        sanitized_height: prepared.height,
        issues: prepared.issues,
        metadata_removed: true,
        source: 'kaya_mobile',
      };
      const form = new FormData();
      form.append('view_type', slot.viewType);
      form.append('technical_check', JSON.stringify(technicalCheck));
      form.append('file', {
        uri: prepared.uri,
        name: `${slot.viewType}.jpg`,
        type: 'image/jpeg',
      } as unknown as Blob);
      const response = await api.post(`/api/v1/triage/${sessionId}/photos`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPhotos(current => ({
        ...current,
        [slot.viewType]: { ...prepared, id: response.data.id },
      }));
    } catch (uploadError) {
      setError(apiErrorMessage(uploadError, 'Não foi possível enviar a fotografia.'));
    } finally {
      setUploading(null);
    }
  };

  const confirmRemove = (viewType: ViewType) => {
    const photo = photos[viewType];
    if (!photo?.id || deleting || uploading) return;
    Alert.alert(
      'Eliminar fotografia?',
      'A fotografia será removida permanentemente da triagem e deixará de estar disponível ao profissional.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => void removePhoto(viewType, photo.id!),
        },
      ],
    );
  };

  const removePhoto = async (viewType: ViewType, photoId: string) => {
    setDeleting(viewType);
    setError('');
    try {
      await api.delete(`/api/v1/triage/${sessionId}/photos/${photoId}`);
      setPhotos(current => {
        const next = { ...current };
        delete next[viewType];
        return next;
      });
    } catch (deleteError) {
      setError(apiErrorMessage(deleteError, 'Não foi possível eliminar a fotografia.'));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fotografias para revisão clínica</Text>
      <Text style={styles.intro}>
        Se conseguir, adicione três vistas. São opcionais e podem ajudar o profissional de saúde.
      </Text>
      <View style={styles.boundary}>
        <Text style={styles.boundaryText}>
          🔒 A KAYA não interpreta estas imagens com IA e não fornece um diagnóstico por fotografia.
        </Text>
      </View>
      <View style={styles.consentRow}>
        <Switch value={consented} onValueChange={setConsented} trackColor={{ true: '#5eead4' }} />
        <Text style={styles.consentText}>
          Autorizo o envio privado destas fotografias para revisão pelo profissional associado.
        </Text>
      </View>

      {PHOTO_SLOTS.map(slot => {
        const photo = photos[slot.viewType];
        const isUploading = uploading === slot.viewType;
        const isDeleting = deleting === slot.viewType;
        return (
          <View style={styles.slot} key={slot.viewType}>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.preview} />
            ) : (
              <View style={styles.placeholder}><Text style={styles.placeholderIcon}>📷</Text></View>
            )}
            <View style={styles.slotBody}>
              <Text style={styles.slotTitle}>{slot.title}</Text>
              <Text style={styles.slotHelp}>{slot.help}</Text>
              {photo?.issues.includes('low_resolution') && (
                <Text style={styles.warning}>⚠ Resolução baixa. Repita se for possível.</Text>
              )}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.photoButton, (!consented || Boolean(uploading) || Boolean(deleting)) && styles.disabled]}
                  disabled={!consented || Boolean(uploading) || Boolean(deleting)}
                  onPress={() => selectSource(slot)}
                >
                  {isUploading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.photoButtonText}>{photo ? 'Substituir' : 'Adicionar'}</Text>}
                </TouchableOpacity>
                {photo && (
                  <TouchableOpacity
                    style={[styles.deleteButton, (Boolean(uploading) || Boolean(deleting)) && styles.disabled]}
                    disabled={Boolean(uploading) || Boolean(deleting)}
                    onPress={() => confirmRemove(slot.viewType)}
                  >
                    {isDeleting
                      ? <ActivityIndicator color="#b91c1c" size="small" />
                      : <Text style={styles.deleteButtonText}>Eliminar</Text>}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        );
      })}
      <Text style={styles.optional}>Pode continuar a triagem sem fotografias.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0fdfa',
    borderColor: '#99f6e4',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    padding: 16,
  },
  title: { color: '#0f172a', fontSize: 17, fontWeight: '800' },
  intro: { color: '#475569', fontSize: 13, lineHeight: 19, marginTop: 5 },
  boundary: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginTop: 12,
    padding: 11,
  },
  boundaryText: { color: '#115e59', fontSize: 12, fontWeight: '600', lineHeight: 18 },
  consentRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginVertical: 14 },
  consentText: { color: '#334155', flex: 1, fontSize: 12, lineHeight: 17 },
  slot: {
    backgroundColor: '#fff',
    borderColor: '#dbe5e4',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    overflow: 'hidden',
  },
  preview: { backgroundColor: '#e2e8f0', height: 132, width: 112 },
  placeholder: {
    alignItems: 'center',
    backgroundColor: '#e6fffb',
    height: 132,
    justifyContent: 'center',
    width: 112,
  },
  placeholderIcon: { fontSize: 30 },
  slotBody: { flex: 1, padding: 11 },
  slotTitle: { color: '#0f172a', fontSize: 13, fontWeight: '800' },
  slotHelp: { color: '#64748b', fontSize: 11, lineHeight: 16, marginTop: 3 },
  warning: { color: '#b45309', fontSize: 10, marginTop: 5 },
  photoButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#0d9488',
    borderRadius: 8,
    marginTop: 9,
    minWidth: 84,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  actionRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  photoButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  deleteButton: {
    borderColor: '#fecaca',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 9,
    minWidth: 70,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deleteButtonText: { color: '#b91c1c', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  disabled: { opacity: 0.4 },
  optional: { color: '#64748b', fontSize: 11, marginTop: 2 },
  error: { color: '#b91c1c', fontSize: 12, marginTop: 8 },
});
