"""Static build-policy guard; real Docker canary exports additionally verify it."""
from pathlib import Path

import pytest

IGNORE = Path(__file__).resolve().parents[1] / ".dockerignore"
pytestmark = pytest.mark.skipif(not IGNORE.is_file(), reason="Build policy is intentionally excluded from the runtime image")


def test_docker_context_has_only_exact_file_exceptions():
    rules = [line.strip() for line in IGNORE.read_text().splitlines() if line.strip() and not line.startswith("#")]
    assert rules[0] == "**"
    for rule in rules[1:]:
        assert rule.startswith("!")
        path = rule[1:]
        assert path and not any(character in path for character in "*?[]")
        assert not path.endswith("/")
        assert ".." not in Path(path).parts
        assert (IGNORE.parent / path).is_file()


def test_runtime_sources_allowed_but_private_and_unreviewed_files_are_not():
    allowed = {line[1:].strip() for line in IGNORE.read_text().splitlines() if line.startswith("!")}
    assert {"app/main.py", "app/config.py", "app/services/health_storage.py", "alembic/env.py", "alembic.ini"} <= allowed
    forbidden = {".env", "email_log.txt", "app/private.env", "app/email_log.txt", "app/private.py", "app/schema.sql", "uploads/synthetic.pdf"}
    assert not (allowed & forbidden)
