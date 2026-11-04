"""Owner recovery and clinician decisions for retained prescription renewal requests."""
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import Patient, Doctor, PrescriptionRequest, PrescriptionRequestDecision, HealthAuditLog
from app.health_schemas import PrescriptionRequestCreate, PrescriptionRequestDecide, PrescriptionRequestOut
from app.services.clinician_access import require_current_clinician
from app.services import prescription_renewals as renewal
from app.services.cursors import decode_position, encode_position


def _private(response:Response):
    response.headers['Cache-Control']='private, no-store'
    response.headers['X-Content-Type-Options']='nosniff'


router=APIRouter(tags=['prescription-requests'],dependencies=[Depends(_private)])


def _patient(user,db):
    if user.role not in ('patient','cliente'): raise HTTPException(403,'Acesso reservado ao titular paciente.')
    patient=db.query(Patient).filter_by(user_id=user.id).first()
    if not patient: raise HTTPException(404,'Perfil de paciente não encontrado.')
    return patient


def _doctor(user,db):
    if user.role!='doctor': raise HTTPException(403,'Acesso reservado ao médico atribuído.')
    credential=require_current_clinician(user,db)
    doctor=db.query(Doctor).filter_by(user_id=user.id).first()
    if not doctor: raise HTTPException(404,'Perfil médico não encontrado.')
    return doctor,credential


def _commit(db):
    try: db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(503,'Não foi possível confirmar o pedido. Recupere com a mesma chave e conteúdo.') from None


def _write(db,operation):
    try:
        row=operation(); _commit(db); return row
    except HTTPException: db.rollback(); raise
    except Exception:
        db.rollback()
        raise HTTPException(503,'Não foi possível confirmar o pedido. Repita a mesma chave e conteúdo.') from None


def _read_audit(db,user,action,identifier):
    db.add(HealthAuditLog(actor_user_id=user.id,action=action,resource_type='prescription_request',resource_id=identifier))
    _commit(db)


def _missing(code):
    return HTTPException(404,{'code':code,'request_in_flight_may_commit':True,
        'message':'O resultado ainda não foi encontrado. Um pedido em curso pode ser confirmado mais tarde.'},
        headers={'Cache-Control':'private, no-store'})


def _page(db,query,user,owner,scope,limit,cursor):
    position=decode_position(cursor,scope=scope,viewer_id=user.id,owner_id=owner) if cursor else None
    if position:
        stamp,identifier=position
        query=query.filter(or_(PrescriptionRequest.created_at<stamp,and_(PrescriptionRequest.created_at==stamp,PrescriptionRequest.id<identifier)))
    rows=query.order_by(PrescriptionRequest.created_at.desc(),PrescriptionRequest.id.desc()).limit(limit+1).all()
    more=len(rows)>limit; rows=rows[:limit]
    next_cursor=encode_position(scope=scope,viewer_id=user.id,owner_id=owner,created_at=rows[-1].created_at,identifier=rows[-1].id) if more else None
    return {'items':[renewal.request_out(db,row) for row in rows],'next_cursor':next_cursor}


@router.post('/api/v1/prescription-requests',response_model=PrescriptionRequestOut,status_code=201)
def create_prescription_request(body:PrescriptionRequestCreate,idempotency_key:str|None=Header(None,alias='Idempotency-Key'),
        user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    patient=_patient(user,db)
    row=_write(db,lambda:renewal.create_request(db,patient,body.model_dump(),idempotency_key))
    return renewal.request_out(db,row)


@router.get('/api/v1/prescription-requests/requests/{request_key}',response_model=PrescriptionRequestOut)
def recover_prescription_request(request_key:str,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    patient=_patient(user,db); key=renewal._key(request_key)
    row=db.query(PrescriptionRequest).filter_by(patient_id=patient.id,request_key=key).first()
    if not row: raise _missing('renewal_request_not_found')
    _read_audit(db,user,'renewal_request_recovered',row.id)
    return renewal.request_out(db,row)


@router.get('/api/v1/prescription-requests/page')
def patient_request_page(limit:int=Query(20,ge=1,le=100),cursor:str|None=Query(None,max_length=1024),
        user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    patient=_patient(user,db)
    result=_page(db,db.query(PrescriptionRequest).filter_by(patient_id=patient.id),user,patient.id,'renewals:patient',limit,cursor)
    _read_audit(db,user,'renewal_history_read',patient.id)
    return result


@router.get('/api/v1/prescription-requests',response_model=list[PrescriptionRequestOut])
def list_my_prescription_requests(user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    patient=_patient(user,db)
    rows=db.query(PrescriptionRequest).filter_by(patient_id=patient.id).order_by(PrescriptionRequest.created_at.desc()).all()
    return [renewal.request_out(db,row) for row in rows]


def _doctor_query(db,doctor,credential,status):
    query=db.query(PrescriptionRequest).filter(PrescriptionRequest.doctor_id==doctor.id,
        or_(PrescriptionRequest.country==credential.practice_country,PrescriptionRequest.country.is_(None)))
    if status!='all': query=query.filter(PrescriptionRequest.status==status)
    return query


Status=Literal['pending','all','approved','adjusted','consult_requested','exams_requested','rejected']


@router.get('/api/v1/doctor/prescription-requests/page')
def doctor_request_page(status:Status='pending',limit:int=Query(20,ge=1,le=100),cursor:str|None=Query(None,max_length=1024),
        user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    doctor,credential=_doctor(user,db)
    result=_page(db,_doctor_query(db,doctor,credential,status),user,doctor.id,
        f'renewals:doctor:{credential.practice_country}:{status}',limit,cursor)
    _read_audit(db,user,'renewal_assigned_history_read',doctor.id)
    return result


@router.get('/api/v1/doctor/prescription-requests/decisions/{request_key}')
def recover_prescription_decision(request_key:str,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    doctor,credential=_doctor(user,db); key=renewal._key(request_key)
    decision=db.query(PrescriptionRequestDecision).filter_by(actor_user_id=user.id,doctor_id=doctor.id,request_key=key).first()
    if not decision: raise _missing('renewal_decision_not_found')
    _read_audit(db,user,'renewal_decision_recovered',decision.request_id)
    return renewal.receipt_out(db,decision)


@router.get('/api/v1/doctor/prescription-requests',response_model=list[PrescriptionRequestOut])
def list_doctor_prescription_requests(status:Status='pending',user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    doctor,credential=_doctor(user,db)
    return [renewal.request_out(db,row) for row in _doctor_query(db,doctor,credential,status).order_by(PrescriptionRequest.created_at.asc()).all()]


@router.post('/api/v1/doctor/prescription-requests/{request_id}/decide')
def decide_prescription_request(request_id:str,body:PrescriptionRequestDecide,
        idempotency_key:str|None=Header(None,alias='Idempotency-Key'),user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    _doctor(user,db)
    decision=_write(db,lambda:renewal.decide_request(db,user,request_id,body.model_dump(),idempotency_key))
    return renewal.receipt_out(db,decision)
