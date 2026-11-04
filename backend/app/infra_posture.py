"""Cloud infrastructure and secrets posture (Phase 33). Domain-pure.

The Azure foundation and secrets handling must be fail-safe: no secrets in code
or parameter files, transport encrypted, storage private, identities
least-privilege, and no credentials in outputs. This module holds reusable
posture predicates; a paired static contract test asserts the real Bicep keeps
these controls. Provisioning or changing live cloud resources is out of scope and
owner-bound.

Stdlib-only and importable without the app.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

# ── Secret handling ──────────────────────────────────────────────────────────

# Value shapes that must never be committed as literals.
_SECRET_LITERAL = [
    re.compile(r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{6,}"),  # JWT
    re.compile(r"(?i)\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{6,}"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"(?i)(password|secret|token|api[_-]?key)\s*[:=]\s*['\"][^'\"]{8,}['\"]"),
]


def contains_committed_secret(text: str) -> bool:
    """True when the text embeds a literal secret (a committed credential)."""
    return any(rx.search(text or "") for rx in _SECRET_LITERAL)


def secret_supplied_securely(param_decl: str) -> bool:
    """A sensitive parameter must be declared @secure() and never carry a default
    literal value."""
    has_secure = "@secure()" in param_decl
    has_default_literal = bool(re.search(r"=\s*['\"][^'\"]+['\"]", param_decl))
    return has_secure and not has_default_literal


# ── Endpoint / storage posture ───────────────────────────────────────────────

@dataclass(frozen=True)
class ResourcePosture:
    name: str
    https_only: Optional[bool] = None
    min_tls: Optional[str] = None
    blob_public_access: Optional[bool] = None
    public_network_access: Optional[str] = None    # "Enabled" | "Disabled" | None
    uses_managed_identity: Optional[bool] = None


def storage_posture_ok(p: ResourcePosture) -> tuple[bool, tuple]:
    reasons: list[str] = []
    if p.https_only is not True:
        reasons.append("storage must enforce HTTPS-only traffic")
    if p.min_tls not in ("TLS1_2", "TLS1_3"):
        reasons.append("storage must require TLS 1.2+")
    if p.blob_public_access is not False:
        reasons.append("blob public access must be disabled")
    return (not reasons, tuple(reasons))


def database_posture_ok(p: ResourcePosture) -> tuple[bool, tuple]:
    reasons: list[str] = []
    if p.public_network_access != "Disabled":
        reasons.append("database public network access must be Disabled")
    return (not reasons, tuple(reasons))


def identity_posture_ok(p: ResourcePosture) -> bool:
    """Application access should use a managed identity, not a static credential."""
    return p.uses_managed_identity is True


# ── Least privilege ──────────────────────────────────────────────────────────

# Broad/owner roles that an application identity must never be granted.
_FORBIDDEN_APP_ROLES = {
    "Owner", "Contributor", "User Access Administrator",
}


def app_role_is_least_privilege(role_name: str) -> bool:
    return role_name not in _FORBIDDEN_APP_ROLES


REQUIRED_INFRA_CONTROLS = (
    "sensitive params @secure() with no default literal",
    "no secrets in template outputs",
    "storage https-only + TLS1_2 + no public blob access",
    "database public network access Disabled",
    "application access via managed identity",
    "scoped (least-privilege) role assignments, never Owner/Contributor",
    "private endpoints for data services",
)

# Residual public-access resources are allowed only with a dated owner review.
INFRA_EVIDENCE_REQUIRED = (
    "public_network_access_review_signed",
    "secret_rotation_policy",
    "network_diagram_and_firewall_rules",
    "no_secret_in_state_or_outputs_proof",
)
