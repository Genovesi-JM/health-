import { useEffect, useRef, useState } from 'react';
import { apiErrorStatus } from '../utils/apiError';
import api from '../api';
import ConsultationAmendments from './ConsultationAmendments';

export type Notes = { subjective: string | null; objective: string | null; assessment: string; plan: string };
export type Closeout = {
  patient_summary: string; follow_up_instructions: string | null; follow_up_required: boolean;
  outcome: string; finalized_at: string; finalized_by: string; finalized_by_name?: string;
  follow_up: { id: string; assigned_user_id: string; assigned_name: string; due_at: string; status: string } | null;
  notes?: Notes;
  published_revision?: number;
  published_history?: Array<{ revision: number; patient_summary: string; published_at: string; author_name: string }>;
  current_revision?: number; current_digest?: string; current_is_published?: boolean;
  original?: { patient_summary: string; notes: Notes };
  amendments?: Array<{ id: string; revision: number; created_at: string; author_name: string; reason: string; publish_to_patient: boolean; digest: string; previous_digest: string; patient_summary: string; notes: Notes }>;
};
export type CloseoutRecord = { consultation_id: string; status: string; closeout: Closeout | null };
const outcomes: { [key: string]: string } = { resolved: 'Resolvida', follow_up: 'Requer acompanhamento', referral: 'Referenciação', er: 'Encaminhamento para urgência' };
const emptyDraft = { subjective: '', objective: '', assessment: '', plan: '', patient_summary: '', follow_up_instructions: '', outcome: '', follow_up_required: false, follow_up_due_at: '' };
type Submission = Omit<typeof emptyDraft, 'subjective' | 'objective' | 'follow_up_instructions' | 'follow_up_due_at'> & {
  subjective: string | null; objective: string | null; follow_up_instructions: string | null; follow_up_due_at: string | null;
};
const fieldStyle = { display: 'grid', gap: '0.35rem', marginBottom: '1rem' };

export default function ConsultationCloseout({ consultationId, role, onFinalized, onDirtyChange, onBusyChange, onRecordUpdated, onAccessLost, allowAmendment = true }: {
  consultationId: string; role: 'doctor' | 'patient'; onFinalized?: () => void; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void;
  allowAmendment?: boolean;
  onRecordUpdated?: (record: CloseoutRecord) => void;
  onAccessLost?: () => void;
}) {
  const [record, setRecord] = useState<CloseoutRecord | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [draftConsultationId, setDraftConsultationId] = useState(consultationId);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [amendmentDirty, setAmendmentDirty] = useState(false);
  const [amendmentBusy, setAmendmentBusy] = useState(false);
  const busyRef = useRef(false);
  const lastSubmission = useRef<{ signature: string; payload: Submission } | null>(null);
  const currentId = useRef(consultationId);
  const recordGeneration = useRef(0);
  currentId.current = consultationId;
  const draftDirty = draftConsultationId === consultationId && !saved && Object.entries(draft).some(([key, value]) => value !== emptyDraft[key as keyof typeof emptyDraft]);
  const dirty = draftDirty || amendmentDirty;

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy || amendmentBusy); }, [busy, amendmentBusy, onBusyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const load = async () => {
    const id = consultationId;
    const generation = ++recordGeneration.current;
    setLoading(true); setError('');
    try {
      const { data } = await api.get<CloseoutRecord>(`/api/v1/consultations/${id}/closeout`);
      if (currentId.current === id && generation === recordGeneration.current) setRecord(data);
    } catch (failure: unknown) { if (currentId.current === id && generation === recordGeneration.current) {
      if ([401, 403, 404, 409].includes(apiErrorStatus(failure) ?? 0)) setRecord(null);
      if ([401, 403].includes(apiErrorStatus(failure) ?? 0)) onAccessLost?.();
      setError('Não foi possível carregar o registo da consulta. Tente novamente.');
    } }
    finally { if (currentId.current === id && generation === recordGeneration.current) setLoading(false); }
  };
  const applyAmendment = (updated: CloseoutRecord) => {
    if (currentId.current !== updated.consultation_id) return;
    recordGeneration.current += 1;
    setLoading(false); setError(''); setRecord(updated);
    onRecordUpdated?.(updated);
  };
  useEffect(() => {
    currentId.current = consultationId;
    busyRef.current = false; lastSubmission.current = null; setBusy(false); onBusyChange?.(false);
    setRecord(null); setDraft(emptyDraft); setDraftConsultationId(consultationId); setSaved(false); setAcknowledged(false);
    setAmendmentDirty(false); setAmendmentBusy(false);
    void load();
    return () => { currentId.current = ''; recordGeneration.current += 1; };
  }, [consultationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (key: keyof typeof emptyDraft, value: string | boolean) => {
    setDraft(current => ({ ...current, [key]: value })); setAcknowledged(false);
  };
  const finalize = async () => {
    if (busyRef.current || !acknowledged) return;
    if (!draft.outcome || !draft.assessment.trim() || !draft.plan.trim() || !draft.patient_summary.trim()) {
      setError('Preencha a avaliação, o plano, o resumo para o paciente e o resultado.'); return;
    }
    const signature = JSON.stringify(draft);
    const replay = lastSubmission.current?.signature === signature ? lastSubmission.current.payload : null;
    const due = draft.follow_up_due_at ? new Date(draft.follow_up_due_at) : null;
    if (!replay && draft.follow_up_required && (!draft.follow_up_instructions.trim() || !due || !Number.isFinite(due.getTime()) || due.getTime() <= Date.now())) {
      setError('Indique as instruções e uma data futura para o acompanhamento.'); return;
    }
    const payload = replay || {
      subjective: draft.subjective.trim() || null, objective: draft.objective.trim() || null,
      assessment: draft.assessment.trim(), plan: draft.plan.trim(), patient_summary: draft.patient_summary.trim(),
      outcome: draft.outcome, follow_up_required: draft.follow_up_required,
      follow_up_instructions: draft.follow_up_instructions.trim() || null,
      follow_up_due_at: draft.follow_up_required ? due!.toISOString() : null,
    };
    const id = consultationId;
    lastSubmission.current = { signature, payload };
    busyRef.current = true; setBusy(true); onBusyChange?.(true); setError('');
    try {
      await api.post(`/api/v1/consultations/${id}/complete`, payload);
      if (currentId.current !== id) return;
      setSaved(true); onDirtyChange?.(false);
      try { const result = await api.get<CloseoutRecord>(`/api/v1/consultations/${id}/closeout`); if (currentId.current === id) setRecord(result.data); }
      catch (failure) { if (currentId.current === id) {
        if (onAccessLost && [401, 403].includes(apiErrorStatus(failure) ?? 0)) { onAccessLost(); return; }
        setError('Consulta concluída. Não foi possível recarregar o resumo; atualize para o consultar.');
      } }
      if (currentId.current === id) onFinalized?.();
    } catch (failure: unknown) {
      if (currentId.current !== id) return;
      if (onAccessLost && [401, 403].includes(apiErrorStatus(failure) ?? 0)) { onAccessLost(); return; }
      if (apiErrorStatus(failure) === 409) {
        try { const result = await api.get<CloseoutRecord>(`/api/v1/consultations/${id}/closeout`); if (currentId.current === id) setRecord(result.data); }
        catch (refreshFailure) { if (currentId.current === id && onAccessLost && [401, 403].includes(apiErrorStatus(refreshFailure) ?? 0)) { onAccessLost(); return; } }
        if (currentId.current !== id) return;
        setError('A consulta mudou noutra sessão. O seu rascunho foi preservado; reveja o registo atual antes de continuar.');
      } else {
        setError('Não foi possível confirmar a conclusão. O rascunho foi preservado. Tente guardar novamente; a mesma submissão não duplica o registo.');
      }
    } finally { if (currentId.current === id) { busyRef.current = false; setBusy(false); onBusyChange?.(false); } }
  };

  const currentRecord = record?.consultation_id === consultationId ? record : null;
  const closeout = currentRecord?.closeout;
  const editable = role === 'doctor' && currentRecord?.status === 'in_progress' && !closeout && !saved;
  return <section className="card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
    <h3>{role === 'doctor' ? 'Conclusão clínica da consulta' : 'Resumo da consulta'}</h3>
    {error && <p role="alert" className="alert alert-danger">{error}</p>}
    {saved && <p role="status">Consulta concluída e resumo publicado para o paciente.</p>}
    <button type="button" className="btn btn-sm" onClick={load} disabled={loading || busy || amendmentBusy}>Atualizar registo</button>
    {loading && <p role="status">A carregar o registo…</p>}
    {!loading && currentRecord && !closeout && !editable && !saved && <p>{currentRecord.status === 'completed' ? 'Esta consulta ainda não tem um resumo publicado.' : 'O resumo ficará disponível depois da conclusão pelo médico.'}</p>}
    {closeout && <div style={{ marginTop: '1rem', whiteSpace: 'pre-wrap' }}>
      <p><strong>Resultado:</strong> {outcomes[closeout.outcome] || closeout.outcome}</p>
      <h4>{role === 'doctor' && closeout.current_is_published === false ? 'Resumo da revisão interna (ainda não publicado)' : 'Resumo para o paciente'}</h4><p>{closeout.patient_summary}</p>
      {closeout.follow_up_instructions && <><h4>Instruções de acompanhamento</h4><p>{closeout.follow_up_instructions}</p></>}
      {closeout.follow_up && <p><strong>Acompanhamento:</strong> {closeout.follow_up.assigned_name || 'Médico responsável'} · {new Date(closeout.follow_up.due_at).toLocaleString('pt-PT')} · {closeout.follow_up.status === 'open' || closeout.follow_up.status === 'pending' ? 'Pendente' : closeout.follow_up.status === 'completed' ? 'Concluído' : closeout.follow_up.status}</p>}
      <p>Concluída por {closeout.finalized_by_name || 'médico responsável'} em {new Date(closeout.finalized_at).toLocaleString('pt-PT')}.</p>
      {(closeout.published_history?.length || 0) > 1 && <details><summary>Histórico dos resumos publicados</summary>
        {closeout.published_history!.map(item => <article key={item.revision}>
          <p><strong>{item.revision === 0 ? 'Resumo original' : `Correção publicada ${item.revision}`}</strong> · {item.author_name} · {new Date(item.published_at).toLocaleString('pt-PT')}</p>
          <p>{item.patient_summary}</p>
        </article>)}
      </details>}
      {role === 'doctor' && closeout.notes && <details><summary>Notas clínicas internas</summary>
        {(['subjective', 'objective', 'assessment', 'plan'] as const).map(key => <p key={key}><strong>{{ subjective: 'História clínica', objective: 'Observações', assessment: 'Avaliação', plan: 'Plano clínico' }[key]}:</strong> {closeout.notes![key] || '—'}</p>)}
      </details>}
    </div>}
    {role === 'doctor' && currentRecord?.status === 'completed' && closeout && <ConsultationAmendments key={consultationId} consultationId={consultationId} closeout={closeout} allowAmendment={allowAmendment} onUpdated={applyAmendment} onDirtyChange={setAmendmentDirty} onBusyChange={setAmendmentBusy} />}
    {role === 'doctor' && draftConsultationId === consultationId && (editable || draftDirty) && <form onSubmit={event => { event.preventDefault(); void finalize(); }} style={{ marginTop: '1rem' }}>
      <p>{editable ? 'Escreva a avaliação e o plano clínico. Só o resumo e as instruções de acompanhamento serão publicados para o paciente.' : 'Rascunho preservado nesta sessão. O registo publicado acima não será substituído.'}</p>
      <fieldset disabled={busy || loading || !editable} style={{ border: 0, padding: 0 }}>
        {(['subjective', 'objective', 'assessment', 'plan', 'patient_summary', 'follow_up_instructions'] as const).map(key => <label key={key} style={fieldStyle}>
          {{ subjective: 'História clínica (interna, opcional)', objective: 'Observações (internas, opcionais)', assessment: 'Avaliação clínica (interna)', plan: 'Plano clínico (interno)', patient_summary: 'Resumo para o paciente', follow_up_instructions: 'Instruções de acompanhamento' }[key]}
          <textarea className="form-input" rows={3} maxLength={10000} value={draft[key]} required={['assessment', 'plan', 'patient_summary'].includes(key) || (key === 'follow_up_instructions' && draft.follow_up_required)} onChange={event => update(key, event.target.value)} />
        </label>)}
        <label style={fieldStyle}>Resultado da consulta<select className="form-input" required value={draft.outcome} onChange={event => {
          update('outcome', event.target.value); if (event.target.value === 'follow_up') update('follow_up_required', true);
        }}><option value="">Escolha o resultado</option>{Object.entries(outcomes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label style={fieldStyle}><span><input type="checkbox" checked={draft.follow_up_required} disabled={draft.outcome === 'follow_up'} onChange={event => update('follow_up_required', event.target.checked)} /> Criar tarefa de acompanhamento sob a minha responsabilidade</span></label>
        {draft.follow_up_required && <label style={fieldStyle}>Data e hora limite do acompanhamento (hora local)<input className="form-input" type="datetime-local" required value={draft.follow_up_due_at} onChange={event => update('follow_up_due_at', event.target.value)} /></label>}
        <label style={fieldStyle}><span><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /> Revi o resumo e confirmo a conclusão desta consulta.</span></label>
        <button className="btn btn-primary" type="submit" disabled={!acknowledged || busy}>{busy ? 'A guardar…' : 'Concluir e publicar resumo'}</button>
      </fieldset>
    </form>}
  </section>;
}
