import { useEffect, useState } from 'react';
import type { MutableRefObject } from 'react';
import { Link } from 'react-router-dom';
import api, { getSession } from '../api';
import type { StepRenderContext } from './OnboardingShell';
import { consentReference, isConsentCountry, parseConsentCatalog, parseConsentState } from '../utils/consent';
import type { ConsentCatalog, ConsentReference, ConsentState } from '../utils/consent';

export default function OnboardingConsentStep({ ctx, readyRef }: { ctx: StepRenderContext; readyRef: MutableRefObject<boolean> }) {
  const country = ctx.stepsData['4']?.country;
  const [result, setResult] = useState<{ catalog: ConsentCatalog; state: ConsentState } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [session] = useState(getSession);
  useEffect(() => {
    let active = true; readyRef.current = false;
    if (!isConsentCountry(country)) return;
    const headers = { Authorization: `Bearer ${session?.token ?? ''}` };
    const current = () => active && !!session?.token && getSession()?.userId === session.userId && getSession()?.token === session.token;
    void Promise.all([
      api.get('/api/v1/compliance/catalog', { headers, params: { country, language: 'pt' } }),
      api.get('/api/v1/compliance/consent-state', { headers, params: { country, language: 'pt' } }),
    ]).then(([catalogResponse, stateResponse]) => {
      if (!current()) return;
      const catalog = parseConsentCatalog(catalogResponse.data, country);
      const state = parseConsentState(stateResponse.data, country);
      if (catalog.documents.some(doc => !state.states.some(item => item.document?.id === doc.id && item.document.version === doc.version && item.document.content_hash === doc.content_hash))) throw new Error('O catálogo mudou. Atualize os documentos antes de decidir.');
      readyRef.current = catalog.available && state.available;
      setResult({ catalog, state }); setError('');
    }).catch(() => { if (current()) { readyRef.current = false; setResult(null); setError('Não foi possível confirmar os documentos aprovados. Atualize para continuar.'); } });
    return () => { active = false; readyRef.current = false; };
  }, [country, retry, session, readyRef]);
  const current = result?.catalog.country === country ? result : null;
  const validDraft = current && ctx.data.catalog_country === country && ctx.data.catalog_language === 'pt' && ctx.data.consent_expected_revision === current.state.revision;
  const accepted = validDraft && Array.isArray(ctx.data.consent_acceptances) ? ctx.data.consent_acceptances as ConsentReference[] : [];
  return <>
    <p>País escolhido no perfil: {country === 'AO' ? 'Angola' : country === 'PT' ? 'Portugal' : 'Por confirmar'}. Documentos em Português.</p>
    <p>Leia cada texto aprovado. As decisões serão guardadas em conjunto com a conclusão do perfil. Nenhuma opção nova vem selecionada.</p>
    {error && <p role="alert">{error}</p>}
    {!current && !error && <p role="status">A consultar os documentos aprovados…</p>}
    {current && !current.catalog.available && <p role="status">Os documentos aprovados para este país ainda não estão disponíveis. Pode guardar o rascunho; a conclusão do perfil permanece indisponível.</p>}
    <button type="button" className="btn btn-secondary" onClick={() => { readyRef.current = false; setResult(null); setRetry(value => value + 1); }}>Atualizar documentos de consentimento</button>
    {current?.catalog.documents.filter(doc => doc.required).map(doc => {
      const reference = consentReference(doc);
      const selected = accepted.some(item => JSON.stringify(item) === JSON.stringify(reference));
      return <section key={doc.id} style={{ margin: '1rem 0' }}><h3>{doc.title}</h3><p>Finalidade: {doc.purpose} · versão {doc.version} · {doc.country} · {doc.language}</p>
        <details><summary>Ler documento aprovado</summary><div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{doc.content}</div><p>Fonte aprovada: {doc.approved_source}</p></details>
        <label><input type="checkbox" checked={selected} disabled={!current.catalog.available || !current.state.available} onChange={event => {
          const next = event.target.checked ? [...accepted.filter(item => item.document_id !== doc.id), reference] : accepted.filter(item => item.document_id !== doc.id);
          ctx.setData({ catalog_country: country, catalog_language: 'pt', consent_expected_revision: current.state.revision, consent_acceptances: next });
        }} /> Li e aceito {doc.title}, versão {doc.version}.</label>
      </section>;
    })}
    <p>As finalidades opcionais são decididas separadamente nos <Link to={`/consents?country=${country === 'PT' ? 'PT' : 'AO'}`}>controlos de consentimento</Link>, após concluir o perfil.</p>
  </>;
}
