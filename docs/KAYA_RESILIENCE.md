# Kaya resilience & disaster recovery (Phase 34)

When a dependency fails, the platform degrades safely (`backend/app/resilience.py`,
domain-pure). Clinical features fail closed, retries touch only idempotent
operations, a circuit breaker sheds load, and readiness is fail-closed. DR
targets, a tested failover, and a runbook are governance the release board must
see; running a real DR drill is owner-bound.

## Invariants enforced

- **Safe degradation.** `degraded_response` returns `fail_closed` for a clinical
  feature (triage/booking/prescribing/teleconsult/notes/messaging/vitals/emergency)
  when a dependency is down — never a cached or guessed clinical answer;
  informational features return a `degraded_notice` and may continue.
- **Idempotent-only retries.** `retry_allowed` retries only idempotent operations,
  within `MAX_RETRIES`; a non-idempotent operation (charge/send/prescribe) is
  never blindly retried. `backoff_seconds` is exponential with a cap.
- **Bounded timeouts.** `timeout_ok` requires every outbound call to carry a
  bounded timeout (no unbounded waits).
- **Circuit breaker.** Opens after N consecutive failures, sheds load during
  cooldown, half-opens to probe, closes on a probe success and re-opens on a probe
  failure.
- **Fail-closed readiness.** `readiness_ok` is true only when every declared check
  passes; no checks or an unknown check is treated as not ready.
- **DR-plan governance.** `dr_plan_ok` requires named RPO/RTO, a *tested* failover,
  a runbook, and a passing backup policy.

## Tests — `backend/phase34_tests/test_resilience.py` (13, all passing)

Clinical fail-closed vs informational degrade vs healthy; idempotent-only bounded
retries; capped backoff; timeout bounds; circuit breaker open→half-open→closed
and reopen-on-probe-failure; fail-closed readiness; DR plan requires-all and
untested-failover fails.

## Human intervention / external gates (BLOCKED_EXTERNAL / owner-bound)

- **DR drill.** A named infrastructure/clinical-ops owner must run an actual
  failover drill and record RPO/RTO achieved vs target; assumed failover is not
  accepted.
- **Incident runbook** (roles, escalation, comms, clinical-safety fallback) signed
  by a named owner.
- **Topology.** Multi-zone/region design and the degradation UX for clinical
  features approved by named owners.
- **Runtime adoption verification** — a harness-verified task must confirm the held
  endpoints apply degradation, retries, timeouts, and the breaker.
- **Clinical release stays HOLD.**
