import canonicalPolicy from '../config/kayaPolicy.json';

interface Phase1Policy {
  policy_version: number;
  planning: {
    country_code: string;
    country_name?: string;
    city: string;
    decision_status: string;
    approval_scope: string;
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

// Phase 1 cannot activate operations, including in a synthetic profile. Policy
// flags or a client environment variable are not authorization to release care.
export function assertOperationalAccess(): void {
  throw new OperationalAccessBlockedError();
}
