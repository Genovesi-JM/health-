/** Built UI smoke with synthetic HTTP replies; no backend or provider integration.
 * Requires PLAYWRIGHT_MODULE (absolute module path) and CHROME_EXECUTABLE.
 * A fresh browser context intercepts every API request and denies external traffic.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(repo, 'frontend/dist');
const output = process.env.KAYA_BROWSER_EVIDENCE;
if (!output || !process.env.PLAYWRIGHT_MODULE || !process.env.CHROME_EXECUTABLE) {
  throw new Error('Set KAYA_BROWSER_EVIDENCE, PLAYWRIGHT_MODULE and CHROME_EXECUTABLE explicitly.');
}
await mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/health-\//, '');
    const target = resolve(dist, pathname.replace(/^\//, ''));
    if (target !== dist && !target.startsWith(dist + '/')) throw new Error('Invalid path');
    const file = extname(target) ? target : resolve(dist, 'index.html');
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(yes => server.listen(0, '127.0.0.1', yes));
const origin = `http://127.0.0.1:${server.address().port}`;
const purposes = ['privacy_policy', 'telemedicine_consent', 'terms_of_service', 'health_data_processing', 'medical_disclaimer'];
const user = { id: 'synthetic-browser-owner', email: 'synthetic@example.invalid', role: 'patient', is_active: true, name: 'Synthetic Browser Patient', patient_onboarding_complete: true };
const results = [];
const pageErrors = [];
const denied = [];
const blockedExternal = [];
const apiCalls = [];
let mode = 'empty';
let events = [];
let lostConsentResponse = true;
let paymentKey = null;
let paymentPosts = 0;
let consultationReads = 0;
let readingPosts = 0;
let importPosts = 0;
const readings = [{ id: 'synthetic-old-reading', reading_type: 'weight', value: 70, unit: 'kg',
  measured_at: '2026-10-01T10:00:00Z', source: 'manual', notes: 'Medição sintética anterior', country: null, consent_language: null }];
const documents = country => [...purposes, ...(mode.startsWith('readings') ? ['devices'] : [])].map(purpose => {
  const content = `SYNTHETIC BROWSER TEST ONLY: ${country} ${purpose}. <img src=x onerror=alert(1)>`;
  return { id: `${country}-${purpose}`, document_key: `${country}:pt:${purpose}`, version: 1,
    content_hash: createHash('sha256').update(content).digest('hex'), country, language: 'pt', purpose,
    kind: purpose === 'devices' ? 'optional' : 'clinical_informed_consent', required: purpose !== 'devices', title: `Synthetic ${purpose}`, content,
    approved_source: 'synthetic-fixture://browser-only', effective_from: '2026-01-01T00:00:00+00:00', effective_to: null };
});
function state(country) {
  const available = mode !== 'empty';
  return { country, language: 'pt', available, revision: events.length, required_purposes: purposes,
    states: documents(country).map(document => {
      const event = events.findLast(item => item.country === country && item.purpose === document.purpose) || null;
      const effective = available && event?.action === 'grant';
      return { purpose: document.purpose, status: !available ? 'unavailable' : !event ? 'missing' : effective ? 'granted' : 'withdrawn',
        effective: !!effective, document: available ? document : null, latest_event: event };
    }) };
}
function grantSynthetic(country, purpose) {
  const document = documents(country).find(item => item.purpose === purpose);
  events.push({ id: randomUUID(), request_key: randomUUID(), sequence: events.length + 1, purpose,
    document_id: document.id, version: document.version, content_hash: document.content_hash,
    country, language: 'pt', action: 'grant', created_at: new Date().toISOString() });
}
const receipt = event => ({ event, revision: events.length, state: state(event.country) });
const consultation = () => ({ id: 'synthetic-visit', patient_id: 'synthetic-patient', specialty: 'clinica_geral', status: mode === 'closed-payment' ? 'cancelled' : 'scheduled',
  country: mode === 'portugal-payment' ? 'PT' : 'AO', scheduled_at: '2099-10-04T12:00:00+00:00', timezone: 'Africa/Luanda', created_at: '2026-10-04T12:00:00+00:00', payment_status: 'unpaid' });
const paymentReceipt = () => ({ payment_id: 'synthetic-payment', request_key: paymentKey, provider: 'multicaixa_express', status: 'paid', dispatch_state: 'response_recorded',
  financial_review_status: 'required', financial_review_reason: 'care_no_longer_payable', consultation_paid: false, amount: 12345, currency: 'AOA', provider_reference: 'SYNTHETIC-REFERENCE' });
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', locale: 'pt-PT' });
  await context.addInitScript(user => {
    if (!localStorage.getItem('ht_token')) {
      localStorage.setItem('ht_token', 'synthetic-browser-token');
      localStorage.setItem('ht_user_id', user.id); localStorage.setItem('ht_role', user.role);
      localStorage.setItem('ht_email', user.email); localStorage.setItem('ht_user', JSON.stringify(user));
    }
  }, user);
  await context.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    const api = /^\/(api|auth)\//.test(path);
    const respond = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'cache-control': 'private, no-store' }, body: JSON.stringify(data) });
    if (api) {
      apiCalls.push({ method: request.method(), path, query: url.search });
      if (request.method() === 'OPTIONS') return respond({});
      if (path === '/auth/me') return respond(user);
      if (path === '/api/v1/notifications/unread-count') return respond({ unread: 0 });
      if (path === '/api/v1/compliance/consent-state') return respond(state(url.searchParams.get('country')));
      if (path === '/api/v1/compliance/catalog') {
        const country = url.searchParams.get('country');
        return respond({ country, language: 'pt', available: mode !== 'empty', required_purposes: purposes,
          unavailable_purposes: mode === 'empty' ? purposes : [], documents: mode === 'empty' ? [] : documents(country) });
      }
      if (path === '/api/v1/compliance/consent-history/page') return respond({ items: [...events].reverse(), next_cursor: null });
      if (path.startsWith('/api/v1/compliance/consent-requests/')) {
        const event = events.find(item => item.request_key === path.split('/').at(-1));
        return event ? respond(receipt(event)) : respond({ detail: { code: 'consent_request_not_found', request_in_flight_may_commit: true } }, 404);
      }
      if (path === '/api/v1/compliance/consent' && request.method() === 'POST') {
        const body = request.postDataJSON(); const key = request.headers()['idempotency-key'];
        const old = events.find(item => item.request_key === key);
        if (old) return respond(receipt(old));
        assert.equal(body.expected_revision, events.length);
        const document = documents(body.country).find(item => item.id === body.document_id);
        for (const field of ['version', 'content_hash', 'country', 'language']) assert.equal(body[field], document[field]);
        const event = { ...body, id: randomUUID(), sequence: events.length + 1, purpose: document.purpose, created_at: new Date().toISOString(), request_key: key };
        events.push(event);
        if (lostConsentResponse) { lostConsentResponse = false; return route.abort('failed'); }
        return respond(receipt(event));
      }
      if (path === '/api/v1/readings/me') return respond({ total: readings.length, readings });
      if (path === '/api/v1/readings' && request.method() === 'POST') {
        ++readingPosts;
        const body = request.postDataJSON();
        assert.equal(body.country, 'PT'); assert.equal(body.consent_language, 'pt'); assert.equal(body.source, 'manual');
        const row = { ...body, id: randomUUID() }; readings.push(row); return respond(row, 201);
      }
      if (path === '/api/v1/readings/import') {
        ++importPosts;
        assert.match(request.postData(), /name="country"\r\n\r\nPT/);
        assert.match(request.postData(), /name="consent_language"\r\n\r\npt/);
        return respond({ imported: 0, skipped: 0, errors: ['Linha 2: measurement date is required'], source: 'renpho_csv' });
      }
      if (path === '/api/v1/consultations/me/page') { ++consultationReads; return respond({ items: [consultation()], next_cursor: null }); }
      if (path === '/api/v1/dashboard/patient-state') return respond({ current_state: 'triage_completed', last_triage_risk: 'LOW' });
      if (path === '/api/v1/billing/payment-methods') return respond({ methods: [{ id: 'multicaixa_express', label: 'Multicaixa Express', description: 'Synthetic only', enabled: true }] });
      if (path.endsWith('/payment-status')) return paymentKey ? respond(paymentReceipt()) : respond({ detail: 'Synthetic absent receipt' }, 404);
      if (path === '/api/v1/billing/consultation/checkout') {
        ++paymentPosts; paymentKey = request.headers()['idempotency-key'];
        assert.equal(request.postDataJSON().consultation_id, 'synthetic-visit');
        return route.abort('failed');
      }
      denied.push({ method: request.method(), path }); return respond({ detail: 'Unmocked API denied by synthetic harness' }, 503);
    }
    if (url.origin === origin) return route.continue();
    blockedExternal.push({ origin: url.origin, path }); return route.abort('blockedbyclient');
  });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on('pageerror', error => pageErrors.push(String(error)));
  const visit = path => page.goto(origin + '/health-' + path);
  const visible = text => page.getByText(text).first().waitFor({ state: 'visible' });
  const stored = prefix => page.evaluate(prefix => Object.keys(localStorage).filter(key => key.startsWith(prefix)).map(key => JSON.parse(localStorage.getItem(key))), prefix);

  await visit('/consents'); await visible('Ainda não há um conjunto completo de documentos aprovados');
  assert.equal(await page.getByRole('button', { name: /^Aceitar/ }).count(), 0);
  await Promise.all([page.waitForResponse(response => response.url().includes('consent-state') && response.url().includes('country=PT')), page.getByLabel('País dos documentos').selectOption('PT')]);
  await visible('Ainda não há um conjunto completo de documentos aprovados');
  results.push('Both empty market catalogs block fresh consent without invented texts.');

  mode = 'consent'; await visit('/consents');
  await page.getByText('Ler documento aprovado', { exact: true }).first().click();
  await visible('SYNTHETIC BROWSER TEST ONLY: AO privacy_policy. <img src=x onerror=alert(1)>');
  assert.equal(await page.locator('img[src="x"]').count(), 0);
  await page.getByRole('checkbox', { name: 'Li a versão 1 de Synthetic privacy_policy.' }).check();
  await page.getByRole('button', { name: 'Aceitar — Synthetic privacy_policy', exact: true }).click();
  await visible('O resultado ainda não foi confirmado.');
  const pending = await stored('kaya_pending_consent:'); assert.equal(pending.length, 1);
  await page.reload(); await page.getByRole('button', { name: 'Verificar decisão guardada', exact: true }).click();
  await visible('Decisão registada.'); assert.equal(events.length, 1); assert.equal((await stored('kaya_pending_consent:')).length, 0);
  results.push('Literal approved text and exact consent UUID survive a lost response and browser reload without a duplicate grant.');

  await page.getByRole('button', { name: 'Retirar — Synthetic privacy_policy', exact: true }).click();
  await visible('Finalidade: privacy_policy · Retirado');
  assert.equal(events.length, 2); assert.equal(events[1].action, 'withdraw');
  await page.getByRole('button', { name: 'Atualizar histórico', exact: true }).click();
  await page.getByRole('link', { name: 'Consultar o meu histórico', exact: true }).click();
  await page.getByRole('button', { name: 'Pagar', exact: true }).waitFor();
  assert.ok(page.url().endsWith('/consultations'));
  results.push('Withdrawal preserves accessible consultation history and append-only decision history.');

  mode = 'payment'; await page.getByRole('button', { name: 'Pagar', exact: true }).click();
  await page.getByRole('button', { name: /Multicaixa Express/ }).click();
  await visible('Não inicie outro pagamento');
  const savedPayment = await stored('kaya_pending_payment:'); assert.equal(savedPayment.length, 1); assert.equal(savedPayment[0].key, paymentKey);
  mode = 'closed-payment'; await page.reload();
  await page.getByRole('button', { name: 'Verificar pagamento', exact: true }).waitFor(); const beforeReads = consultationReads;
  await page.getByRole('button', { name: 'Verificar pagamento', exact: true }).click();
  await visible('Pagamento em revisão financeira');
  assert.equal(await page.getByText('Pagamento confirmado', { exact: true }).count(), 0);
  assert.equal(paymentPosts, 1); assert.equal(consultationReads, beforeReads);
  assert.equal((await stored('kaya_pending_payment:'))[0].key, paymentKey);
  await page.screenshot({ path: resolve(output, 'payment-review-desktop.png'), fullPage: true, animations: 'disabled' });
  results.push('A lost checkout response remains recoverable on cancelled history; a paid receipt under financial review never marks care paid.');

  paymentKey = null; mode = 'portugal-payment';
  await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('kaya_pending_payment:')).forEach(key => localStorage.removeItem(key)));
  await page.reload(); await page.getByRole('button', { name: 'Pagar', exact: true }).click();
  await visible('Pagamentos em Portugal indisponíveis');
  assert.equal(await page.getByRole('button', { name: /Multicaixa Express/ }).isDisabled(), true); assert.equal(paymentPosts, 1);
  results.push('Portugal checkout remains disabled even if a synthetic provider advertises availability.');

  mode = 'consent'; await page.setViewportSize({ width: 390, height: 844 }); await visit('/consents');
  await visible('Finalidade: privacy_policy · Retirado');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await page.screenshot({ path: resolve(output, 'consent-mobile-viewport.png'), fullPage: true, animations: 'disabled' });
  results.push('Consent and withdrawal history render at a 390px viewport without horizontal page overflow.');
  mode = 'readings';
  for (const country of ['AO', 'PT']) for (const purpose of purposes) grantSynthetic(country, purpose);
  await visit('/patient/readings'); await visible('Medição sintética anterior');
  await page.getByLabel('País das novas medições').selectOption('PT');
  await page.getByRole('button', { name: 'Nova Medição', exact: true }).click();
  await page.getByLabel('Tipo de Medição *', { exact: true }).selectOption('weight');
  await page.getByLabel('Valor *', { exact: true }).fill('71');
  await page.getByRole('button', { name: 'Guardar Medição', exact: true }).click();
  await visible('71 kg'); assert.equal(readingPosts, 1);
  results.push('Manual measurements carry the chosen Portugal scope and need no optional device grant; legacy history stays visible.');

  await page.getByLabel('Ficheiro CSV', { exact: true }).setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Weight\n,70') });
  await page.getByRole('button', { name: 'Importar ficheiro selecionado', exact: true }).click();
  await visible('Reveja os consentimentos deste país, incluindo a decisão separada para dispositivos');
  assert.equal(importPosts, 0); await visible('Ficheiro selecionado: synthetic.csv');
  grantSynthetic('PT', 'devices');
  await page.getByRole('button', { name: 'Importar ficheiro selecionado', exact: true }).click();
  await visible('Linha 2: measurement date is required'); assert.equal(importPosts, 1);
  await visible('Ficheiro selecionado: synthetic.csv');
  results.push('CSV acquisition requires the optional device grant; an invalid-row reply stays visible and retains the selected file.');

  events.push({ ...events.findLast(item => item.country === 'PT' && item.purpose === 'privacy_policy'), id: randomUUID(), request_key: randomUUID(), sequence: events.length + 1, action: 'withdraw' });
  await page.getByRole('button', { name: 'Nova Medição', exact: true }).click();
  await page.getByLabel('Tipo de Medição *', { exact: true }).selectOption('weight');
  await page.getByLabel('Valor *', { exact: true }).fill('72');
  await page.getByRole('button', { name: 'Guardar Medição', exact: true }).click();
  await visible('Reveja os consentimentos deste país antes de guardar novas medições. O histórico continua disponível.');
  assert.equal(readingPosts, 1); await visible('Medição sintética anterior');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await page.screenshot({ path: resolve(output, 'readings-mobile-viewport.png'), fullPage: true, animations: 'disabled' });
  results.push('Withdrawal blocks fresh measurements while retained history remains accessible at a 390px viewport.');
  assert.deepEqual(pageErrors, []); assert.deepEqual(denied, []);
  await writeFile(resolve(output, 'browser-ui-smoke.json'), JSON.stringify({ kind: 'synthetic-built-ui-only', browser: browser.version(),
    tests: results.length, results, pageErrors, denied, blockedExternal, apiCalls, source: 'Built frontend/dist, all API replies synthetic; external traffic denied; no live provider or backend tested.' }, null, 2));
  console.log(JSON.stringify({ passed: results.length, browser: browser.version(), evidence: output }));
} catch (error) {
  await writeFile(resolve(output, 'browser-failure.json'), JSON.stringify({ error: String(error), results, pageErrors, denied, apiCalls }, null, 2));
  throw error;
} finally {
  await browser?.close(); await new Promise(yes => server.close(yes));
}
