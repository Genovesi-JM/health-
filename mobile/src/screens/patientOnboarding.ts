export const PATIENT_CONSENT_VERSION = 'patient-onboarding-v1';
export const PATIENT_SCOPE = '?role=patient';
export const REQUIRED_PATIENT_CONSENTS = [
  'c_terms', 'c_privacy', 'c_health', 'c_telemedicine', 'c_medical_disclaimer',
] as const;
export const OPTIONAL_PATIENT_CONSENTS = ['c_family_share', 'c_analytics', 'c_marketing', 'c_research'] as const;

export type PatientStep = Record<string, unknown>;
export type PatientData = Record<string, PatientStep>;
export interface PatientDraft {
  id: string;
  role: string;
  status: string;
  completion_status?: string;
  current_step: number;
  total_steps: number;
  completed_steps: number[];
  data: PatientData;
}
type PatientIdentity = { email: string; full_name: string };

const asStep = (value: unknown): PatientStep => value && typeof value === 'object' && !Array.isArray(value)
  ? value as PatientStep : {};

/** Seed only useful defaults. Untouched optional health fields remain absent. */
export function patientDataForDraft(identity: PatientIdentity, stored: unknown): PatientData {
  const source = asStep(stored);
  const defaults: PatientData = {
    '1': { language: 'pt', channel: 'email' },
    '2': { email: identity.email },
    '3': { full_name: identity.full_name },
    '4': { country: 'AO' }, '5': {}, '6': {},
    '7': { consent_version: PATIENT_CONSENT_VERSION }, '8': {},
  };
  const data = Object.fromEntries(Object.keys(defaults).map(step => [step, { ...defaults[step], ...asStep(source[step]) }]));
  // Account email changes belong to security settings, never this form.
  data['2'].email = identity.email;
  if (asStep(source['7']).consent_version !== PATIENT_CONSENT_VERSION) {
    for (const key of [...REQUIRED_PATIENT_CONSENTS, ...OPTIONAL_PATIENT_CONSENTS]) data['7'][key] = false;
    data['7'].consent_version = PATIENT_CONSENT_VERSION;
  }
  return data;
}

const valueText = (data: PatientStep, key: string) => typeof data[key] === 'string' ? (data[key] as string).trim() : '';
export const validPatientPhone = (value: string) => /^\+[1-9][0-9]{6,14}$/.test(value.replace(/[\s()\-]/g, ''));

export function validatePatientStep(step: number, data: PatientData, identity: PatientIdentity, today = new Date().toISOString().slice(0, 10)): string | null {
  const fields = data[String(step)] ?? {};
  const text = (key: string) => valueText(fields, key);
  if (step === 1 && (!['pt', 'en', 'fr', 'es', 'zh'].includes(text('language')) || !['email', 'sms', 'both'].includes(text('channel')))) {
    return 'Selecione o idioma e a preferência de contacto.';
  }
  if (step === 2) {
    if (text('email').toLowerCase() !== identity.email.trim().toLowerCase()) return 'Use o email da sua conta.';
    const required = ['sms', 'both'].includes(valueText(data['1'], 'channel'));
    if ((required || text('phone')) && !validPatientPhone(text('phone'))) return 'Introduza o contacto em formato internacional, por exemplo +244900000000.';
  }
  if (step === 3) {
    if (!text('full_name') || text('full_name').length > 200) return 'Indique o nome completo (até 200 caracteres).';
    const dob = text('dob');
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(dob) ? new Date(`${dob}T00:00:00Z`) : new Date(NaN);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dob || dob > today) return 'Use uma data de nascimento válida, não futura, no formato AAAA-MM-DD.';
    if (!['', 'female', 'male', 'intersex', 'other'].includes(text('sex'))) return 'Selecione uma opção válida para sexo.';
  }
  if (step === 4 && !['AO', 'PT'].includes(text('country'))) return 'Selecione Angola ou Portugal.';
  if (step === 5 && !['', 'unknown', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(text('blood_type'))) return 'Selecione um grupo sanguíneo válido.';
  if (step === 6) {
    if (!text('ec_name') || !validPatientPhone(text('ec_phone'))) return 'Indique o nome do contacto de emergência e um telefone em formato internacional.';
    if (text('ec_alt_phone') && !validPatientPhone(text('ec_alt_phone'))) return 'Use o formato internacional para o telefone alternativo.';
    if (fields.ec_consent !== true) return 'Confirme a autorização do contacto de emergência.';
  }
  if (step === 7) {
    if (fields.consent_version !== PATIENT_CONSENT_VERSION || REQUIRED_PATIENT_CONSENTS.some(key => fields[key] !== true)) return 'Reveja e aceite os cinco consentimentos obrigatórios.';
    if (OPTIONAL_PATIENT_CONSENTS.some(key => key in fields && typeof fields[key] !== 'boolean')) return 'Confirme as suas escolhas opcionais.';
  }
  return null;
}

export function patientDraftComplete(draft: PatientDraft | null | undefined): boolean {
  return draft?.status === 'submitted' && draft.completion_status === 'complete';
}

interface PatientDraftApi {
  get: (url: string) => Promise<{ data: any }>;
  put: (url: string, body: unknown) => Promise<{ data: any }>;
  post: (url: string, body?: unknown) => Promise<{ data: any }>;
}

/** A retry first checks whether the previous submit already committed. */
export async function submitPatientDraft(api: PatientDraftApi, review: PatientStep): Promise<PatientDraft> {
  const status = await api.get(`/api/v1/onboarding/status${PATIENT_SCOPE}`);
  if (patientDraftComplete(status.data.draft)) return status.data.draft;
  await api.put(`/api/v1/onboarding/steps/8${PATIENT_SCOPE}`, { data: review, completed: true });
  const response = await api.post(`/api/v1/onboarding/submit${PATIENT_SCOPE}`);
  if (!patientDraftComplete(response.data)) throw new Error('Não foi possível confirmar a conclusão do perfil. Tente novamente.');
  return response.data;
}
