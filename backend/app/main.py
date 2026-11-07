"""Phase 0 launch hold. The normal ASGI entry point exposes no clinical routes.

The original runtime is retained for isolated synthetic checks only. See
``docs/KAYA_EXECUTION_STATUS.md`` before attempting to use it.
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


def create_application() -> FastAPI:
    mode = os.environ.get("KAYA_EXECUTION_MODE", "hold")
    if mode == "synthetic":
        # Never load the original runtime alongside an operator dotenv file.
        # The audit runner copies reviewed source into a disposable workspace.
        backend = Path(__file__).resolve().parents[1]
        if os.environ.get("ENV") != "test" or (backend / ".env").exists():
            raise RuntimeError("Synthetic runtime requires ENV=test and no backend/.env")
        from .synthetic_runtime import create_application as create_synthetic_application
        return create_synthetic_application()
    if mode != "hold":
        raise RuntimeError("Unknown KAYA_EXECUTION_MODE; clinical launch remains on HOLD")

    application = FastAPI(title="Kaya launch hold", docs_url=None, redoc_url=None, openapi_url=None)

    @application.middleware("http")
    async def launch_hold(request: Request, call_next):
        # One read-only informational exception; it never selects a jurisdiction
        # from request data or enables clinical routes. Invalid policy stays held.
        if request.method == "GET" and request.url.path == "/api/v1/public/pilot-scope":
            try:
                from .phase1_policy import public_pilot_scope
                metadata = public_pilot_scope()
            except (ImportError, OSError, ValueError, TypeError):
                pass
            else:
                return JSONResponse(content=metadata, headers={"Cache-Control": "no-store"})
        # Hold every clinical path and method, including auth, webhooks, health.
        # Readiness must not report a clinical runtime as available.
        return JSONResponse(
            status_code=503,
            content={
                "status": "HOLD",
                "clinical_operations": "disabled",
                "detail": "Kaya is unavailable for clinical use. Synthetic development only.",
                "emergency_guidance": "If you need urgent help, contact local emergency services.",
            },
            headers={"Cache-Control": "no-store"},
        )

    return application


app = create_application()
