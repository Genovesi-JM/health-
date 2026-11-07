import { useEffect, useRef, useState } from 'react';
import api from '../api';
import { apiErrorMessage, apiErrorStatus } from '../utils/apiError';
import type { Closeout, CloseoutRecord, Notes } from './ConsultationCloseout';

type Draft = Notes & { patient_summary: string; reason: string; publish_to_patient: boolean; expected_digest: string };
type Pending = { key: string; body: Draft };
const labels = { subjective: 'História clínica corrigida (interna)', objective: 'Observações corrigidas (internas)', assessment: 'Avaliação corrigida (interna)', plan: 'Plano corrigido (interno)', patient_summary: 'Resumo corrigido para o paciente' };
const fields = Object.keys(labels) as Array<keyof typeof labels>;
const date = (value: string) => new Date(value).toLocaleString('pt-PT');

function confirmsUncommittedRequest(error: unknown): boolean {
  const failure = error as { response?: { data?: { detail?: unknown } } } | null;
  const detail = failure?.response?.data?.detail;
  return apiErrorStatus(error) === 409 && detail !== null && typeof detail === 'object'
    && 'code' in detail && detail.code === 'amendment_stale_head'
    && 'request_key_committed' in detail && detail.request_key_committed === false;
}

/** A correction appends a signed revision; it never edits the original record. */
export default function ConsultationAmendments({ consultationId, closeout, onUpdated, onDirtyChange, onBusyChange, allowAmendment = true }: {
  consultationId: string; closeout: Closeout; onUpdated: (record: CloseoutRecord) => void;
  onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void;
  allowAmendment?: boolean;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef<Pending | null>(null);
  const inFlight = useRef(false);
  const active = useRef(true);
  const canAmend = allowAmendment && typeof closeout.current_digest === 'string' && /^[a-f0-9]{64}$/.test(closeout.current_digest) && Boolean(closeout.notes);
  const stale = Boolean(draft && draft.expected_digest !== closeout.current_digest);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; onDirtyChange(false); onBusyChange(false); };
  }, [onDirtyChange, onBusyChange]);
  useEffect(() => { onDirtyChange(draft !== null); }, [draft, onDirtyChange]);

  const begin = () => {
    if (!canAmend || inFlight.current) return;
    setDraft({ ...closeout.notes!, patient_summary: closeout.patient_summary, reason: '', publish_to_patient: false, expected_digest: closeout.current_digest! });
    setAcknowledged(false); setError(''); setNotice('');
  };
  const change = (key: keyof Draft, value: string | boolean) => {
    if (pending.current || inFlight.current) return;
    setDraft(current => current ? { ...current, [key]: value } : null);
    setAcknowledged(false);
  };
  const save = async () => {
    if (!draft || inFlight.current || (!pending.current && (!canAmend || stale || !acknowledged))) return;
    if (!pending.current) {
      if (![draft.reason, draft.assessment, draft.plan, draft.patient_summary].every(value => value.trim())) {
        setError('Preencha o motivo, a avaliação, o plano e o resumo corrigidos.'); return;
      }
      try {
        pending.current = { key: crypto.randomUUID(), body: {
          expected_digest: draft.expected_digest, reason: draft.reason.trim(), publish_to_patient: draft.publish_to_patient,
          subjective: draft.subjective?.trim() || null, objective: draft.objective?.trim() || null,
          assessment: draft.assessment.trim(), plan: draft.plan.trim(), patient_summary: draft.patient_summary.trim(),
        } };
      } catch {
        setError('Não foi possível preparar o envio. Use um navegador atualizado numa ligação segura.'); return;
      }
    }
    const submission = pending.current;
    inFlight.current = true; setBusy(true); onBusyChange(true); setError(''); setNotice('');
    try {
      const { data } = await api.post<CloseoutRecord>(`/api/v1/consultations/${consultationId}/closeout/amendments`, submission.body, { headers: { 'Idempotency-Key': submission.key } });
      if (!active.current) return;
      if (data.consultation_id !== consultationId || !data.closeout?.current_digest) throw new Error('Unconfirmed correction response');
      pending.current = null; setUncertain(false); setDraft(null); setAcknowledged(false);
      onUpdated(data);
      setNotice(submission.body.publish_to_patient ? 'Correção registada e resumo publicado para o paciente.' : 'Correção interna registada. O resumo publicado para o paciente mantém-se.');
    } catch (failure) {
      if (!active.current) return;
      const status = apiErrorStatus(failure);
      // Authority/consent checks can reject a retry before replay lookup. A
      // previously uncertain request keeps its identity until the server either
      // acknowledges it or explicitly verifies this key never committed.
      if ((!uncertain || confirmsUncommittedRequest(failure)) && status && status >= 400 && status < 500 && ![408, 429].includes(status)) {
        pending.current = null; setUncertain(false); setAcknowledged(false);
        if (status === 409) {
          setError('O registo mudou ou já não permite esta correção. O rascunho foi preservado. Reveja o registo atual antes de continuar.');
          try {
            const { data } = await api.get<CloseoutRecord>(`/api/v1/consultations/${consultationId}/closeout`);
            if (active.current && data.consultation_id === consultationId) onUpdated(data);
          } catch { /* Keep the draft; the parent provides an explicit refresh. */ }
        } else setError(apiErrorMessage(failure, 'Não foi possível registar a correção. Verifique o acesso e os campos.'));
      } else {
        setUncertain(true);
        setError('Não foi possível confirmar o envio. O conteúdo ficou reservado para repetir exatamente o mesmo pedido, sem duplicar a correção.');
      }
    } finally {
      if (active.current) { inFlight.current = false; setBusy(false); onBusyChange(false); }
    }
  };

  return <section aria-label="Correções do registo clínico" style={{ marginTop: '1.5rem' }}>
    <h4>Correções do registo</h4>
    <p>O registo original é preservado. Cada correção inclui o autor, a data e o motivo. O resultado e as tarefas de acompanhamento mantêm-se.</p>
    {closeout.current_is_published === false && <p role="status">A revisão clínica atual contém uma correção interna ainda não publicada para o paciente.</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
    {closeout.original && <details><summary>Registo original assinado</summary>
      <p>{closeout.original.patient_summary}</p>
      {(['subjective', 'objective', 'assessment', 'plan'] as const).map(key => <p key={key}><strong>{labels[key]}:</strong> {closeout.original!.notes[key] || '—'}</p>)}
    </details>}
    {(closeout.amendments || []).map(item => <details key={item.id} style={{ marginTop: '0.75rem' }}>
      <summary>Correção {item.revision} · {item.author_name} · {date(item.created_at)} · {item.publish_to_patient ? 'Publicada' : 'Interna'}</summary>
      <p><strong>Motivo interno:</strong> {item.reason}</p>
      <p><strong>Resumo:</strong> {item.patient_summary}</p>
      {(['subjective', 'objective', 'assessment', 'plan'] as const).map(key => <p key={key}><strong>{labels[key]}:</strong> {item.notes[key] || '—'}</p>)}
    </details>)}
    {!draft && canAmend && <button type="button" className="btn" onClick={begin}>Adicionar correção</button>}
    {!canAmend && <p>Não é possível corrigir este registo até confirmar a sua versão assinada.</p>}
    {draft && <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy || uncertain || !canAmend} style={{ border: 0, padding: 0 }}>
        <label style={{ display: 'grid', gap: '.35rem', margin: '1rem 0' }}>Motivo da correção (interno)
          <textarea className="form-input" required maxLength={2000} value={draft.reason} onChange={event => change('reason', event.target.value)} />
        </label>
        {fields.map(key => <label key={key} style={{ display: 'grid', gap: '.35rem', margin: '1rem 0' }}>{labels[key]}
          <textarea className="form-input" rows={3} maxLength={10000} required={['assessment', 'plan', 'patient_summary'].includes(key)} value={draft[key] || ''} onChange={event => change(key, event.target.value)} />
        </label>)}
        <label style={{ display: 'block', margin: '1rem 0' }}><input type="checkbox" checked={draft.publish_to_patient} onChange={event => change('publish_to_patient', event.target.checked)} /> Publicar este resumo corrigido para o paciente</label>
        <label style={{ display: 'block', margin: '1rem 0' }}><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /> Revi o registo atual e confirmo esta correção.</label>
      </fieldset>
      {stale && !uncertain && <div role="alert"><p>Existe uma versão mais recente. Compare-a com o rascunho antes de voltar a confirmar.</p>
        <button type="button" className="btn" disabled={busy || !canAmend} onClick={() => {
          setDraft(current => current ? { ...current, expected_digest: closeout.current_digest! } : null);
          setAcknowledged(false); setError('');
        }}>Revi a versão atual; manter o meu rascunho</button>
      </div>}
      <button type="submit" className="btn btn-primary" disabled={busy || (!uncertain && (!acknowledged || stale || !canAmend))}>{busy ? 'A guardar…' : uncertain ? 'Repetir o mesmo envio' : 'Registar correção'}</button>
      <button type="button" className="btn" disabled={busy || uncertain} onClick={() => { setDraft(null); setAcknowledged(false); setError(''); }}>Cancelar correção</button>
    </form>}
  </section>;
}
