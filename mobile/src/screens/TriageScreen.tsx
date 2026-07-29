import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import TriagePhotoGuide, { type ViewType } from '../components/TriagePhotoGuide';
import api from '../services/api';
import { apiErrorMessage } from '../utils/apiError';

type Step = 'start' | 'questions' | 'result';
type Answer = string | number | boolean;

type TriageQuestion = {
  key: string;
  text?: string;
  label?: string;
  type: 'boolean' | 'number' | 'select' | 'scale';
  required?: boolean;
  options?: string[];
};

type TriageResult = {
  triage_id: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  recommended_action: string;
  score: number;
  disclaimer?: string;
};

type PhotoRequest = {
  id: string;
  triage_session_id: string;
  view_type: ViewType;
  message?: string;
  chief_complaint?: string;
  doctor_name?: string;
};

const TEAL = '#0d9488';

const CATEGORIES = [
  { value: 'general', label: 'Geral', icon: '🩺' },
  { value: 'respiratory', label: 'Respiração', icon: '🫁' },
  { value: 'cardiac', label: 'Coração', icon: '❤️' },
  { value: 'gi', label: 'Digestivo', icon: '🫃' },
  { value: 'urinary', label: 'Urinário', icon: '💧' },
  { value: 'skin', label: 'Pele', icon: '🩹' },
  { value: 'injury', label: 'Lesão', icon: '🤕' },
  { value: 'neuro', label: 'Neurológico', icon: '🧠' },
  { value: 'mental', label: 'Saúde mental', icon: '🌿' },
  { value: 'medication', label: 'Medicação', icon: '💊' },
  { value: 'chronic', label: 'Doença crónica', icon: '📋' },
] as const;

const RESULT_STYLE = {
  LOW: { color: '#15803d', background: '#dcfce7', label: 'Baixo' },
  MEDIUM: { color: '#a16207', background: '#fef9c3', label: 'Médio' },
  HIGH: { color: '#c2410c', background: '#ffedd5', label: 'Alto' },
  URGENT: { color: '#b91c1c', background: '#fee2e2', label: 'Urgente' },
};

const ACTION_LABELS: Record<string, string> = {
  SELF_CARE: 'Autocuidados e vigilância. Procure ajuda se houver agravamento.',
  DOCTOR_24H: 'Fale com um profissional de saúde nas próximas 24 horas.',
  DOCTOR_NOW: 'Procure avaliação médica o mais rapidamente possível.',
  ER_NOW: 'Procure um serviço de urgência imediatamente.',
};

export default function TriageScreen() {
  const [step, setStep] = useState<Step>('start');
  const [ageGroup, setAgeGroup] = useState<'adult' | 'pediatric'>('adult');
  const [guardian, setGuardian] = useState(false);
  const [category, setCategory] = useState('general');
  const [complaint, setComplaint] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [questions, setQuestions] = useState<TriageQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [result, setResult] = useState<TriageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingPhotoRequests, setPendingPhotoRequests] = useState<PhotoRequest[]>([]);

  useEffect(() => {
    api.get<PhotoRequest[]>('/api/v1/triage/photo-requests/pending')
      .then(response => setPendingPhotoRequests(response.data))
      .catch(() => setPendingPhotoRequests([]));
  }, []);

  const startTriage = async () => {
    if (complaint.trim().length < 3) {
      setError('Descreva brevemente o principal problema de saúde.');
      return;
    }
    if (ageGroup === 'pediatric' && !guardian) {
      setError('Confirme que está a responder como responsável pela criança.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/api/v1/triage/start', {
        chief_complaint: complaint.trim(),
        age_group: ageGroup,
        category,
        answered_by_guardian: ageGroup === 'pediatric' ? guardian : false,
      });
      setSessionId(response.data.triage_id ?? response.data.session_id);
      setQuestions(response.data.questions ?? []);
      setAnswers({});
      setStep('questions');
    } catch (startError) {
      setError(apiErrorMessage(startError, 'Não foi possível iniciar a triagem.'));
    } finally {
      setLoading(false);
    }
  };

  const submitTriage = async () => {
    const missing = questions.filter(question =>
      question.required && answers[question.key] === undefined,
    );
    if (missing.length) {
      Alert.alert(
        'Respostas em falta',
        `Responda às ${missing.length} pergunta${missing.length === 1 ? '' : 's'} obrigatória${missing.length === 1 ? '' : 's'}.`,
      );
      return;
    }
    setLoading(true);
    setError('');
    try {
      const answerList = Object.entries(answers).map(([question_key, answer]) => ({
        question_key,
        answer,
      }));
      await api.post(`/api/v1/triage/${sessionId}/answers`, { answers: answerList });
      const response = await api.post(`/api/v1/triage/${sessionId}/complete`, {});
      setResult(response.data);
      setStep('result');
    } catch (submitError) {
      setError(apiErrorMessage(submitError, 'Não foi possível concluir a triagem.'));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('start');
    setComplaint('');
    setSessionId('');
    setQuestions([]);
    setAnswers({});
    setResult(null);
    setError('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>✦</Text>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Orientação de saúde</Text>
            <Text style={styles.heroText}>
              Responda a algumas perguntas para receber uma recomendação segura.
            </Text>
          </View>
        </View>

        <View style={styles.safetyBanner}>
          <Text style={styles.safetyTitle}>Não é um diagnóstico médico</Text>
          <Text style={styles.safetyText}>
            Em caso de dificuldade respiratória, dor forte no peito, desmaio ou perigo imediato,
            contacte o 112.
          </Text>
        </View>

        {step === 'start' && pendingPhotoRequests.length > 0 && (
          <View style={styles.requestsSection}>
            <Text style={styles.requestsTitle}>Fotografias pedidas pelo profissional</Text>
            {Array.from(new Set(
              pendingPhotoRequests.map(request => request.triage_session_id),
            )).map(triageId => {
              const requests = pendingPhotoRequests.filter(
                request => request.triage_session_id === triageId,
              );
              const first = requests[0];
              return (
                <View style={styles.requestCard} key={triageId}>
                  <Text style={styles.requestComplaint}>
                    {first.chief_complaint || 'Triagem clínica'}
                  </Text>
                  <Text style={styles.requestClinician}>
                    {first.doctor_name || 'Profissional de saúde associado'}
                  </Text>
                  {requests.map(request => request.message ? (
                    <Text style={styles.requestMessage} key={request.id}>{request.message}</Text>
                  ) : null)}
                  <TriagePhotoGuide
                    sessionId={triageId}
                    requestedViews={requests.map(request => request.view_type)}
                    onPhotoUploaded={viewType => setPendingPhotoRequests(current =>
                      current.filter(request =>
                        request.triage_session_id !== triageId
                        || request.view_type !== viewType,
                      ),
                    )}
                  />
                </View>
              );
            })}
          </View>
        )}

        {step === 'start' && (
          <StartStep
            ageGroup={ageGroup}
            category={category}
            complaint={complaint}
            guardian={guardian}
            loading={loading}
            onAgeGroup={value => {
              setAgeGroup(value);
              if (value === 'adult') setGuardian(false);
            }}
            onCategory={setCategory}
            onComplaint={setComplaint}
            onGuardian={setGuardian}
            onStart={() => void startTriage()}
          />
        )}

        {step === 'questions' && (
          <View>
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>Motivo da triagem</Text>
              <Text style={styles.summaryText}>{complaint}</Text>
            </View>
            {(category === 'skin' || category === 'injury') && (
              <TriagePhotoGuide sessionId={sessionId} />
            )}
            <Text style={styles.sectionTitle}>Perguntas clínicas</Text>
            <Text style={styles.sectionHelp}>* resposta obrigatória</Text>
            {questions.map((question, index) => (
              <QuestionCard
                answer={answers[question.key]}
                index={index}
                key={question.key}
                onAnswer={answer => setAnswers(current => {
                  const next = { ...current };
                  if (answer === undefined) delete next[question.key];
                  else next[question.key] = answer;
                  return next;
                })}
                question={question}
              />
            ))}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('start')}>
                <Text style={styles.secondaryButtonText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.growButton, loading && styles.disabled]}
                disabled={loading}
                onPress={() => void submitTriage()}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryButtonText}>Obter orientação</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 'result' && result && (
          <ResultStep result={result} onReset={reset} />
        )}
        {step === 'start' && error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type StartStepProps = {
  ageGroup: 'adult' | 'pediatric';
  category: string;
  complaint: string;
  guardian: boolean;
  loading: boolean;
  onAgeGroup: (value: 'adult' | 'pediatric') => void;
  onCategory: (value: string) => void;
  onComplaint: (value: string) => void;
  onGuardian: (value: boolean) => void;
  onStart: () => void;
};

function StartStep(props: StartStepProps) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Para quem é esta triagem?</Text>
      <View style={styles.segment}>
        {(['adult', 'pediatric'] as const).map(value => (
          <TouchableOpacity
            key={value}
            style={[styles.segmentButton, props.ageGroup === value && styles.segmentActive]}
            onPress={() => props.onAgeGroup(value)}
          >
            <Text style={[
              styles.segmentText,
              props.ageGroup === value && styles.segmentTextActive,
            ]}>
              {value === 'adult' ? 'Adulto' : 'Criança'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {props.ageGroup === 'pediatric' && (
        <View style={styles.guardianRow}>
          <Switch
            value={props.guardian}
            onValueChange={props.onGuardian}
            trackColor={{ true: '#5eead4' }}
          />
          <Text style={styles.guardianText}>Sou responsável pela criança e respondo por ela.</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Qual é a área principal?</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map(item => (
          <TouchableOpacity
            key={item.value}
            style={[
              styles.category,
              props.category === item.value && styles.categoryActive,
            ]}
            onPress={() => props.onCategory(item.value)}
          >
            <Text style={styles.categoryIcon}>{item.icon}</Text>
            <Text style={[
              styles.categoryText,
              props.category === item.value && styles.categoryTextActive,
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>O que está a acontecer?</Text>
      <TextInput
        multiline
        onChangeText={props.onComplaint}
        placeholder="Descreva os sintomas, quando começaram e o que mais o preocupa."
        placeholderTextColor="#94a3b8"
        style={styles.complaintInput}
        textAlignVertical="top"
        value={props.complaint}
      />
      <TouchableOpacity
        style={[styles.primaryButton, props.loading && styles.disabled]}
        disabled={props.loading}
        onPress={props.onStart}
      >
        {props.loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.primaryButtonText}>Começar triagem →</Text>}
      </TouchableOpacity>
    </View>
  );
}

function QuestionCard({
  answer,
  index,
  onAnswer,
  question,
}: {
  answer?: Answer;
  index: number;
  onAnswer: (answer: Answer | undefined) => void;
  question: TriageQuestion;
}) {
  return (
    <View style={styles.questionCard}>
      <Text style={styles.questionText}>
        <Text style={styles.questionNumber}>{index + 1}. </Text>
        {question.label || question.text || question.key}
        {question.required ? ' *' : ''}
      </Text>
      {question.type === 'boolean' && (
        <View style={styles.answerRow}>
          {[
            { label: 'Sim', value: true },
            { label: 'Não', value: false },
          ].map(option => (
            <TouchableOpacity
              key={option.label}
              style={[styles.answerButton, answer === option.value && styles.answerActive]}
              onPress={() => onAnswer(option.value)}
            >
              <Text style={[
                styles.answerText,
                answer === option.value && styles.answerTextActive,
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {question.type === 'number' && (
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={value => {
            const normalized = value.replace(',', '.');
            if (normalized === '') {
              onAnswer(undefined);
            } else if (!Number.isNaN(Number(normalized))) {
              onAnswer(Number(normalized));
            }
          }}
          placeholder="0"
          placeholderTextColor="#94a3b8"
          style={styles.numberInput}
          value={answer === undefined ? '' : String(answer)}
        />
      )}
      {(question.type === 'select' || question.type === 'scale') && (
        <View style={styles.answerWrap}>
          {(question.type === 'scale'
            ? Array.from({ length: 10 }, (_, value) => String(value + 1))
            : question.options ?? []
          ).map(option => (
            <TouchableOpacity
              key={option}
              style={[styles.choiceChip, String(answer ?? '') === option && styles.answerActive]}
              onPress={() => onAnswer(question.type === 'scale' ? Number(option) : option)}
            >
              <Text style={[
                styles.choiceText,
                String(answer ?? '') === option && styles.answerTextActive,
              ]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function ResultStep({ result, onReset }: { result: TriageResult; onReset: () => void }) {
  const resultStyle = RESULT_STYLE[result.risk_level] ?? RESULT_STYLE.MEDIUM;
  return (
    <View style={styles.resultCard}>
      <View style={[styles.resultIcon, { backgroundColor: resultStyle.background }]}>
        <Text style={styles.resultIconText}>{result.risk_level === 'URGENT' ? '!' : '✓'}</Text>
      </View>
      <Text style={styles.resultEyebrow}>Nível de orientação</Text>
      <Text style={[styles.resultTitle, { color: resultStyle.color }]}>{resultStyle.label}</Text>
      <View style={[styles.actionCard, { backgroundColor: resultStyle.background }]}>
        <Text style={[styles.actionText, { color: resultStyle.color }]}>
          {ACTION_LABELS[result.recommended_action] ?? result.recommended_action}
        </Text>
      </View>
      <Text style={styles.disclaimer}>
        Este resultado não constitui diagnóstico médico. Se os sintomas piorarem ou surgir um sinal
        de alarme, procure ajuda imediatamente.
      </Text>
      <TouchableOpacity style={styles.primaryButton} onPress={onReset}>
        <Text style={styles.primaryButtonText}>Fazer nova triagem</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: '#f8fafc', flex: 1 },
  content: { padding: 18, paddingBottom: 42 },
  hero: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 14 },
  heroIcon: {
    backgroundColor: '#ccfbf1',
    borderRadius: 13,
    color: '#0f766e',
    fontSize: 24,
    overflow: 'hidden',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  heroCopy: { flex: 1 },
  heroTitle: { color: '#0f172a', fontSize: 22, fontWeight: '800' },
  heroText: { color: '#64748b', fontSize: 13, lineHeight: 18, marginTop: 2 },
  safetyBanner: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 13,
    borderWidth: 1,
    marginBottom: 22,
    padding: 13,
  },
  safetyTitle: { color: '#9a3412', fontSize: 13, fontWeight: '800' },
  safetyText: { color: '#9a3412', fontSize: 11, lineHeight: 17, marginTop: 3 },
  requestsSection: { gap: 10, marginBottom: 18 },
  requestsTitle: { color: '#92400e', fontSize: 16, fontWeight: '800' },
  requestCard: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderRadius: 15,
    borderWidth: 1,
    padding: 13,
  },
  requestComplaint: { color: '#0f172a', fontSize: 14, fontWeight: '800' },
  requestClinician: { color: '#64748b', fontSize: 11, marginTop: 2 },
  requestMessage: { color: '#92400e', fontSize: 12, lineHeight: 17, marginVertical: 8 },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
    marginTop: 5,
  },
  sectionHelp: { color: '#94a3b8', fontSize: 11, marginBottom: 10, marginTop: -7 },
  segment: {
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    flexDirection: 'row',
    marginBottom: 18,
    padding: 4,
  },
  segmentButton: { alignItems: 'center', borderRadius: 9, flex: 1, padding: 10 },
  segmentActive: { backgroundColor: '#fff' },
  segmentText: { color: '#64748b', fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: '#0f766e' },
  guardianRow: {
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    marginTop: -8,
    padding: 11,
  },
  guardianText: { color: '#334155', flex: 1, fontSize: 12, lineHeight: 17 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  category: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  categoryActive: { backgroundColor: '#f0fdfa', borderColor: TEAL },
  categoryIcon: { fontSize: 15 },
  categoryText: { color: '#475569', fontSize: 12, fontWeight: '600' },
  categoryTextActive: { color: '#0f766e' },
  complaintInput: {
    backgroundColor: '#fff',
    borderColor: '#cbd5e1',
    borderRadius: 13,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    minHeight: 112,
    padding: 13,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: TEAL,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
  },
  secondaryButtonText: { color: '#475569', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  growButton: { flex: 1 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 5 },
  summary: { backgroundColor: '#e0f2fe', borderRadius: 12, marginBottom: 15, padding: 13 },
  summaryLabel: { color: '#0369a1', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  summaryText: { color: '#0c4a6e', fontSize: 13, lineHeight: 18, marginTop: 3 },
  questionCard: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    padding: 14,
  },
  questionText: { color: '#0f172a', fontSize: 13, fontWeight: '700', lineHeight: 19 },
  questionNumber: { color: TEAL },
  answerRow: { flexDirection: 'row', gap: 9, marginTop: 12 },
  answerButton: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  answerActive: { backgroundColor: TEAL, borderColor: TEAL },
  answerText: { color: '#475569', fontSize: 13, fontWeight: '700' },
  answerTextActive: { color: '#fff' },
  numberInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 9,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 14,
    marginTop: 11,
    padding: 10,
    width: 110,
  },
  answerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 },
  choiceChip: {
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 38,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  choiceText: { color: '#475569', fontSize: 12, textAlign: 'center' },
  error: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    color: '#b91c1c',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
    marginTop: 10,
    padding: 11,
  },
  resultCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 22,
  },
  resultIcon: {
    alignItems: 'center',
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  resultIconText: { color: '#0f172a', fontSize: 31, fontWeight: '900' },
  resultEyebrow: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 15,
    textTransform: 'uppercase',
  },
  resultTitle: { fontSize: 28, fontWeight: '900', marginTop: 3 },
  actionCard: { borderRadius: 13, marginVertical: 18, padding: 15, width: '100%' },
  actionText: { fontSize: 15, fontWeight: '800', lineHeight: 21, textAlign: 'center' },
  disclaimer: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
});
