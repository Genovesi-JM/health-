/**
 * Web/PWA client safety (Phase 37).
 *
 * The web client must not leak PHI, must not present stale clinical data as live,
 * must not perform a clinical action without server authority, and must not make
 * unproven clinical claims. These are reusable predicates; a paired contract test
 * asserts the real Vite/PWA config and source keep the controls.
 *
 * The clinical runtime is held server-side (503) and the client is gated by
 * `assertOperationalAccess`; this module adds defence-in-depth on the client.
 */

/** A path that returns PHI/authnz and must never be cached by the service worker. */
export function isClinicalApiPath(path: string): boolean {
  return /(^|\/)(api|auth|admin|me)(\/|$)/.test(path);
}

/** PHI/secret must never travel in a URL (query string or fragment). */
const PHI_URL_MARKERS = [
  /[?&](token|access_token|password|email|phone|dob|mrn|ssn|bi)=/i,
  /[?&#].*(bearer|eyJ[A-Za-z0-9_\-]{6,}\.)/i,
];
export function urlCarriesSensitiveData(url: string): boolean {
  return PHI_URL_MARKERS.some((re) => re.test(url));
}

/** Storage keys allowed on the client. PHI/clinical content is never persisted. */
const DISALLOWED_STORAGE_KEY = /(patient|clinical|note|diagnos|prescription|triage|record|phi)/i;
export function storageKeyAllowed(key: string): boolean {
  return !DISALLOWED_STORAGE_KEY.test(key);
}

/**
 * A clinical action requires server authority; the client may render intent but
 * never treat a local/offline state as an authoritative clinical outcome.
 */
export function clientMayFinalizeClinicalAction(): boolean {
  return false;
}

/** Offline: clinical data is shown only with an explicit "not live" marker. */
export function offlineClinicalDisplayAllowed(hasStaleMarker: boolean): boolean {
  return hasStaleMarker;
}

/**
 * Unproven clinical/marketing claims that must not appear in patient-facing copy
 * (extends the Phase 3 copy contract). Illustrative; a named clinical owner owns
 * the full list.
 */
export const FORBIDDEN_CLAIM_PATTERNS: RegExp[] = [
  /\bdiagnos(e|is|es|ed)\b/i,
  /\bguarantee[sd]?\b/i,
  /\bcure[sd]?\b/i,
  /\bemergency (response|dispatch)\b/i,
  /\bpre-?alert\b/i,
  /\breduced? wait\b/i,
  /\b100% (safe|accurate)\b/i,
];
export function copyHasForbiddenClaim(text: string): boolean {
  return FORBIDDEN_CLAIM_PATTERNS.some((re) => re.test(text));
}
