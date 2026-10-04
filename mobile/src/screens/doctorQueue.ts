import { requestAllowsNewScheduleAction, type ConsultationExpiry } from './consultationExpiry';
export type DisplayedQueueItem = ConsultationExpiry & { id: string; patient_id?: string; reschedule_revision?: number };
type QueueApi = { post(path: string, data: undefined, config: { params: { expected_revision: number } }): Promise<unknown> };

/** Accept/start only the appointment revision the clinician actually reviewed. */
export async function openDisplayedQueueItem(api: QueueApi, item: DisplayedQueueItem, refreshAfterConflict: () => Promise<void>): Promise<string> {
  if (!item.patient_id) throw new Error('Não foi possível confirmar o paciente. Atualize a fila.');
  if (item.status === 'in_progress') return item.patient_id;
  if (!requestAllowsNewScheduleAction(item)) throw new Error('O prazo ou estado deste pedido precisa de confirmação. Atualize a fila antes de aceitar.');
  if (!['requested', 'scheduled'].includes(item.status) || !Number.isSafeInteger(item.reschedule_revision) || item.reschedule_revision! < 0) {
    throw new Error('Não foi possível confirmar a versão do horário. Atualize a fila antes de aceitar ou iniciar.');
  }
  try {
    const action = item.status === 'scheduled' ? 'start' : 'accept';
    await api.post(`/api/v1/doctor/queue/${encodeURIComponent(item.id)}/${action}`, undefined,
      { params: { expected_revision: item.reschedule_revision! } });
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 409) {
      await refreshAfterConflict();
      throw new Error('O horário ou estado da consulta mudou. Reveja a fila atualizada antes de aceitar ou iniciar.');
    }
    throw error;
  }
  return item.patient_id;
}
