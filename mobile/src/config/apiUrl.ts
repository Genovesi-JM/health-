/** Resolve the API endpoint without silently shipping a development address. */
export function resolveApiBaseUrl(
  canonical: string | undefined,
  legacy: string | undefined,
  development: boolean,
): string {
  const configured = canonical?.trim() || legacy?.trim();
  if (!configured && !development) {
    throw new Error('Configure EXPO_PUBLIC_API_URL before building Kaya for distribution.');
  }
  let url: URL;
  try {
    url = new URL(configured || 'http://localhost:8000');
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL must be an absolute HTTP or HTTPS URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('EXPO_PUBLIC_API_URL must be HTTP(S) without credentials, query parameters or a fragment.');
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  // WHATWG URL serializes dotted IPv4 inside IPv6 as hexadecimal groups.
  const ipv6Local = ['[::]', '[::1]', '[::ffff:0:0]'].includes(host)
    || /^\[::(?:ffff:)?7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/.test(host);
  const local = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
    || ipv6Local || host === '0.0.0.0' || host.startsWith('127.')
    || host === '10.0.2.2' || host === '10.0.3.2';
  if (!development && (url.protocol !== 'https:' || local)) {
    throw new Error('Distributed Kaya builds require an HTTPS API endpoint outside localhost or an emulator.');
  }
  return url.href.replace(/\/+$/, '');
}
