import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { getSession } from '../api';
import { useAuth } from '../AuthContext';
import { apiErrorMessage, apiErrorStatus } from '../utils/apiError';
import { allConsentEffective, clearPendingConsent, consentNotCommitted, consentReference, isConsentCountry, parseConsentHistory, parseConsentReceipt, parseConsentState, readPendingConsent, savePendingConsent } from '../utils/consent';
import type { ConsentAction, ConsentCountry, ConsentEvent, ConsentPurposeState, ConsentState, PendingConsent } from '../utils/consent';

const BASE = '/api/v1/compliance';
const statusLabels = { granted: 'Em vigor', missing: 'Sem decisão', withdrawn: 'Retirado', refused: 'Recusado', stale: 'Versão anterior', unavailable: 'Documento aprovado indisponível' };
const actionLabels = { grant: 'Aceitação', refuse: 'Recusa', withdraw: 'Retirada' };
const uncertain = 'O resultado ainda não foi confirmado. Recupere a mesma decisão antes de enviar outra; um erro ou uma pesquisa sem resultado não prova que o pedido falhou.';

export default function ConsentManager() {
  const session = getSession();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const selected = params.get('country');
  return <ConsentWorkspace key={`${session?.userId}:${session?.token}`} initialCountry={isConsentCountry(selected) ? selected : 'AO'} needsProfile={user?.patient_onboarding_complete === false} />;
}

function ConsentWorkspace({ initialCountry, needsProfile }: { initialCountry: ConsentCountry; needsProfile: boolean }) {
  const [session] = useState(getSession);
  const owner = session?.userId ?? '';
  const token = session?.token ?? '';
  const [restored] = useState(() => {
    try { return { pending: owner ? readPendingConsent(owner) : null, error: '' }; }
    catch { return { pending: null, error: 'Não foi possível ler a referência guardada. As decisões estão bloqueadas até recuperar o armazenamento.' }; }
  });
  const [country, setCountry] = useState<ConsentCountry>(restored.pending?.payload.country ?? initialCountry);
  const [pending, setPending] = useState<PendingConsent | null>(restored.pending);
  const [storageError, setStorageError] = useState(restored.error);
  const [state, setState] = useState<ConsentState | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<ConsentEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [accessLost, setAccessLost] = useState(false);
  const denied = useRef(false);
  const authority = useRef(0);
  const mounted = useRef(false);
  const mutation = useRef(false);
  const readSequence = useRef(0);
  const historySequence = useRef(0);
  const historyBusy = useRef(false);
  const advanceRead = useCallback(() => ++readSequence.current, []);
  const advanceHistory = useCallback(() => ++historySequence.current, []);
  const current = useCallback(() => mounted.current && !!owner && !!token && getSession()?.userId === owner && getSession()?.token === token, [owner, token]);
  const config = useCallback(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; advanceRead(); advanceHistory(); }; }, [advanceRead, advanceHistory]);
  const invalidateAccess = useCallback((failure: unknown) => {
    if (![401, 403].includes(apiErrorStatus(failure) ?? 0)) return false;
    denied.current = true; ++authority.current; ++readSequence.current; ++historySequence.current;
    historyBusy.current = false; setHistoryLoading(false); setLoading(false);
    setAccessLost(true); setState(null); setChecked({}); setHistory([]); setHistoryLoaded(false); setNextCursor(null); setNotice('');
    return true;
  }, []);

  const refresh = useCallback(async (explicit = false) => {
    if (!current() || mutation.current) return;
    if (denied.current && !explicit) return;
    const sequence = ++readSequence.current;
    setLoading(true); setError('');
    try {
      const response = await api.get(`${BASE}/consent-state`, { ...config(), params: { country, language: 'pt' } });
      if (!current() || sequence !== readSequence.current) return;
      setState(parseConsentState(response.data, country)); setChecked({}); denied.current = false; setAccessLost(false);
      try { setPending(readPendingConsent(owner)); setStorageError(''); }
      catch { setStorageError('Não foi possível ler a referência guardada. Não envie outra decisão.'); }
    } catch (failure) {
      if (!current() || sequence !== readSequence.current) return;
      invalidateAccess(failure);
      setError(apiErrorMessage(failure, 'Não foi possível atualizar os consentimentos. Atualize antes de decidir.'));
    } finally { if (current() && sequence === readSequence.current) setLoading(false); }
  }, [current, config, country, owner, invalidateAccess]);
  useEffect(() => {
    void Promise.resolve().then(() => refresh());
    const focus = () => { void refresh(); };
    const storage = (event: StorageEvent) => { if (event.key?.startsWith('kaya_pending_consent:')) void refresh(); };
    window.addEventListener('focus', focus); window.addEventListener('storage', storage);
    return () => { advanceRead(); window.removeEventListener('focus', focus); window.removeEventListener('storage', storage); };
  }, [refresh, advanceRead]);

  const loadHistory = useCallback(async (cursor?: string) => {
    if (!current() || historyBusy.current || denied.current) return;
    historyBusy.current = true;
    const sequence = ++historySequence.current;
    setHistoryLoading(true); setHistoryError('');
    try {
      const response = await api.get(`${BASE}/consent-history/page`, { ...config(), params: { limit: 20, ...(cursor ? { cursor } : {}) } });
      if (!current() || sequence !== historySequence.current) return;
      const page = parseConsentHistory(response.data);
      setHistory(previous => cursor ? [...new Map([...previous, ...page.items].map(item => [item.id, item])).values()] : page.items);
      setNextCursor(page.next_cursor); setHistoryLoaded(true);
    } catch (failure) {
      if (!current() || sequence !== historySequence.current) return;
      invalidateAccess(failure);
      if (apiErrorStatus(failure) === 422) setNextCursor(null);
      setHistoryError(apiErrorStatus(failure) === 422 ? 'A continuação expirou. Atualize o histórico para recomeçar.' : 'Não foi possível carregar o histórico. Tente atualizar.');
    } finally { if (current() && sequence === historySequence.current) { historyBusy.current = false; setHistoryLoading(false); } }
  }, [config, current, invalidateAccess]);

  const execute = async (attempt: PendingConsent, lookup = false) => {
    if (!current() || mutation.current || denied.current) return;
    const authorityEpoch = authority.current;
    mutation.current = true; ++readSequence.current;
    setBusy(true); setLoading(false); setError(''); setNotice('');
    let sent = false;
    try {
      // Write before POST; a retry never substitutes a newer document or revision.
      if (!lookup) savePendingConsent(attempt);
      setPending(attempt);
      sent = !lookup;
      const response = lookup
        ? await api.get(`${BASE}/consent-requests/${encodeURIComponent(attempt.key)}`, config())
        : await api.post(`${BASE}/consent`, attempt.payload, { headers: { ...config().headers, 'Idempotency-Key': attempt.key } });
      if (!current() || authority.current !== authorityEpoch) return;
      const receipt = parseConsentReceipt(response.data, attempt);
      setState(receipt.state); setCountry(receipt.state.country); setChecked({});
      setNotice('Decisão registada. O estado apresentado é o estado atual confirmado pelo servidor.');
      try { clearPendingConsent(attempt); setPending(readPendingConsent(owner)); setStorageError(''); }
      catch { setStorageError('O servidor confirmou a decisão, mas a referência local não pôde ser atualizada. Verifique o mesmo pedido antes de enviar outro.'); }
      void loadHistory();
    } catch (failure) {
      if (!current() || authority.current !== authorityEpoch) return;
      invalidateAccess(failure);
      const absent = !lookup ? consentNotCommitted(failure) : null;
      if (absent) {
        try {
          clearPendingConsent(attempt); setPending(readPendingConsent(owner)); setState(null); setChecked({});
          setError(`${absent} Atualize os documentos antes de decidir novamente.`);
        } catch { setStorageError('Não foi possível atualizar a referência guardada. Recupere o mesmo pedido.'); }
      } else {
        let retained: PendingConsent | null = null;
        try { retained = readPendingConsent(owner); } catch { setStorageError('Não foi possível verificar a referência guardada. Mantenha esta página aberta e não envie outro pedido.'); }
        setPending(retained ?? (sent || lookup ? attempt : null));
        if (!retained && (sent || lookup)) setStorageError('A referência não pôde ser confirmada no armazenamento. Mantenha esta página aberta para recuperar a mesma decisão.');
        setError(retained || sent || lookup ? uncertain : 'Não foi possível guardar a referência de recuperação. Nenhuma nova decisão foi enviada. Verifique o armazenamento e atualize.');
      }
    } finally { if (current()) { mutation.current = false; setBusy(false); } }
  };
  const decide = (item: ConsentPurposeState, action: ConsentAction) => {
    if (needsProfile || !state || state.country !== country || loading || busy || error || pending || storageError || denied.current || !current()) return;
    const reference = action === 'withdraw' && item.latest_event ? {
      document_id: item.latest_event.document_id, version: item.latest_event.version, content_hash: item.latest_event.content_hash,
      country: item.latest_event.country, language: item.latest_event.language,
    } : item.document ? consentReference(item.document) : null;
    if (!reference || (action === 'grant' && !checked[item.document?.id ?? ''])) return;
    void execute({ owner, key: crypto.randomUUID(), payload: { ...reference, action, expected_revision: state.revision } });
  };
  const visibleState = state?.country === country ? state : null;
  const locked = needsProfile || accessLost || !!pending || !!storageError || busy || loading || !!error || !current();

  return <>
    <div className="page-header"><h1>Consentimentos e decisões</h1><p>Reveja os documentos aprovados para o país selecionado e decida separadamente sobre cada finalidade.</p></div>
    <p>Retirar ou recusar pode impedir novas ações que dependam dessa decisão. O acesso ao seu histórico e aos seus documentos pessoais continua disponível.</p>
    {needsProfile && <p>Reveja os documentos aqui e <Link to="/onboarding/patient">conclua o perfil de paciente</Link> para registar as decisões iniciais.</p>}
    <Link to="/consultations">Consultar o meu histórico</Link>{' · '}<Link to="/settings">Definições e dados da conta</Link>
    <p><label htmlFor="consent-country">País dos documentos</label>{' '}<select id="consent-country" value={country} disabled={!!pending || busy || !!storageError} onChange={event => { if (isConsentCountry(event.target.value)) { setCountry(event.target.value); setChecked({}); setNotice(''); } }}><option value="AO">Angola</option><option value="PT">Portugal</option></select>{' '}Idioma dos documentos: Português</p>
    <button className="btn btn-secondary" disabled={busy || loading} onClick={() => void refresh(true)}>Atualizar consentimentos</button>
    {accessLost && <p role="alert">O acesso deixou de estar autorizado. Os documentos e o histórico foram ocultados. Atualize explicitamente para verificar o acesso; a referência mínima de recuperação foi mantida.</p>}
    {loading && <p role="status">A consultar os documentos e o estado atual…</p>}
    {error && <p role="alert">{error}</p>}{storageError && <p role="alert">{storageError}</p>}{notice && <p role="status">{notice}</p>}
    {pending && <section aria-label="Recuperar decisão" className="card" style={{ padding: '1rem', margin: '1rem 0' }}>
      <p>Existe uma decisão por confirmar nesta conta: {actionLabels[pending.payload.action]} · {pending.payload.country} · versão {pending.payload.version}.</p>
      {!storageError && <p>A referência exata foi guardada neste navegador. Pode voltar à mesma conta para a recuperar, mesmo se o catálogo ficar indisponível.</p>}
      <button className="btn btn-secondary" disabled={busy || accessLost} onClick={() => void execute(pending, true)}>Verificar decisão guardada</button>{' '}
      <button className="btn btn-primary" disabled={busy || accessLost} onClick={() => void execute(pending)}>Repetir a mesma decisão</button>
    </section>}
    {visibleState && <>
      {!visibleState.available && <p role="status">Ainda não há um conjunto completo de documentos aprovados disponível para este país. Novas ações que exijam esses documentos continuam indisponíveis.</p>}
      {allConsentEffective(visibleState) && <p role="status">As cinco decisões obrigatórias estão em vigor neste país e nesta versão dos documentos.</p>}
      {visibleState.states.map(item => <section className="card" key={item.purpose} style={{ padding: '1rem', margin: '1rem 0' }}>
        <h2>{item.document?.title ?? item.purpose}</h2><p>Finalidade: {item.purpose} · {statusLabels[item.status]}</p>
        {item.document && <>
          <p>Versão {item.document.version} · {item.document.country} · {item.document.language}{item.document.required ? ' · Obrigatório para as ações aplicáveis' : ' · Opcional'}</p>
          <details><summary>Ler documento aprovado</summary><div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.document.content}</div><p>Fonte aprovada: {item.document.approved_source}</p><p style={{ overflowWrap: 'anywhere' }}>Identificação do conteúdo: {item.document.content_hash}</p></details>
          {!item.effective && <><p><label><input type="checkbox" checked={checked[item.document.id] ?? false} disabled={locked} onChange={event => setChecked(previous => ({ ...previous, [item.document!.id]: event.target.checked }))} /> Li a versão {item.document.version} de {item.document.title}.</label></p>
            <button className="btn btn-primary" disabled={locked || !checked[item.document.id]} onClick={() => decide(item, 'grant')}>Aceitar — {item.document.title}</button>{' '}
            <button className="btn btn-secondary" disabled={locked} onClick={() => decide(item, 'refuse')}>Recusar — {item.document.title}</button></>}
        </>}
        {item.latest_event?.action === 'grant' && <button className="btn btn-secondary" disabled={locked} onClick={() => decide(item, 'withdraw')}>Retirar — {item.document?.title ?? item.purpose}</button>}
      </section>)}
    </>}
    <section aria-labelledby="consent-history-title"><h2 id="consent-history-title">Histórico das decisões</h2>
      <button className="btn btn-secondary" disabled={historyLoading || accessLost} onClick={() => void loadHistory()}>Atualizar histórico</button>
      {historyError && <p role="alert">{historyError}</p>}{historyLoading && <p role="status">A carregar histórico…</p>}
      {historyLoaded && history.length === 0 && <p>Ainda não há decisões registadas.</p>}
      <ul>{history.map(item => <li key={item.id}>{actionLabels[item.action]} · {item.purpose} · versão {item.version} · {item.country} · {new Date(item.created_at).toLocaleString('pt-PT')}</li>)}</ul>
      {nextCursor && <button className="btn btn-secondary" disabled={historyLoading} onClick={() => void loadHistory(nextCursor)}>Carregar mais decisões</button>}
    </section>
  </>;
}
