/// <reference types="node" />
/**
 * Phase 37 web/PWA client safety: policy predicates plus a contract test that the
 * real Vite/PWA config keeps clinical API responses out of the cache and that
 * source does not put tokens/PHI in URLs.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isClinicalApiPath,
  urlCarriesSensitiveData,
  storageKeyAllowed,
  clientMayFinalizeClinicalAction,
  offlineClinicalDisplayAllowed,
  copyHasForbiddenClaim,
} from './clientSafety';

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, '..', '..');

describe('client-safety predicates', () => {
  it('flags clinical API paths', () => {
    expect(isClinicalApiPath('/api/v1/consultations')).toBe(true);
    expect(isClinicalApiPath('/auth/login')).toBe(true);
    expect(isClinicalApiPath('/assets/logo.svg')).toBe(false);
  });

  it('rejects sensitive data in URLs', () => {
    expect(urlCarriesSensitiveData('/reset?token=abc123')).toBe(true);
    expect(urlCarriesSensitiveData('/p?email=a@b.com')).toBe(true);
    expect(urlCarriesSensitiveData('/agenda?day=2026-09-14')).toBe(false);
  });

  it('disallows PHI/clinical storage keys', () => {
    expect(storageKeyAllowed('ht_token')).toBe(true);
    expect(storageKeyAllowed('lang')).toBe(true);
    expect(storageKeyAllowed('patient_record_cache')).toBe(false);
    expect(storageKeyAllowed('triage_answers')).toBe(false);
  });

  it('never finalizes a clinical action on the client', () => {
    expect(clientMayFinalizeClinicalAction()).toBe(false);
  });

  it('shows offline clinical data only with a stale marker', () => {
    expect(offlineClinicalDisplayAllowed(true)).toBe(true);
    expect(offlineClinicalDisplayAllowed(false)).toBe(false);
  });

  it('flags forbidden clinical/marketing claims', () => {
    expect(copyHasForbiddenClaim('We diagnose your condition')).toBe(true);
    expect(copyHasForbiddenClaim('guaranteed reduced wait')).toBe(true);
    expect(copyHasForbiddenClaim('Book a consultation with a doctor')).toBe(false);
  });
});

describe('PWA config contract (real vite.config.ts)', () => {
  const cfg = readFileSync(resolve(frontendRoot, 'vite.config.ts'), 'utf-8');

  it('routes API/auth through NetworkOnly (no clinical response cached)', () => {
    expect(cfg).toMatch(/NetworkOnly/);
    expect(cfg).toMatch(/\(api\|auth\|admin\|me\)/);
  });

  it('excludes api/auth from precache and navigation fallback', () => {
    expect(cfg).toMatch(/globIgnores/);
    expect(cfg).toContain('**/api/**');
    expect(cfg).toMatch(/navigateFallbackDenylist/);
  });
});

describe('source hygiene', () => {
  it('api client does not attach clinical data to URL query strings', () => {
    const api = readFileSync(resolve(frontendRoot, 'src', 'api.ts'), 'utf-8');
    // tokens are sent via the Authorization header, never as a query param
    expect(api).toMatch(/Authorization/);
    expect(api).not.toMatch(/\?token=/);
    expect(api).not.toMatch(/&token=/);
  });
});
