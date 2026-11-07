# Kaya: foundation only, Spain pilot

This resource-group-scoped template prepares isolated, empty Azure resources.
It creates **no application, ingress, migration job, schema, patient record,
demo seed or third-party API subscription**. Successful compilation is not a
cloud deployment or a completed migration. No live provisioning was performed
as part of this infrastructure change.

Use the existing `rg-kaya-pilot-weu` resource group. Its West Europe metadata
does not select the region of new resources; the template explicitly uses
`spaincentral`. Do not recreate, move, rename or change the group location.
The release owner must check subscription eligibility and a resource-group
preview before authorizing provisioning.

## Bounded resources and cost controls

- One PostgreSQL 16 `Standard_B1ms` Burstable server: 32 GB P4, 7-day backups,
  no HA or geo-backup, automatic storage growth disabled. Two empty logical
  databases share this server; there is no second database server charge.
- Private delegated PostgreSQL subnet, TLS required, public database access
  disabled, private DNS linked only to Kaya's VNet. No public firewall rule.
- Kaya VNet `10.42.0.0/21`; ACA subnet `10.42.0.0/23`; PostgreSQL
  `10.42.2.0/28`. Review overlap before future peering. GeoVision's reviewed
  `10.40.0.0/21` is distinct; this is not proof against every other network.
- One empty VNet-integrated Container Apps Consumption environment, no
  dedicated workload profile and no runtime. `internal=false` reserves an
  external-capable environment; it does not create a public app/clinical API.
- Own ACR Basic (admin credentials and anonymous pulls disabled), own managed
  identity, own empty RBAC Key Vault (soft delete and purge protection enabled).
- Own Standard LRS Blob account, TLS/HTTPS only, shared-key authorization and
  anonymous Blob access disabled. `health-private` has `publicAccess=None`.
- Log Analytics quota 0.1 GB/day, retention 30 days. A quota is not an exact
  invoice cap: delayed enforcement, backups, storage, egress and infrastructure
  can still cost money. Fixed storage requires alerts/manual capacity review.

These choices minimize baseline resources toward the shared EUR100–250/month
three-project pilot envelope; they do **not** guarantee a total or replace the
current regional price estimate and subscription budget alerts. No App
Configuration, Service Bus, Redis server, paid verification or AI service is
created. Database/registry and any platform networking baseline costs accrue
even before an application is launched. Purge protection is intentionally not
reversible during its retention window.

## Exact source-derived configuration

| Setting | Empty Azure destination | Source evidence |
| --- | --- | --- |
| `DATABASE_URL` | `kaya` | `backend/app/config.py` `database_url`; `backend/app/database.py` `Base`/engine; default local filename `health_platform.db` |
| `ACCOUNTS_DATABASE_URL` | `kaya_accounts` | `backend/app/config.py` `accounts_database_url`; `backend/app/accounts/database.py` separate `AccountsBase`/engine; default local filename `accounts.db` |

The separate account models are `CustomerAccount`/`Employee` in
`backend/app/accounts/models.py`. Their customer/employee routers are currently
disabled in `backend/app/main.py`. The separate `routers/accounts.py` namespace
uses main-database account models; do not conflate the two stores or merge them.
Reserving both empty destinations does not enable disabled routers or migrate
either SQLite database. No existing database was opened to prepare this plan.

No secrets are installed by this foundation. Before a runtime, securely create
restricted application DB roles, then write each URL to its own Key Vault
secret (`database-url`, `accounts-database-url`) using TLS, URL-encoded
credentials and `postgresql+psycopg2://.../kaya?sslmode=require` (or the accounts
database name). Do not deploy the
API with PostgreSQL administrator credentials. Keep administrative recovery
credentials in the operator's approved secret store, not app-readable secrets.
Preserve existing application encryption keys for any later approved migration;
new random keys would not decrypt historical records.

Future storage settings from `backend/app/services/health_storage.py` and config:

```text
HEALTH_STORAGE_PROVIDER=azure_blob
AZURE_STORAGE_ACCOUNT_NAME=<storageAccountName output>
AZURE_STORAGE_CONTAINER=health-private
AZURE_STORAGE_MANAGED_IDENTITY_CLIENT_ID=<identityClientId output>
AZURE_STORAGE_SIGNED_URL_SECONDS=300
```

Only four application-identity grants are created: `AcrPull` on own registry,
`Key Vault Secrets User` on own vault, `Storage Blob Data Contributor` on the
single health container, `Storage Blob Delegator` on its owning account.
There are no subscription/group-wide or cross-project grants. This identity
is not yet attached to a runtime, and live RBAC has not been tested.

Blob, Key Vault and ACR use **authenticated public network endpoints**, not
private endpoints. Blob privacy here means no anonymous access; user-delegation
SAS is a short-lived bearer credential and must never be logged. Azure shared-key
and service/account SAS are disabled; user-delegation SAS remains supported.
The current download interface needs browser access to Blob. A future
private-endpoint-only design needs a reviewed backend streaming proxy/network
plan first. Do not claim all resources are network-private.

## Offline preparation and controlled handoff

```sh
python3 infra/azure/parameters.py
/Users/genovesimaria/.azure/bin/bicep build infra/azure/main.bicep --stdout
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s infra/azure/tests -v
```

The helper prints only nonsecret parameters. The required secure
`postgresAdministratorPassword` has no default and is intentionally omitted.
The release owner must supply it through a reviewed secure in-memory deployment
path or approved Key Vault reference, never a checked-in file, CLI argument,
shell history, chat or deployment output. Save recovery credentials safely
before provisioning; this template does not persist them in the empty vault.
Verify selected account/subscription and existing group read-only first. Review
the exact preview for these resources, identities, costs and deletions; do not
run group creation or automatic runtime/startup commands as part of foundation.

## Gates before any runtime or patient use

1. Verify live private DNS/TLS, managed identity and container-scoped access
   using disposable synthetic files only; anonymous/shared-key attempts must
   fail. Review logs for signed URLs, credentials and health data leakage.
2. Independently review migration ownership for both DBs, portable migrations,
   least-privilege roles, backup monitoring and a successful isolated restore.
   Existing startup performs schema work and the Docker command runs Alembic;
   neither was executed against Azure by this task.
3. Use `ENV=production`, `SEED_DEMO_DATA=false` for a reviewed synthetic pilot.
   Existing `main.py` seeds when environment is not exactly prod/production,
   regardless of a false seed flag. Do not use `ENV=pilot` or `staging` yet.
4. Supply stable signing/encryption keys securely; enforce MFA/bootstrap,
   server-side consent and clinical role checks. See `docs/AZURE_PILOT_STATUS.md`.
5. Keep Angola demonstrations synthetic only until health-data governance,
   cross-border processing, clinical safety and professional verification have
   been reviewed. An EU server alone does not establish legal/clinical readiness.
   No real patient data, uploads, billing, messages or verification providers
   should be connected merely because the foundation exists.
