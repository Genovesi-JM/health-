import { useEffect, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import OnboardingConsentStep from './OnboardingConsentStep';
import { consentReference } from '../utils/consent';
import type { ConsentCountry } from '../utils/consent';
import { syntheticDocuments, syntheticState } from '../utils/consent.test-fixtures';
const identity = vi.hoisted(() => ({ userId: 'owner-A', token: 'token-A' }));
vi.mock('../api', () => ({ default: { get: vi.fn() }, getSession: () => ({ ...identity }) }));
let saved: Record<string, unknown> = {};
const readyRef = { current: false };
function Harness({ country = 'PT', initial = {} }: { country?: ConsentCountry; initial?: Record<string, unknown> }) {
  const [data, setData] = useState(initial); useEffect(() => { saved = data; }, [data]);
  return <MemoryRouter><OnboardingConsentStep readyRef={readyRef} ctx={{ data, stepsData: { '4': { country } }, setData,
    setField: (key, value) => setData(previous => ({ ...previous, [key]: value })), error: null }} /></MemoryRouter>;
}
function response(url: string, country: ConsentCountry, revision = 0) {
  const state = syntheticState(country, revision);
  return { data: url.endsWith('/catalog') ? { country, language: 'pt', available: true, required_purposes: state.required_purposes, unavailable_purposes: [], documents: syntheticDocuments(country) } : state };
}
beforeEach(() => {
  vi.resetAllMocks(); identity.userId = 'owner-A'; identity.token = 'token-A'; readyRef.current = false; saved = {};
  vi.mocked(api.get).mockImplementation(async (url, config) => response(url, (config?.params as { country?: string } | undefined)?.country === 'AO' ? 'AO' : 'PT'));
});
afterEach(cleanup);
it('uses the explicit profile market and persists only exact references and current revision', async () => {
  render(<Harness />);
  const inputs = await screen.findAllByRole('checkbox'); expect(inputs).toHaveLength(5); inputs.forEach(input => expect(input).not.toBeChecked());
  expect(api.get).toHaveBeenCalledWith('/api/v1/compliance/catalog', { headers: { Authorization: 'Bearer token-A' }, params: { country: 'PT', language: 'pt' } });
  for (const input of inputs) fireEvent.click(input);
  expect(saved).toEqual({ catalog_country: 'PT', catalog_language: 'pt', consent_expected_revision: 0, consent_acceptances: syntheticDocuments('PT').map(consentReference) });
  expect(readyRef.current).toBe(true);
});
it('does not interpret old booleans or stale revision as a fresh decision', async () => {
  render(<Harness initial={{ c_terms: true, c_privacy: true, catalog_country: 'PT', catalog_language: 'pt', consent_expected_revision: 9,
    consent_acceptances: syntheticDocuments('PT').map(consentReference) }} />);
  (await screen.findAllByRole('checkbox')).forEach(input => expect(input).not.toBeChecked());
});
it('keeps completion unavailable with an empty approved catalog', async () => {
  vi.mocked(api.get).mockImplementation(async url => {
    const state = syntheticState('PT'); state.available = false; state.states = state.states.map(item => ({ ...item, status: 'unavailable', document: null }));
    return { data: url.endsWith('/catalog') ? { country: 'PT', language: 'pt', available: false, required_purposes: state.required_purposes, unavailable_purposes: state.required_purposes, documents: [] } : state };
  });
  render(<Harness />); await screen.findByText(/a conclusão do perfil permanece indisponível/);
  expect(readyRef.current).toBe(false); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument(); expect(saved).toEqual({});
});
it('ignores a late catalog from a previously selected country', async () => {
  const old: Array<() => void> = [];
  vi.mocked(api.get).mockImplementation((url, config) => (config?.params as { country?: string } | undefined)?.country === 'AO'
    ? new Promise(resolve => old.push(() => resolve(response(url, 'AO')))) : Promise.resolve(response(url, 'PT')));
  const view = render(<Harness country="AO" />); await waitFor(() => expect(old).toHaveLength(2));
  view.rerender(<Harness country="PT" />); await screen.findAllByRole('checkbox');
  await act(async () => old.forEach(resolve => resolve()));
  expect(screen.getByText('País escolhido no perfil: Portugal. Documentos em Português.')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('checkbox')[0]); expect(saved.catalog_country).toBe('PT');
});
it('does not display catalog text after the account changed during its fetch', async () => {
  const pending: Array<() => void> = [];
  vi.mocked(api.get).mockImplementation(url => new Promise(resolve => pending.push(() => resolve(response(url, 'PT')))));
  render(<Harness />); await waitFor(() => expect(pending).toHaveLength(2)); identity.userId = 'owner-B'; identity.token = 'token-B';
  await act(async () => pending.forEach(resolve => resolve())); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument(); expect(readyRef.current).toBe(false);
});
