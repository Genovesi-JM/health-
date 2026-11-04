"""Real routes, exact retry decisions and retained bytes; all data synthetic."""
from datetime import date, timedelta
import importlib.util
import io
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import event, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.health_models import (ClinicianCredential, Consultation, Doctor, Patient, Prescription, Referral)
from app.models import User, UserProfile
from app.clinical_document_models import ClinicalDocumentRequest
from app.routers import prescriptions
from tests.consent_fixtures import grant_all, seed_episode, withdraw


BODIES = {'prescription': {'medications':[{'name':'Medicamento sintético','dosage':'dose sintética','frequency':'frequência sintética'}], 'instructions':'Texto de teste'},
          'referral': {'destination':'Clínica sintética','reason':'Teste de documento','urgency':'routine'}}


@pytest.fixture
def context(db, monkeypatch):
    patient_user = User(email='doc-patient@example.invalid',role='patient',password_hash='synthetic',is_active=True)
    doctor_user = User(email='doc-doctor@example.invalid',role='doctor',password_hash='synthetic',is_active=True)
    outsider = User(email='doc-other@example.invalid',role='doctor',password_hash='synthetic',is_active=True)
    db.add_all([patient_user,doctor_user,outsider]);db.flush()
    patient = Patient(user_id=patient_user.id);doctor = Doctor(user_id=doctor_user.id,verification_status='verified',license_number='UNVERIFIED-LEGACY')
    otherdoctor = Doctor(user_id=outsider.id,verification_status='verified')
    db.add_all([patient,doctor,otherdoctor,UserProfile(user_id=patient_user.id,full_name='Paciente Sintético'),UserProfile(user_id=doctor_user.id,full_name='Médica Sintética')]);db.flush()
    for user in (doctor_user,outsider):
        db.add(ClinicianCredential(user_id=user.id,profession='doctor',legal_name='Synthetic Doctor',practice_country='AO',licence_country='AO',
            issuing_authority='Synthetic Registry',licence_number='VERIFIED-SYNTHETIC',licence_expiry_date=(date.today()+timedelta(days=30)).isoformat(),
            diploma_country='AO',diploma_institution='Synthetic Institute',degree_title='Medicine',status='verified'))
    grant_all(db,patient);grant_all(db,patient,country='PT')
    consultation=Consultation(patient_id=patient.id,doctor_id=doctor.id,country='AO',consent_language='pt',status='completed')
    db.add(consultation);db.flush();seed_episode(db,consultation);db.commit()
    state=SimpleNamespace(actor=doctor_user,objects={},writes=[],lose=False,rendered=[],doctor=doctor,patient=patient,
        patient_user=patient_user,doctor_user=doctor_user,outsider=outsider,consultation=consultation)
    class Storage:
        def write_retained_bytes(self,data,key):
            state.writes.append((key,data))
            if key in state.objects and state.objects[key]!=data: raise RuntimeError('synthetic conflict')
            state.objects[key]=data
            if state.lose: state.lose=False;raise RuntimeError('synthetic lost response')
        def download_bytes(self,key):return state.objects[key]
        def get_signed_url(self,key):return 'https://synthetic.invalid/private'
        def get_signed_url_expiry_seconds(self):return 60
    from app.services.pdf_generator import generate_referral_pdf
    fixture_pdf = generate_referral_pdf('Synthetic patient', None, 'Synthetic doctor', 'TEST', 'Synthetic clinic', None, 'Synthetic only', 'routine')
    def render(**kwargs):
        state.rendered.append(kwargs)
        assert kwargs['doctor_license']=='VERIFIED-SYNTHETIC'
        return fixture_pdf
    monkeypatch.setattr(prescriptions,'get_health_storage',lambda:Storage())
    monkeypatch.setattr(prescriptions,'generate_prescription_pdf',render)
    monkeypatch.setattr(prescriptions,'generate_referral_pdf',render)
    app=FastAPI();app.include_router(prescriptions.router)
    def database():
        with Session(db.bind,autoflush=False) as session:yield session
    app.dependency_overrides[get_db]=database
    app.dependency_overrides[get_current_user]=lambda:state.actor
    with TestClient(app,raise_server_exceptions=False) as client:
        state.client=client;yield state


def post(context,kind,key=None,body=None,consultation=None):
    return context.client.post(f'/api/v1/consultations/{consultation or context.consultation.id}/{kind}',
        headers={'Idempotency-Key':key or str(uuid4())},json=body or BODIES[kind])


@pytest.mark.parametrize('kind',['prescription','referral'])
def test_one_exact_document_and_receipt_after_withdrawal(context,db,kind):
    key=str(uuid4());first=post(context,kind,key);assert first.status_code==200,first.text
    assert first.json()['artifact_status']=='ready' and first.json()['file_url'] is None
    withdraw(db,context.patient,'health_data_processing');db.commit()
    repeat=post(context,kind,key);assert repeat.status_code==200,repeat.text
    assert repeat.json()==first.json() and len(context.writes)==len(context.rendered)==1
    assert db.query(ClinicalDocumentRequest).count()==1
    fresh=post(context,kind);assert fresh.status_code==403
    receipt=context.client.get('/api/v1/consultation-document-requests/'+key)
    assert receipt.status_code==200 and receipt.json()['document']==first.json()
    context.actor=context.patient_user
    download=context.client.get('/api/v1/files/'+first.json()['id']);assert download.status_code==200,download.text


@pytest.mark.parametrize('kind',['prescription','referral'])
def test_missing_episode_and_wrong_market_cannot_render(context,db,kind):
    legacy=Consultation(patient_id=context.patient.id,doctor_id=context.doctor.id,country='AO',consent_language='pt',status='completed')
    foreign=Consultation(patient_id=context.patient.id,doctor_id=context.doctor.id,country='PT',consent_language='pt',status='completed')
    db.add_all([legacy,foreign]);db.flush();seed_episode(db,foreign);db.commit()
    for item in (legacy,foreign):
        response=post(context,kind,consultation=item.id);assert response.status_code==409,response.text
    assert not context.writes and not context.rendered and db.query(ClinicalDocumentRequest).count()==0


@pytest.mark.parametrize('kind',['prescription','referral'])
def test_lost_upload_result_resumes_same_bytes_and_id_after_withdrawal(context,db,kind):
    key=str(uuid4());context.lose=True;first=post(context,kind,key)
    assert first.status_code==503 and first.json()['detail']['request_committed'] is True
    receipt=context.client.get('/api/v1/consultation-document-requests/'+key).json()
    assert receipt['document']['artifact_status']=='pending'
    record_id=receipt['document']['id']
    context.actor=context.patient_user
    assert context.client.get('/api/v1/files/'+record_id).status_code==503
    context.actor=context.doctor_user
    withdraw(db,context.patient,'health_data_processing');db.commit()
    repeat=post(context,kind,key);assert repeat.status_code==200,repeat.text
    assert repeat.json()['id']==record_id and repeat.json()['artifact_status']=='ready'
    assert len(context.objects)==1 and len(context.rendered)==1 and context.writes[0]==context.writes[1]
    assert db.query(ClinicalDocumentRequest).count()==1


def test_request_key_cannot_change_body_kind_or_owner(context,db):
    key=str(uuid4());first=post(context,'prescription',key);assert first.status_code==200
    for kind,body in [('prescription',dict(BODIES['prescription'],instructions='changed')),('referral',BODIES['referral'])]:
        response=post(context,kind,key,body);assert response.status_code==409,response.text
        assert response.json()['detail']['request_key_committed'] is True
    context.actor=context.outsider
    absent=context.client.get('/api/v1/consultation-document-requests/'+key)
    assert absent.status_code==404 and absent.json()['detail']['request_in_flight_may_commit'] is True
    assert len(context.writes)==1


def test_record_and_receipt_commit_atomically_before_any_storage(context,db):
    def reject(mapper,connection,target):raise RuntimeError('synthetic insert failure')
    event.listen(ClinicalDocumentRequest,'before_insert',reject)
    key=str(uuid4())
    try:response=post(context,'prescription',key)
    finally:event.remove(ClinicalDocumentRequest,'before_insert',reject)
    assert response.status_code==503,response.text
    assert db.query(Prescription).count()==db.query(ClinicalDocumentRequest).count()==0
    assert not context.writes
    repeat=post(context,'prescription',key);assert repeat.status_code==200,repeat.text


def test_renderer_never_persists_plain_text_as_pdf(context,db,monkeypatch):
    monkeypatch.setattr(prescriptions,'generate_prescription_pdf',lambda **kw:b'This is not a PDF')
    response=post(context,'prescription');assert response.status_code==503
    assert db.query(Prescription).count()==db.query(ClinicalDocumentRequest).count()==0
    assert not context.writes


def test_request_and_original_clinical_content_cannot_be_rewritten(context,db):
    response=post(context,'prescription');assert response.status_code==200,response.text
    row=db.query(ClinicalDocumentRequest).one();record=db.get(Prescription,row.prescription_id)
    for sql,params in [
        ('UPDATE clinical_document_requests SET request_json=:value WHERE id=:id',{'value':'{}','id':row.id}),
        ('DELETE FROM clinical_document_requests WHERE id=:id',{'id':row.id}),
        ('UPDATE prescriptions SET instructions=:value WHERE id=:id',{'value':'replacement','id':record.id}),
        ('UPDATE prescriptions SET file_storage_key=:value WHERE id=:id',{'value':'health/other.pdf','id':record.id}),
        ('DELETE FROM prescriptions WHERE id=:id',{'id':record.id}),
        ('UPDATE doctors SET user_id=:value WHERE id=:id',{'value':context.outsider.id,'id':context.doctor.id}),
    ]:
        with pytest.raises(Exception):db.execute(text(sql),params);db.commit()
        db.rollback()
    assert db.get(Prescription,record.id).instructions=='Texto de teste'


def test_document_inputs_are_bounded_and_uuid_required(context,db):
    path=f'/api/v1/consultations/{context.consultation.id}/prescription'
    assert context.client.post(path,json=BODIES['prescription']).status_code==422
    assert post(context,'prescription','invalid').status_code==422
    assert post(context,'prescription',body={'medications':[]}).status_code==422
    assert post(context,'prescription',body={'medications':[{'name':'   ','dosage':'d','frequency':'f'}]}).status_code==422
    assert post(context,'prescription',body=dict(BODIES['prescription'],instructions='a'*4001)).status_code==422
    assert not context.writes


def test_document_migration_preserves_nonempty_evidence(context,db):
    response=post(context,'prescription');assert response.status_code==200,response.text
    path=Path(__file__).resolve().parents[1]/'alembic/versions/clinical_document_requests_v1.py'
    spec=importlib.util.spec_from_file_location('document_migration',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    with db.bind.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            module.upgrade()
            with pytest.raises(RuntimeError,match='Retained clinical'):module.downgrade()


def test_long_pdf_wraps_all_escaped_content_and_paginates():
    from app.services.pdf_generator import generate_prescription_pdf,generate_referral_pdf
    from pypdf import PdfReader
    common={'patient_name':'Paciente Sintético <b>literal</b>','patient_dob':'1980-01-01','doctor_name':'Médica Sintética','doctor_license':'TEST-ONLY'}
    meds=[{'name':f'Medicamento sintético {index}','dosage':'Texto sintético sem recomendação','frequency':'Apenas dados de teste','notes':('observação detalhada '*40)+f'END-MED-{index}'} for index in range(25)]
    rx=PdfReader(io.BytesIO(generate_prescription_pdf(**common,medications=meds,instructions=('instrução longa '*200)+'END-INSTRUCTIONS')))
    ref=PdfReader(io.BytesIO(generate_referral_pdf(**common,destination='Clínica sintética',specialty='Teste',urgency='routine',reason=('motivo sintético '*200)+'END-REASON')))
    for reader,ending in ((rx,'END-INSTRUCTIONS'),(ref,'END-REASON')):
        assert len(reader.pages)>1
        alltext='\n'.join(page.extract_text() for page in reader.pages)
        assert ending in alltext and '<b>literal</b>' in alltext and 'Assinatura e envio externo não validados' in alltext
        assert all('Página '+str(i+1) in page.extract_text() for i,page in enumerate(reader.pages))
    text_rx='\n'.join(page.extract_text() for page in rx.pages)
    assert all(f'END-MED-{i}' in text_rx for i in range(25))


def test_doctor_slug_replace_cannot_discard_document_author(context,db):
    assert post(context,'prescription').status_code==200
    context.doctor.slug='retained-author';db.commit()
    with pytest.raises(Exception):
        db.execute(Doctor.__table__.insert().prefix_with('OR REPLACE').values(id=str(uuid4()),user_id=context.outsider.id,slug='retained-author'))
        db.commit()
    db.rollback()
    assert db.get(Doctor,context.doctor.id).user_id==context.doctor_user.id


@pytest.mark.parametrize('stored',['missing','changed'])
def test_corrupt_or_missing_provider_object_is_never_signed(context,db,stored):
    key=str(uuid4());first=post(context,'prescription',key);assert first.status_code==200
    row=db.query(ClinicalDocumentRequest).one()
    if stored=='missing':context.objects.clear()
    else:context.objects[row.storage_key]=b'%PDF-1.7 changed'
    context.actor=context.patient_user
    response=context.client.get('/api/v1/files/'+first.json()['id'])
    assert response.status_code==(503 if stored=='missing' else 409),response.text
    assert response.headers['cache-control']=='private, no-store'
    assert 'download_url' not in response.json()
    context.actor=context.doctor_user
    replay=post(context,'prescription',key)
    assert replay.status_code==response.status_code
    assert len(context.writes)==1
