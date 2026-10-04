"""Bounded consultation keyset traversal with identity/filter-bound cursors."""
import hashlib
import json

from fastapi import HTTPException
from sqlalchemy import and_, or_

from app.health_models import Consultation
from app.services.cursors import decode_position, encode_position

VIEWS = {"all": None, "upcoming": ("requested", "scheduled", "in_progress"),
         "past": ("completed", "cancelled", "no_show", "expired")}


def history_query(query, *, view="all", status=None):
    if view not in VIEWS:
        raise HTTPException(422, "Escolha uma vista de consultas válida.")
    if VIEWS[view]:
        query = query.filter(Consultation.status.in_(VIEWS[view]))
    if status:
        query = query.filter(Consultation.status == status)
    return query


def consultation_page(query, *, viewer, owner, scope, limit, cursor, ascending=False, filters=None):
    if type(limit) is not int or not 1 <= limit <= 100:
        raise HTTPException(422, "Escolha entre 1 e 100 consultas por página.")
    binding = scope + ":" + hashlib.sha256(json.dumps(filters or {}, sort_keys=True, separators=(",", ":")).encode()).hexdigest()[:24]
    if cursor:
        at, identifier = decode_position(cursor, scope=binding, viewer_id=viewer, owner_id=owner)
        query = query.filter(or_(
            Consultation.created_at > at if ascending else Consultation.created_at < at,
            and_(Consultation.created_at == at, Consultation.id > identifier if ascending else Consultation.id < identifier),
        ))
    order = (Consultation.created_at.asc(), Consultation.id.asc()) if ascending else (Consultation.created_at.desc(), Consultation.id.desc())
    rows = query.order_by(*order).limit(limit + 1).all()
    items = rows[:limit]
    next_cursor = encode_position(scope=binding, viewer_id=viewer, owner_id=owner,
        created_at=items[-1].created_at, identifier=items[-1].id) if len(rows) > limit else None
    return items, next_cursor


def private_page(response):
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
