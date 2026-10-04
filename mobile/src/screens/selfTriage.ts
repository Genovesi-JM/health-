export const SELF_TRIAGE_NOTICE = 'Esta triagem destina-se apenas ao próprio titular adulto da conta. A triagem de menores ou em nome de outra pessoa não está disponível.';

type Input = { chief_complaint: string; category: string; age_group: unknown; answered_by_guardian: unknown; [key: string]: unknown };
/** Do not silently turn a stale delegated/pediatric draft into account-holder care. */
export async function startSelfTriage<T>(api: { post(path: string, body: unknown): Promise<{ data: T }> }, input: Input): Promise<{ data: T }> {
  const fields = new Set(['chief_complaint', 'category', 'age_group', 'answered_by_guardian']);
  if (input.age_group !== 'adult' || input.answered_by_guardian !== false || Object.keys(input).some(key => !fields.has(key))) {
    throw new Error(SELF_TRIAGE_NOTICE);
  }
  return api.post('/api/v1/triage/start', input);
}
