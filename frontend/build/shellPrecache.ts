import type { Plugin } from 'vite';

type BundleGraph = Record<string, { type: string; fileName: string; isEntry?: boolean; imports?: readonly string[] }>;
type PrecacheEntry = { url: string; revision: string | null; size: number };

/** Only static dependencies are needed to boot the shell; dynamic page imports stay on demand. */
export function shellJavaScript(bundle: BundleGraph): Set<string> {
  const files = new Set<string>();
  const visit = (name: string) => {
    const chunk = bundle[name];
    if (!chunk || chunk.type !== 'chunk' || files.has(chunk.fileName)) return;
    files.add(chunk.fileName);
    for (const dependency of chunk.imports ?? []) visit(dependency);
  };
  for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk' && chunk.isEntry) visit(chunk.fileName);
  return files;
}

export function createShellPrecache() {
  let shell = new Set<string>();
  const plugin: Plugin = {
    name: 'kaya-shell-precache',
    apply: 'build',
    generateBundle(_options, bundle) { shell = shellJavaScript(bundle); },
  };
  return {
    plugin,
    transform(manifest: PrecacheEntry[]) {
      if (shell.size === 0) throw new Error('Cannot precache without the generated application entry graph.');
      return { manifest: manifest.filter(entry => !entry.url.endsWith('.js') || shell.has(entry.url)), warnings: [] };
    },
  };
}

/** Workbox serializes this function into the worker: keep it self-contained. */
export function isOnDemandScript({ request, url, sameOrigin }: { request: { destination: string }; url: URL; sameOrigin: boolean }): boolean {
  const workerLocation = (globalThis as unknown as { location: { href: string } }).location.href;
  const assetPath = new URL('./assets/', workerLocation).pathname;
  return sameOrigin && request.destination === 'script' && url.pathname.startsWith(assetPath)
    && /^[-\w]+-[\w-]+\.js$/.test(url.pathname.slice(assetPath.length));
}
