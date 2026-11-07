import { describe, expect, it } from 'vitest';
import { accountPathAfterLogin, defaultAccountPath, isPatientAccount, requiredPathRedirect } from './authRouting';
import { requiresReauthentication } from './api';
import type { User } from './types';

const patient: User = { id: 'patient-1', email: 'patient@example.test', role: 'patient', is_active: true, patient_onboarding_complete: false };
const applicant: User = { ...patient, professional_application: { profession: 'doctor', status: 'pending_review' } };

describe('server account state determines the entry flow', () => {
  it('keeps a professional applicant out of the patient onboarding and patient consent flow', () => {
    expect(defaultAccountPath(applicant)).toBe('/professional-verification');
    expect(isPatientAccount(applicant)).toBe(false);
    expect(accountPathAfterLogin(applicant, '/doctor/dashboard')).toBe('/professional-verification');
    expect(requiredPathRedirect(applicant, '/dashboard')).toBe('/professional-verification');
    expect(requiredPathRedirect(applicant, '/professional-verification')).toBeNull();
  });

  it('requires new patient onboarding even when login has a saved booking destination', () => {
    expect(accountPathAfterLogin(patient, '/consultations')).toBe('/onboarding/patient');
    expect(requiredPathRedirect(patient, '/consent-gate')).toBeNull();
    expect(requiredPathRedirect(patient, '/consents')).toBeNull();
    expect(requiredPathRedirect(patient, '/onboarding/patient')).toBeNull();
  });

  it('restores local destinations for a patient whose onboarding is complete', () => {
    const complete = { ...patient, patient_onboarding_complete: true };
    expect(accountPathAfterLogin(complete, '/consultations')).toBe('/consultations');
    expect(accountPathAfterLogin(complete, '//example.test')).toBe('/dashboard');
    expect(accountPathAfterLogin(complete, '/login')).toBe('/dashboard');
  });

  it('does not grant a clinical role from verified application metadata', () => {
    expect(defaultAccountPath({ ...applicant, professional_application: { profession: 'doctor', status: 'verified' } })).toBe('/professional-verification');
    expect(defaultAccountPath({ ...applicant, role: 'doctor' })).toBe('/doctor/dashboard');
    expect(defaultAccountPath({ ...applicant, role: 'nurse' })).toBe('/nurse');
  });
});

describe('MFA session renewal', () => {
  it('requests a new login for server-confirmed enrollment or verification requirements', () => {
    expect(requiresReauthentication(403, 'mfa_enrollment_required', '/auth/me')).toBe(true);
    expect(requiresReauthentication(403, 'mfa_verification_required', '/api/v1/credentials/me')).toBe(true);
    expect(requiresReauthentication(401, undefined, '/auth/me')).toBe(true);
  });

  it('does not treat other permission failures or invalid passwords as an MFA login', () => {
    expect(requiresReauthentication(403, undefined, '/api/v1/credentials/me')).toBe(false);
    expect(requiresReauthentication(403, 'permission_denied', '/auth/me')).toBe(false);
    expect(requiresReauthentication(401, undefined, '/auth/login')).toBe(false);
  });
});
