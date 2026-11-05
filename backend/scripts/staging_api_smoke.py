"""Synthetic API journey inside one rolled-back PostgreSQL transaction.

No HTTP listener, email, external provider, persistent consent approval, or
clinical launch. Azure mode accepts only the restricted Kaya staging role.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timedelta
import hashlib
import json
import os
from pathlib import Path
import sys
from uuid import uuid4
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def run(local=False):
    os.environ.update(ENV='test', KAYA_MANAGED_SCHEMA='true', KAYA_DISABLE_RATE_LIMIT='1')
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import make_url
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import NullPool
    from app import database
    from app.staging_schema import fingerprint, schema_status
    from app.config import settings
    url = make_url(os.environ['DATABASE_URL'])
    if local:
        if url.host not in ('127.0.0.1', 'localhost') or not url.database.startswith('kaya_test_'):
            raise RuntimeError('Invalid disposable local test target')
    elif (url.host, url.database, url.username) != (
            'pg-kaya-stage-iloie6.postgres.database.azure.com', 'kaya', 'kaya_stage_app'):
        raise RuntimeError('Invalid restricted Azure staging target')
    engine = create_engine(url, poolclass=NullPool, hide_parameters=True, connect_args={'connect_timeout': 12})
    database.engine = engine
    database.DATABASE_URL = settings.database_url
    step = 'preflight'
    with engine.connect() as connection:
        assert schema_status(connection)['ready'], 'schema_not_ready'
        before = fingerprint(connection)
        connection.rollback()
        transaction = connection.begin()
        database.SessionLocal = sessionmaker(bind=connection, expire_on_commit=False,
                                             join_transaction_mode='create_savepoint')
        try:
            from fastapi import FastAPI
            from fastapi.testclient import TestClient
            from app.routers import auth, onboarding, appointments, consultations, patients, doctor_portal
            from app.models import User
            from app.health_models import (Patient, Doctor, ClinicianCredential, MfaCredential,
                                           ConsentCatalogDocument, Consultation, HealthAuditLog)
            from app.services import consent_runtime
            from app.services.mfa import generate_secret
            from app.oauth2 import create_access_token
            from app import mail
            def blocked(*args, **kwargs):
                raise RuntimeError('External delivery forbidden in synthetic acceptance')
            mail._send_email = blocked
            application = FastAPI()
            for router in (auth, onboarding, appointments, consultations, patients, doctor_portal):
                application.include_router(router.router)
            marker = 'kaya-smoke-' + uuid4().hex
            with TestClient(application) as client:
                def request(method, path, status, **kwargs):
                    response = client.request(method, path, **kwargs)
                    if response.status_code != status:
                        print('KAYA_API_STATUS='+json.dumps(dict(step=step,method=method,expected=status,actual=response.status_code)),flush=True)
                        raise RuntimeError('Unexpected API status')
                    return response.json()
                def register(suffix):
                    email = f'{marker}-{suffix}@example.com'
                    result = request('POST', '/auth/register', 201, json={
                        'email': email, 'password': 'Synthetic-long-pass-2026!', 'full_name': 'Synthetic Test Only',
                        'sector_focus': 'health', 'role': 'patient'})
                    return email, {'Authorization': 'Bearer ' + result['access_token']}
                step = 'registration_login'
                email, headers = register('patient')
                _, other = register('other')
                login = request('POST', '/auth/login', 200, json={'email': email, 'password': 'Synthetic-long-pass-2026!'})
                assert login['access_token']
                request('GET', '/api/v1/consultations/me', 403)
                step = 'synthetic_consent_and_clinician_setup'
                with database.SessionLocal() as session:
                    # A non-empty real catalog needs a separately isolated test DB.
                    assert session.query(ConsentCatalogDocument).count() == 0, 'catalog_is_not_disposable'
                    refs = []
                    for purpose in consent_runtime.REQUIRED_PURPOSES:
                        content = f'SYNTHETIC ROLLBACK TEST ONLY; no legal approval. {marker}/{purpose}'
                        row = ConsentCatalogDocument(document_key=f'AO:pt:{purpose}', version=1,
                            country='AO', language='pt', purpose=purpose, kind='clinical_informed_consent',
                            required=True, title='Synthetic rollback fixture', content=content,
                            content_hash=hashlib.sha256(content.encode()).hexdigest(), status='approved',
                            approved_source='synthetic-fixture://rollback-only', effective_from=datetime.utcnow()-timedelta(days=1))
                        session.add(row); session.flush()
                        refs.append(dict(document_id=row.id, version=1, content_hash=row.content_hash, country='AO', language='pt'))
                    user = User(email=marker+'-doctor@example.com', role='doctor', password_hash='unused-synthetic', is_active=True)
                    session.add(user); session.flush()
                    doctor = Doctor(user_id=user.id, license_number='SYNTHETIC-'+marker,
                                    specialization='clinica_geral', verification_status='verified')
                    session.add(doctor)
                    session.add(ClinicianCredential(user_id=user.id, profession='doctor', legal_name='Synthetic clinician',
                        practice_country='AO', licence_country='AO', issuing_authority='Synthetic only',
                        licence_number='SYNTHETIC-'+marker, diploma_country='AO', diploma_institution='Synthetic',
                        degree_title='Synthetic', status='verified'))
                    session.add(MfaCredential(user_id=user.id, secret=generate_secret(), enabled=True))
                    session.commit()
                    clinician = {'Authorization': 'Bearer ' + create_access_token({'sub':user.email,'uid':user.id,'role':'doctor','mfa_verified':True})}
                step = 'onboarding'
                payload = {
                    '1': {'language':'pt','channel':'email'},
                    '2': {'email':email,'phone':'+244900000111'},
                    '3': {'full_name':'Synthetic Test Only','dob':'1990-05-20','sex':'female'},
                    '4': {'country':'AO','city':'Luanda'},
                    '5': {'blood_type':'O+','allergies':'','chronic':'','medications':'','surgeries':''},
                    '6': {'ec_name':'Synthetic Contact','ec_phone':'+244900000222','ec_consent':True},
                    '7': {'catalog_country':'AO','catalog_language':'pt','consent_expected_revision':0,'consent_acceptances':refs},
                    '8': {},
                }
                request('POST','/api/v1/onboarding/start',200,headers=headers,json={'role':'patient'})
                for number in range(1,9):
                    request('PUT',f'/api/v1/onboarding/steps/{number}',200,headers=headers,json={'data':payload[str(number)],'completed':True})
                completed=request('POST','/api/v1/onboarding/submit',200,headers=headers)
                assert completed['completion_status']=='complete'
                patient=request('GET','/api/v1/patients/me',200,headers=headers)
                step='publish_book_retry_and_isolation'
                start=datetime.now(ZoneInfo('Africa/Luanda'))+timedelta(days=2)
                def publish(at):
                    return request('POST','/api/v1/doctor/appointment-slots',201,headers=clinician,json={
                        'country':'AO','timezone':'Africa/Luanda','starts_at':at.isoformat(),'ends_at':(at+timedelta(minutes=30)).isoformat()})
                slot=publish(start);second=publish(start+timedelta(hours=2));key=str(uuid4())
                body={'country':'AO','specialty':'clinica_geral','slot_id':slot['id']}
                booking=request('POST','/api/v1/consultations/book',200,headers=headers|{'Idempotency-Key':key},json=body)
                retry=request('POST','/api/v1/consultations/book',200,headers=headers|{'Idempotency-Key':key},json=body)
                assert retry['id']==booking['id']
                assert booking['id'] not in [row['id'] for row in request('GET','/api/v1/consultations/me',200,headers=other)]
                request('PATCH',f'/api/v1/consultations/{booking["id"]}',403,headers=other,json={})
                step='accept_reschedule_reload_cancel_audit'
                request('POST',f'/api/v1/doctor/queue/{booking["id"]}/accept',200,headers=clinician)
                moved=request('POST',f'/api/v1/consultations/{booking["id"]}/reschedule',200,
                    headers=headers|{'Idempotency-Key':str(uuid4())},json={'slot_id':second['id'],'expected_revision':0})
                assert moved['reschedule_revision']==1
                with database.SessionLocal() as reloaded:
                    assert reloaded.get(Consultation,booking['id']).slot_id==second['id']
                cancelled=request('PATCH',f'/api/v1/consultations/{booking["id"]}',200,headers=headers,json={})
                assert cancelled['status']=='cancelled'
                with database.SessionLocal() as audit:
                    actions={row.action for row in audit.query(HealthAuditLog).filter_by(resource_id=booking['id'])}
                    assert {'consultation_booked','consultation_accepted','consultation_rescheduled','consultation_cancelled'} <= actions
                step='complete'
        except Exception as exc:
            # Known step labels only; never echo response bodies, tokens or SQL.
            print('KAYA_API_FAILURE_STEP='+step+';type='+type(exc).__name__, flush=True)
            raise RuntimeError('Synthetic API acceptance failed') from None
        finally:
            transaction.rollback()
        assert fingerprint(connection)==before, 'rollback_changed_schema_or_row_counts'
    engine.dispose()
    return dict(passed=True, database='PostgreSQL', role='runtime', rollback_verified=True,
                scenarios=['registration','login','onboarding','consent','slot_publication','booking',
                           'retry_idempotency','patient_isolation','acceptance','rescheduling','session_reload','cancellation','audit'],
                limits=['in-process HTTP adapter; no deployed ingress or browser test',
                        'outer transaction rolled back; no restart durability claim'])


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--local',action='store_true')
    args=parser.parse_args()
    try:
        print('KAYA_API_RESULT='+json.dumps(run(args.local),sort_keys=True),flush=True)
    except Exception as exc:
        print('KAYA_API_FAILURE='+type(exc).__name__,flush=True)
        raise SystemExit(1)
