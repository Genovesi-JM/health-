from __future__ import annotations
# backend/app/main.py
"""
Health Platform Backend — Digital Triage & Teleconsultation
Transformed from GeoVision drone SaaS into healthcare SaaS.
"""

from pathlib import Path

import os
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db_engine
from .middleware import SecurityHeadersMiddleware, RateLimitMiddleware, HTTPSRedirectMiddleware

# Core routers (kept from original)
from .routers import auth, admin, me

# Health platform routers (new)
from .routers import (
    patients,
    doctors,
    triage,
    consultations,
    prescriptions,
    corporate,
    health_billing,
    compliance,
    health_dashboard,
)

from .seed_data import seed_all


def create_application() -> FastAPI:
    """Build and configure the FastAPI instance."""
    application = FastAPI(
        title=settings.app_name,
        description="Plataforma de Triage Digital & Teleconsulta — API",
        version="1.0.0",
    )

    # Safe startup diagnostics (no secrets)
    try:
        print(
            "[HealthPlatform] Config: "
            f"env={settings.env} "
            f"backend_base={settings.backend_base} "
            f"frontend_base={settings.frontend_base} "
            f"google_client_id_set={bool(settings.google_client_id)} "
            f"google_client_secret_set={bool(settings.google_client_secret)}"
        )
        cors_env = os.getenv("CORS_ORIGINS", "")
        if cors_env.strip():
            print(f"[HealthPlatform] CORS_ORIGINS(env)={cors_env}")
    except Exception:
        pass

    # CORS
    default_origins = {
        "http://127.0.0.1:8001",
        "http://localhost:8001",
        "http://localhost:3000",
        "http://localhost:5173",
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
        allow_origins = [o.strip() for o in env_origins.split(",") if o.strip()]
    else:
        allow_origins = sorted(default_origins)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Security middleware (order matters: outermost first)
    application.add_middleware(SecurityHeadersMiddleware)
    application.add_middleware(RateLimitMiddleware)
    application.add_middleware(HTTPSRedirectMiddleware)

    init_db_engine()

    # Ensure DB schema is up-to-date (add missing columns)
    try:
        from .database import ensure_legacy_schema
        ensure_legacy_schema()
        print("[HealthPlatform] Schema drift check completed.")
    except Exception as exc:
        print(f"[HealthPlatform] Schema drift check failed (non-fatal): {exc}")

    # Seed test data (admin, patients, doctors)
    try:
        result = seed_all()
        print(f"[HealthPlatform] Seed complete: {result}")
    except Exception as exc:
        print(f"[HealthPlatform] Seed data failed (non-fatal): {exc}")

    # ── Core routers (auth, admin, user profile) ──
    application.include_router(auth.router)       # /auth/*
    application.include_router(admin.router)      # /admin/*
    application.include_router(me.router)         # /me

    # ── Health platform routers ──
    application.include_router(patients.router)           # /api/v1/patients/*
    application.include_router(doctors.router)            # /api/v1/doctors/*
    application.include_router(triage.router)             # /api/v1/triage/*
    application.include_router(consultations.router)      # /api/v1/consultations/*, /api/v1/doctor/*
    application.include_router(prescriptions.router)      # /api/v1/consultations/*/prescription|referral, /api/v1/files/*
    application.include_router(corporate.router)          # /api/v1/corporate/*
    application.include_router(health_billing.router)     # /api/v1/billing/*
    application.include_router(compliance.router)         # /api/v1/compliance/*
    application.include_router(health_dashboard.router)   # /api/v1/dashboard/*

    # ── Deprecated drone/shop routers (disabled) ──
    # The following routers are from the original GeoVision platform and
    # are no longer included. They are NOT deleted to allow gradual migration.
    # - projects, ai, accounts, kpi (GeoVision-specific)
    # - products, orders, customer_accounts, employees (e-commerce)
    # - datasets, risk, payments, shop, contacts (drone platform)

    @application.get("/health", tags=["system"])
    @application.get("/api/v1/health", tags=["system"])
    def healthcheck() -> dict:
        return {"status": "ok", "platform": "health"}

    return application


app = create_application()
