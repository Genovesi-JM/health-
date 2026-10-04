import { patientCloseoutResponse, type CloseoutResponse } from './consultations';

export type DoctorCloseout = {
  consultation_id: string; status: string;
  closeout: null | {
    notes: { subjective: string | null; objective: string | null; assessment: string | null; plan: string | null };
    patient_summary: string; current_revision: number; current_is_published: boolean;
    author_name: string; recorded_at: string; published: NonNullable<CloseoutResponse['closeout']>;
  };
};
export class InvalidDoctorCloseout extends Error {}
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown> : {};

/** Separate clinician reader: the patient parser must keep rejecting unpublished clinical summaries. */
export function doctorCloseoutResponse(value: unknown, consultationId: string): DoctorCloseout {
  try {
    const response = object(value); const source = object(response.closeout);
    if (response.closeout === null) return { ...patientCloseoutResponse(value, consultationId), closeout: null };
    const revision = source.current_revision;
    if (response.status !== 'completed' || !Number.isSafeInteger(revision) || (revision as number) < 0 || typeof source.current_is_published !== 'boolean' ||
        typeof source.patient_summary !== 'string') throw new Error('Invalid clinical revision');
    const history = Array.isArray(source.published_history) ? source.published_history.map(object) : [];
    const publishedSummary = history.find(item => item.revision === source.published_revision)?.patient_summary;
    const published = patientCloseoutResponse({ ...response, closeout: { ...source, patient_summary: publishedSummary } }, consultationId).closeout;
    if (!published) throw new Error('Missing published original');
    if ((revision as number) < published.published_revision! ||
        (source.current_is_published && (revision !== published.published_revision || source.patient_summary !== published.patient_summary)) ||
        (!source.current_is_published && revision === published.published_revision)) throw new Error('Invalid publication state');
    const notes = object(source.notes);
    for (const key of ['subjective', 'objective', 'assessment', 'plan']) {
      if (notes[key] !== null && typeof notes[key] !== 'string') throw new Error('Invalid clinical notes');
    }
    const amendments = Array.isArray(source.amendments) ? source.amendments.map(object) : [];
    const current = amendments.find(item => item.revision === revision);
    const author = revision === 0 ? source.finalized_by_name : current?.author_name;
    const at = revision === 0 ? source.finalized_at : current?.created_at;
    if (typeof author !== 'string' || typeof at !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(at) || !Number.isFinite(Date.parse(at))) {
      throw new Error('Invalid clinical attribution');
    }
    return { consultation_id: consultationId, status: response.status as string, closeout: {
      notes: { subjective: notes.subjective as string | null, objective: notes.objective as string | null,
        assessment: notes.assessment as string | null, plan: notes.plan as string | null },
      patient_summary: source.patient_summary, current_revision: revision as number, current_is_published: source.current_is_published,
      author_name: author, recorded_at: at, published,
    } };
  } catch { throw new InvalidDoctorCloseout('Não foi possível verificar o registo clínico desta consulta.'); }
}

export async function loadDoctorCloseout(api: { get(path: string): Promise<{ data: unknown }> }, consultationId: string): Promise<DoctorCloseout> {
  const response = await api.get(`/api/v1/consultations/${encodeURIComponent(consultationId)}/closeout`);
  return doctorCloseoutResponse(response.data, consultationId);
}

export function canRetainDoctorCloseout(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return !(error instanceof InvalidDoctorCloseout) && ![401, 403, 404, 409].includes(status ?? 0);
}
