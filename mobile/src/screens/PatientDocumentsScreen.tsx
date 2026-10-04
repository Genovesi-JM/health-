import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/AppStack';
import api from '../services/api';
import {
  DOCUMENT_STATUS, DOCUMENT_TEXT_LIMIT, canProcessDocument, canReviewDocument, documentError, manualReviewMessage,
  preparePhotoUpload, reconcileDocumentReview, saveDocumentReview, sendDocumentUpload, startDocumentReview,
  type DocumentCapabilities, type DocumentUpload, type PatientDocument, type ReviewDraft,
} from './patientDocuments';

const BASE = '/api/v1/patient-documents';
const TEAL = '#0d9488';

export default function PatientDocumentsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [capabilities, setCapabilities] = useState<DocumentCapabilities | null>(null);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [upload, setUpload] = useState<DocumentUpload | null>(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [listError, setListError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = useRef(false);
  const dirty = !!draft && draft.text !== startDocumentReview(draft.document).text;

  useEffect(() => navigation.addListener('beforeRemove', event => {
    if (busy.current) {
      event.preventDefault();
      Alert.alert('Aguarde', 'A operação ainda está em curso.');
    } else if (dirty) {
      event.preventDefault();
      Alert.alert('Sair sem guardar?', 'As alterações ao texto ainda não foram guardadas.', [
        { text: 'Continuar a rever', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
      ]);
    }
  }), [navigation, dirty]);

  const load = async () => {
    if (busy.current) return;
    busy.current = true;
    setWorking('load');
    setListError('');
    try {
      const [availability, list] = await Promise.allSettled([api.get(BASE + '/capabilities'), api.get(BASE)]);
      setCapabilities(availability.status === 'fulfilled' ? availability.value.data : null);
      if (list.status === 'fulfilled') setDocuments(list.value.data);
      else setListError(documentError(list.reason, 'Não foi possível atualizar os seus documentos. Tente novamente.'));
    } finally {
      busy.current = false;
      setWorking('');
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const remember = (document: PatientDocument) => {
    setDocuments(previous => [document, ...previous.filter(item => item.id !== document.id)]);
  };

  const openDocument = async (id: string) => {
    if (busy.current) return;
    busy.current = true;
    setWorking(id);
    setError('');
    setNotice('');
    try {
      const response = await api.get<PatientDocument>(`${BASE}/${encodeURIComponent(id)}`);
      setDraft(startDocumentReview(response.data));
      remember(response.data);
    } catch (failure) {
      setError(documentError(failure, 'Não foi possível abrir o documento. O texto atual foi mantido.'));
    } finally { busy.current = false; setWorking(''); }
  };

  const selectDocument = (id: string) => {
    if (id === draft?.document.id || busy.current) return;
    if (dirty) {
      Alert.alert('Mudar de documento?', 'As alterações ao texto atual ainda não foram guardadas.', [
        { text: 'Continuar a rever', style: 'cancel' },
        { text: 'Mudar sem guardar', style: 'destructive', onPress: () => { void openDocument(id); } },
      ]);
    } else void openDocument(id);
  };

  const choosePhoto = async () => {
    if (busy.current || capabilities?.upload_enabled !== true) return;
    busy.current = true;
    setWorking('choose');
    setError('');
    setNotice('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Permita o acesso às fotografias para selecionar uma imagem do documento.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1 });
      if (result.canceled || !result.assets[0]) return;
      setUpload(preparePhotoUpload(result.assets[0], capabilities.max_bytes));
      setConsent(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível selecionar a imagem.');
    } finally { busy.current = false; setWorking(''); }
  };

  const uploadPhoto = async () => {
    if (busy.current || !upload || !consent || capabilities?.upload_enabled !== true) return;
    if (dirty) {
      setError('Guarde ou rejeite a revisão atual antes de enviar outro documento.');
      return;
    }
    busy.current = true;
    setWorking('upload');
    setError('');
    setNotice('');
    try {
      const document = await sendDocumentUpload(api, upload, consent);
      remember(document);
      setDraft(startDocumentReview(document));
      setUpload(null);
      setConsent(false);
      setNotice(document.status === 'blocked' ? 'O documento foi bloqueado e não pode ser lido.' : 'Documento recebido. Consulte o estado abaixo para continuar.');
    } catch (failure) {
      setError(documentError(failure, 'Não foi possível confirmar o envio. A imagem foi mantida; pode tentar novamente.'));
      // Keep the same image and idempotency key after an uncertain response.
    } finally { busy.current = false; setWorking(''); }
  };

  const processDocument = async () => {
    if (busy.current || !draft || !canProcessDocument(draft.document)) return;
    busy.current = true;
    setWorking('process');
    setError('');
    setNotice('');
    try {
      const response = await api.post<PatientDocument>(`${BASE}/${encodeURIComponent(draft.document.id)}/process`, { version: draft.document.version }, { timeout: 60_000 });
      setDraft(startDocumentReview(response.data));
      remember(response.data);
      setNotice(response.data.status === 'ready_for_review' ? 'Texto extraído. Reveja-o antes de confirmar.' : 'Estado atualizado. Consulte as instruções do documento.');
    } catch (failure: any) {
      if (failure.response?.status === 409) {
        try {
          const latest = await api.get<PatientDocument>(`${BASE}/${encodeURIComponent(draft.document.id)}`);
          remember(latest.data);
          setDraft(startDocumentReview(latest.data));
          setError('O documento foi atualizado noutra sessão. Reveja o estado atual antes de continuar.');
        } catch { setError('Não foi possível obter a versão atual. Tente atualizar o documento.'); }
      } else setError(documentError(failure, 'Não foi possível ler o documento. Pode tentar novamente.'));
    } finally { busy.current = false; setWorking(''); }
  };

  const review = async (decision: 'confirm' | 'reject') => {
    if (busy.current || !draft) return;
    busy.current = true;
    setWorking('review');
    setError('');
    setNotice('');
    try {
      const result = await saveDocumentReview(api, draft, decision);
      setDraft(result.draft);
      remember(result.draft.document);
      if (result.saved) setNotice(decision === 'confirm' ? 'O texto foi confirmado por si e guardado.' : 'A sua rejeição foi guardada.');
      else setError('O documento mudou noutra sessão. O seu texto foi mantido. Compare-o com a versão atual antes de continuar.');
    } catch (failure) {
      setError(documentError(failure, 'Não foi possível confirmar que a revisão foi guardada. O seu texto foi mantido; tente novamente.'));
    } finally { busy.current = false; setWorking(''); }
  };

  const refreshDocument = async () => {
    if (busy.current || !draft) return;
    busy.current = true;
    setWorking('refresh-document');
    setError('');
    setNotice('');
    try {
      const response = await api.get<PatientDocument>(`${BASE}/${encodeURIComponent(draft.document.id)}`);
      remember(response.data);
      setDraft(dirty ? reconcileDocumentReview(draft, response.data) : startDocumentReview(response.data));
      setNotice(dirty ? 'A versão atual foi obtida. As suas alterações foram mantidas para comparação.' : 'Estado do documento atualizado.');
    } catch (failure) { setError(documentError(failure, 'Não foi possível atualizar. O seu texto foi mantido.')); }
    finally { busy.current = false; setWorking(''); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={TEAL} /><Text>A carregar documentos…</Text></View>;
  const document = draft?.document;
  const reviewable = !!document && canReviewDocument(document);
  const uploadAvailable = capabilities?.upload_enabled === true;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Os meus documentos</Text>
      <Text style={styles.body}>Envie exames ou relatórios e reveja o texto. A sua confirmação fica separada do processo clínico e não constitui validação médica.</Text>
      <View style={styles.card}>
        <Text style={styles.heading}>Adicionar documento</Text>
        <Text style={styles.body}>Nesta aplicação pode selecionar imagens JPG ou PNG, até {Math.floor((capabilities?.max_bytes || 10_485_760) / 1024 / 1024)} MB. Para enviar um PDF, utilize a Kaya na web.</Text>
        <Text style={styles.body}>A leitura automática está disponível para PDFs com texto. Fotografias e PDFs digitalizados precisam de transcrição manual nesta fase.</Text>
        {!uploadAvailable && <Text accessibilityRole="alert" style={styles.warning}>{capabilities?.message || 'O envio está temporariamente indisponível. Pode consultar e rever os documentos já enviados.'}</Text>}
        <Action label={upload ? 'Escolher outra imagem' : 'Escolher imagem'} onPress={choosePhoto} disabled={!!working || !uploadAvailable} secondary />
        {upload && <>
          <Image source={{ uri: upload.file.uri }} style={styles.preview} accessibilityLabel="Imagem selecionada para envio" resizeMode="contain" />
          <Text style={styles.filename}>{upload.file.name}</Text>
          <View style={styles.consentRow}>
            <Switch value={consent} onValueChange={setConsent} disabled={!!working || !uploadAvailable} accessibilityLabel="Autorizar o tratamento deste documento" trackColor={{ true: '#5eead4' }} />
            <Text style={styles.consent}>Autorizo a Kaya a guardar e tratar este documento, que pode conter dados de saúde, para extrair texto e permitir a minha revisão.</Text>
          </View>
          <Action label="Enviar documento" onPress={uploadPhoto} disabled={!!working || !consent || !uploadAvailable || dirty} />
        </>}
      </View>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      {notice ? <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text> : null}
      {working ? <ActivityIndicator color={TEAL} accessibilityLabel="Operação em curso" /> : null}
      <View style={styles.listHeader}><Text style={styles.heading}>Documentos enviados</Text><Action label="Atualizar lista" onPress={load} disabled={!!working} secondary /></View>
      {listError ? <Text style={styles.error} accessibilityRole="alert">{listError}</Text> : null}
      {!documents.length && !listError ? <Text style={styles.body}>Ainda não enviou documentos.</Text> : null}
      {documents.map(item => <TouchableOpacity key={item.id} onPress={() => selectDocument(item.id)} disabled={!!working} accessibilityRole="button" accessibilityState={{ selected: item.id === document?.id, disabled: !!working }} style={[styles.documentRow, item.id === document?.id && styles.selected]}>
        <Text style={styles.filename}>{item.original_filename}</Text>
        <Text style={styles.body}>{DOCUMENT_STATUS[item.status] || 'Estado indisponível'}</Text>
        <Text style={styles.meta}>{Math.ceil(item.size_bytes / 1024)} KB · {new Date(item.created_at).toLocaleDateString('pt-PT')}</Text>
      </TouchableOpacity>)}
      {document && draft && <View style={styles.card}>
        <Text style={styles.heading}>{document.original_filename}</Text>
        <Text style={styles.status}>{DOCUMENT_STATUS[document.status] || 'Estado indisponível'}</Text>
        {document.status === 'blocked' && <Text style={styles.warning}>O ficheiro não passou a verificação de segurança e não pode ser lido ou revisto.</Text>}
        {document.status === 'processing_failed' && <Text style={styles.warning}>A leitura não foi concluída. Nenhum resultado foi confirmado. Pode tentar novamente.</Text>}
        {document.status === 'needs_manual_review' && <Text style={styles.warning}>{manualReviewMessage(document)}</Text>}
        {document.status === 'confirmed' && <Text style={styles.body}>Este texto foi confirmado por si. Um profissional ainda não o validou clinicamente.</Text>}
        {document.status === 'rejected' && <Text style={styles.body}>A revisão foi rejeitada. Este texto não foi confirmado para utilização.</Text>}
        <Text style={styles.meta}>O ficheiro original pode ser consultado através da sua conta na Kaya na web.</Text>
        {canProcessDocument(document) && <Action label={document.status === 'processing_failed' ? 'Tentar ler novamente' : 'Ler documento'} onPress={processDocument} disabled={!!working || !uploadAvailable} />}
        {document.extracted_text ? <><Text style={styles.label}>Texto extraído automaticamente</Text><Text selectable style={styles.extracted}>{document.extracted_text}</Text></> : null}
        {(reviewable || document.reviewed_text !== null || draft.conflict) && <>
          <Text style={styles.label}>{reviewable ? 'Reveja e corrija o texto' : draft.conflict ? 'O seu texto não guardado' : 'Texto da sua revisão'}</Text>
          <TextInput accessibilityLabel="Texto da revisão" multiline value={draft.text} onChangeText={text => setDraft(current => current ? { ...current, text } : current)} editable={reviewable && !working} maxLength={DOCUMENT_TEXT_LIMIT} textAlignVertical="top" style={styles.editor} placeholder="Transcreva aqui o texto do documento" />
          <Text style={styles.meta}>{draft.text.length.toLocaleString('pt-PT')} / 100 000 caracteres</Text>
        </>}
        {draft.conflict && <View style={styles.conflict}>
          <Text style={styles.heading}>Comparar com a versão atual</Text>
          <Text style={styles.body}>O seu texto acima foi preservado. A versão atual é a {document.version} ({DOCUMENT_STATUS[document.status]}).</Text>
          <Text selectable style={styles.extracted}>{document.reviewed_text ?? document.extracted_text ?? 'A versão atual não contém texto.'}</Text>
          {reviewable ? <Action label="Continuar com o meu texto nesta versão" onPress={() => setDraft(current => current ? { ...current, conflict: false } : current)} disabled={!!working} secondary /> : <Text style={styles.warning}>A revisão desta versão já foi concluída. O seu texto não foi enviado novamente.</Text>}
          <Action label="Descartar as minhas alterações e usar a versão atual" onPress={() => setDraft(startDocumentReview(document))} disabled={!!working} secondary />
        </View>}
        {reviewable && <>
          <Text style={styles.body}>Confirme apenas depois de comparar com o documento original. Esta revisão não cria diagnósticos, receitas ou outros registos clínicos.</Text>
          <Action label="Confirmar texto" onPress={() => review('confirm')} disabled={!!working || draft.conflict || !draft.text.trim()} />
          <Action label="Rejeitar revisão" onPress={() => Alert.alert('Rejeitar esta revisão?', 'O texto não será confirmado. Esta decisão encerra a revisão deste documento.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Rejeitar', style: 'destructive', onPress: () => { void review('reject'); } }])} disabled={!!working || draft.conflict} secondary />
        </>}
        <Action label="Atualizar documento" onPress={refreshDocument} disabled={!!working} secondary />
      </View>}
    </ScrollView>
  );
}

function Action({ label, onPress, disabled, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]} disabled={disabled} onPress={onPress}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 48, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 25, fontWeight: '800', color: '#0f172a' },
  heading: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  body: { fontSize: 14, lineHeight: 21, color: '#475569' },
  meta: { fontSize: 12, lineHeight: 18, color: '#64748b' },
  card: { padding: 18, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  preview: { height: 200, width: '100%', backgroundColor: '#f1f5f9', borderRadius: 8 },
  filename: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  consentRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  consent: { flex: 1, color: '#334155', fontSize: 13, lineHeight: 19 },
  warning: { color: '#92400e', backgroundColor: '#fffbeb', padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 19 },
  error: { color: '#991b1b', backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, lineHeight: 20 },
  notice: { color: '#065f46', backgroundColor: '#ecfdf5', padding: 12, borderRadius: 8, lineHeight: 20 },
  listHeader: { gap: 8, marginTop: 6 },
  documentRow: { padding: 15, gap: 4, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  selected: { borderColor: TEAL, backgroundColor: '#f0fdfa' },
  status: { color: '#0f766e', fontWeight: '700', fontSize: 13 },
  label: { color: '#334155', fontWeight: '700', fontSize: 14, marginTop: 6 },
  extracted: { padding: 12, borderRadius: 8, color: '#334155', backgroundColor: '#f8fafc', fontSize: 14, lineHeight: 21 },
  editor: { minHeight: 190, maxHeight: 400, borderWidth: 1, borderColor: '#94a3b8', borderRadius: 8, padding: 12, color: '#0f172a', backgroundColor: '#fff', fontSize: 15, lineHeight: 22 },
  conflict: { borderWidth: 1, borderColor: '#fbbf24', backgroundColor: '#fffbeb', borderRadius: 8, padding: 12, gap: 10 },
  button: { backgroundColor: TEAL, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 9, alignItems: 'center' },
  secondary: { backgroundColor: '#e2e8f0' },
  disabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  secondaryText: { color: '#334155' },
});
