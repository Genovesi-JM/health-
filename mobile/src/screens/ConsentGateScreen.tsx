import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import type { AppStackParamList } from '../navigation/AppStack';
import * as SecureStore from 'expo-secure-store';
import type { AxiosRequestConfig } from 'axios';
import { useAuth } from '../contexts/AuthContext';
import api, { sessions } from '../services/api';
import {
  CONSENT_ACTION, CONSENT_STATUS, consentNotCommitted, observeConsentRead, consentQuery, consentReference, newConsentAttempt, parseConsentCatalog,
  parseConsentHistory, parseConsentState, readConsentAttempt, recoverConsent, submitConsent,
  type ConsentAction, type ConsentAttempt, type ConsentCatalog, type ConsentCountry, type ConsentEvent,
  type ConsentPurposeState, type ConsentState,
} from './consents';

const BASE = '/api/v1/compliance';
const statusOf = (error: unknown) => (error as { response?: { status?: number } })?.response?.status;
const countryLabel = (country: ConsentCountry) => country === 'AO' ? 'Angola' : 'Portugal';

export default function ConsentGateScreen() {
  const { user } = useAuth();
  const owner = user?.id ?? '';
  const route = useRoute<RouteProp<AppStackParamList, 'ConsentGate'>>();
  const [country, setCountry] = useState<ConsentCountry>(route.params?.country === 'PT' ? 'PT' : 'AO');
  const [catalog, setCatalog] = useState<ConsentCatalog | null>(null);
  const [state, setState] = useState<ConsentState | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<ConsentAttempt | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [history, setHistory] = useState<ConsentEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorExpired, setCursorExpired] = useState(false);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState('');
  const mounted = useRef(true);
  const focused = useRef(true);
  const busy = useRef(false);
  const sequence = useRef(0);
  const current = useCallback((version: number, ticket = sequence.current) => mounted.current && focused.current && sessions.current(version) && sequence.current === ticket, []);
  const scoped = useCallback((version: number) => ({
    get: (path: string) => api.get(path, { _sessionVersion: version } as AxiosRequestConfig),
    post: (path: string, body: unknown, options: { headers: Record<string, string> }) => api.post(path, body, { ...options, _sessionVersion: version } as AxiosRequestConfig),
  }), []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; sequence.current += 1; }; }, []);

  const revokeAccess = useCallback((version: number, ticket: number) => {
    if (!current(version, ticket)) return;
    sequence.current += 1; busy.current = false; setWorking('');
    setCatalog(null); setState(null); setChecked({}); setHistory([]); setCursor(null); setPending(null); setRecoveryReady(false);
    setError('O acesso mudou. Atualize a sessão para consultar as suas decisões.');
  }, [current]);

  const load = useCallback(async () => {
    if (!owner || busy.current) return;
    const version = sessions.version(); const ticket = ++sequence.current;
    busy.current = true; setWorking('load'); setError(''); setHistoryError(''); setChecked({});
    const client = scoped(version);
    const deny = () => revokeAccess(version, ticket);
    const observe = <T,>(request: Promise<T>) => observeConsentRead(request, () => current(version, ticket), deny);
    try {
      const results = await Promise.allSettled([
        observe(client.get(BASE + '/catalog' + consentQuery(country))), observe(client.get(BASE + '/consent-state' + consentQuery(country))),
        observe(client.get(BASE + '/consent-history/page?limit=20')), readConsentAttempt(SecureStore, owner),
      ]);
      if (!current(version, ticket)) return;
      if (results.some(result => result.status === 'rejected' && [401, 403].includes(statusOf(result.reason) ?? 0))) {
        setCatalog(null); setState(null); setHistory([]); setCursor(null); setRecoveryReady(false);
        setError('O acesso mudou. Atualize a sessão para consultar as suas decisões.'); return;
      }
      const [catalogResult, stateResult, historyResult, recoveryResult] = results;
      if (catalogResult.status === 'fulfilled' && stateResult.status === 'fulfilled') {
        try { setCatalog(parseConsentCatalog(catalogResult.value.data, country)); setState(parseConsentState(stateResult.value.data, country)); }
        catch { setCatalog(null); setState(null); setError('Não foi possível verificar o catálogo e o estado atual. Atualize antes de decidir.'); }
      } else { setCatalog(null); setState(null); setError('Não foi possível carregar os textos e decisões atuais. Tente novamente.'); }
      if (historyResult.status === 'fulfilled') {
        try { const page = parseConsentHistory(historyResult.value.data); setHistory(page.items); setCursor(page.next_cursor); setCursorExpired(false); }
        catch { setHistoryError('Não foi possível verificar o histórico. Os registos carregados foram mantidos.'); }
      } else setHistoryError('Não foi possível atualizar o histórico. Os registos carregados foram mantidos.');
      if (recoveryResult.status === 'fulfilled') { setPending(recoveryResult.value); setRecoveryReady(true); }
      else { setRecoveryReady(false); setError('Não foi possível verificar a decisão guardada. Atualize antes de tomar outra decisão.'); }
    } finally { if (current(version, ticket)) { busy.current = false; setWorking(''); } }
  }, [owner, country, current, scoped, revokeAccess]);
  useFocusEffect(useCallback(() => {
    focused.current = true; void load();
    return () => { focused.current = false; sequence.current += 1; busy.current = false; };
  }, [load]));

  useEffect(() => {
    const listener = AppState.addEventListener('change', next => { if (next === 'active' && focused.current) void load(); });
    return () => listener.remove();
  }, [load]);

  const runDecision = async (attempt: ConsentAttempt, lookup = false) => {
    if (busy.current || !owner) return;
    const version = sessions.version(); const ticket = sequence.current;
    const assertCurrent = () => { sessions.assertCurrent(version); if (!current(version, ticket)) throw new Error('A vista mudou.'); };
    busy.current = true; setWorking(lookup ? 'recover' : 'decision'); setError(''); setNotice('');
    try {
      const response = lookup ? await recoverConsent(scoped(version), SecureStore, attempt, assertCurrent)
        : await submitConsent(scoped(version), SecureStore, attempt, assertCurrent);
      assertCurrent();
      if (response) {
        if (response.state.country === country) setState(response.state);
        else { setState(null); setCatalog(null); }
        setHistory(previous => Array.from(new Map([response.event, ...previous].map(item => [item.id, item])).values()).sort((left, right) => right.sequence - left.sequence));
        setChecked({}); setNotice('Decisão confirmada pelo servidor. O estado atual pode incluir decisões posteriores a este pedido.');
      } else setError('A decisão ainda não foi encontrada. Um pedido anterior pode estar em curso; a referência original foi mantida.');
    } catch (failure) {
      if (!current(version, ticket)) return;
      if ([401, 403].includes(statusOf(failure) ?? 0)) { revokeAccess(version, ticket); return; }
      if (consentNotCommitted(failure)) { setState(null); setCatalog(null); setChecked({}); }
      const detail = (failure as { response?: { data?: { detail?: { message?: string } } } })?.response?.data?.detail;
      setError(typeof detail?.message === 'string' ? detail.message : 'Não foi possível confirmar a decisão. Verifique ou repita o pedido original antes de decidir novamente.');
    } finally {
      if (current(version, ticket)) {
        try { const saved = await readConsentAttempt(SecureStore, owner); if (current(version, ticket)) { setPending(saved); setRecoveryReady(true); } }
        catch { if (current(version, ticket)) { setRecoveryReady(false); setError('Não foi possível verificar a referência da decisão. Atualize antes de continuar.'); } }
        if (current(version, ticket)) { busy.current = false; setWorking(''); }
      }
    }
  };

  const decide = (item: ConsentPurposeState, action: ConsentAction) => {
    if (!state || busy.current || pending || !recoveryReady) return;
    const source = action === 'withdraw' ? item.latest_event : item.document;
    if (!source || action !== 'withdraw' && !checked[item.document?.id ?? '']) return;
    const version = sessions.version(); const ticket = sequence.current;
    const attempt = newConsentAttempt(owner, consentReference(source), action, state.revision);
    Alert.alert(CONSENT_ACTION[action], `${item.document?.title ?? item.purpose}\n${countryLabel(country)} · Português · versão ${source.version}\n${action === 'withdraw' ? 'A retirada pode impedir novos cuidados ou processamento. Os seus registos e histórico continuam acessíveis.' : action === 'refuse' ? 'A recusa de uma finalidade necessária pode impedir novos cuidados ou processamento.' : 'Será guardada a sua decisão sobre esta versão exata do texto.'}`, [
      { text: 'Voltar', style: 'cancel' },
      { text: `Confirmar: ${CONSENT_ACTION[action].toLowerCase()}`, onPress: () => { if (current(version, ticket)) void runDecision(attempt); } },
    ]);
  };

  const more = async () => {
    if (!cursor || cursorExpired || busy.current) return;
    const version = sessions.version(); const ticket = sequence.current;
    busy.current = true; setWorking('history'); setHistoryError('');
    try {
      const response = await scoped(version).get(BASE + '/consent-history/page?limit=20&cursor=' + encodeURIComponent(cursor));
      if (!current(version, ticket)) return;
      const page = parseConsentHistory(response.data, cursor);
      setHistory(previous => Array.from(new Map([...previous, ...page.items].map(item => [item.id, item])).values())); setCursor(page.next_cursor);
    } catch (failure) {
      if (!current(version, ticket)) return;
      if ([401, 403].includes(statusOf(failure) ?? 0)) { revokeAccess(version, ticket); return; }
      if (statusOf(failure) === 422) setCursorExpired(true);
      setHistoryError(statusOf(failure) === 422 ? 'A página expirou. Atualize o histórico para recomeçar.' : 'Não foi possível carregar mais decisões. Os registos carregados foram mantidos.');
    } finally { if (current(version, ticket)) { busy.current = false; setWorking(''); } }
  };
  const locked = !!working || !!pending || !recoveryReady;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.inner}>
    <Text style={styles.brand}>KAYA</Text><Text style={styles.title}>Consentimentos e histórico</Text>
    <Text style={styles.text}>Escolha o catálogo que pretende consultar. O país deste catálogo não altera o país das consultas ou dos documentos. Idioma dos textos: português.</Text>
    <View style={styles.row}>{(['AO', 'PT'] as const).map(code => <TouchableOpacity key={code} disabled={!!working} onPress={() => { sequence.current += 1; setCountry(code); setCatalog(null); setState(null); setChecked({}); }} accessibilityRole="radio" accessibilityState={{ selected: country === code }} style={[styles.button, country === code && styles.selected]}><Text>{countryLabel(code)}</Text></TouchableOpacity>)}</View>
    <TouchableOpacity style={styles.button} disabled={!!working} onPress={() => void load()}><Text>Atualizar catálogo, decisões e histórico</Text></TouchableOpacity>
    {!!working && <ActivityIndicator color="#0d9488" />}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!notice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
    {catalog && !catalog.available && <Text style={styles.error}>O catálogo aprovado está incompleto ou indisponível. Não é possível concluir as autorizações necessárias para novos cuidados neste mercado. Não substituímos os textos em falta.</Text>}
    {pending && <View style={styles.card}><Text style={styles.heading}>Decisão por confirmar</Text><Text style={styles.text}>{CONSENT_ACTION[pending.payload.action]} · {countryLabel(pending.payload.country)} · versão {pending.payload.version}. A referência e o conteúdo exato foram guardados para esta conta.</Text>
      <TouchableOpacity style={styles.button} disabled={!!working} onPress={() => void runDecision(pending, true)}><Text>Verificar a decisão guardada</Text></TouchableOpacity>
      <TouchableOpacity style={styles.button} disabled={!!working} onPress={() => void runDecision(pending)}><Text>Repetir a mesma decisão</Text></TouchableOpacity>
    </View>}
    {state?.states.map(item => <View key={item.purpose} style={styles.card}>
      <Text style={styles.heading}>{item.document?.title ?? item.purpose}</Text><Text style={styles.text}>Finalidade: {item.purpose} · {item.document?.required === false ? 'Opcional' : state.required_purposes.includes(item.purpose) ? 'Necessária para novos cuidados' : 'Opcional'}</Text>
      <Text style={styles.notice}>{CONSENT_STATUS[item.status]}{item.effective ? ' · vigente' : ' · sem autorização vigente'}</Text>
      {item.document && <>
        <Text style={styles.text}>Versão {item.document.version} · {countryLabel(item.document.country)} · Português</Text>
        <Text selectable style={styles.legal}>{item.document.content}</Text>
        <Text selectable style={styles.small}>Origem aprovada: {item.document.approved_source}</Text>
        {!item.effective && <><View style={styles.row}><Switch value={checked[item.document.id] === true} disabled={locked} onValueChange={value => setChecked(previous => ({ ...previous, [item.document!.id]: value }))} accessibilityLabel={`Li o texto: ${item.document.title}`} /><Text style={[styles.text, { flex: 1 }]}>Li esta versão e quero registar a minha decisão.</Text></View>
          <View style={styles.row}>{(['grant', 'refuse'] as const).map(action => <TouchableOpacity key={action} style={styles.button} disabled={locked || !checked[item.document!.id]} onPress={() => decide(item, action)}><Text>{CONSENT_ACTION[action]}</Text></TouchableOpacity>)}</View></>}
      </>}
      {item.latest_event && <Text style={styles.small}>Última decisão: {CONSENT_ACTION[item.latest_event.action]} · {new Date(item.latest_event.created_at).toLocaleString('pt-PT', { timeZone: 'UTC' })} UTC · versão {item.latest_event.version} · idioma {item.latest_event.language}</Text>}
      {item.latest_event?.action === 'grant' && <TouchableOpacity style={styles.button} disabled={locked} onPress={() => decide(item, 'withdraw')}><Text>Retirar autorização</Text></TouchableOpacity>}
    </View>)}
    <Text style={styles.heading}>Histórico pessoal</Text><Text style={styles.text}>A retirada não apaga decisões anteriores, documentos ou consultas já guardados. Pode continuar a consultar os seus registos.</Text>
    {!!historyError && <Text style={styles.error} accessibilityRole="alert">{historyError}</Text>}
    {!history.length && !historyError && !working && <Text style={styles.text}>Nenhuma decisão carregada.</Text>}
    {history.map(event => <View key={event.id} style={styles.card}><Text style={styles.heading}>{event.purpose}</Text><Text style={styles.text}>{CONSENT_ACTION[event.action]} · {countryLabel(event.country)} · idioma {event.language} · versão {event.version}</Text><Text style={styles.small}>{new Date(event.created_at).toLocaleString('pt-PT', { timeZone: 'UTC' })} UTC · sequência {event.sequence}</Text></View>)}
    {cursor && <TouchableOpacity style={styles.button} disabled={!!working || cursorExpired} onPress={() => void more()}><Text>Carregar mais decisões</Text></TouchableOpacity>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0fdfa' }, inner: { padding: 20, paddingBottom: 48 }, brand: { color: '#0d9488', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 12 }, heading: { fontSize: 17, fontWeight: '600', color: '#0f172a', marginBottom: 9 },
  text: { color: '#334155', fontSize: 14, lineHeight: 21, marginBottom: 10 }, legal: { color: '#0f172a', fontSize: 15, lineHeight: 23, paddingVertical: 16 },
  small: { color: '#475569', fontSize: 12, lineHeight: 18, marginBottom: 8 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 },
  button: { padding: 13, borderWidth: 1, borderColor: '#94a3b8', borderRadius: 9, marginBottom: 8, minHeight: 44, backgroundColor: '#fff' }, selected: { borderColor: '#0d9488', backgroundColor: '#ccfbf1' },
  card: { padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 16 }, error: { color: '#991b1b', backgroundColor: '#fee2e2', padding: 12, marginBottom: 12, lineHeight: 21 },
  notice: { color: '#115e59', backgroundColor: '#ccfbf1', padding: 10, marginBottom: 10, lineHeight: 20 },
});
