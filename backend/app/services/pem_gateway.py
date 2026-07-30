"""Portugal PEM/BDNP integration boundary.

KAYA may prepare and audit an electronic-prescription payload, but it must not
claim legal submission until the deployment has SPMS conformity, organisation
credentials, prescriber authentication and the certified gateway connection.
"""
from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class PEMConfiguration:
    base_url: str
    client_id: str
    organisation_id: str
    client_certificate_path: str

    @property
    def configured(self) -> bool:
        return all((
            self.base_url,
            self.client_id,
            self.organisation_id,
            self.client_certificate_path,
        ))


def configuration() -> PEMConfiguration:
    return PEMConfiguration(
        base_url=os.getenv("PEM_API_BASE_URL", "").strip(),
        client_id=os.getenv("PEM_CLIENT_ID", "").strip(),
        organisation_id=os.getenv("PEM_ORGANISATION_ID", "").strip(),
        client_certificate_path=os.getenv("PEM_CLIENT_CERT_PATH", "").strip(),
    )


def public_status() -> dict[str, Any]:
    config = configuration()
    return {
        "provider": "SPMS",
        "network": "PEM_BDNP",
        "jurisdiction": "PT",
        "configured": config.configured,
        "mode": "certified_gateway" if config.configured else "preparation_only",
        "requirements": {
            "spms_conformity": True,
            "prescriber_strong_authentication": True,
            "central_bdnp_registration": True,
            "organisation_credentials": bool(config.organisation_id and config.client_id),
            "client_certificate": bool(config.client_certificate_path),
            "endpoint": bool(config.base_url),
        },
        "message": (
            "Gateway configurado; a submissão deve ainda ser validada no ambiente "
            "certificado SPMS."
            if config.configured else
            "Preparação e auditoria disponíveis. Faltam credenciais/certificado "
            "SPMS para uma submissão legal à PEM/BDNP."
        ),
    }


def prepare_payload(*, prescription_id: str, patient_id: str, doctor_id: str) -> tuple[dict[str, Any], str]:
    """Build the non-PII envelope used to bind a local record to PEM submission."""
    payload = {
        "schema": "kaya.pem.preparation.v1",
        "jurisdiction": "PT",
        "network": "PEM_BDNP",
        "local_prescription_id": prescription_id,
        "local_patient_id": patient_id,
        "local_prescriber_id": doctor_id,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return payload, hashlib.sha256(canonical).hexdigest()

