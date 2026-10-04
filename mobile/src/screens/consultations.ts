export type PatientConsultation = {
  id: string;
  specialty: string;
  status: string;
  scheduled_at?: string | null;
  scheduled_end_at?: string | null;
  slot_id?: string | null;
  country?: 'AO' | 'PT' | null;
  timezone?: string | null;
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

/** Only the closeout endpoint authorizes access and supplies the current state.
 * List metadata and video availability can fail independently of a published summary. */
export async function loadPatientConsultation(api: ConsultationApi, id: string): Promise<PatientConsultationDetail> {
  if (!id.trim()) throw new Error('Consulta não encontrada.');
  const [closeout, list, capabilities] = await Promise.allSettled([
    api.get(`/api/v1/consultations/${encodeURIComponent(id)}/closeout`),
    api.get('/api/v1/consultations/me'),
    api.get('/api/v1/teleconsultations/capabilities'),
  ]);
  if (closeout.status === 'rejected') throw closeout.reason;
  const result = closeout.value.data as CloseoutResponse;
  if (result.consultation_id !== id) throw new Error('A consulta recebida não corresponde ao pedido.');
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
  const status = (error as { response?: { status?: number } })?.response?.status;
  // A revoked relationship, missing record, or failed finalization verification
  // must remove the previously visible clinical summary.
  return ![401, 403, 404, 409].includes(status ?? 0);
}
