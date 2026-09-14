import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import App from './App';
import { displayCapabilityState, policy } from './phase1/policy';

vi.mock('./LegacyApp', () => { throw new Error('Legacy app must not be imported'); });
vi.mock('./AuthContext', () => { throw new Error('Authentication must not be imported'); });
vi.mock('./api', () => { throw new Error('API client must not be imported'); });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('Phase 1 informational boundary', () => {
  it.each(['/', '/login', '/auth/callback?token=synthetic', '/triage', '/doctor/dashboard', '/preview/nurse', '/pricing', '/unlisted-path'])(
    'keeps %s informational without session access or network calls', path => {
      window.history.replaceState({}, '', path);
      const readStorage = vi.spyOn(Storage.prototype, 'getItem');
      const writeStorage = vi.spyOn(Storage.prototype, 'setItem');
      const request = vi.fn(() => { throw new Error('Network prohibited'); });
      vi.stubGlobal('fetch', request);
      const xhr = vi.spyOn(XMLHttpRequest.prototype, 'open');
      const openWindow = vi.spyOn(window, 'open');

      const { container } = render(<App />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(policy.public_copy.title);
      expect(screen.getByText(policy.public_copy.availability)).toBeInTheDocument();
      expect(screen.getByText('Unverified')).toBeInTheDocument();
      expect(container.querySelectorAll('input, textarea, select, form, iframe, a, button')).toHaveLength(0);
      expect(readStorage).not.toHaveBeenCalled();
      expect(writeStorage).not.toHaveBeenCalled();
      expect(request).not.toHaveBeenCalled();
      expect(xhr).not.toHaveBeenCalled();
      expect(openWindow).not.toHaveBeenCalled();
    },
  );

  it('renders the canonical planning scope and every capability state without enabling an action', () => {
    render(<App />);
    expect(screen.getByText(`${policy.planning.city}, ${policy.planning.country_name}`)).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(policy.capabilities.length + 1);
    for (const capability of policy.capabilities) {
      const row = screen.getByRole('rowheader', { name: capability.label }).closest('tr')!;
      expect(within(row).getByText(displayCapabilityState(capability.state))).toBeInTheDocument();
      expect(within(row).getByText('Unavailable in this version')).toBeInTheDocument();
    }
  });

  it('does not interpret a synthetic profile or a feature flag as release authorization', () => {
    vi.stubEnv('VITE_KAYA_CLIENT_PROFILE', 'synthetic');
    vi.stubEnv('VITE_KAYA_EXECUTION_MODE', 'synthetic');
    const saved = policy.feature_flags.triage;
    policy.feature_flags.triage = true;
    try {
      const { container } = render(<App />);
      expect(screen.getByText('Information only')).toBeInTheDocument();
      expect(container.querySelectorAll('input, form, button, a')).toHaveLength(0);
    } finally {
      policy.feature_flags.triage = saved;
    }
  });
});
