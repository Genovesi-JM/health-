// Run after vite build: verify the emitted graph and actual worker, not chunk-name assumptions.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const entry = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/)?.[1];
assert.ok(entry, 'The build must contain a module entry');
const assetStart = entry.indexOf('assets/');
assert.ok(assetStart >= 0);
const entryFile = entry.slice(assetStart);
const source = name => readFileSync(join(root, name), 'utf8');
const shell = new Set();
function staticGraph(name, seen = shell) {
  if (seen.has(name)) return seen;
  seen.add(name);
  const file = ts.createSourceFile(name, source(name), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  for (const statement of file.statements) {
    if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))) continue;
    const module = statement.moduleSpecifier;
    if (module && ts.isStringLiteral(module) && module.text.startsWith('.')) {
      staticGraph(posix.join(posix.dirname(name), module.text), seen);
    }
  }
  return seen;
}
staticGraph(entryFile);

let precache = [];
const routes = [];
class NetworkOnly {}
class CacheFirst { constructor(options) { this.options = options; } }
class NavigationRoute { constructor(handler, options) { this.handler = handler; this.options = options; } }
class Plugin { constructor(options) { this.options = options; } }
const location = { href: `https://kaya.example${entry.slice(0, assetStart)}sw.js` };
const workbox = { clientsClaim() {}, cleanupOutdatedCaches() {}, precacheAndRoute(entries) { precache = entries; },
  registerRoute(...args) { routes.push(args); }, NetworkOnly, CacheFirst, NavigationRoute,
  createHandlerBoundToURL: url => url, CacheableResponsePlugin: Plugin, ExpirationPlugin: Plugin };
runInNewContext(source('sw.js'), { self: { define: true, skipWaiting() {} },
  define(_dependencies, factory) { factory(workbox); }, URL, location }, { timeout: 1000 });
const cachedJS = new Set(precache.filter(item => item.url.endsWith('.js')).map(item => item.url));
assert.deepEqual([...cachedJS].sort(), [...shell].sort(), 'Only the complete static shell graph may be precached');
const files = readdirSync(join(root, 'assets')).filter(name => name.endsWith('.js'));
for (const page of ['PatientDocumentsPage', 'ConsultationsPage', 'ClinicianPatientWorkspacePage', 'TriagePage', 'LandingPage']) {
  const file = files.find(name => name.startsWith(`${page}-`));
  assert.ok(file, `${page} must have a separate route bundle`);
  assert.ok(!cachedJS.has(`assets/${file}`), `${page} must not download during service-worker installation`);
}
assert.ok(precache.some(item => item.url === 'index.html'));
assert.ok(precache.some(item => item.url.endsWith('.css')));
assert.ok(!precache.some(item => /(?:^|\/)(?:api|auth|prototype)\//.test(item.url)));

const scriptRule = routes.find(([match, handler]) => typeof match === 'function' && handler instanceof CacheFirst);
assert.ok(scriptRule, 'Page scripts need an on-use caching rule');
assert.equal(scriptRule[2], 'GET');
const scriptURL = new URL(`${entry.slice(0, assetStart)}assets/PatientDocumentsPage-abCD1234.js`, location.href);
const match = (url, destination = 'script', sameOrigin = true) => scriptRule[0]({ request: { destination }, url, sameOrigin });
assert.equal(match(scriptURL), true);
assert.equal(match(scriptURL, 'script', false), false);
assert.equal(match(scriptURL, 'document'), false);
assert.equal(match(new URL('/other-app/assets/PatientDocumentsPage-abCD1234.js', location.href)), false);
for (const path of ['/api/v1/patient-documents', '/auth/refresh', '/admin/patients', '/me', '/prototype/index.html']) {
  const url = new URL(path, location.href);
  assert.equal(match(url), false);
  const existingRule = routes.find(([pattern]) => typeof pattern?.test === 'function' && pattern.test(url.href));
  assert.ok(existingRule?.[1] instanceof NetworkOnly, `${path} must keep its network-only policy`);
}
const bytes = set => [...set].reduce((sum, name) => sum + readFileSync(join(root, name)).length, 0);
const gzip = set => [...set].reduce((sum, name) => sum + gzipSync(readFileSync(join(root, name))).length, 0);
const landing = files.find(name => name.startsWith('LandingPage-'));
const firstPublicRoute = staticGraph(`assets/${landing}`, new Set(shell));
console.log(JSON.stringify({ shell: { chunks: shell.size, bytes: bytes(shell), gzip: gzip(shell) },
  firstPublicRoute: { chunks: firstPublicRoute.size, bytes: bytes(firstPublicRoute), gzip: gzip(firstPublicRoute) },
  deferredJavaScriptChunks: files.length - shell.size, precacheEntries: precache.length }, null, 2));
console.log('Built route graph, shell precache and API/auth cache isolation passed.');
