"""Synthetic retained renewal creation, decisions, recovery and access boundaries."""
from uuid import uuid4
from datetime import datetime
import importlib.util
from pathlib import Path

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import event, text, create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from alembic.migration import MigrationContext
from alembic.operations import Operations

from app.health_models import (PrescriptionRequest, PrescriptionRequestDecision, StandalonePrescription,
    HealthAuditLog, Notification, ClinicianCredential, Doctor)
from app.models import User
from app.routers import prescription_requests
from app.rbac import assert_doctor_can_access_patient
from app.services.patient_documents import doctor_has_document_relationship
from app.services import prescription_renewals as renewal
from app.health_schemas import PrescriptionRequestDecide
from test_consultation_lifecycle import people
from consent_fixtures import withdraw, grant_all

ROOT='/api/v1/prescription-requests'
DOCTOR='/api/v1/doctor/prescription-requests'


@pytest.fixture
def api():
    app=FastAPI(); app.include_router(prescription_requests.router)
    with TestClient(app,raise_server_exceptions=False) as client: yield client


def payload(people,**overrides):
    return {'doctor_id':people['doctor']['profile'].id,'country':'AO','consent_language':'pt',
        'medication_name':'Synthetic medication','dose':'Synthetic dose','frequency':'Synthetic frequency','reason':None,**overrides}


def create(api,people,body=None,key=None,who='patient'):
    return api.post(ROOT,headers=people[who]['headers']|{'Idempotency-Key':key or str(uuid4())},json=body or payload(people))


def decide(api,people,item,action='approve',key=None,who='doctor',**overrides):
    return api.post(DOCTOR+'/'+item['id']+'/decide',headers=people[who]['headers']|{'Idempotency-Key':key or str(uuid4())},
        json={'action':action,'expected_revision':0,**overrides})


def test_creation_and_atomic_approval_have_exact_recovery_without_invented_validity(api,people,db_session):
    key=str(uuid4()); first=create(api,people,key=key)
    assert first.status_code==201,first.text
    item=first.json(); assert item['decision_state']=='pending' and item['revision']==0
    assert 'risk_alert' not in item and 'allergies' not in item
    assert create(api,people,key=key).json()['id']==item['id']
    decision_key=str(uuid4()); result=decide(api,people,item,key=decision_key)
    assert result.status_code==200,result.text
    receipt=result.json(); assert receipt['request']['status']=='approved' and receipt['request']['revision']==1
    assert receipt['decision']['action']=='approved' and receipt['decision']['request_key']==decision_key
    record=db_session.query(StandalonePrescription).filter_by(prescription_request_id=item['id']).one()
    assert record.valid_until is None and record.pharmacy_status=='not_submitted' and record.country=='AO'
    assert db_session.query(PrescriptionRequestDecision).filter_by(request_id=item['id']).count()==1
    assert db_session.query(HealthAuditLog).filter_by(action='renewal_decided',resource_id=item['id']).count()==1
    assert db_session.query(Notification).filter_by(related_entity_id=item['id']).count()==2
    withdraw(db_session,people['patient']['profile'],'health_data_processing'); db_session.commit()
    assert create(api,people,key=key).json()['status']=='approved'
    assert decide(api,people,item,key=decision_key).json()['decision']==receipt['decision']
    assert api.get(ROOT+'/requests/'+key,headers=people['patient']['headers']).json()['id']==item['id']
    assert api.get(DOCTOR+'/decisions/'+decision_key,headers=people['doctor']['headers']).json()['decision']==receipt['decision']
    assert create(api,people).json()['detail']['request_key_committed'] is False


@pytest.mark.parametrize('who,country', [('unverified','AO'),('doctor','PT')])
def test_fresh_creation_checks_current_clinician_country(api,people,who,country):
    response=create(api,people,payload(people,doctor_id=people[who]['profile'].id,country=country))
    assert response.status_code==409 and response.json()['detail']['code']=='renewal_not_committed'


def test_withdrawal_blocks_fresh_decision_but_owner_reads_remain(api,people,db_session):
    item=create(api,people).json()
    withdraw(db_session,people['patient']['profile'],'telemedicine_consent');db_session.commit()
    response=decide(api,people,item)
    assert response.status_code==409 and response.json()['detail']['request_key_committed'] is False
    assert db_session.get(PrescriptionRequest,item['id'],populate_existing=True).status=='pending'
    assert api.get(ROOT+'/page',headers=people['patient']['headers']).json()['items'][0]['id']==item['id']


@pytest.mark.parametrize('failure_model',[StandalonePrescription,HealthAuditLog,Notification])
def test_decision_failure_rolls_back_every_record_and_retry_is_safe(api,people,db_session,monkeypatch,failure_model):
    item=create(api,people).json(); key=str(uuid4())
    def fail(*args): raise RuntimeError('Synthetic atomicity failure')
    if failure_model is Notification:
        original=renewal.enqueue_notification; monkeypatch.setattr(renewal,'enqueue_notification',fail)
    else:event.listen(failure_model,'before_insert',fail)
    try: response=decide(api,people,item,key=key)
    finally:
        if failure_model is Notification:monkeypatch.setattr(renewal,'enqueue_notification',original)
        else:event.remove(failure_model,'before_insert',fail)
    assert response.status_code==503,response.text
    assert db_session.get(PrescriptionRequest,item['id'],populate_existing=True).status=='pending'
    assert db_session.query(PrescriptionRequestDecision).filter_by(request_id=item['id']).count()==0
    assert db_session.query(StandalonePrescription).filter_by(prescription_request_id=item['id']).count()==0
    assert decide(api,people,item,key=key).status_code==200


def test_changed_body_or_other_actor_cannot_reuse_request_or_decision(api,people):
    key=str(uuid4());item=create(api,people,key=key).json()
    changed=create(api,people,payload(people,reason='Changed'),key)
    assert changed.status_code==409 and isinstance(changed.json()['detail'],str)
    assert api.get(ROOT+'/requests/'+key,headers=people['other_patient']['headers']).status_code==404
    dk=str(uuid4());receipt=decide(api,people,item,key=dk)
    assert receipt.status_code==200
    assert decide(api,people,item,'reject',key=dk).status_code==409
    assert api.get(DOCTOR+'/decisions/'+dk,headers=people['other_doctor']['headers']).status_code==404
    assert decide(api,people,item,who='other_doctor').status_code==404
    assert api.get(ROOT+'/requests/'+str(uuid4()),headers=people['patient']['headers']).json()['detail']['request_in_flight_may_commit'] is True


def test_pending_and_legacy_approved_requests_do_not_grant_whole_record_access(api,people,db_session):
    item=create(api,people).json(); doctor=people['doctor']['profile'];patient=people['patient']['profile']
    with pytest.raises(HTTPException):assert_doctor_can_access_patient(doctor,patient.id,db_session)
    assert not doctor_has_document_relationship(doctor.id,patient.id,db_session)
    legacy=PrescriptionRequest(patient_id=patient.id,doctor_id=doctor.id,medication_name='Legacy',status='approved')
    db_session.add(legacy);db_session.commit()
    with pytest.raises(HTTPException):assert_doctor_can_access_patient(doctor,patient.id,db_session)
    assert decide(api,people,{'id':legacy.id}).status_code==409
    assert decide(api,people,item).status_code==200
    db_session.expire_all()
    assert_doctor_can_access_patient(doctor,patient.id,db_session)
    assert doctor_has_document_relationship(doctor.id,patient.id,db_session)
    credential=db_session.query(ClinicianCredential).filter_by(user_id=doctor.user_id).one()
    credential.practice_country='PT';db_session.commit()
    assert not renewal.has_accepted_renewal(db_session,doctor.id,patient.id)


def test_stale_session_cannot_override_terminal_decision(api,people,db_session):
    item=create(api,people).json()
    with Session(db_session.bind,autoflush=False) as waiting:
        stale=waiting.get(PrescriptionRequest,item['id']);assert stale.status=='pending'
        assert decide(api,people,item).status_code==200
        with pytest.raises(HTTPException) as error:
            renewal.decide_request(waiting,waiting.get(User,people['doctor']['user'].id),item['id'],
                PrescriptionRequestDecide(action='reject',expected_revision=0).model_dump(),str(uuid4()))
        assert error.value.status_code==409
        waiting.rollback()
    assert db_session.get(PrescriptionRequest,item['id'],populate_existing=True).status=='approved'


def test_doctor_revision_missing_and_blank_final_dose_rejected(api,people):
    item=create(api,people,payload(people,dose=None)).json()
    response=decide(api,people,item)
    assert response.status_code==409 and response.json()['detail']['request_key_committed'] is False
    assert api.post(DOCTOR+'/'+item['id']+'/decide',headers=people['doctor']['headers'],json={'action':'reject'}).status_code==422
    assert decide(api,people,item,'adjust',adjusted_dose='New dose',adjusted_frequency='New frequency').status_code==200


def test_history_cursor_is_owner_and_filter_bound_and_legacy_read_only(api,people,db_session):
    for _ in range(3):assert create(api,people).status_code==201
    first=api.get(ROOT+'/page',headers=people['patient']['headers'],params={'limit':1}).json()
    assert first['next_cursor']
    second=api.get(ROOT+'/page',headers=people['patient']['headers'],params={'limit':1,'cursor':first['next_cursor']}).json()
    assert first['items'][0]['id']!=second['items'][0]['id']
    assert api.get(ROOT+'/page',headers=people['other_patient']['headers'],params={'cursor':first['next_cursor']}).status_code==422
    doctor=api.get(DOCTOR+'/page',headers=people['doctor']['headers'],params={'limit':1}).json()
    assert api.get(DOCTOR+'/page',headers=people['doctor']['headers'],params={'status':'all','cursor':doctor['next_cursor']}).status_code==422
    assert api.get(ROOT+'/page',headers=people['patient']['headers']).headers['cache-control']=='private, no-store'


def test_immutable_request_decision_and_clinical_record_survive_sql_replace_and_delete(api,people,db_session):
    item=create(api,people).json();receipt=decide(api,people,item).json()
    ids={'prescription_requests':item['id'],'prescription_request_decisions':receipt['decision']['id'],
         'standalone_prescriptions':receipt['decision']['standalone_prescription_id']}
    for table,identifier in ids.items():
        for sql in [f'DELETE FROM {table} WHERE id=:id',f'INSERT OR REPLACE INTO {table} SELECT * FROM {table} WHERE id=:id']:
            with pytest.raises(IntegrityError):db_session.execute(text(sql),{'id':identifier});db_session.commit()
            db_session.rollback()
    with pytest.raises(IntegrityError):
        db_session.execute(text("UPDATE prescription_requests SET status='rejected' WHERE id=:id"),{'id':item['id']});db_session.commit()
    db_session.rollback()
    assert renewal.receipt_out(db_session,db_session.get(PrescriptionRequestDecision,receipt['decision']['id']))['request']['status']=='approved'


def migration():
    spec=importlib.util.spec_from_file_location('renewal_migration_test',Path('alembic/versions/prescription_renewals_v1.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module


def test_migration_adopts_schema_preserves_legacy_and_refuses_evidence_loss():
    from app.database import Base
    engine=create_engine('sqlite://')
    Base.metadata.create_all(engine)
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        change=migration();change.upgrade();change.downgrade()
        connection.execute(text("INSERT INTO prescription_requests (id,patient_id,doctor_id,medication_name,status,created_at) VALUES ('legacy','patient','doctor','Synthetic','approved','2020-01-01')"))
        change.upgrade();change.upgrade()
        row=connection.execute(text("SELECT country,consent_language,request_key,creation_evidence_json,revision FROM prescription_requests WHERE id='legacy'")).one()
        assert tuple(row)==(None,None,None,None,0)
        connection.execute(text("INSERT INTO prescription_requests (id,patient_id,doctor_id,medication_name,status,created_at,request_key) VALUES ('new','patient','doctor','Synthetic','pending','2026-01-01','synthetic-key')"))
        with pytest.raises(RuntimeError,match='Retained renewal evidence'):change.downgrade()


@pytest.mark.parametrize('bad_index',['uq_renewal_decision_request','uq_renewal_decision_actor_key'])
def test_migration_rejects_weak_decision_uniqueness(bad_index):
    from app.database import Base
    engine=create_engine('sqlite://');Base.metadata.create_all(engine)
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        connection.execute(text('DROP INDEX '+bad_index))
        with pytest.raises(RuntimeError,match='Invalid renewal decision uniqueness'):migration().upgrade()
