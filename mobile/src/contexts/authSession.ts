export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  access_token: string;
  refresh_token?: string;
  professional_application?: { profession: 'doctor' | 'nurse'; status: string } | null;
  patient_onboarding_complete?: boolean;
}

type AuthData = Record<string, any>;

export type LoginResult =
  | { kind: 'enrollment'; token: string }
  | { kind: 'challenge'; token: string }
  | { kind: 'session'; session: AuthUser };

export function normalizeAuth(data: AuthData): AuthUser {
  if (!data || typeof data !== 'object') throw new Error('The sign-in response is incomplete. Please try again.');
  if (data.mfa_required || data.mfa_enrollment_required) throw new Error('Complete two-step verification before signing in.');
  const source = data.user ?? data;
  const token = data.access_token ?? source.access_token;
  if (typeof token !== 'string' || !token || !source.id || !source.email || !source.role) {
    throw new Error('The sign-in response is incomplete. Please try again.');
  }
  return {
    id: String(source.id),
    email: source.email,
    full_name: source.full_name ?? source.name ?? '',
    role: source.role,
    access_token: token,
    refresh_token: data.refresh_token ?? source.refresh_token,
    professional_application: source.professional_application ?? null,
    patient_onboarding_complete: source.patient_onboarding_complete,
  };
}

export function classifyLoginResponse(data: AuthData): LoginResult {
  if (!data || typeof data !== 'object') throw new Error('The sign-in response is incomplete. Please try again.');
  if (data.mfa_enrollment_required === true && typeof data.enrollment_token === 'string' && data.enrollment_token) {
    return { kind: 'enrollment', token: data.enrollment_token };
  }
  if (data.mfa_required === true && typeof data.mfa_token === 'string' && data.mfa_token) {
    return { kind: 'challenge', token: data.mfa_token };
  }
  return { kind: 'session', session: normalizeAuth(data) };
}

export function mergeSessionIdentity(session: AuthUser, me: AuthData): AuthUser {
  return normalizeAuth({
    ...session,
    ...me,
    id: me.id || me.user_id || session.id,
    full_name: me.full_name ?? me.name ?? session.full_name,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    professional_application: me.professional_application ?? null,
  });
}

export function isProfessionalApplicant(user: AuthUser): boolean {
  return ['patient', 'cliente'].includes(user.role) && Boolean(user.professional_application);
}

export function isMfaSessionError(error: { response?: { status?: number; headers?: Record<string, unknown> } }): boolean {
  const response = error.response;
  return [401, 403].includes(response?.status ?? 0)
    && ['mfa_enrollment_required', 'mfa_verification_required', 'session_role_changed'].includes(String(response?.headers?.['x-kaya-error-code']));
}
