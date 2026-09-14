// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const repo = resolve(process.cwd(), '..');

// Traverse executable imports, exports and literal import()/require() calls.
// This protects the native boundary without loading native modules on the host.
function importsReachableFrom(entry: string) {
  const files = new Set<string>();
  const packages = new Set<string>();
  function visit(path: string) {
    if (files.has(path)) return;
    files.add(path);
    if (path.endsWith('.json') || path.endsWith('.css')) return;
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true,
      path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    function add(specifier: string) {
      if (!specifier.startsWith('.')) {
        packages.add(specifier);
        return;
      }
      const base = resolve(dirname(path), specifier);
      const target = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.json`]
        .find(candidate => existsSync(candidate));
      if (!target) throw new Error(`Unresolved entrypoint dependency: ${specifier}`);
      visit(target);
    }
    function walk(node: ts.Node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier
        && ts.isStringLiteral(node.moduleSpecifier)) add(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        const argument = node.arguments[0];
        if (!argument || !ts.isStringLiteral(argument)) throw new Error('Nonliteral runtime import in informational entrypoint');
        add(argument.text);
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
  visit(resolve(repo, entry));
  return { files, packages };
}

describe('Phase 1 web and Expo entrypoints', () => {
  it.each(['frontend/src/main.tsx', 'mobile/index.js'])(
    '%s never imports legacy sessions, providers, navigation or background tasks', entry => {
      const graph = importsReachableFrom(entry);
      for (const path of graph.files) {
        expect(path).not.toMatch(/LegacyApp|AuthContext|backgroundHealthTask|HealthSyncManager|\/services\/|\/health\/|\/navigation\/|\/api\.ts$/);
      }
      const allowedPackages = new Set(['react', 'react-dom/client', 'react-native', 'expo']);
      for (const name of graph.packages) expect(allowedPackages.has(name), name).toBe(true);
    },
  );

  it('keeps the active Expo configuration free of health/background/photo activation', () => {
    const { expo } = JSON.parse(readFileSync(resolve(repo, 'mobile/app.json'), 'utf8'));
    expect(expo.ios.infoPlist?.UIBackgroundModes).toBeUndefined();
    expect(expo.android.permissions).toEqual([]);
    expect(expo.android.blockedPermissions).toContain('android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND');
    expect(expo.android.blockedPermissions).toContain('android.permission.CAMERA');
    for (const plugin of expo.plugins) {
      expect(['expo-image-picker', '@kingstinct/react-native-healthkit', 'react-native-health-connect'])
        .not.toContain(Array.isArray(plugin) ? plugin[0] : plugin);
    }
    expect(existsSync(resolve(repo, 'mobile/app.config.js'))).toBe(false);
    expect(existsSync(resolve(repo, 'mobile/app.config.ts'))).toBe(false);
    expect(readFileSync(resolve(repo, 'mobile/index.js'), 'utf8')).not.toContain('legacy-app.json');
  });

  it('keeps public HTML and PWA metadata informational without clinical shortcuts', () => {
    const manifest = JSON.parse(readFileSync(resolve(repo, 'frontend/public/manifest.webmanifest'), 'utf8'));
    expect(manifest.shortcuts ?? []).toEqual([]);
    expect(manifest.description).toContain('planning information');
    const html = readFileSync(resolve(repo, 'frontend/index.html'), 'utf8');
    expect(html).toContain('<title>KAYA — Planning information</title>');
    expect(html).not.toMatch(/Triagem, teleconsulta/);
  });
});
