"""Phase 7 modular-monolith boundaries. Enforced by static import scanning:
provider adapters never import transport, domain-pure modules stay importable
without the app, the held entry stays import-light, and no NEW cross-router
shortcut is introduced (legacy ones are baselined, not silently allowed).
"""
from __future__ import annotations

import re
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
ROUTERS = BACKEND / "app/routers"
SERVICES = BACKEND / "app/services"

_ROUTER_IMPORT = re.compile(r"^\s*(?:from|import)\s+app\.routers\b", re.MULTILINE)
_CROSS_ROUTER = re.compile(r"from\s+app\.routers\.([a-z_]+)\s+import", re.MULTILINE)

# Grandfathered legacy cross-router imports (importer -> imported). NEW pairs
# outside this baseline fail; the baseline may only shrink as domains extract.
_BASELINE_CROSS_ROUTER = {
    ("consultations", "notifications"),
    ("doctors", "notifications"),
    ("doctors", "auth"),
    ("mfa", "auth"),
    ("messages", "notifications"),
    ("prescription_requests", "notifications"),
    ("triage", "notifications"),
}


def test_adapters_never_import_routers():
    """Provider adapters (services) translate to providers, not transport."""
    offenders = []
    for f in SERVICES.glob("*.py"):
        if _ROUTER_IMPORT.search(f.read_text(encoding="utf-8")):
            offenders.append(f.name)
    assert not offenders, f"services must not import app.routers: {offenders}"


def test_domain_pure_modules_stay_pure():
    """Governance/perimeter policy must import no app config, DB, or routers,
    so new domain code is testable without the whole app or a provider."""
    forbidden = re.compile(r"from\s+app\.(config|database|routers)\b|import\s+app\.(config|database|routers)\b")
    for name in ("app/governance.py", "app/phase1_policy.py"):
        src = (BACKEND / name).read_text(encoding="utf-8")
        assert not forbidden.search(src), f"{name} must stay domain-pure"


def test_held_entry_is_import_light():
    """The default (held) entry must not import clinical routers at module load."""
    src = (BACKEND / "app/main.py").read_text(encoding="utf-8")
    assert not _ROUTER_IMPORT.search(src), "held main.py must not import app.routers at module level"


def test_no_new_cross_router_imports():
    found = set()
    for f in ROUTERS.glob("*.py"):
        importer = f.stem
        for imported in _CROSS_ROUTER.findall(f.read_text(encoding="utf-8")):
            if imported != importer:
                found.add((importer, imported))
    new = found - _BASELINE_CROSS_ROUTER
    assert not new, f"new cross-router shortcut(s) introduced (extract into a domain service instead): {sorted(new)}"
    # Baseline must not grow stale: every baselined pair should still exist.
    stale = _BASELINE_CROSS_ROUTER - found
    assert not stale, f"baseline lists cross-router imports that no longer exist; tighten it: {sorted(stale)}"


def test_domain_map_documented():
    doc = (BACKEND.parent / "docs/KAYA_DOMAINS.md")
    assert doc.exists()
    text = doc.read_text(encoding="utf-8")
    for domain in ("identity", "credentialing", "triage", "care-episodes", "billing", "integrations"):
        assert domain in text, f"domain map missing: {domain}"
