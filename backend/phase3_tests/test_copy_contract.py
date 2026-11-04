"""Phase 3 copy contract: no reachable surface may claim or imply hospital
notification, pre-arrival preparation, reduced waiting, priority access,
dispatch, ambulance/ETA, or guaranteed safety/availability. Kaya has no such
integration; the claims are forbidden in every locale.

This scans the repository's user-facing text sources directly (no browser
needed) so a forbidden claim cannot silently survive in one language.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]

# User-facing text sources to scan (source of truth for all locales).
SCAN_FILES = [
    REPO / "frontend/src/i18n/translations.ts",
]

# Forbidden claim phrases (case-insensitive), across pt/en/fr/es. These assert
# a capability Kaya does not have. Factual, non-promissory emergency guidance is
# allowed; these specific promises are not.
FORBIDDEN = [
    # hospital pre-alert / notification / preparation
    r"pr[ée]-?alert",
    r"pr[ée]alert",
    r"pre-?alert",
    r"pre-?avis(o|ado)",            # pre-aviso / pre-avisado (ES/PT pre-alert)
    r"pr[ée]-?avis(o)?\s+de\s+urg",
    r"hospital j[áa] sabe",
    r"hospital already knows",
    r"h[ôo]pital est d[ée]j[àa] pr[ée]venu",
    r"hospital ya lo sabe",
    r"hospital (prepara|prepares|preparado|ready to receive|se prepara|prêt à vous recevoir)",
    r"prepares? for your arrival",
    r"prepara-se para a sua chegada",
    r"notifi(ca|es|e) o hospital",
    r"notifies the .*hospital",
    # reduced waiting as a promise
    r"menos (espera|tempo de espera)",
    r"less waiting",
    r"moins d[’']attente",
    r"menos tiempo de espera",
    r"reduc(e|ed|ir).{0,12}(wait|espera|attente)",
    # improved / greater safety as a promise
    r"mais seguran[çc]a",
    r"more safety",
    r"greater .*safety",
    r"m[áa]s segur(a|idad)",
    r"plus de s[ée]curit[ée]",
    r"processo mais r[áa]pido e seguro",
    r"faster,? safer",
    # priority access / queue
    r"acesso priorit[áa]rio",
    r"priority access",
    r"fila priorit[áa]ria",
    r"priority queue",
    r"acc[èe]s prioritaire",
    r"file prioritaire",
    # dispatch / ambulance / ETA
    r"\bdispatch",
    r"\bambul[âa]nc",
    r"\bambulanc",
    r"\bETA\b",
    r"heure d[’']arriv[ée]e estim",
    r"hora estimada de llegada",
    r"ETA estimado",
    # guaranteed clinical availability / SLA
    r"dispon[íi]vel em minutos",
    r"available in minutes",
    r"disponible en (quelques )?minutes?",
    r"disponible en minutos",
    r"SLA[^.]{0,30}garant",
    r"guaranteed[^.]{0,30}SLA",
    r"guaranteed medical",
]

_COMPILED = [(p, re.compile(p, re.IGNORECASE)) for p in FORBIDDEN]


def _iter_lines():
    for path in SCAN_FILES:
        assert path.exists(), f"Scan target missing: {path}"
        for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            yield path, i, line


def test_no_forbidden_emergency_or_outcome_claims():
    hits = []
    for path, lineno, line in _iter_lines():
        for pattern, rx in _COMPILED:
            if rx.search(line):
                hits.append(f"{path.name}:{lineno}: /{pattern}/ :: {line.strip()[:120]}")
    assert not hits, "Forbidden emergency/outcome claims found:\n" + "\n".join(hits)


def test_no_hardcoded_emergency_number():
    """Unknown jurisdiction must not guess an emergency number; no hardcoded
    112/911/999 dial instruction may live in shared copy."""
    hits = []
    dial = re.compile(r"(ligue|ligar|call|appelez|appeler|llama|llame|marque|disque)\D{0,8}\b(112|911|999|000)\b", re.IGNORECASE)
    for path, lineno, line in _iter_lines():
        if dial.search(line):
            hits.append(f"{path.name}:{lineno}: {line.strip()[:120]}")
    assert not hits, "Hardcoded emergency-number dial instruction found:\n" + "\n".join(hits)


# Component/page tree scan — narrow patterns to avoid code false positives
# (e.g. the lucide `Ambulance` icon import or `borderRadius: 999`).
_COMPONENT_ROOT = REPO / "frontend/src"
_COMPONENT_FORBIDDEN = [
    re.compile(r"pr[ée]-?alert", re.IGNORECASE),
    re.compile(r"pr[ée]-?alertad", re.IGNORECASE),
    re.compile(r"pre-?avis[oa]\s+hospital", re.IGNORECASE),
    re.compile(r"hospital\s+pr[ée]", re.IGNORECASE),
    re.compile(r"acesso priorit[áa]rio", re.IGNORECASE),
    re.compile(r"priority access", re.IGNORECASE),
    re.compile(r"menos (espera|tempo de espera)", re.IGNORECASE),
    re.compile(r">\s*(112|911|999)\s*<"),          # emergency number as JSX text
    re.compile(r"tel:\s*(112|911|999)"),
    re.compile(r"(call|ligue|ligar)\D{0,10}(112|911|999)", re.IGNORECASE),
]


def test_no_forbidden_claims_in_components():
    hits = []
    for path in _COMPONENT_ROOT.rglob("*.tsx"):
        if path.name.endswith(".test.tsx") or "translations" in path.name:
            continue
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            for rx in _COMPONENT_FORBIDDEN:
                if rx.search(line):
                    hits.append(f"{path.relative_to(REPO)}:{lineno}: {line.strip()[:110]}")
    assert not hits, "Forbidden claim/number in component source:\n" + "\n".join(hits)
