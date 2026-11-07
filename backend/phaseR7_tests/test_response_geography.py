"""Phase R7 Response geography: only explicitly-approved, user-confirmed covered
areas get capabilities; inferred/coarse/unknown location and out-of-area get
information-only + boundary notice; unsigned map covers nothing.
"""
from __future__ import annotations

from app import response_geography as G


def _map(**kw):
    base = dict(map_id="cm-1", areas=frozenset({"AO-LUANDA-INGOMBOTA", "AO-LUANDA-MAIANGA"}),
                signed_off_by="Ops Owner")
    base.update(kw)
    return G.CoverageMap(**base)


def _loc(area_id="AO-LUANDA-INGOMBOTA", source="user_confirmed"):
    return G.ReportedLocation(area_id=area_id, source=source)


def test_covered_confirmed_location_gets_capabilities():
    assert G.exposure_for_location(_map(), _loc()) == "capabilities"
    assert G.out_of_area_message(_map(), _loc()) is None


def test_out_of_area_is_information_only():
    assert G.exposure_for_location(_map(), _loc(area_id="AO-BENGO-X")) == "information_only"
    assert G.out_of_area_message(_map(), _loc(area_id="AO-BENGO-X"))


def test_inferred_location_not_trusted():
    assert not G.location_is_trusted(_loc(source="ip_inferred"))
    assert G.exposure_for_location(_map(), _loc(source="ip_inferred")) == "information_only"
    assert G.exposure_for_location(_map(), _loc(source="coarse")) == "information_only"


def test_unknown_location_information_only():
    assert G.exposure_for_location(_map(), G.ReportedLocation(None, "unknown")) == "information_only"


def test_unsigned_map_covers_nothing():
    assert not G.area_covered(_map(signed_off_by=None), "AO-LUANDA-INGOMBOTA")
    assert G.exposure_for_location(_map(signed_off_by=None), _loc()) == "information_only"
