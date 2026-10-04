export type PatientConsultation = {
  id: string;
  specialty: string;
  status: string;
  scheduled_at?: string | null;
  scheduled_end_at?: string | null;
  slot_id?: string | null;
  country?: 'AO' | 'PT' | null;
  timezone?: string | null;
  doctor_id?: string | null;
  payment_status?: string;
  payment_id?: string | null;
  reschedule_revision?: number;
  started_at?: string | null;
  ended_at?: string | null;
};

export type ConsultationCloseout = {
  patient_summary: string;
  follow_up_instructions: string | null;
  outcome: string;
  finalized_at: string;
  finalized_by: string;
  finalized_by_name: string | null;
  follow_up_required: boolean;
  follow_up: null | {
    id: string;
    assigned_user_id: string | null;
    assigned_name: string | null;
    due_at: string | null;
    status: string;
  };
  published_revision?: number;
  published_history?: PublishedPatientSummary[];
};

export type PublishedPatientSummary = {
  revision: number;
  patient_summary: string;
  published_at: string;
  author_name: string;
};

export type CloseoutResponse = {
  consultation_id: string;
  status: string;
  closeout: ConsultationCloseout | null;
};

export type VideoCapabilities = {
  enabled: boolean;
  provider: string | null;
  recording_enabled: boolean;
  message: string;
};

export type PatientConsultationDetail = {
  result: CloseoutResponse;
  consultation: PatientConsultation | null;
  capabilities: VideoCapabilities | null;
  metadataUnavailable: boolean;
};

export const CONSULTATION_STATUS: Record<string, string> = {
  requested: 'A aguardar aceitação', scheduled: 'Horário confirmado',
  in_progress: 'Em curso', completed: 'Concluída',
  cancelled: 'Cancelada', no_show: 'Não realizada',
};

export const CONSULTATION_OUTCOME: Record<string, string> = {
  resolved: 'Consulta concluída', follow_up: 'Acompanhamento recomendado',
  referral: 'Encaminhamento', er: 'Encaminhamento para urgência',
};

export const FOLLOW_UP_STATUS: Record<string, string> = {
  open: 'Pendente', pending: 'Pendente', in_progress: 'Em curso', completed: 'Concluído',
  cancelled: 'Cancelado', overdue: 'Em atraso',
};

type ConsultationApi = {
  get: (path: string) => Promise<{ data: any }>;
};

class InvalidPatientCloseout extends Error {}

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const textOrNull = (value: unknown): string | null => typeof value === 'string' ? value : null;

/** Copy only patient-visible fields. Clinician SOAP, amendments, reasons and
 * unpublished revision metadata must never enter this screen's state. */
export function patientCloseoutResponse(value: unknown, id: string): CloseoutResponse {
  const response = record(value);
  if (response.consultation_id !== id) throw new InvalidPatientCloseout('A consulta recebida não corresponde ao pedido.');
  if (typeof response.status !== 'string') throw new InvalidPatientCloseout('Não foi possível verificar o estado da consulta.');
  if (response.closeout === null) return { consultation_id: id, status: response.status, closeout: null };
  const source = record(response.closeout);
  if (typeof source.patient_summary !== 'string' || typeof source.outcome !== 'string' ||
      typeof source.finalized_at !== 'string' || typeof source.finalized_by !== 'string' ||
      typeof source.follow_up_required !== 'boolean') {
    throw new InvalidPatientCloseout('Não foi possível verificar o resumo publicado.');
  }
  const followUp = record(source.follow_up);
  const closeout: ConsultationCloseout = {
    patient_summary: source.patient_summary,
    outcome: source.outcome,
    finalized_at: source.finalized_at,
    finalized_by: source.finalized_by,
    finalized_by_name: textOrNull(source.finalized_by_name),
    follow_up_instructions: textOrNull(source.follow_up_instructions),
    follow_up_required: source.follow_up_required,
    follow_up: typeof followUp.id === 'string' && typeof followUp.status === 'string' ? {
      id: followUp.id,
      assigned_user_id: textOrNull(followUp.assigned_user_id),
      assigned_name: textOrNull(followUp.assigned_name),
      due_at: textOrNull(followUp.due_at),
      status: followUp.status,
    } : null,
  };
  if (source.published_revision !== undefined || source.published_history !== undefined) {
    const revision = source.published_revision;
    if (!Number.isSafeInteger(revision) || (revision as number) < 0 ||
        !Array.isArray(source.published_history) || source.published_history.length === 0) {
      throw new InvalidPatientCloseout('Não foi possível verificar as versões do resumo publicado.');
    }
    const seen = new Set<number>();
    const history = source.published_history.map((value): PublishedPatientSummary => {
      const entry = record(value);
      if (!Number.isSafeInteger(entry.revision) || (entry.revision as number) < 0 ||
          (entry.revision as number) > (revision as number) || seen.has(entry.revision as number) ||
          typeof entry.patient_summary !== 'string' || typeof entry.author_name !== 'string' ||
          typeof entry.published_at !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(entry.published_at) ||
          Number.isNaN(Date.parse(entry.published_at))) {
        throw new InvalidPatientCloseout('Não foi possível verificar as versões do resumo publicado.');
      }
      seen.add(entry.revision as number);
      return { revision: entry.revision as number, patient_summary: entry.patient_summary,
        published_at: entry.published_at, author_name: entry.author_name };
    }).sort((a, b) => a.revision - b.revision);
    const latest = history[history.length - 1];
    if (history[0].revision !== 0 || latest.revision !== revision || latest.patient_summary !== closeout.patient_summary) {
      throw new InvalidPatientCloseout('Não foi possível verificar a versão atual do resumo publicado.');
    }
    closeout.published_revision = revision as number;
    closeout.published_history = history;
  }
  return { consultation_id: id, status: response.status, closeout };
}

export function patientSummaryPublication(closeout: ConsultationCloseout): { author_name: string | null; published_at: string } {
  const latest = closeout.published_history?.find(item => item.revision === closeout.published_revision);
  return latest
    ? { author_name: latest.author_name, published_at: latest.published_at }
    : { author_name: closeout.finalized_by_name, published_at: closeout.finalized_at };
}

/** Only the closeout endpoint authorizes access and supplies the current state.
 * List metadata and video availability can fail independently of a published summary. */
export async function loadPatientConsultation(api: ConsultationApi, id: string): Promise<PatientConsultationDetail> {
  if (!id.trim()) throw new Error('Consulta não encontrada.');
  const [closeout, list, capabilities] = await Promise.allSettled([
    api.get(`/api/v1/consultations/${encodeURIComponent(id)}/closeout`),
    api.get(`/api/v1/consultations/me?consultation_id=${encodeURIComponent(id)}`),
    api.get('/api/v1/teleconsultations/capabilities'),
  ]);
  if (closeout.status === 'rejected') throw closeout.reason;
  const result = patientCloseoutResponse(closeout.value.data, id);
  const consultation = list.status === 'fulfilled' && Array.isArray(list.value.data)
    ? (list.value.data as PatientConsultation[]).find(item => item.id === id) || null
    : null;
  return {
    result,
    consultation: consultation ? { ...consultation, status: result.status } : null,
    capabilities: capabilities.status === 'fulfilled' ? capabilities.value.data : null,
    metadataUnavailable: list.status === 'rejected',
  };
}

export function canCancelConsultation(status: string): boolean {
  return status === 'requested' || status === 'scheduled';
}

export function consultationNextStep(status: string): string {
  if (status === 'requested') return 'O pedido aguarda aceitação de um médico. O horário ainda não está confirmado.';
  if (status === 'scheduled') return 'O médico confirmou o horário. Pode atualizar esta página para acompanhar o início da consulta.';
  if (status === 'in_progress') return 'A consulta está em curso. O resumo aparecerá aqui depois de o médico concluir o registo clínico.';
  if (status === 'completed') return 'Consulte abaixo as orientações que o médico disponibilizou.';
  if (status === 'cancelled') return 'Esta consulta foi cancelada. Pode fazer um novo pedido em As minhas consultas.';
  if (status === 'no_show') return 'Esta consulta não foi realizada. Pode fazer um novo pedido em As minhas consultas.';
  return 'Atualize esta página para acompanhar o estado da consulta.';
}

export function videoAvailabilityMessage(capabilities: VideoCapabilities | null): string {
  if (!capabilities) return 'Não foi possível confirmar a disponibilidade da videochamada. Atualize esta página para tentar novamente.';
  // No native provider adapter ships. A capability change on the server alone
  // must not create a call button or a public-room fallback on this client.
  if (capabilities.enabled) return 'As chamadas de vídeo ainda não estão disponíveis nesta versão da aplicação.';
  return capabilities.message || 'A videochamada ainda não está disponível na Kaya.';
}

export function consultationDate(value?: string | null): string {
  if (!value) return 'Por definir';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Por definir' : parsed.toLocaleString('pt-PT');
}

export function consultationError(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' && detail.trim() ? detail : fallback;
}

export function canRetainConsultationAfterError(error: unknown): boolean {
  if (error instanceof InvalidPatientCloseout) return false;
  const status = (error as { response?: { status?: number } })?.response?.status;
  // A revoked relationship, missing record, or failed finalization verification
  // must remove the previously visible clinical summary.
  return ![401, 403, 404, 409].includes(status ?? 0);
}
