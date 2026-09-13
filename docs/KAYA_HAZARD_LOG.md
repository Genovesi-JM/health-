# Kaya hazard log

Clinical operations remain HOLD. No hazard has clinical approval or an accepted residual-risk signature. Human owners remain unassigned. Review at the next phase and before any release decision.

| ID | Hazard and cause | Current control and evidence | Status and closure |
| --- | --- | --- | --- |
| H01 P0 | False reassurance from missing answers; score defaults to zero | evaluate_triage({}) reproduced LOW SELF_CARE in postchecks.json. Default HTTP API returns 503. | OPEN in original runtime; backend and clinical leads must prove incomplete inputs cannot produce reassurance |
| H02 P0 | A person believes a hospital has been alerted or care is faster/safer | Unsupported multilingual text remains in translations.ts; no integration approval supplied | OPEN; product and clinical owners must remove claims and inspect released clients |
| H03 High | Clinical information sent to an unapproved processor | AI and video source paths found; default HTTP entry held, no live provider used | OPEN; privacy owner must approve exact purpose/provider and require fail-closed egress tests |
| H04 High | Clinical action by a person without verified authority | Limited auth regression suite passes; no exhaustive role/tenant/credential proof | OPEN; credentialing and security owners need negative tests and human decision audit evidence |
| H05 High | Schema drift or seeded accounts create unsafe runtime state | Default hold bypasses all original startup imports; original startup preserved for isolated tests | OPEN for future runtime; database owner needs reviewed migration and restore evidence |
| H06 High | Local engineering success mistaken for deployed safety | All new evidence is local or offline; existing runtime status unknown | OPEN; operations owner must supply exact-environment evidence and independent release approval |

No clinical policy has been invented or approved by the coding agent. The hold reduces exposure in the default entry point; it does not establish treatment readiness or eliminate defects in preserved source.

Phase 0 completion: the local API and startup/deployment freeze is verified by 38 negative tests; the full original/current suite comparison has matching failures and no phase regression. H01 through H06 remain open for future clinical release, with safely held technical work allowed. Remote state is not inferred from local evidence.
