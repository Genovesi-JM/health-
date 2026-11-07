import type { User } from './types';

/** Application progress never grants a clinical role; the server controls roles. */
export function isProfessionalApplicant(user: User): boolean {
  return ['patient', 'cliente'].includes(user.role) && Boolean(user.professional_application);
}

export function isPatientAccount(user: User): boolean {
  return ['patient', 'cliente'].includes(user.role) && !isProfessionalApplicant(user);
}

export function requiredAccountPath(user: User): string | null {
  if (isProfessionalApplicant(user)) return '/professional-verification';
  if (isPatientAccount(user) && user.patient_onboarding_complete === false) return '/onboarding/patient';
  return null;
}

export function defaultAccountPath(user: User): string {
  const required = requiredAccountPath(user);
  if (required) return required;
  if (user.role === 'doctor') return '/doctor/dashboard';
  if (user.role === 'nurse') return '/nurse';
  if (user.role === 'admin') return '/admin';
  if (user.role === 'corporate_admin') return '/corporate';
  return '/dashboard';
}

export function accountPathAfterLogin(user: User, requested?: string): string {
  const required = requiredAccountPath(user);
  if (required) return required;
  // Only accept local router destinations, never an external or auth loop URL.
  if (requested?.startsWith('/') && !requested.startsWith('//')
    && !['/login', '/register', '/auth/callback'].includes(requested.split('?')[0])) return requested;
  return defaultAccountPath(user);
}

export function requiredPathRedirect(user: User, pathname: string): string | null {
  const required = requiredAccountPath(user);
  if (!required || pathname === required) return null;
  if (['/settings', '/security', '/security/mfa', '/consents', '/consent-gate', '/data-consent'].includes(pathname)) return null;
  if (isProfessionalApplicant(user) && pathname === '/onboarding/professional') return null;
  return required;
}
