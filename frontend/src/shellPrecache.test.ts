import { afterEach, expect, it, vi } from 'vitest';
import { createShellPrecache, isOnDemandScript, shellJavaScript } from '../build/shellPrecache';

afterEach(() => vi.unstubAllGlobals());
it('keeps the complete static shell graph while excluding dynamic page trees and assets', () => {
  const chunk = (fileName: string, imports: string[], isEntry = false, dynamicImports: string[] = []) => ({ type: 'chunk', fileName, imports, isEntry, dynamicImports });
  const graph = {
    'entry.js': chunk('entry.js', ['shared.js'], true, ['documents.js']),
    'shared.js': chunk('shared.js', ['framework.js']),
    'framework.js': chunk('framework.js', ['shared.js']),
    'documents.js': chunk('documents.js', ['shared.js', 'pdf.js']),
    'pdf.js': chunk('pdf.js', []),
    'style.css': { type: 'asset', fileName: 'style.css' },
  };
  expect([...shellJavaScript(graph)].sort()).toEqual(['entry.js', 'framework.js', 'shared.js']);
});
it('fails the build safely when no entry graph was supplied instead of silently making an unusable offline shell', () => {
  expect(() => createShellPrecache().transform([{ url: 'index.html', revision: 'one', size: 10 }])).toThrow(/entry graph/);
});
it.each(['/sw.js', '/health-/sw.js', '/custom/base/sw.js'])('only caches same-origin built scripts inside worker scope %s', scope => {
  vi.stubGlobal('location', { href: `https://kaya.example${scope}` });
  const assets = scope.replace(/sw\.js$/, 'assets/');
  const request = (path: string, destination = 'script', sameOrigin = true) => isOnDemandScript({ url: new URL(path, 'https://kaya.example'), request: { destination }, sameOrigin });
  expect(request(`${assets}PatientDocumentsPage-aB_123.js`)).toBe(true);
  for (const path of ['/api/v1/patient-documents', '/auth/refresh', '/admin/patients', '/me', '/prototype/assets/demo-aB_123.js', `${assets}document.pdf`, `${assets}nested/clinical-aB_123.js`, `${assets}unhashed.js`]) {
    expect(request(path)).toBe(false);
  }
  expect(request(`${assets}PatientDocumentsPage-aB_123.js`, 'fetch')).toBe(false);
  expect(request(`${assets}PatientDocumentsPage-aB_123.js`, 'script', false)).toBe(false);
});
