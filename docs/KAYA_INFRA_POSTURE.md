# Kaya cloud infrastructure & secrets posture (Phase 33)

The Azure foundation and secrets handling must be fail-safe. `backend/app/infra_posture.py`
(domain-pure) holds reusable posture predicates and a paired static contract test
asserts the real `infra/azure/main.bicep` keeps the required controls.
Provisioning or changing live cloud resources is out of scope and owner-bound —
this phase locks the posture in source and inventories the residual public-access
surface.

## Controls confirmed in the Bicep (static contract test)

- **No committed secret.** The template embeds no literal credential.
- **Secure admin password.** `postgresAdministratorPassword` is `@secure()` with
  no plaintext default; it is supplied securely at deploy time.
- **Storage private.** `allowBlobPublicAccess: false`, `minimumTlsVersion: TLS1_2`,
  `supportsHttpsTrafficOnly: true`.
- **Database private.** PostgreSQL `publicNetworkAccess: 'Disabled'` behind a
  private endpoint (`privateEndpointNetworkPolicies: 'Disabled'` on the subnets).
- **Managed identity.** A user-assigned managed identity is used for application
  access; role assignments are scoped (AcrPull, Key Vault Secrets User, Blob
  contributor/delegator) — no Owner/Contributor.
- **No secret outputs.** Template outputs carry only non-secret references
  (Key Vault URI, identity ids) — no passwords, keys, or credential-bearing
  connection strings.

## Policy predicates (`infra_posture.py`)

`contains_committed_secret`, `secret_supplied_securely`, `storage_posture_ok`,
`database_posture_ok`, `identity_posture_ok`, and `app_role_is_least_privilege`
(rejects Owner/Contributor/User Access Administrator). `REQUIRED_INFRA_CONTROLS`
and `INFRA_EVIDENCE_REQUIRED` enumerate what the release board must see.

## Residual public-access inventory (OWNER REVIEW — not changed here)

Three resources declare **`publicNetworkAccess: 'Enabled'`**:

| Resource | Mitigation in place | Owner action before real PHI |
| --- | --- | --- |
| Container Registry (ACR) | AcrPull via managed identity | Move to private endpoint / firewall; disable public access |
| Storage account | `allowBlobPublicAccess: false`, TLS1_2, https-only | Add private endpoint + network rules; disable public network access |
| Key Vault | Least-privilege RBAC, no runtime secrets seeded | Add private endpoint + firewall; disable public access |

These are network-reachable at the control/data-plane endpoint (objects are not
public), acceptable only for a bootstrap foundation. Closing them is an
owner-approved infrastructure change.

## Human intervention / external gates (BLOCKED_EXTERNAL / owner-bound)

- **Public-access closure & network design.** A named infrastructure owner must
  sign off moving ACR/Storage/Key Vault to private endpoints with firewall rules
  before any real PHI, and provide a network diagram.
- **Secret rotation policy** and proof that no secret appears in deployment state
  or outputs.
- **No cloud resources were provisioned, changed, or deleted.** The Bicep remains
  a foundation template (12 offline tests from Phase 0). Clinical release HOLD.
