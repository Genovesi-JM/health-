"""Keep the runtime dependency graph identical to the graph exercised in CI."""
from pathlib import Path
import re

import pytest


BACKEND = Path(__file__).resolve().parents[1]


def _locked_versions(name):
    text = (BACKEND / name).read_text()
    requirements = re.findall(r"^([A-Za-z0-9_.-]+)==([^\s;]+) \\\n((?:    --hash=sha256:[a-f0-9]{64}(?: \\)?\n)+)", text, re.M)
    versions = {name.lower().replace("_", "-"): version for name, version, _ in requirements}
    # Every installable line must be an exact version followed by SHA256 hashes.
    installable = [line for line in text.splitlines() if line and not line.startswith(("#", " "))]
    assert len(versions) == len(installable)
    assert versions
    return versions


def test_runtime_graph_is_fully_hashed_and_matches_tested_versions():
    runtime = _locked_versions("requirements.deploy.lock")
    validation = _locked_versions("requirements.phase0.lock")
    assert {name: validation.get(name) for name in runtime} == runtime
    assert {"psycopg2-binary", "redis", "pypdf"} <= runtime.keys()
    assert not ({"python-jose", "ecdsa", "pytest"} & runtime.keys())


@pytest.mark.skipif(not (BACKEND / "Dockerfile").exists(), reason="Build definitions are excluded from the runtime image")
def test_runtime_build_uses_only_the_audited_hash_lock():
    docker = (BACKEND / "Dockerfile").read_text().split("FROM runtime AS security-test")[0]
    assert "COPY requirements.deploy.lock ./" in docker
    assert "--require-hashes -r requirements.deploy.lock" in docker
    install_commands = [line.strip() for line in docker.splitlines() if "pip install" in line]
    assert len(install_commands) == 1
    assert all("--require-hashes" in command for command in install_commands)
