import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileText, History, Loader2, ShieldCheck, X, XCircle } from 'lucide-react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';

interface Transition {
  id: string;
  previous_status: string | null;
  new_status: string;
  actor_kind: string;
  reason_code: string | null;
  reason_text: string | null;
  reviewer_notes: string | null;
  provider: string | null;
  at: string;
}

interface CaseDetail {
  credential_id: string;
  user_id: string;
  profession: string;
  status: string;
  entered: Record<string, unknown>;
  extracted_by_provider: Record<string, Record<string, unknown>>;
  evidence: Array<{ id: string; kind: string; filename: string; uploaded_at: string }>;
  provider_checks: Array<{
    id: string; provider: string; check_type: string; status: string;
    external_id: string | null; error_message: string | null;
  }>;
  transitions: Transition[];
  allowed_next_statuses: string[];
}

interface Props {
  credentialId: string;
  onClose: () => void;
  onCaseUpdated: () => void;
}

type ActionKind =
  | 'request-information'
  | 'suspend'
  | 'reactivate'
  | 'revoke'
  | 'approve'
  | 'reject'
  | 'manual-verified'
  | 'manual-partial'
  | 'manual-unable';

interface ActionSpec {
  label: string;
  requiresReason: boolean;
  destructive?: boolean;
  primary?: boolean;
  run: (reason: string, notes: string) => Promise<void>;
}

/** Map raw credential field keys to localized labels for the diff table. */
function fieldLabel(key: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    legal_name: 'admc.fld_legal_name',
    licence_number: 'admc.fld_licence_number',
    issuing_authority: 'admc.fld_authority',
    licence_expiry_date: 'admc.fld_expiry',
    diploma_institution: 'admc.fld_institution',
    degree_title: 'admc.fld_degree',
    graduation_year: 'admc.fld_grad_year',
  };
  const tk = map[key];
  return tk ? t(tk) : key;
}

export default function CaseDetailDrawer({ credentialId, onClose, onCaseUpdated }: Props) {
  const { t } = useT();
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionKind | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get<CaseDetail>(`/api/v1/compliance/cases/${credentialId}/detail`);
      setDetail(res.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || 'Falha ao carregar o processo.');
    } finally { setLoading(false); }
  }, [credentialId]);

  useEffect(() => { load(); }, [load]);

  const runAction = async (kind: ActionKind, reasonText: string, reviewerNotes: string) => {
    setBusy(true); setError(null);
    try {
      const base = `/api/v1/compliance/cases/${credentialId}`;
      switch (kind) {
        case 'request-information':
          await api.post(`${base}/request-information`, { reason_text: reasonText, reviewer_notes: reviewerNotes });
          break;
        case 'suspend':
          await api.post(`${base}/suspend`, { reason_text: reasonText, reviewer_notes: reviewerNotes });
          break;
        case 'reactivate':
          await api.post(`${base}/reactivate`);
          break;
        case 'revoke':
          await api.post(`${base}/revoke`, { reason_text: reasonText, reviewer_notes: reviewerNotes });
          break;
        case 'manual-verified':
          await api.post(`${base}/manual-review-complete`, { outcome: 'verified', reason_text: reasonText, reviewer_notes: reviewerNotes });
          break;
        case 'manual-partial':
          await api.post(`${base}/manual-review-complete`, { outcome: 'partial', reason_text: reasonText, reviewer_notes: reviewerNotes });
          break;
        case 'manual-unable':
          await api.post(`${base}/manual-review-complete`, { outcome: 'unable_to_verify', reason_text: reasonText, reviewer_notes: reviewerNotes });
          break;
        case 'approve':
          await api.post(`/api/v1/credentials/admin/${credentialId}/decision`, { action: 'approve', notes: reviewerNotes });
          break;
        case 'reject':
          await api.post(`/api/v1/credentials/admin/${credentialId}/decision`, { action: 'reject', notes: reasonText });
          break;
      }
      setToast(t('admc.applied'));
      setPendingAction(null); setReason(''); setNotes('');
      await load();
      onCaseUpdated();
      window.setTimeout(() => setToast(null), 2400);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: unknown } } };
      const detailBody = err.response?.data?.detail;
      if (detailBody && typeof detailBody === 'object' && 'error' in detailBody) {
        setError(t('admc.action_failed'));
      } else {
        setError(typeof detailBody === 'string' ? detailBody : 'Ação falhou.');
      }
    } finally { setBusy(false); }
  };

  const actions: Record<ActionKind, ActionSpec> = {
    approve:               { label: t('admc.action_approve'),          requiresReason: false, primary: true,   run: (r, n) => runAction('approve', r, n) },
    reject:                { label: t('admc.action_reject'),           requiresReason: true,  destructive: true, run: (r, n) => runAction('reject', r, n) },
    'request-information': { label: t('admc.action_request_info'),     requiresReason: true,                    run: (r, n) => runAction('request-information', r, n) },
    suspend:               { label: t('admc.action_suspend'),          requiresReason: true,  destructive: true, run: (r, n) => runAction('suspend', r, n) },
    reactivate:            { label: t('admc.action_reactivate'),       requiresReason: false, primary: true,   run: (_r, _n) => runAction('reactivate', '', '') },
    revoke:                { label: t('admc.action_revoke'),           requiresReason: true,  destructive: true, run: (r, n) => runAction('revoke', r, n) },
    'manual-verified':     { label: t('admc.action_manual_verified'),  requiresReason: false,                   run: (r, n) => runAction('manual-verified', r, n) },
    'manual-partial':      { label: t('admc.action_manual_partial'),   requiresReason: false,                   run: (r, n) => runAction('manual-partial', r, n) },
    'manual-unable':       { label: t('admc.action_manual_unable'),    requiresReason: true,                    run: (r, n) => runAction('manual-unable', r, n) },
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 720, height: '100vh', background: 'var(--bg-primary)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.2)', overflowY: 'auto',
      }}>
        <div style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 2, borderBottom: '1px solid var(--border)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Processo #{credentialId.slice(0, 8)}…</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {loading && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={18} className="spin" style={{ marginRight: 6, verticalAlign: 'middle' }} /> …
            </div>
          )}
          {!loading && detail && (
            <>
              {/* Status + summary ────────────────────────── */}
              <section style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4 }}>
                  Estado atual
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>
                  {detail.status} · {detail.profession}
                </div>
              </section>

              {/* Entered vs extracted ─────────────────────── */}
              <section style={{ marginBottom: '1.75rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>{t('admc.entered')} vs {t('admc.extracted')}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                      <th style={{ textAlign: 'left', padding: '0.35rem 0' }}>Campo</th>
                      <th style={{ textAlign: 'left', padding: '0.35rem 0' }}>{t('admc.entered')}</th>
                      <th style={{ textAlign: 'left', padding: '0.35rem 0' }}>{t('admc.extracted')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(detail.entered).map(([k, v]) => {
                      const extractedValue = Object.values(detail.extracted_by_provider ?? {})
                        .map(providerFields => providerFields?.[k])
                        .find(x => x != null);
                      const mismatch = extractedValue != null && String(extractedValue) !== String(v);
                      return (
                        <tr key={k} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.45rem 0', fontWeight: 600 }}>{fieldLabel(k, t)}</td>
                          <td style={{ padding: '0.45rem 0', color: 'var(--text-secondary)' }}>{String(v ?? '—')}</td>
                          <td style={{ padding: '0.45rem 0', color: mismatch ? '#b45309' : 'var(--text-secondary)', fontWeight: mismatch ? 700 : 400 }}>
                            {extractedValue == null ? '—' : String(extractedValue)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>

              {/* Evidence ─────────────────────────────────── */}
              <section style={{ marginBottom: '1.75rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={14} /> {t('admc.evidence')}
                </div>
                {(detail.evidence ?? []).length === 0 ? (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>—</div>
                ) : (
                  detail.evidence.map(e => (
                    <div key={e.id} style={{ padding: '0.4rem 0', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                      <span><strong>{e.kind}</strong> — {e.filename}</span>
                      <a href={`/api/v1/credentials/evidence/${e.id}/download`}
                         target="_blank" rel="noreferrer"
                         style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>Abrir</a>
                    </div>
                  ))
                )}
              </section>

              {/* Provider checks ──────────────────────────── */}
              <section style={{ marginBottom: '1.75rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={14} /> {t('admc.checks')}
                </div>
                {(detail.provider_checks ?? []).length === 0 ? (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>—</div>
                ) : (
                  detail.provider_checks.map(pc => (
                    <div key={pc.id} style={{ padding: '0.4rem 0', fontSize: '0.82rem', borderBottom: '1px solid var(--border)' }}>
                      <div><strong>{pc.provider}</strong> — {pc.check_type} — <em>{pc.status}</em></div>
                      {pc.error_message && (
                        <div style={{ color: '#b91c1c', fontSize: '0.75rem', marginTop: 2 }}>{pc.error_message}</div>
                      )}
                    </div>
                  ))
                )}
              </section>

              {/* Transitions ─────────────────────────────── */}
              <section style={{ marginBottom: '1.75rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <History size={14} /> {t('admc.history')}
                </div>
                {detail.transitions.length === 0 ? (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('admc.no_transitions')}</div>
                ) : (
                  <ol style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {detail.transitions.slice().reverse().map(t => (
                      <li key={t.id} style={{ marginBottom: '0.35rem' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{t.previous_status || '—'} → {t.new_status}</strong>
                        {' · '}<span>{new Date(t.at).toLocaleString('pt-PT')}</span>
                        {' · '}<span>{t.actor_kind}</span>
                        {t.reason_code && <> · <em>{t.reason_code}</em></>}
                        {t.reason_text && <div style={{ marginTop: 2 }}>{t.reason_text}</div>}
                        {t.reviewer_notes && (
                          <div style={{ marginTop: 2, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            (interno) {t.reviewer_notes}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              {/* Reviewer actions ────────────────────────── */}
              <section>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>{t('admc.actions')}</div>
                {error && (
                  <div style={{ marginBottom: 12, padding: '0.55rem 0.75rem', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: '#b91c1c', fontSize: '0.82rem' }}>
                    {error}
                  </div>
                )}
                {pendingAction ? (
                  <div style={{ padding: '0.85rem 1rem', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-secondary)' }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.6rem' }}>{actions[pendingAction].label}</div>
                    {actions[pendingAction].requiresReason && (
                      <>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>{t('admc.reason_prompt')}</label>
                        <textarea
                          value={reason}
                          onChange={e => setReason(e.target.value)}
                          rows={2}
                          style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem', marginBottom: 8 }}
                        />
                      </>
                    )}
                    <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>{t('admc.notes_prompt')}</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                      style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem', marginBottom: 8 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className={actions[pendingAction].destructive ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'}
                        disabled={busy || (actions[pendingAction].requiresReason && !reason.trim())}
                        onClick={() => actions[pendingAction].run(reason, notes)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        {busy && <Loader2 size={14} className="spin" />} Confirmar
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPendingAction(null); setReason(''); setNotes(''); }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => setPendingAction('approve')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={14} /> {t('admc.action_approve')}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPendingAction('request-information')}>
                      {t('admc.action_request_info')}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPendingAction('manual-verified')}>
                      {t('admc.action_manual_verified')}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPendingAction('manual-partial')}>
                      {t('admc.action_manual_partial')}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPendingAction('manual-unable')}>
                      {t('admc.action_manual_unable')}
                    </button>
                    {detail.status === 'suspended' ? (
                      <button className="btn btn-primary btn-sm" onClick={() => setPendingAction('reactivate')}>
                        {t('admc.action_reactivate')}
                      </button>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => setPendingAction('suspend')} style={{ color: '#b45309' }}>
                        {t('admc.action_suspend')}
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => setPendingAction('reject')} style={{ color: '#b91c1c' }}>
                      <XCircle size={14} style={{ marginRight: 4 }} /> {t('admc.action_reject')}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPendingAction('revoke')} style={{ color: '#b91c1c' }}>
                      {t('admc.action_revoke')}
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {toast && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#059669', color: '#fff', padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.85rem', boxShadow: '0 6px 24px rgba(0,0,0,0.15)' }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
