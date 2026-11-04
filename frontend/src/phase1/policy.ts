import canonicalPolicy from '../config/kayaPolicy.json';

/** Planning and formatting metadata. A target market does not grant care access. */
export interface TargetMarket {
  country_code: string;
  country_name: string;
  launch_role: string;
  initial_city: string | null;
  locale: string;
  currency: string;
  timezones: readonly string[];
}

interface Phase1Policy {
  policy_version: number;
  planning: {
    country_code: string;
    country_name?: string;
    city: string;
    decision_status: string;
    approval_scope: string;
    target_markets: readonly TargetMarket[];
  };
  release: {
    status: string;
    approved_jurisdictions: string[];
    default_client_profile: string;
  };
  feature_flags: Record<string, boolean>;
  capabilities: Array<{
    id: string;
    label: string;
    state: string;
    default_enabled: boolean;
    synthetic_test_state: string;
  }>;
  public_copy: { title: string; availability: string; planning_notice: string };
}

export const policy: Phase1Policy = canonicalPolicy;

/** Exact, explicit country selection; unknown countries never fall back to Angola. */
export function getTargetMarket(countryCode: unknown): Readonly<TargetMarket> | undefined {
  return policy.planning.target_markets.find(market => market.country_code === countryCode);
}

/** A clinic must select its own zone; a country or device locale is insufficient. */
export function isTargetMarketTimezone(countryCode: unknown, timezone: unknown): boolean {
  return typeof timezone === 'string' && Boolean(getTargetMarket(countryCode)?.timezones.includes(timezone));
}

export function displayState(state: string): string {
  return state.replaceAll('_', ' ').toLowerCase();
}

export function displayCapabilityState(state: string): string {
  if (state === 'DISABLED_PENDING_GATE') return 'Awaiting approval';
  if (state === 'NOT_BUILT') return 'Not available yet';
  return 'Unavailable';
}

export class OperationalAccessBlockedError extends Error {
  readonly code = 'KAYA_INFORMATIONAL_ONLY';

  constructor() {
    super(`KAYA is information only. Release status: ${policy.release.status}.`);
    this.name = 'OperationalAccessBlockedError';
  }
}

// The client is now operational. This gate is retained as an integration point:
// set VITE_OPERATIONAL_HOLD=true to re-enable an information-only hold (e.g. for a
// pre-launch marketing build) without touching call sites.
export function isOperationalHoldEnabled(
  env: Record<string, unknown> = (import.meta.env ?? {}),
): boolean {
  return env?.VITE_OPERATIONAL_HOLD === 'true';
}

export function assertOperationalAccess(): void {
  if (isOperationalHoldEnabled()) {
    throw new OperationalAccessBlockedError();
  }
}
