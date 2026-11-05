"""Operational ASGI entry point for isolated synthetic development only.

Azure's default container entry remains app.main:app (clinical HOLD).
This module is not a clinical launch authorization.
"""
from __future__ import annotations

from .factory import create_app

app = create_app()
