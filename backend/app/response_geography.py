"""KAYA Response — geographic coverage limits (Phase R7). Domain-pure.

Response operates only inside explicitly approved coverage areas. Outside a
covered area — or when the location is unknown or was merely inferred — the
reporter receives information only plus the boundary notice, never a covered-area
capability. Location must be explicitly provided and confirmed, never guessed from
IP or a coarse signal. Stdlib-only.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from . import response_scope


@dataclass(frozen=True)
class CoverageArea:
    area_id: str                 # e.g. "AO-LUANDA-INGOMBOTA"
    jurisdiction: str            # e.g. "AO-LUANDA"


@dataclass(frozen=True)
class CoverageMap:
    map_id: str
    areas: frozenset             # frozenset[str] of approved area ids
    signed_off_by: Optional[str] = None


@dataclass(frozen=True)
class ReportedLocation:
    area_id: Optional[str]
    source: str                  # "user_confirmed" | "ip_inferred" | "coarse" | "unknown"


# Location sources we trust enough to consider "provided". IP/coarse are NOT.
_TRUSTED_SOURCES = frozenset({"user_confirmed"})


def coverage_map_signed(cmap: CoverageMap) -> bool:
    return bool(cmap.signed_off_by)


def location_is_trusted(loc: ReportedLocation) -> bool:
    """Only an explicitly user-confirmed location counts; inferred/coarse/unknown
    are not trusted for a coverage decision."""
    return bool(loc.area_id) and loc.source in _TRUSTED_SOURCES


def area_covered(cmap: CoverageMap, area_id: Optional[str]) -> bool:
    return coverage_map_signed(cmap) and bool(area_id) and area_id in cmap.areas


def exposure_for_location(cmap: CoverageMap, loc: ReportedLocation) -> str:
    """Fail-closed: 'capabilities' only for a trusted, covered location; otherwise
    'information_only'."""
    if not location_is_trusted(loc):
        return "information_only"
    if not area_covered(cmap, loc.area_id):
        return "information_only"
    return "capabilities"


def out_of_area_message(cmap: CoverageMap, loc: ReportedLocation) -> Optional[str]:
    """The reporter-facing notice when Response cannot cover the location. Returns
    None when the location is covered."""
    if exposure_for_location(cmap, loc) == "capabilities":
        return None
    return response_scope.boundary_notice()
