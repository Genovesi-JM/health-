# Phase 0 diagnostic notes

The initial full backend run and the first post-change run both failed collection because tests.test_clinician_credentials resolved incorrectly. A second disposable-copy diagnostic registered a Python tests namespace pointing to backend/tests before pytest collection. That diagnostic exceeded the 180-second bound. This harness-only experiment did not change repository test source and does not count as a full-suite pass. postchecks.json contains its timeout plus the subsequent 118 passing focused tests and the empty-triage reproduction.

The backend dependency auditor was installed in a separate Python 3.12 environment. A Python 3.8 installation attempt was stopped while building a dependency. No application environment packages were upgraded. The completed partial audit used exact installed versions for the 17 available declared direct dependencies, with --no-deps --disable-pip --format json and a 90-second timeout. It excluded four missing packages and did not resolve transitive deployment dependencies.

The new hold tests ran as PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest backend/phase0_tests -q and passed all 15 cases. git diff --check passed. preservation.json verifies all four pre-existing files and the original runtime copy.
