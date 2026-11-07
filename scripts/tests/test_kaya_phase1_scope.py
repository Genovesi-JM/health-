"""Offline synthetic boundary tests; no application/provider imports."""
import copy
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from kaya_phase1_scope import evaluate_draft_metrics, validate_policy

POLICY = json.loads((Path(__file__).resolve().parents[2] / "policy/kaya_phase1_policy.json").read_text())


def scenario():
    # Fabricated aggregate records for rule tests, not a real evaluation result.
    return {m["id"]: {"value": m["threshold"], "sample_size": 10,
                       "evidence_kind": "consented_human_evaluation", "individual_failure_count": 0}
            for m in POLICY["pilot"]["metrics"]}


class DraftScopeTests(unittest.TestCase):
    def test_valid_synthetic_scenario_cannot_release(self):
        result = evaluate_draft_metrics(POLICY, scenario())
        self.assertEqual(result["assessment"], "WITHIN_DRAFT_LIMITS")
        self.assertEqual(result["release_status"], "HOLD")
        self.assertIn("REJECT_NEW_REQUESTS", result["actions"])

    def test_each_zero_tolerance_event_holds(self):
        for metric in POLICY["pilot"]["metrics"]:
            if metric["kind"] == "count" and metric["threshold"] == 0:
                with self.subTest(metric=metric["id"]):
                    obs = scenario()
                    obs[metric["id"]]["value"] = 1
                    self.assertIn("HOLD", evaluate_draft_metrics(POLICY, obs)["actions"])

    def test_capacity_staffing_and_support_breaches(self):
        for key, value, action in [("staffed_coverage_ratio", 0.99, "CLOSE_BOOKING_WINDOW"),
                                    ("pending_request_count", 6, "PAUSE_ADMISSION"),
                                    ("support_unacknowledged_staffed_minutes", 31, "PAUSE_ADMISSION"),
                                    ("booking_completion_ratio", 0.89, "PAUSE_ADMISSION")]:
            with self.subTest(metric=key):
                obs = scenario()
                obs[key]["value"] = value
                self.assertIn(action, evaluate_draft_metrics(POLICY, obs)["actions"])

    def test_missing_unknown_and_malformed_observations_block(self):
        for obs in [{}, None, {**scenario(), "unknown": {"value": 0}}]:
            self.assertEqual(evaluate_draft_metrics(POLICY, obs)["assessment"], "INDETERMINATE")
        for value in [None, True, "0", -1, float("nan"), float("inf"), 0.5]:
            with self.subTest(value=value):
                obs = scenario()
                obs["safety_boundary_violation_count"]["value"] = value
                self.assertIn("BLOCK", evaluate_draft_metrics(POLICY, obs)["actions"])

    def test_rates_require_valid_denominator_and_sample(self):
        for sample in [None, 0, 9, True, 10.5]:
            obs = scenario()
            obs["booking_completion_ratio"]["sample_size"] = sample
            self.assertIn("BLOCK", evaluate_draft_metrics(POLICY, obs)["actions"])
        obs = scenario()
        obs["booking_completion_ratio"]["value"] = 1.01
        self.assertIn("BLOCK", evaluate_draft_metrics(POLICY, obs)["actions"])

    def test_synthetic_respondents_cannot_establish_comprehension(self):
        obs = scenario()
        obs["critical_boundary_comprehension_ratio"]["evidence_kind"] = "synthetic"
        self.assertIn("BLOCK", evaluate_draft_metrics(POLICY, obs)["actions"])

    def test_individual_comprehension_failure_overrides_aggregate(self):
        obs = scenario()
        obs["critical_boundary_comprehension_ratio"].update(value=1.0, individual_failure_count=1)
        self.assertIn("HOLD", evaluate_draft_metrics(POLICY, obs)["actions"])

    def test_events_never_auto_resume(self):
        for event in [*POLICY["pilot"]["immediate_hold_events"], "unknown_event"]:
            self.assertIn("HOLD", evaluate_draft_metrics(POLICY, scenario(), [event])["actions"])
        self.assertEqual(evaluate_draft_metrics(POLICY, scenario())["release_status"], "HOLD")

    def test_false_like_values_flags_and_duplicate_ids_rejected(self):
        for value in [True, "false", 0, None]:
            policy = copy.deepcopy(POLICY)
            policy["feature_flags"]["triage"] = value
            with self.assertRaises(ValueError):
                validate_policy(policy)
        policy = copy.deepcopy(POLICY)
        policy["capabilities"].append(policy["capabilities"][0])
        with self.assertRaises(ValueError):
            validate_policy(policy)

    def test_planning_selection_never_grants_clinical_approval(self):
        validate_policy(POLICY)
        for country in [None, "", "ES", "AO ", 1]:
            policy = copy.deepcopy(POLICY)
            policy["planning"]["country_code"] = country
            with self.assertRaises(ValueError):
                validate_policy(policy)
        for state in ["PILOT", "LIVE", "UNKNOWN"]:
            policy = copy.deepcopy(POLICY)
            policy["capabilities"][0]["state"] = state
            with self.assertRaises(ValueError):
                validate_policy(policy)

    def test_target_markets_cannot_change_release_or_primary_pilot(self):
        markets = POLICY["planning"]["target_markets"]
        self.assertEqual([market["country_code"] for market in markets], ["AO", "PT"])
        self.assertEqual([market["launch_role"] for market in markets], ["primary", "preparation"])
        self.assertIsNone(markets[1]["initial_city"])
        self.assertEqual(POLICY["pilot"]["country_code"], "AO")
        for jurisdictions in [["AO"], ["PT"], ["AO", "PT"]]:
            policy = copy.deepcopy(POLICY)
            policy["release"]["approved_jurisdictions"] = jurisdictions
            with self.assertRaises(ValueError):
                validate_policy(policy)

    def test_market_configuration_cannot_be_ambiguous_or_silently_fallback(self):
        for value in [None, {}, [], [POLICY["planning"]["target_markets"][0]]]:
            policy = copy.deepcopy(POLICY)
            policy["planning"]["target_markets"] = value
            with self.assertRaises(ValueError):
                validate_policy(policy)
        for index, field, value in [
            (0, "country_code", "PT"), (0, "currency", "EUR"), (0, "locale", "pt-PT"),
            (0, "timezones", ["Europe/Lisbon"]), (1, "launch_role", "primary"),
            (1, "initial_city", "Lisbon"), (1, "currency", "AOA"),
            (1, "timezones", ["Europe/Lisbon"]),
        ]:
            with self.subTest(index=index, field=field):
                policy = copy.deepcopy(POLICY)
                policy["planning"]["target_markets"][index][field] = value
                with self.assertRaises(ValueError):
                    validate_policy(policy)

    def test_nullable_market_city_must_be_explicit(self):
        policy = copy.deepcopy(POLICY)
        self.assertIsNone(policy["planning"]["target_markets"][1]["initial_city"])
        validate_policy(policy)
        del policy["planning"]["target_markets"][1]["initial_city"]
        with self.assertRaises(ValueError):
            validate_policy(policy)

    def test_weakened_stop_rules_are_rejected(self):
        mutations = [
            ("safety_boundary_violation_count", "operator", "min"),
            ("failed_escalation_count", "threshold", 1),
            ("critical_boundary_comprehension_ratio", "required_evidence_kind", None),
            ("critical_boundary_comprehension_ratio", "minimum_sample", 0),
            ("critical_boundary_comprehension_ratio", "individual_failure_blocks_admission", False),
            ("pending_request_count", "threshold", 100),
        ]
        for identifier, key, value in mutations:
            with self.subTest(metric=identifier, field=key):
                policy = copy.deepcopy(POLICY)
                next(m for m in policy["pilot"]["metrics"] if m["id"] == identifier)[key] = value
                with self.assertRaises(ValueError):
                    validate_policy(policy)

    def test_missing_owners_and_unapproved_staffing_cannot_pass(self):
        for key, value in [("owners", []), ("duration_days", 365), ("capacity", {})]:
            policy = copy.deepcopy(POLICY)
            policy["pilot"][key] = value
            with self.assertRaises(ValueError):
                validate_policy(policy)
        policy = copy.deepcopy(POLICY)
        policy["pilot"]["schedule"]["staffing_requirements"]["approval_status"] = "APPROVED"
        with self.assertRaises(ValueError):
            validate_policy(policy)


if __name__ == "__main__":
    unittest.main()
