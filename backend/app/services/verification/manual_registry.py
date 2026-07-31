from __future__ import annotations
"""Manual registry provider — config-driven per country + profession.

Regulatory bodies like *Ordem dos Médicos de Angola* or *Consejo General de
Colegios Oficiales de Médicos* do not always expose an API. This provider
consults a small config table to figure out which authority owns the licence,
records enough context for a compliance reviewer to look it up, and returns
``MANUAL_REVIEW``. That is deliberate: the spec forbids simulating an
official API connection that does not exist.

Authorities that DO expose an API can be plugged in later by registering a
different ``RegulatoryRegistryProvider`` implementation in ``__init__.py``.
"""

from typing import Any

from .base import (
    ProviderMode,
    RegistryCheckRequest,
    VerificationResult,
    VerificationStatus,
)


# ── Configured regulatory authorities ────────────────────────────────────────
# Keyed by (country_iso2, profession). Each entry has: display name, home URL,
# public search URL (if any), and notes shown to reviewers.

REGULATORY_AUTHORITIES: dict[tuple[str, str], dict[str, str]] = {
    # ── Angola ────────────────────────────────────────────────────────────
    ("AO", "doctor"): {
        "name": "Ordem dos Médicos de Angola",
        "home_url": "https://www.ordemmedicos.ao/",
        "public_search_url": "",
        "review_notes": (
            "Confirmar via consulta directa à Ordem. Solicitar comprovativo de "
            "inscrição activa (nº, data de emissão, especialidade)."
        ),
    },
    ("AO", "nurse"): {
        "name": "Ordem dos Enfermeiros de Angola",
        "home_url": "https://www.oea.ao/",
        "public_search_url": "",
        "review_notes": (
            "Confirmar através da Ordem dos Enfermeiros ou por comprovativo de "
            "cédula profissional. Alternativa: verificação pelo Ministério da Saúde."
        ),
    },
    ("AO", "pharmacist"): {
        "name": "Ordem dos Farmacêuticos de Angola",
        "home_url": "https://www.ofa.ao/",
        "public_search_url": "",
        "review_notes": "Verificação por documento oficial ou contacto directo com a Ordem.",
    },
    # ── Spain ─────────────────────────────────────────────────────────────
    ("ES", "doctor"): {
        "name": "Consejo General de Colegios Oficiales de Médicos (CGCOM)",
        "home_url": "https://www.cgcom.es/",
        "public_search_url": "https://www.cgcom.es/servicios/vpm-verificacion",
        "review_notes": (
            "Usar la herramienta VPM (Verificación Pública del Médico) del "
            "CGCOM para confirmar la colegiación. Registrar el número de colegiado y provincia."
        ),
    },
    ("ES", "nurse"): {
        "name": "Consejo General de Enfermería",
        "home_url": "https://www.consejogeneralenfermeria.org/",
        "public_search_url": "",
        "review_notes": "Verificar mediante certificado del colegio provincial correspondiente.",
    },
    ("ES", "pharmacist"): {
        "name": "Consejo General de Colegios Farmacéuticos",
        "home_url": "https://www.portalfarma.com/",
        "public_search_url": "",
        "review_notes": "Solicitar certificado de colegiación al colegio provincial.",
    },
    # ── Portugal ──────────────────────────────────────────────────────────
    ("PT", "doctor"): {
        "name": "Ordem dos Médicos (Portugal)",
        "home_url": "https://ordemdosmedicos.pt/",
        "public_search_url": "https://ordemdosmedicos.pt/pesquisa-de-medicos/",
        "review_notes": (
            "Confirmar via pesquisa pública da Ordem dos Médicos. "
            "Registar cédula profissional e Colégio da Especialidade."
        ),
    },
    ("PT", "nurse"): {
        "name": "Ordem dos Enfermeiros (Portugal)",
        "home_url": "https://www.ordemenfermeiros.pt/",
        "public_search_url": "https://www.ordemenfermeiros.pt/pesquisa-de-enfermeiros/",
        "review_notes": "Confirmar via pesquisa pública OE. Registar cédula.",
    },
}


def lookup_authority(country: str, profession: str) -> dict[str, str] | None:
    """Return the config entry for a (country, profession) pair or None."""
    return REGULATORY_AUTHORITIES.get((country.upper(), profession.lower()))


class ManualRegistryProvider:
    """Records the registry-check context so a reviewer can complete it."""
    name = "manual_registry"
    mode = ProviderMode.LIVE  # manual review IS the live behavior, not a fallback.

    def check(self, request: RegistryCheckRequest) -> VerificationResult:
        cfg = lookup_authority(request.country, request.profession)
        if cfg is None:
            return VerificationResult(
                status=VerificationStatus.MANUAL_REVIEW,
                provider=self.name,
                mode=self.mode,
                raw={
                    "message": (
                        f"No regulatory authority configured for "
                        f"({request.country}, {request.profession}). "
                        f"A compliance reviewer must identify and confirm the "
                        f"correct authority before approval."
                    ),
                    "authority_provided_by_applicant": request.authority,
                    "licence_number": request.licence_number,
                    "config_needed": True,
                },
            )
        return VerificationResult(
            status=VerificationStatus.MANUAL_REVIEW,
            provider=self.name,
            mode=self.mode,
            raw={
                "authority": cfg["name"],
                "authority_home_url": cfg["home_url"],
                "authority_public_search_url": cfg["public_search_url"],
                "review_notes": cfg["review_notes"],
                "licence_number": request.licence_number,
                "applicant_name": request.legal_name,
            },
        )
