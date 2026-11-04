"""Exact approved-text decisions and personal evidence recovery."""
from typing import List, Literal
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Response
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import Patient, PatientConsent, PatientConsentEvent, HealthAuditLog
from app.health_schemas import ConsentRequest, ConsentOut
from app.rbac import get_patient_for_user
from app.services import consent_runtime as consent
from app.services.cursors import decode_position, encode_position


def _private(response: Response):
    response.headers['Cache-Control'] = 'private, no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'


router = APIRouter(prefix='/api/v1/compliance', tags=['compliance'], dependencies=[Depends(_private)])


def _owner(user, db):
    if user.role not in ('patient', 'cliente'): raise HTTPException(403, 'A decisão pertence ao titular paciente.')
    return db.query(Patient).filter_by(user_id=user.id).first()


def _commit(db):
    try: db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(503, 'Não foi possível confirmar a decisão. Recupere com a mesma chave e conteúdo.') from None


@router.get('/catalog')
def catalog(country: Literal['AO', 'PT'], language: str = Query('pt', pattern=r'^[a-z]{2}(-[A-Z]{2})?$', max_length=10),
            user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return consent.catalog_out(db, country, language)


@router.get('/consent-state')
def consent_state(country: Literal['AO', 'PT'], language: str = Query('pt', pattern=r'^[a-z]{2}(-[A-Z]{2})?$', max_length=10),
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient = _owner(user, db)
    return consent.state_out(db, patient.id if patient else None, country, language)


@router.post('/consent')
def decide_consent(body: ConsentRequest, idempotency_key: str | None = Header(None, alias='Idempotency-Key'),
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient = _owner(user, db)
    if not patient: raise HTTPException(404, 'Conclua o perfil de paciente antes de registar decisões individuais.')
    try:
        event = consent.append_event(db, patient, user.id, body.model_dump(), idempotency_key)
        _commit(db)
        return consent.receipt_out(db, event)
    except HTTPException:
        db.rollback(); raise
    except Exception:
        db.rollback()
        raise HTTPException(503, 'Não foi possível confirmar a decisão. Repita a mesma chave e conteúdo.') from None


@router.get('/consent-requests/{request_key}')
def recover_decision(request_key: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    key = consent.normalized_key(request_key); patient = _owner(user, db)
    event = db.query(PatientConsentEvent).filter_by(patient_id=patient.id, request_key=key).first() if patient else None
    if not event:
        raise HTTPException(404, {'code': 'consent_request_not_found', 'request_in_flight_may_commit': True,
            'message': 'A decisão ainda não foi encontrada. Um pedido em curso pode ser confirmado mais tarde.'},
            headers={'Cache-Control': 'private, no-store'})
    db.add(HealthAuditLog(actor_user_id=user.id, action='consent_request_recovered', resource_type='consent_event', resource_id=event.id))
    _commit(db)
    return consent.receipt_out(db, event)


@router.get('/consent-history/page')
def consent_history(limit: int = Query(20, ge=1, le=100), cursor: str | None = Query(None, max_length=1024),
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient = _owner(user, db)
    owner = patient.id if patient else user.id
    position = decode_position(cursor, scope='consent-history', viewer_id=user.id, owner_id=owner) if cursor else None
    if not patient: return {'items': [], 'next_cursor': None}
    query = db.query(PatientConsentEvent).filter_by(patient_id=patient.id)
    if position:
        stamp, identifier = position
        query = query.filter(or_(PatientConsentEvent.created_at < stamp, and_(PatientConsentEvent.created_at == stamp, PatientConsentEvent.id < identifier)))
    rows = query.order_by(PatientConsentEvent.created_at.desc(), PatientConsentEvent.id.desc()).limit(limit + 1).all()
    more = len(rows) > limit; rows = rows[:limit]
    cursor = encode_position(scope='consent-history', viewer_id=user.id, owner_id=owner,
        created_at=rows[-1].created_at, identifier=rows[-1].id) if more else None
    db.add(HealthAuditLog(actor_user_id=user.id, action='consent_history_read', resource_type='patient', resource_id=patient.id))
    _commit(db)
    return {'items': [consent.event_out(db, event) for event in rows], 'next_cursor': cursor}


@router.get('/consents', response_model=List[ConsentOut])
def list_legacy_consents(patient: Patient = Depends(get_patient_for_user), db: Session = Depends(get_db)):
    """Legacy declarations remain visible but do not prove effective consent."""
    return db.query(PatientConsent).filter_by(patient_id=patient.id).order_by(PatientConsent.accepted_at.desc()).all()
