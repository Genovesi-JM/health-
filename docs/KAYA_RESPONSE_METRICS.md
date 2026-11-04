# KAYA Response — metrics & zero-boundary-event gate (Phase R12)

PHI-free operational metrics with a hard gate: any boundary event trips it
(`backend/app/response_metrics.py`, domain-pure).

## Invariants enforced

- **Zero-boundary gate.** `zero_boundary_gate` holds only when there are zero
  boundary events AND zero failed escalations in the window; `gate_tripped` is true
  on any of either (R15 zero-tolerance).
- **Rates.** `ack_rate` / `resolution_rate` return None on no incidents (no
  division-by-zero, no false 100%).
- **Comprehension (R16).** `comprehension_ready` is fail-closed: an adequate sample
  (≥ 10), an aggregate pass rate ≥ 0.90, and no individual admitted after a failed
  critical check.
- **PHI-free.** `metrics_are_phi_free` rejects any per-person identifier in the
  metric fields.

## Tests — `backend/phaseR12_tests/test_response_metrics.py` (8, all passing)

Rates (None on zero); zero-boundary gate holds when clean; any boundary/failed
escalation trips the gate; comprehension ready; below-target blocks; small sample
blocks; failed-critical blocks admission; PHI-free metrics.

## Human intervention / external gates (owner-bound)

- **Comprehension study (R16).** A named language/accessibility + clinical owner
  must run a consented human study (≥ 10 people) meeting the aggregate target with
  no individual admitted after a failed critical check.
- **Live-window zero-boundary evidence** reviewed by a named owner before and
  during any activation.
- **Clinical release stays HOLD; Response stays DISABLED.**
