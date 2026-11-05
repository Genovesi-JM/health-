"""Operational factory for isolated synthetic checks.

The Azure production/default image still starts app.main:app (clinical HOLD).
Managed-schema sessions neither create tables nor seed demo users at startup.
"""
from __future__ import annotations

import os
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db_engine
from .middleware import (
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
    HTTPSRedirectMiddleware,
)

# Core routers
from .routers import auth, admin, me, mfa

# Health platform routers
from .routers import (
    patients,
    patient_documents,
    doctors,
    triage,
    consultations,
    appointments,
    prescriptions,
    prescription_requests,
    messages,
    nurse,
    shop_devices,
    doctor_portal,
    corporate,
    health_billing,
    compliance,
    health_dashboard,
    chatbot,
    readings,
    medications,
    family,
    notifications,
    credentials,
    clinician_workspace,
    clinical_operations,
    teleconsultation,
    onboarding,
    compliance_review,
    verification_actions,
    verification_webhooks,
    organisations,
    caregiver,
    public_contact,
    public_facilities,
)

from .seed_data import seed_all

_ALL_ROUTERS = [
    auth, mfa, admin, me,
    patients, patient_documents, doctors, triage, consultations, appointments, prescriptions, prescription_requests,
    messages, nurse, shop_devices, doctor_portal, corporate, health_billing,
    compliance, health_dashboard, chatbot, readings, medications, family,
    notifications, credentials, clinician_workspace, clinical_operations,
    teleconsultation, onboarding, compliance_review, verification_actions,
    verification_webhooks, organisations, caregiver, public_contact,
    public_facilities,
]


def _cors_origins() -> list[str]:
    default_origins = {
        "http://127.0.0.1:8001",
        "http://localhost:8001",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://genovesi-jm.github.io",
    }
    try:
        parsed = urlparse(settings.frontend_base)
        if parsed.scheme and parsed.netloc:
            default_origins.add(f"{parsed.scheme}://{parsed.netloc}")
    except Exception:
        pass
    env_origins = os.getenv("CORS_ORIGINS", "")
    if env_origins.strip():
        return [o.strip() for o in env_origins.split(",") if o.strip()]
    return sorted(default_origins)


def create_app() -> FastAPI:
    """Build and configure the operational FastAPI instance."""
    application = FastAPI(
        title=settings.app_name,
        description="KAYA — Digital Triage & Teleconsultation API",
        version="1.0.0",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Kaya-Error-Code"],
    )
    application.add_middleware(SecurityHeadersMiddleware)
    application.add_middleware(RateLimitMiddleware)
    # HTTPS redirect only outside local development, so http://localhost works.
    if settings.env in ("prod", "production", "staging"):
        application.add_middleware(HTTPSRedirectMiddleware)

    # Database: SQLite by default (local), PostgreSQL via DATABASE_URL on Azure.
    init_db_engine()
    try:
        from .database import ensure_legacy_schema
        ensure_legacy_schema()
    except Exception as exc:  # pragma: no cover - defensive
        print(f"[KAYA] schema drift check failed (non-fatal): {exc}")

    # Seed demo data outside production (so local login works out of the box).
    _is_prod = settings.env in ("prod", "production")
    if (os.environ.get("KAYA_MANAGED_SCHEMA", "").lower() != "true"
            and (not _is_prod or settings.seed_demo_data)):
        try:
            result = seed_all()
            print(f"[KAYA] seed complete: {result}")
        except Exception as exc:  # pragma: no cover - defensive
            print(f"[KAYA] seed data failed (non-fatal): {exc}")

    for router in _ALL_ROUTERS:
        application.include_router(router.router)

    @application.get("/health", tags=["system"])
    @application.get("/api/v1/health", tags=["system"])
    def healthcheck() -> dict:
        return {"status": "ok", "platform": "kaya", "env": settings.env}

    if settings.expiry_scan_enabled:
        from .services.scheduler import scheduler

        @application.on_event("startup")
        async def _start_expiry_scheduler() -> None:  # pragma: no cover
            scheduler.start()

        @application.on_event("shutdown")
        async def _stop_expiry_scheduler() -> None:  # pragma: no cover
            await scheduler.stop()

    return application
