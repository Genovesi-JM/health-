# Kaya Azure pilot — verified scope

Updated 12 September 2026. These are pilot preparation changes, not a completed
clinical production migration.

## Security and storage changes

- An email address no longer grants administrator privileges.
- Protected sessions check the persisted role, MFA enrollment and verified
  second-factor claim. Mandatory MFA cannot be disabled through self-service.
- Inactive accounts cannot complete an MFA login challenge. Legacy refresh
  tokens cannot acquire MFA assurance, and OAuth paths without step-up fail
  closed for MFA-protected accounts.
- A failed consent check blocks the patient portal, supports retry, and does
  not trust a browser acceptance cache. Error text uses the existing language
  system and a wrapping layout with a 44px minimum button height.
- Health files support explicitly selected Azure Blob using managed identity,
  private containers and read-only HTTPS user-delegation download URLs. Azure
  does not silently fall back to local storage or S3. Download responses report
  their real configured expiry (default 300 seconds, maximum 900 seconds).

Secrets, customer databases, mail logs and patient uploads were not used by the
isolated tests. No existing encrypted data or storage objects were transferred.

## Evidence

- 116 isolated backend regressions passed with the actual pinned Azure SDKs
  installed in disposable test dependencies, with network/token calls mocked.
- 9 focused frontend consent/translation regressions passed, and the frontend
  TypeScript build check passed.
- Browser/mobile screenshot QA is pending: Chrome control failed during this
  session. A source layout change is not proof of mobile visual correctness.
- Container packaging and live Azure managed-identity/RBAC checks are separate
  release gates. Successful unit tests do not prove live cloud connectivity.

## Explicit remaining blockers

1. Secure MFA enrollment/bootstrap for professional/admin accounts. Public
   professional signup currently fails closed; do not re-enable unrestricted
   bootstrap tokens to make demonstrations work.
2. MFA-aware OAuth step-up, refresh families, revocation/replay protection.
3. Server-enforced versioned consent, clinical role/access review, and approval
   of clinical/triage workflows before real patient use.
4. Review both database destinations, backups, migrations and a verified restore.
   Switching the storage provider does not copy historical S3/local objects.
5. Provision and test scoped Azure permissions with synthetic files only:
   Blob Data Contributor on the health container, Blob Delegator on its account;
   anonymous access and shared-key authentication disabled. Client downloads
   need network reachability; private-endpoint-only storage requires streaming
   downloads through the backend instead of direct browser SAS redirects.
6. Existing startup uses demo seeding outside `prod`/`production`. Do not launch
   with `ENV=pilot` or `staging` until that behavior is corrected/reviewed; use
   a reviewed production-profile synthetic pilot with seeding explicitly off.

No real-data cutover, public healthcare launch, paid third-party API contract,
or replacement of the current deployment is implied by these commits.
