import { useCallback, useEffect, useRef, useState } from 'react';
import api, { getSession } from '../api';
import { useT } from '../i18n/LanguageContext';
import { X, CheckCircle2, Copy, Loader2, Smartphone, CreditCard, Landmark } from 'lucide-react';
import { checkoutNotCommitted, clearPendingPayment, formatPaymentAmount, isPaymentKey, isPaymentProvider, parsePaymentReceipt, paymentOutcome, paymentRedirect, readPendingPayment, savePendingPayment } from '../utils/pendingPayment';
import type { PaymentProvider, PaymentReceipt, PendingPayment } from '../utils/pendingPayment';

interface PaymentMethod { id: string; label: string; description: string; enabled: boolean; integration_status?: string }
interface Props { open: boolean; consultationId: string; country?: string | null; recoveryOnly?: boolean; onClose: () => void; onPaid: () => void }
type Phase = 'checking' | 'methods' | 'pending' | 'paid' | 'failed' | 'blocked';
const uncertainty = 'Ainda não foi possível confirmar o resultado. A referência foi guardada nesta conta. Não inicie outro pagamento; verifique o estado ou recupere o mesmo pedido.';
const statusOf = (error: unknown) => (error as { response?: { status?: number } })?.response?.status;
const METHOD_ICON: Record<string, React.ReactNode> = {
  multicaixa_express: <Smartphone size={18} />, visa_mastercard: <CreditCard size={18} />, iban_transfer: <Landmark size={18} />,
};

export default function PaymentModal(props: Props) {
  const session = getSession();
  return props.open ? <PaymentSession key={`${session?.userId}:${session?.token}:${props.consultationId}`} {...props} /> : null;
}

function PaymentSession({ consultationId, country, recoveryOnly = false, onClose, onPaid }: Props) {
  const { t } = useT();
  const [session] = useState(getSession);
  const owner = session?.userId ?? '';
  const token = session?.token ?? '';
  const mounted = useRef(false);
  const busy = useRef(false);
  const paidNotified = useRef(false);
  const onPaidRef = useRef(onPaid);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phase, setPhase] = useState<Phase>('checking');
  const [attempt, setAttempt] = useState<PendingPayment | null>(null);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodsLoaded, setMethodsLoaded] = useState(false);
  const [methodsError, setMethodsError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const current = useCallback(() => mounted.current && !!owner && !!token && getSession()?.userId === owner && getSession()?.token === token, [owner, token]);
  const config = useCallback(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const statusUrl = `/api/v1/billing/consultation/${consultationId}/payment-status`;

  useEffect(() => { onPaidRef.current = onPaid; }, [onPaid]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, []);

  const applyReceipt = useCallback((value: unknown, pending: PendingPayment) => {
    const next = parsePaymentReceipt(value, pending);
    if (!current()) return;
    setReceipt(previous => previous?.payment_id === next.payment_id && previous.request_key === next.request_key ? { ...previous, ...next } : next);
    setError('');
    const outcome = paymentOutcome(next);
    if (outcome === 'paid' || outcome === 'failed') {
      let cleared = false;
      try { cleared = clearPendingPayment(pending); } catch { /* Keep the saved identity for recovery. */ }
      if (cleared) setAttempt(null);
      setPhase(outcome === 'paid' ? 'paid' : cleared ? 'failed' : 'blocked');
      if (!cleared && outcome === 'failed') setError('O pedido falhou, mas não foi possível atualizar a referência guardada. Verifique novamente antes de escolher outro método.');
      if (outcome === 'paid' && !paidNotified.current) { paidNotified.current = true; onPaidRef.current(); }
    } else {
      setPhase('pending');
    }
  }, [current]);

  const exactStatus = useCallback(async (pending: PendingPayment) => {
    try {
      const result = await api.get(statusUrl, { ...config(), params: { request_key: pending.key } });
      if (current()) applyReceipt(result.data, pending);
    } catch (problem) {
      if (current() && [401, 403].includes(statusOf(problem) ?? 0)) setReceipt(null);
      throw problem;
    }
  }, [statusUrl, config, current, applyReceipt]);

  // Unfiltered status only discovers an existing identity; all actionable receipts use an exact lookup.
  const discover = useCallback(async (allowEmpty: boolean) => {
    try {
      const result = await api.get(statusUrl, config());
      if (!current()) return;
      const found = parsePaymentReceipt(result.data);
      if (!isPaymentKey(found.request_key) || !isPaymentProvider(found.provider)) {
        setReceipt(found); setPhase('blocked');
        setError('Este pagamento necessita de revisão pela equipa. Não existe uma referência de pedido recuperável; não inicie outro pagamento.');
        return;
      }
      const recovered = { owner, consultationId, provider: found.provider, key: found.request_key };
      savePendingPayment(recovered);
      setAttempt(recovered); setPhase('pending');
      await exactStatus(recovered);
    } catch (problem) {
      if (!current()) return;
      if ([401, 403].includes(statusOf(problem) ?? 0)) setReceipt(null);
      // A 404 allows initial selection only if this browser knows of no prior attempt.
      // Once a prior attempt was discovered, absence never proves that it did not commit.
      if (statusOf(problem) === 404 && allowEmpty && !readPendingPayment(owner, consultationId)) {
        setPhase(recoveryOnly ? 'blocked' : 'methods'); setError(recoveryOnly ? 'Não existe um pagamento confirmado para mostrar. Um pedido em curso ainda pode aparecer; pode verificar novamente.' : '');
      } else { setPhase('blocked'); setError('Não foi possível confirmar o pagamento existente. Verifique novamente; não inicie outro pedido.'); }
    }
  }, [statusUrl, config, current, owner, consultationId, exactStatus, recoveryOnly]);

  useEffect(() => {
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active || !current()) return;
      busy.current = true; setLoading(true);
      try {
        const saved = readPendingPayment(owner, consultationId);
        if (saved) { setAttempt(saved); setPhase('pending'); await exactStatus(saved); }
        else await discover(true);
      } catch { if (active && current()) { setPhase('blocked'); setError(uncertainty); } }
      finally { if (active && current()) { busy.current = false; setLoading(false); } }
    })();
    return () => { active = false; };
  }, [owner, consultationId, current, exactStatus, discover]);

  useEffect(() => {
    let active = true;
    if (!['AO', 'PT'].includes(country ?? '') || !owner || !token) return;
    void api.get('/api/v1/billing/payment-methods', { ...config(), params: { country, currency: country === 'PT' ? 'EUR' : 'AOA', include_planned: true } })
      .then(result => {
        if (!active || !current()) return;
        if (!Array.isArray(result.data?.methods)) throw new Error('Invalid catalog');
        const list = result.data.methods as PaymentMethod[];
        if (list.some(item => !item || typeof item.id !== 'string' || typeof item.label !== 'string' || typeof item.description !== 'string' || typeof item.enabled !== 'boolean')) throw new Error('Invalid catalog');
        setMethods(list); setMethodsLoaded(true); setMethodsError('');
      }).catch(() => { if (active && current()) { setMethods([]); setMethodsLoaded(false); setMethodsError('Não foi possível carregar os métodos de pagamento.'); } });
    return () => { active = false; };
  }, [country, owner, token, catalogVersion, config, current]);

  const checkStatus = useCallback(async () => {
    if (busy.current || !current()) return;
    busy.current = true; setLoading(true);
    try {
      const saved = readPendingPayment(owner, consultationId);
      if (saved) { setAttempt(saved); await exactStatus(saved); }
      else await discover(false);
    } catch { if (current()) setError(uncertainty); }
    finally { if (current()) { busy.current = false; setLoading(false); } }
  }, [current, owner, consultationId, exactStatus, discover]);

  useEffect(() => {
    if (phase !== 'pending' || !attempt || receipt?.provider === 'iban_transfer') return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await checkStatus();
      if (active) timer = setTimeout(poll, 4000);
    };
    timer = setTimeout(poll, 4000);
    return () => { active = false; clearTimeout(timer); };
  }, [phase, attempt, receipt?.provider, checkStatus]);

  const submit = async (method?: PaymentProvider) => {
    if (busy.current || !current()) return;
    busy.current = true; setLoading(true); setError('');
    let pending: PendingPayment | null = null;
    let durable = false;
    try {
      pending = readPendingPayment(owner, consultationId);
      durable = !!pending;
      if (!pending) {
        if (recoveryOnly || !method || phase !== 'methods' || country !== 'AO' || !methodsLoaded || !methods.some(item => item.id === method && item.enabled)) throw new Error('Escolha indisponível.');
        pending = { owner, consultationId, provider: method, key: crypto.randomUUID() };
        savePendingPayment(pending); // Mandatory durable write before the first POST.
        durable = true;
      }
      if (!current()) return;
      setAttempt(pending); setReceipt(previous => previous?.request_key === pending?.key ? previous : null); setPhase('pending');
      const result = await api.post('/api/v1/billing/consultation/checkout', { consultation_id: consultationId, payment_method: pending.provider }, { headers: { ...config().headers, 'Idempotency-Key': pending.key } });
      if (current()) applyReceipt(result.data, pending);
    } catch (problem) {
      if (!current()) return;
      if ([401, 403].includes(statusOf(problem) ?? 0)) setReceipt(null);
      const absent = checkoutNotCommitted(problem);
      if (absent && pending) {
        let cleared = false;
        try { cleared = clearPendingPayment(pending); } catch { /* Retry exact identity if local persistence is unavailable. */ }
        if (cleared) {
          setAttempt(null); setReceipt(null);
          if (absent.reason === 'existing_payment_attempt') { setPhase('blocked'); await discover(false); }
          else { setPhase(recoveryOnly ? 'blocked' : 'methods'); setError(absent.message); }
        } else { setPhase('blocked'); setError(uncertainty); }
      } else {
        setPhase(durable ? 'pending' : 'blocked');
        setError(durable ? uncertainty : 'Não foi possível guardar a referência de recuperação. Nenhum novo pagamento foi enviado. Verifique o estado antes de tentar novamente.');
      }
    } finally { if (current()) { busy.current = false; setLoading(false); } }
  };

  const copy = async (key: string, value?: string) => {
    if (!value || !current()) return;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      if (!current()) return;
      setCopied(key); if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => { if (current()) setCopied(null); }, 1500);
    } catch { if (current()) setError('Não foi possível copiar. Pode selecionar a referência apresentada.'); }
  };
  const outcome = receipt ? paymentOutcome(receipt) : null;
  const redirect = paymentRedirect(receipt?.redirect_url);
  const instructionsAllowed = !!receipt && outcome === 'pending' && receipt.dispatch_state === 'response_recorded';
  const reference = receipt?.provider_reference;

  return <div onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="modal-overlay" style={{ zIndex: 9999 }}>
    <section role="dialog" aria-modal="true" aria-labelledby="payment-title" className="modal" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 id="payment-title">{t('pay.title')}</h2><button onClick={onClose} aria-label={t('common.close')} className="btn btn-ghost"><X size={18} /></button>
      </header>
      {error && <p role="alert">{error}</p>}
      {(!owner || !token) && <p role="alert">Inicie sessão na conta desta consulta para recuperar o pagamento.</p>}
      {loading && <p role="status"><Loader2 size={18} /> A verificar o pagamento…</p>}
      {phase === 'methods' && <>
        {country === 'PT' ? <p>Pagamentos em Portugal indisponíveis enquanto a cotação em EUR não estiver aprovada.</p>
          : country !== 'AO' ? <p>O país desta consulta não está confirmado. Não é possível iniciar o pagamento.</p> : <p>{t('pay.choose_method')}</p>}
        {methodsError && <p role="alert">{methodsError}</p>}
        {['AO', 'PT'].includes(country ?? '') && <button className="btn btn-secondary" disabled={loading} onClick={() => setCatalogVersion(value => value + 1)}>Atualizar métodos</button>}
        {methodsLoaded && !methods.some(method => method.enabled) && <p>Nenhum método de pagamento está disponível neste momento.</p>}
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>{methods.map(method => <button key={method.id} className="btn btn-secondary"
          disabled={loading || !method.enabled || country !== 'AO' || !isPaymentProvider(method.id)}
          onClick={() => { if (isPaymentProvider(method.id)) void submit(method.id); }}>
          {METHOD_ICON[method.id] ?? <CreditCard size={18} />} <span>{method.label}{method.description && <small style={{ display: 'block' }}>{method.description}</small>}{(!method.enabled || country !== 'AO') && <small style={{ display: 'block' }}>Indisponível</small>}</span>
        </button>)}</div>
      </>}
      {phase === 'paid' && <div role="status"><CheckCircle2 size={36} /><h3>Pagamento confirmado</h3><p>O servidor confirmou a aplicação do pagamento à consulta. O estado e o horário da consulta são verificados separadamente.</p></div>}
      {phase === 'failed' && <><p>O prestador confirmou que este pedido falhou, sem revisão financeira pendente.</p>{!recoveryOnly && <button className="btn btn-secondary" onClick={() => { setPhase('methods'); setReceipt(null); }}>{t('pay.try_other')}</button>}</>}
      {(phase === 'pending' || phase === 'blocked') && <>
        {receipt?.amount !== undefined && receipt.currency && <p style={{ fontSize: '1.4rem', fontWeight: 700 }}>{formatPaymentAmount(receipt.amount, receipt.currency)}</p>}
        {outcome === 'review' || (receipt && !attempt) ? <p role="status">Pagamento em revisão financeira. Ainda não está confirmado como aplicado à consulta. Aguarde a equipa; não efetue outro pagamento.</p>
          : <p>Pedido por confirmar. Mantenha o mesmo método e a mesma referência até existir um resultado confirmado.</p>}
        {reference && <ReferenceBox label={t('pay.reference')} value={reference} copied={copied === 'ref'} onCopy={() => void copy('ref', reference)} tCopy={t('pay.copy')} tCopied={t('pay.copied')} />}
        {instructionsAllowed && <>
          {receipt?.instructions && <p>{receipt.instructions}</p>}
          {receipt?.provider === 'iban_transfer' && receipt.transfer_details && <>
            <TransferRow label={t('pay.bank')} value={String(receipt.transfer_details.bank_name ?? '')} />
            <TransferRow label={t('pay.beneficiary')} value={String(receipt.transfer_details.beneficiary ?? '')} />
            <ReferenceBox label="IBAN" value={String(receipt.transfer_details.iban ?? '')} copied={copied === 'iban'} onCopy={() => void copy('iban', String(receipt.transfer_details?.iban ?? ''))} tCopy={t('pay.copy')} tCopied={t('pay.copied')} />
            <p>{t('pay.transfer_note')}</p>
          </>}
          {redirect && ['visa_mastercard', 'paypal'].includes(receipt?.provider ?? '') && <a className="btn btn-primary" href={redirect} target="_blank" rel="noopener noreferrer">Continuar no prestador</a>}
        </>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <button disabled={loading || !owner || !token} className="btn btn-secondary" onClick={() => void checkStatus()}>Verificar estado</button>
          {attempt && <button disabled={loading} className="btn btn-primary" onClick={() => void submit()}>Recuperar o mesmo pedido</button>}
        </div>
        {attempt && <p style={{ fontSize: '0.85rem' }}>Pode fechar esta janela. Ao regressar à mesma conta e consulta neste navegador, a referência guardada permite recuperar este pedido.</p>}
      </>}
    </section>
  </div>;
}

function ReferenceBox({ label, value, copied, onCopy, tCopy, tCopied }: {
  label: string; value?: string; copied: boolean; onCopy: () => void; tCopy: string; tCopied: string;
}) {
  return (
    <div style={{ background: 'var(--bg-subtle, rgba(148,163,184,0.12))', borderRadius: 12, padding: '0.85rem 1rem', margin: '0.5rem 0', textAlign: 'left' }}>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.25rem' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <code style={{ fontSize: '0.98rem', fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{value}</code>
        <button className="btn btn-ghost btn-sm" disabled={!value} onClick={onCopy} style={{ flexShrink: 0 }}>
          <Copy size={14} /> {copied ? tCopied : tCopy}
        </button>
      </div>
    </div>
  );
}

function TransferRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
