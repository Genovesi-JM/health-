const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('/Users/genovesimaria/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const dist = '/Users/genovesimaria/Documents/Codex/2026-09-14/l/work/phase1-clients-review/frontend/dist';
const evidence = '/Users/genovesimaria/Documents/kaya-web/docs/evidence/phase1-2026-09-14';
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname.replace(/^\/health-/, '');
  const candidate = path.resolve(dist, '.' + pathname);
  let file = candidate.startsWith(dist + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : path.join(dist, 'index.html');
  response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(response);
});

(async () => {
  let browser;
  const results = { node: process.version, browser: null, network_policy: 'Fresh context; service workers disabled. All non-loopback or xhr/fetch traffic aborted; Chromium outbound proxy points at closed loopback port.', pages: [] };
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, args: ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=127.0.0.1'] });
    results.browser = browser.version();
    for (const [label, viewport] of [['desktop', { width: 1280, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
      const requests = [], blocked = [], pageErrors = [];
      await context.route('**/*', route => {
        const request = route.request();
        const url = new URL(request.url());
        const record = { url: request.url(), type: request.resourceType() };
        requests.push(record);
        if (url.origin !== origin || ['fetch', 'xhr'].includes(request.resourceType())) {
          blocked.push(record);
          return route.abort();
        }
        return route.continue();
      });
      const page = await context.newPage();
      page.on('pageerror', error => pageErrors.push(String(error)));
      await page.goto(origin + '/health-/triage?profile=synthetic', { waitUntil: 'networkidle', timeout: 30000 });
      assert.equal(await page.getByRole('heading', { level: 1 }).innerText(), 'Kaya — pilot planning');
      assert.equal(await page.locator('tbody tr').count(), 22);
      assert.equal(await page.locator('input, form, iframe, button, a').count(), 0);
      const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewport: window.innerWidth, height: document.documentElement.scrollHeight }));
      assert.ok(dimensions.scrollWidth <= dimensions.viewport, 'Page must not overflow horizontally');
      assert.equal(blocked.length, 0, 'Informational UI must not attempt provider/API traffic');
      assert.deepEqual(pageErrors, []);
      const screenshot = path.join(evidence, 'client-' + label + '.png');
      await page.screenshot({ path: screenshot, fullPage: true });
      results.pages.push({ label, viewport, dimensions, requests, blocked, pageErrors, screenshot });
      await context.close();
    }
    fs.writeFileSync(path.join(evidence, 'client-visual.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify(results, null, 2));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
