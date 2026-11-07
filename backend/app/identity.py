"""Canonical account and identity model (Phase 12). Domain-pure and importable
without the app or a provider.

One immutable subject identity is kept distinct from profile, requested persona,
organization membership, platform role, clinical profession, credential status,
and granted clinical privilege. **Public registration can only ever create a
non-privileged user.** A privileged role (clinician, reviewer, admin, support)
requires controlled provisioning — MFA, verified credentials, and explicit
organization privileges — and can never be self-assigned through registration, a
profile field, onboarding, or a legacy endpoint.
"""
from __future__ import annotations

# Roles a public registrant may hold on the created account.
PUBLIC_SELF_ROLES = frozenset({"patient", "cliente"})

# Roles that carry clinical or administrative authority — never self-assignable.
PRIVILEGED_ROLES = frozenset({
    "doctor", "nurse", "pharmacist", "corporate_admin",
    "compliance_reviewer", "reviewer", "support", "admin",
})


class SelfPromotionError(ValueError):
    """Raised when a caller attempts to self-assign a privileged role."""


def normalize_role(requested: object) -> str:
    r = str(requested or "patient").strip().lower()
    return "patient" if r == "cliente" else r


def is_privileged_role(role: object) -> bool:
    return normalize_role(role) in PRIVILEGED_ROLES


def canonical_account_role(requested: object) -> str:
    """The role a public registration may grant the created User. Always
    non-privileged: a privileged request yields ``patient`` (the person may still
    file an application dossier, which grants no authority until verified)."""
    r = normalize_role(requested)
    return r if r in PUBLIC_SELF_ROLES else "patient"


def assert_not_self_privileged(requested: object) -> None:
    """Fail closed if a privileged role is requested for direct self-assignment."""
    if is_privileged_role(requested):
        raise SelfPromotionError(
            "A privileged role cannot be self-assigned; it requires controlled "
            "provisioning with MFA and verified credentials."
        )


# Identifiers that must NEVER become authorization authority on their own.
NON_AUTHORITY_IDENTIFIERS = frozenset({
    "email", "phone", "provider_id", "oauth_id", "licence_number",
    "license_number", "full_name", "slug",
})


def is_authorization_authority(field: str) -> bool:
    """A mutable profile/provider field is never authorization authority; only
    the granted platform role + verified privilege is."""
    return field not in NON_AUTHORITY_IDENTIFIERS and field in {"role", "granted_privilege"}


# Documented effects of account disablement/deletion (data, not behavior).
ACCOUNT_LIFECYCLE_EFFECTS = {
    "disable": ["revoke active sessions", "block login", "retain records under legal hold"],
    "delete": ["end sessions", "end memberships", "suspend credentials",
               "retain legally-required records under legal hold", "audit the deletion"],
    "merge": ["human review required", "no silent identity merge", "audited"],
}
