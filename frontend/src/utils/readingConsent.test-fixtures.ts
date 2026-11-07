import { syntheticDocuments, syntheticEvent, syntheticState } from './consent.test-fixtures';
import type { ConsentCountry } from './consent';

export function readingsConsentState(country: ConsentCountry = 'AO', device = true) {
  const state = syntheticState(country, 10);
  if (device) state.states.push({ purpose: 'devices', status: 'missing', effective: false, latest_event: null,
    document: { ...syntheticDocuments(country)[0], id: `${country}-devices`, document_key: `${country}:pt:devices`, purpose: 'devices', kind: 'optional', required: false } });
  state.states = state.states.map((item, index) => ({ ...item, status: 'granted', effective: true, latest_event: syntheticEvent(undefined, {
    sequence: index + 1, country, purpose: item.purpose, document_id: item.document!.id, content_hash: item.document!.content_hash,
  }) }));
  return state;
}
