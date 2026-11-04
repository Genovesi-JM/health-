"""Exact renewal submission and one retained, transactional clinical decision."""
from datetime import datetime
import hmac
import json
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import update

from app.health_models import (PrescriptionRequest, PrescriptionRequestDecision, StandalonePrescription,
    Patient, Doctor, HealthAuditLog, PatientConsentEvent, ConsentCatalogDocument)
from app.models import User, UserProfile
from app.services.appointments import lock_resources, current_doctor
from app.services import consent_runtime as consent
from app.services.clinician_access import require_current_clinician
from app.services.cursors import utc_timestamp
from app.services.notifications import enqueue_notification

ACTIONS={'approve':'approved','adjust':'adjusted','adjusted':'adjusted','consult_requested':'consult_requested',
         'exams_requested':'exams_requested','reject':'rejected','rejected':'rejected'}
STATUSES=('pending','approved','adjusted','consult_requested','exams_requested','rejected')


def not_committed(message):
    return HTTPException(409, {'code':'renewal_not_committed','request_key_committed':False,'message':message})


def _key(key): return consent.normalized_key(key)


def _json(data): return json.dumps(data,sort_keys=True,separators=(',',':'))


def _name(db,user_id,fallback):
    profile=db.query(UserProfile).filter_by(user_id=user_id).first()
    return (profile.full_name if profile and profile.full_name else fallback)


def _evidence(db,patient_id,doctor,country,language):
    events=consent.require_effective(db,patient_id,country,language)
    clinician=db.get(User,doctor.user_id,populate_existing=True)
    credential=require_current_clinician(clinician,db)
    if credential.practice_country != country: raise HTTPException(409,'O médico não está disponível neste país.')
    return {'grant_ids':[event.id for event in events], 'doctor_user_id':doctor.user_id,
            'credential_id':credential.id,'practice_country':country,'licence_number':credential.licence_number,
            'doctor_name':_name(db,doctor.user_id,'Médico')}


def _verify_grants(db,patient_id,country,language,evidence,at):
    ids=evidence['grant_ids']
    if not isinstance(ids,list) or len(ids)!=len(set(ids)) or len(ids)!=len(consent.REQUIRED_PURPOSES): raise ValueError()
    events=db.query(PatientConsentEvent).filter(PatientConsentEvent.id.in_(ids)).all()
    purposes=set()
    if len(events)!=len(ids): raise ValueError()
    for event in events:
        document=db.get(ConsentCatalogDocument,event.document_id)
        if (event.patient_id!=patient_id or event.action!='grant' or event.created_at>at or document.country!=country
                or document.language!=language or not consent.valid_document(document,at)): raise ValueError()
        purposes.add(document.purpose)
    if purposes!=set(consent.REQUIRED_PURPOSES): raise ValueError()


def creation_digest(row):
    return consent.canonical({name:getattr(row,name) for name in ('id','patient_id','doctor_id','country','consent_language',
        'request_key','request_digest','medication_name','dose','frequency','reason')} | {
        'created_at':utc_timestamp(row.created_at),'evidence':json.loads(row.creation_evidence_json)})


def verify_creation(db,row):
    try:
        if row.country not in ('AO','PT') or not row.consent_language or not row.creation_digest or not row.request_key: raise ValueError()
        if not hmac.compare_digest(row.creation_digest,creation_digest(row)): raise ValueError()
        evidence=json.loads(row.creation_evidence_json)
        doctor=db.get(Doctor,row.doctor_id)
        if evidence['doctor_user_id']!=doctor.user_id or evidence['practice_country']!=row.country: raise ValueError()
        _verify_grants(db,row.patient_id,row.country,row.consent_language,evidence,row.created_at)
    except (ValueError,TypeError,KeyError,AttributeError):
        raise HTTPException(409,{'code':'renewal_evidence_review','message':'A autorização deste pedido requer revisão explícita.'}) from None


def decision_digest(row):
    return consent.canonical({name:getattr(row,name) for name in ('id','request_id','patient_id','doctor_id','actor_user_id',
        'country','consent_language','request_key','request_digest','action','revision')} | {
        'payload':json.loads(row.payload_json),'evidence':json.loads(row.consent_evidence_json),'decided_at':utc_timestamp(row.decided_at)})


def verify_decision(db,row,request):
    verify_creation(db,request)
    try:
        if not hmac.compare_digest(row.content_digest,decision_digest(row)): raise ValueError()
        if (row.request_id!=request.id or row.patient_id!=request.patient_id or row.doctor_id!=request.doctor_id
                or row.country!=request.country or row.consent_language!=request.consent_language
                or row.revision!=1 or request.revision!=1 or request.status!=row.action): raise ValueError()
        evidence=json.loads(row.consent_evidence_json)
        doctor=db.get(Doctor,row.doctor_id)
        if row.actor_user_id!=doctor.user_id or evidence['doctor_user_id']!=row.actor_user_id: raise ValueError()
        _verify_grants(db,row.patient_id,row.country,row.consent_language,evidence,row.decided_at)
        payload=json.loads(row.payload_json)
        if payload['medication_name']!=request.medication_name or payload['doctor_note']!=request.doctor_note: raise ValueError()
        if row.action in ('approved','adjusted'):
            record=db.query(StandalonePrescription).filter_by(renewal_decision_id=row.id).first()
            if not record or any(getattr(record,field)!=value for field,value in {
                'prescription_request_id':request.id,'patient_id':row.patient_id,'doctor_id':row.doctor_id,'country':row.country,
                'consent_language':row.consent_language,'medication_name':payload['medication_name'],
                'dosage':payload['dose'],'frequency':payload['frequency'],'instructions':payload['doctor_note']}.items()): raise ValueError()
    except (ValueError,TypeError,KeyError,AttributeError):
        raise HTTPException(409,{'code':'renewal_evidence_review','message':'A decisão retida requer verificação.'}) from None


def request_out(db,row):
    decision=db.query(PrescriptionRequestDecision).filter_by(request_id=row.id).first()
    state='legacy_review_required'
    try:
        verify_creation(db,row)
        if decision: verify_decision(db,decision,row); state='decided'
        elif row.status=='pending' and row.revision==0: state='pending'
    except HTTPException: pass
    record=db.query(StandalonePrescription).filter_by(prescription_request_id=row.id).first()
    patient=db.get(Patient,row.patient_id); doctor=db.get(Doctor,row.doctor_id)
    return {**{name:getattr(row,name) for name in ('id','patient_id','doctor_id','country','consent_language','request_key',
        'medication_name','dose','frequency','reason','status','doctor_note','adjusted_dose','adjusted_frequency')},
        'created_at':utc_timestamp(row.created_at),'decided_at':utc_timestamp(row.decided_at),'revision':row.revision or 0,
        'decision_state':state,'decision_id':decision.id if decision else None,'standalone_prescription_id':record.id if record else None,
        'patient_name':_name(db,patient.user_id,'Paciente') if patient else None,
        'doctor_name':_name(db,doctor.user_id,'Médico') if doctor else None}


def receipt_out(db,decision):
    row=db.get(PrescriptionRequest,decision.request_id,populate_existing=True)
    verify_decision(db,decision,row)
    payload=json.loads(decision.payload_json)
    record=db.query(StandalonePrescription).filter_by(renewal_decision_id=decision.id).first()
    original={name:getattr(decision,name) for name in ('id','request_id','request_key','action','revision','country','consent_language')}
    original.update(payload,decided_at=utc_timestamp(decision.decided_at),standalone_prescription_id=record.id if record else None)
    return {'decision':original,'request':request_out(db,row)}


def _audit(db,user_id,action,resource_id):
    db.add(HealthAuditLog(actor_user_id=user_id,action=action,resource_type='prescription_request',resource_id=resource_id))


def create_request(db,patient,body,key):
    key=_key(key); digest=consent.canonical(body)
    def replay():
        row=db.query(PrescriptionRequest).filter_by(patient_id=patient.id,request_key=key).populate_existing().first()
        if row and not hmac.compare_digest(row.request_digest or '',digest):
            raise HTTPException(409,'Esta chave pertence a outro pedido. Recupere o pedido original.')
        return row
    old=replay()
    if old: return old
    lock_resources(db,body['doctor_id'],patient.id)
    old=replay()
    if old: return old
    try:
        doctor=current_doctor(db,body['doctor_id'],body['country'])
        evidence=_evidence(db,patient.id,doctor,body['country'],body['consent_language'])
    except HTTPException as error: raise not_committed(str(error.detail.get('message','Reveja a autorização do pedido.') if isinstance(error.detail,dict) else error.detail)) from None
    row=PrescriptionRequest(id=str(uuid4()),patient_id=patient.id,**body,request_key=key,request_digest=digest,
        status='pending',revision=0,created_at=datetime.utcnow(),creation_evidence_json=_json(evidence))
    row.creation_digest=creation_digest(row)
    db.add(row); db.flush(); _audit(db,patient.user_id,'renewal_requested',row.id)
    enqueue_notification(db,user_id=doctor.user_id,event_key=f'renewal:{row.id}:requested',title='Novo pedido',
        message='Existe um novo pedido para revisão. Abra o pedido para consultar os detalhes.',entity_type='prescription_request',entity_id=row.id)
    db.flush()
    return row


def decide_request(db,user,request_id,body,key):
    key=_key(key); digest=consent.canonical({'request_id':request_id,**body})
    doctor=db.query(Doctor).filter_by(user_id=user.id).first()
    if not doctor: raise HTTPException(404,'Perfil médico não encontrado.')
    def replay():
        event=db.query(PrescriptionRequestDecision).filter_by(actor_user_id=user.id,request_key=key).first()
        if event and not hmac.compare_digest(event.request_digest,digest): raise HTTPException(409,'Esta chave pertence a outra decisão. Recupere a decisão original.')
        return event
    old=replay()
    if old: return old
    row=db.query(PrescriptionRequest).filter_by(id=request_id,doctor_id=doctor.id).first()
    if not row: raise HTTPException(404,'Pedido não encontrado.')
    lock_resources(db,doctor.id,row.patient_id)
    old=replay()
    if old: return old
    db.refresh(row)
    try:
        current=current_doctor(db,doctor.id,row.country)
        verify_creation(db,row)
        if row.status!='pending' or row.revision!=body['expected_revision'] or row.revision!=0:
            raise HTTPException(409,'Este pedido já foi processado. Atualize a lista.')
        evidence=_evidence(db,row.patient_id,current,row.country,row.consent_language)
        action=ACTIONS[body['action']]
        dose=body['adjusted_dose'] if action=='adjusted' else row.dose
        frequency=body['adjusted_frequency'] if action=='adjusted' else row.frequency
        if action in ('approved','adjusted') and (not dose or not frequency):
            raise HTTPException(422,'Indique a dose e frequência finais antes de aprovar ou ajustar.')
        if action!='adjusted' and (body['adjusted_dose'] is not None or body['adjusted_frequency'] is not None):
            raise HTTPException(422,'Use a decisão de ajuste para alterar dose ou frequência.')
    except HTTPException as error: raise not_committed(str(error.detail.get('message','Reveja a autorização do pedido.') if isinstance(error.detail,dict) else error.detail)) from None
    stamp=datetime.utcnow()
    decision=PrescriptionRequestDecision(id=str(uuid4()),request_id=row.id,patient_id=row.patient_id,doctor_id=row.doctor_id,
        actor_user_id=user.id,country=row.country,consent_language=row.consent_language,request_key=key,request_digest=digest,
        action=action,revision=1,decided_at=stamp,consent_evidence_json=_json(evidence),
        payload_json=_json({'medication_name':row.medication_name,'dose':dose,'frequency':frequency,'doctor_note':body['doctor_note']}))
    decision.content_digest=decision_digest(decision)
    db.add(decision); db.flush()
    changed=db.execute(update(PrescriptionRequest).where(PrescriptionRequest.id==row.id,PrescriptionRequest.doctor_id==doctor.id,
        PrescriptionRequest.status=='pending',PrescriptionRequest.revision==0).values(status=action,revision=1,decided_at=stamp,
        doctor_note=body['doctor_note'],adjusted_dose=body['adjusted_dose'],adjusted_frequency=body['adjusted_frequency']))
    if changed.rowcount!=1: raise not_committed('O pedido mudou durante a decisão. Atualize a lista.')
    if action in ('approved','adjusted'):
        db.add(StandalonePrescription(id=str(uuid4()),prescription_request_id=row.id,patient_id=row.patient_id,doctor_id=row.doctor_id,
            renewal_decision_id=decision.id,country=row.country,consent_language=row.consent_language,medication_name=row.medication_name,
            dosage=dose,frequency=frequency,instructions=body['doctor_note'],issue_date=stamp,valid_until=None,pharmacy_status='not_submitted'))
    _audit(db,user.id,'renewal_decided',row.id)
    patient=db.get(Patient,row.patient_id)
    enqueue_notification(db,user_id=patient.user_id,event_key=f'renewal:{row.id}:decision:{decision.id}',title='Pedido atualizado',
        message='O seu pedido foi atualizado. Abra o pedido para consultar os detalhes.',entity_type='prescription_request',entity_id=row.id)
    db.flush(); db.refresh(row)
    return decision


def has_accepted_renewal(db,doctor_id,patient_id):
    doctor=db.get(Doctor,doctor_id)
    if not doctor: return False
    try: credential=require_current_clinician(db.get(User,doctor.user_id),db)
    except HTTPException: return False
    rows=db.query(PrescriptionRequestDecision).filter_by(doctor_id=doctor_id,patient_id=patient_id,country=credential.practice_country).filter(
        PrescriptionRequestDecision.action.in_(('approved','adjusted'))).all()
    for decision in rows:
        try: verify_decision(db,decision,db.get(PrescriptionRequest,decision.request_id)); return True
        except HTTPException: continue
    return False
