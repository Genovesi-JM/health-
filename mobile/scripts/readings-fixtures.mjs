import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as consent from '../src/screens/consents.ts';
export function readingState(country = 'AO', devices = true) {
  const purposes = [...consent.REQUIRED_CONSENT_PURPOSES, 'devices'];
  return { country, language: 'pt', available: true, revision: purposes.length, required_purposes: [...consent.REQUIRED_CONSENT_PURPOSES], states: purposes.map((purpose, index) => {
    const doc = { id: `${country}-${purpose}`, document_key: `${country}:pt:${purpose}`, purpose, version: 1, content_hash: 'a'.repeat(64), country, language: 'pt', kind: 'synthetic', required: index < 5,
      title: 'Synthetic test text', content: 'Synthetic approved fixture only.', approved_source: 'synthetic-test', effective_from: '2026-10-01T00:00:00Z', effective_to: null };
    const effective = purpose !== 'devices' || devices;
    return { purpose, status: effective ? 'granted' : 'missing', effective, document: doc,
      latest_event: effective ? { document_id: doc.id, version: 1, content_hash: doc.content_hash, country, language: 'pt', id: `event-${index}`, sequence: index + 1, purpose, action: 'grant', created_at: '2026-10-04T00:00:00Z', request_key: null } : null };
  }) };
}
const code = ts.transpileModule(readFileSync(new URL('../src/screens/readings.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
export const readingHelpers = {};
runInNewContext(code, { exports: readingHelpers, require: name => { if (name !== './consents') throw new Error(name); return consent; } });
export const scope = country => ({ country, consent_language: 'pt' });
export const connection = (ownerId = 'A', country = 'AO') => JSON.stringify({ ownerId, ...scope(country) });
