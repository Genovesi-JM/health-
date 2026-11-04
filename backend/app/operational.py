"""Operational ASGI entry point for KAYA.

This is what the container runs (local dev and the Azure image):

    gunicorn app.operational:app --worker-class uvicorn.workers.UvicornWorker ...
    # or, for local dev:
    uvicorn app.operational:app --reload --port 8000

It builds the real application via `app.factory.create_app`. The Phase-0 hold
entry `app.main:app` (503) is left intact for the freeze tests and is simply not
used for deployment anymore.
"""
from __future__ import annotations

from .factory import create_app

app = create_app()
