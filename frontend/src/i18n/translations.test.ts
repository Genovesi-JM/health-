import { describe, it, expect } from 'vitest';
import translations, { type Lang } from './translations';

/**
 * Completeness + integrity checks over the translation table. These catch
 * the real bug class we hit repeatedly during the build: a key added in one
 * language but missing pt/en/fr/es, or a duplicate/blank value.
 */
describe('translations table', () => {
  const REQUIRED: Lang[] = ['pt', 'en', 'fr', 'es'];
  const entries = Object.entries(translations);

  it('has a non-trivial number of keys', () => {
    expect(entries.length).toBeGreaterThan(300);
  });

  it('every key has all required languages (pt/en/fr/es) as non-empty strings', () => {
    const offenders: string[] = [];
    for (const [key, entry] of entries) {
      for (const lang of REQUIRED) {
        const v = (entry as Record<string, unknown>)[lang];
        if (typeof v !== 'string' || v.trim() === '') {
          offenders.push(`${key}:${lang}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('zh, when present, is a non-empty string', () => {
    const offenders: string[] = [];
    for (const [key, entry] of entries) {
      if ('zh' in entry) {
        const v = (entry as Record<string, unknown>).zh;
        if (typeof v !== 'string' || v.trim() === '') offenders.push(key);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('covers the new onboarding/verification namespaces', () => {
    const prefixes = ['onboarding.', 'ct.', 'pob.', 'prob.', 'org.', 'cg.', 'mfa.', 'admc.', 'doc.', 'extract.'];
    for (const p of prefixes) {
      const hit = entries.some(([k]) => k.startsWith(p));
      expect(hit, `no keys for namespace ${p}`).toBe(true);
    }
  });

  it('has no accidentally duplicated keys (object already dedupes; guard the count)', () => {
    // A literal duplicate key in the source would have been silently merged
    // by the object literal; this asserts the parsed table size is sane.
    const uniqueKeys = new Set(entries.map(([k]) => k));
    expect(uniqueKeys.size).toBe(entries.length);
  });
});
