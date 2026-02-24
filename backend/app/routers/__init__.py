from __future__ import annotations
"""Routers package for the backend."""
# Health Platform routers — only import core routers that are actively used.
# GeoVision-era routers (projects, ai, shop, etc.) are kept as files but
# NOT imported here to avoid startup errors.
from . import auth  # noqa: F401
