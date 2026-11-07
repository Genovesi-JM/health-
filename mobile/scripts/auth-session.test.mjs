import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyLoginResponse, normalizeAuth, mergeSessionIdentity, isProfessionalApplicant, isMfaSessionError } from '../src/contexts/authSession.ts';

const session = {
  access_token: 'synthetic-session', refresh_token: 'synthetic-refresh',
  user: { id: 'applicant-1', email: 'applicant@example.test', role: 'patient', full_name: 'Example Applicant' },
};

test('MFA enrollment and challenge responses never normalize into persisted sessions', () => {
  for (const payload of [
    { mfa_enrollment_required: true, enrollment_token: 'synthetic-enrollment' },
    { mfa_required: true, mfa_token: 'synthetic-challenge' },
  ]) assert.throws(() => normalizeAuth(payload), /two-step verification/);
  assert.deepEqual(classifyLoginResponse({ mfa_enrollment_required: true, enrollment_token: 'synthetic-enrollment' }), {
    kind: 'enrollment', token: 'synthetic-enrollment',
  });
  assert.deepEqual(classifyLoginResponse({ mfa_required: true, mfa_token: 'synthetic-challenge' }), {
    kind: 'challenge', token: 'synthetic-challenge',
  });
});

test('malformed or tokenless auth responses cannot create a session', () => {
  for (const payload of [undefined, null, {}, { user: session.user }, { access_token: 'token' }, { mfa_required: true }]) {
    assert.throws(() => classifyLoginResponse(payload));
  }
});

test('completed MFA response can be held for recovery-code acknowledgement before login', () => {
  const result = classifyLoginResponse(session);
  assert.equal(result.kind, 'session');
  assert.equal(result.session.access_token, 'synthetic-session');
  assert.equal(result.session.refresh_token, 'synthetic-refresh');
  assert.equal(result.session.id, 'applicant-1');
});

test('fresh identity preserves tokens and routes a canonical patient applicant to verification', () => {
  const fresh = mergeSessionIdentity(normalizeAuth(session), {
    id: 'applicant-1', email: 'applicant@example.test', role: 'patient', name: 'Server Name',
    professional_application: { profession: 'nurse', status: 'pending_review' }, patient_onboarding_complete: false,
  });
  assert.equal(fresh.access_token, 'synthetic-session');
  assert.equal(fresh.refresh_token, 'synthetic-refresh');
  assert.equal(fresh.full_name, 'Server Name');
  assert.equal(fresh.patient_onboarding_complete, false);
  assert.equal(isProfessionalApplicant(fresh), true);
  assert.equal(isProfessionalApplicant(normalizeAuth(session)), false);
});

test('verified application metadata never promotes a patient account', () => {
  const applicant = mergeSessionIdentity(normalizeAuth(session), {
    role: 'patient', professional_application: { profession: 'doctor', status: 'verified' },
  });
  assert.equal(applicant.role, 'patient');
  assert.equal(isProfessionalApplicant(applicant), true);
  assert.equal(isProfessionalApplicant({ ...applicant, role: 'doctor' }), false);
});

test('explicit MFA session errors require reauthentication but ordinary permission errors do not', () => {
  for (const status of [401, 403]) {
    for (const code of ['mfa_enrollment_required', 'mfa_verification_required', 'session_role_changed']) {
      assert.equal(isMfaSessionError({ response: { status, headers: { 'x-kaya-error-code': code } } }), true);
    }
  }
  assert.equal(isMfaSessionError({ response: { status: 403, headers: { 'x-kaya-error-code': 'permission_denied' } } }), false);
  assert.equal(isMfaSessionError({ response: { status: 500, headers: { 'x-kaya-error-code': 'mfa_enrollment_required' } } }), false);
});
