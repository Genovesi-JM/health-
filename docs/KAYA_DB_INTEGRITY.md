# Kaya database integrity, migrations & backups (Phase 32)

Governance-as-code for the data tier (`backend/app/db_integrity.py`, domain-pure)
plus static checks against real source. Provisioning real backups/replicas and
running migrations against a live database are external, owner-bound operations —
this phase makes the *rules* enforceable and inventories the debt.

## Invariants enforced (policy)

- **Migration safety.** `migration_is_safe` requires a single Alembic head, no
  execution during the launch hold, and — for a destructive migration — a
  restorable backup taken first, a reversible down-migration, and a **named human
  approver who is not the agent** (`engineering_preparer`/automation identities are
  refused).
- **Clinical delete / cascade.** `clinical_delete_allowed` never permits an
  on-demand hard delete of a clinical record; only after retention has expired and
  with a named approver. `cascade_is_acceptable` returns false for any
  `ON DELETE CASCADE` that reaches a clinical-record table.
- **Backup policy.** `backup_policy_ok` is true only when backups are encrypted at
  rest, have an offsite copy, have a **tested** restore, and RPO/RTO are set by a
  named owner. An untested restore fails.
- **Required constraints & evidence** are enumerated as data
  (`REQUIRED_CONSTRAINTS`, `DATA_TIER_EVIDENCE_REQUIRED`) for the release board.

## Static source checks

- The **held app** (`app/main.py`) contains no `create_all` and no
  `command.upgrade` — it never migrates or creates tables at startup.
- `Base.metadata.create_all` lives behind `init_db_engine()` (invoked only by the
  synthetic runtime for a disposable test DB), never at module import of the held
  app.

## Clinical cascade-delete inventory (OWNER-BOUND DEBT — not fixed here)

`backend/app/health_models.py` currently declares **`ondelete="CASCADE"`** on
**52** foreign keys. Several reach clinical-record tables — e.g.
`consultation_notes`, `prescriptions`, `referrals`, `consultation_messages`,
`device_readings`, `doctor_reviews`, `teleconsultation_*` — meaning deleting a
parent (consultation/patient) would silently hard-delete a legal clinical record.
This is tracked as debt, **not repaired here**: replacing these cascades with
soft-delete/retention and restrict/no-action FKs is an owner-approved migration
(and must satisfy `migration_is_safe`). The Phase 32 scanner test asserts this
inventory is recorded so the hazard cannot be forgotten.

## Human intervention / external gates (BLOCKED_EXTERNAL / owner-bound)

- **Backups & DR provisioning.** Encrypted, offsite, PITR-capable backups with a
  *tested* restore and named RPO/RTO targets must be provisioned and evidenced by
  a named infrastructure owner. No backup infrastructure was provisioned here.
- **Clinical cascade migration.** A named data owner must approve and run the
  migration that removes clinical cascade-deletes (backup + reversible + approval).
- **Single-head & constraint proof.** Independent verification of a single Alembic
  head and the required constraints in the live schema.
- **No live database was migrated, stamped, or repaired.** Clinical release HOLD.
