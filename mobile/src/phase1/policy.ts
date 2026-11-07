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
  return state.replace(/_/g, ' ').toLowerCase();
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

// No Phase 1 client profile can authorize operations. A synthetic environment
// variable or a feature flag cannot bypass the hold or jurisdiction review.
export function assertOperationalAccess(): void {
  throw new OperationalAccessBlockedError();
}
