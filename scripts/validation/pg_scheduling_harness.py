import os, pathlib, socket, sys, json
root = pathlib.Path(os.environ['KAYA_PG_VALIDATION']).resolve()
assert pathlib.Path.cwd().resolve() == root/'source/backend'
assert not pathlib.Path('.env').exists()
assert os.environ['ENV'] == 'test'
def blocked(*args, **kwargs): raise RuntimeError('SYNTHETIC_NETWORK_DENIED')
socket.create_connection = blocked
socket.getaddrinfo = blocked
socket.gethostbyname = blocked
socket.gethostbyname_ex = blocked
socket.gethostbyaddr = blocked
socket.socket.connect = blocked
socket.socket.connect_ex = blocked
socket.socket.sendto = blocked
if hasattr(socket.socket, 'sendmsg'): socket.socket.sendmsg = blocked
from app import database
from sqlalchemy import text
database.init_db_engine()
with database.engine.connect() as conn:
    print(json.dumps({'database': conn.execute(text('SELECT current_database()')).scalar(), 'version': conn.execute(text('SELECT version()')).scalar(), 'listen_addresses': conn.execute(text('SHOW listen_addresses')).scalar(), 'transaction_isolation': conn.execute(text('SHOW transaction_isolation')).scalar()}), flush=True)
print('BASE SCHEMA READY', flush=True)
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from threading import Barrier, Lock, Event
from uuid import uuid4
from zoneinfo import ZoneInfo
import time, traceback
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session
from app.models import User
from app.health_models import (Patient, Doctor, ClinicianCredential, PatientConsent, MfaCredential,
                              AppointmentSlot, Consultation, ConsultationNotes, ConsultationAmendment,
                              ClinicalCareTask, HealthAuditLog, Notification)
from app.oauth2 import create_access_token
from app.routers import appointments, consultations, notifications
from app.services.consultation_lifecycle import transition
from app.services.mfa import generate_secret

application = FastAPI()
application.include_router(appointments.router)
application.include_router(consultations.router)
application.include_router(notifications.router)
client = TestClient(application)
engine = database.engine
assert engine.dialect.name == 'postgresql'


def person(role):
    with Session(engine, expire_on_commit=False) as session:
        user = User(email=f'pg-synthetic-{uuid4().hex}@example.invalid', role=role,
                    password_hash='unused-synthetic-password', is_active=True)
        session.add(user); session.flush()
        if role == 'patient':
            profile = Patient(user_id=user.id)
            session.add(profile); session.flush()
            for kind in ('privacy_policy', 'telemedicine_consent', 'terms_of_service'):
                session.add(PatientConsent(patient_id=profile.id, consent_type=kind))
        else:
            profile = Doctor(user_id=user.id, license_number=f'TEST-{uuid4().hex}', specialization='clinica_geral', verification_status='verified')
            session.add(profile)
            session.add(ClinicianCredential(user_id=user.id, profession='doctor', legal_name='Synthetic PostgreSQL clinician',
                 practice_country='AO', licence_country='AO', issuing_authority='Synthetic', licence_number=f'TEST-{uuid4().hex}',
                 diploma_country='AO', diploma_institution='Synthetic', degree_title='Synthetic', status='verified'))
            session.add(MfaCredential(user_id=user.id, secret=generate_secret(), enabled=True))
        session.commit()
        token = create_access_token({'sub': user.email, 'uid': user.id, 'role': role, 'mfa_verified': True})
        return {'uid': user.id, 'id': profile.id, 'headers': {'Authorization': 'Bearer '+token}}


def people():
    return {name: person(role) for name, role in [('p1','patient'),('p2','patient'),('d1','doctor'),('d2','doctor')]}


def publish(doctor, start=None):
    start = start or (datetime.now(ZoneInfo('Africa/Luanda')) + timedelta(days=2)).replace(second=0, microsecond=0)
    response = client.post('/api/v1/doctor/appointment-slots', headers=doctor['headers'], json={
        'country':'AO','timezone':'Africa/Luanda','starts_at':start.isoformat(),'ends_at':(start+timedelta(minutes=30)).isoformat()})
    assert response.status_code == 201, (response.status_code,response.text)
    return response.json()


def book(patient, slot=None, key=None):
    payload={'country':'AO','specialty':'clinica_geral'}
    payload.update({'slot_id':slot['id']} if slot else {'next_available':True})
    return client.post('/api/v1/consultations/book', headers=patient['headers']|{'Idempotency-Key':key or str(uuid4())},json=payload)


def accept(doctor, consultation_id):
    return client.post(f'/api/v1/doctor/queue/{consultation_id}/accept',headers=doctor['headers'])


def cancel(patient, consultation_id):
    return client.patch(f'/api/v1/consultations/{consultation_id}',headers=patient['headers'],json={})


def together(calls, table='doctors', sql_prefix=None):
    """Hold both transactions immediately before their first capacity lock."""
    gate=Barrier(len(calls), timeout=8)
    seen=set(); mutex=Lock(); matched=[]
    def before(conn,cursor,statement,parameters,context,executemany):
        if not statement.lower().startswith(sql_prefix or f'update {table} set'): return
        identity=id(conn)
        with mutex:
            if identity in seen: return
            seen.add(identity); matched.append(identity)
        gate.wait()
    event.listen(engine,'before_cursor_execute',before)
    try:
        with ThreadPoolExecutor(max_workers=len(calls)) as pool:
            results=[future.result(timeout=25) for future in [pool.submit(call) for call in calls]]
        assert len(matched)==len(calls), ('barrier not exercised',matched)
        return results
    finally:
        event.remove(engine,'before_cursor_execute',before)


def statuses(results,expected=(200,409)):
    actual=sorted(response.status_code for response in results)
    assert actual==list(expected), [(r.status_code,r.text) for r in results]
    return actual


def same_slot():
    outcomes=[]
    for _ in range(5):
        p=people(); slot=publish(p['d1'])
        results=together([lambda:book(p['p1'],slot),lambda:book(p['p2'],slot)])
        outcomes.append(statuses(results))
        winner=next(r.json()['id'] for r in results if r.status_code==200)
        with Session(engine) as db:
            assert db.query(Consultation).filter_by(slot_id=slot['id']).count()==1
            assert db.get(AppointmentSlot,slot['id']).reserved_consultation_id==winner
    return {'forced_races':len(outcomes),'statuses':outcomes,'one_consultation_and_claim_per_race':True}


def same_patient_different_doctors():
    outcomes=[]
    for _ in range(5):
        p=people(); slot1=publish(p['d1']); slot2=publish(p['d2'])
        results=together([lambda:book(p['p1'],slot1),lambda:book(p['p1'],slot2)],table='patients')
        outcomes.append(statuses(results))
        with Session(engine) as db:
            assert db.query(Consultation).filter_by(patient_id=p['p1']['id']).count()==1
            assert sum(db.get(AppointmentSlot,s['id']).reserved_consultation_id is not None for s in [slot1,slot2])==1
    return {'forced_races':len(outcomes),'statuses':outcomes,'one_patient_reservation_per_race':True}


def immediate_accept_same_doctor():
    outcomes=[]
    for _ in range(5):
        p=people(); one=book(p['p1']).json(); two=book(p['p2']).json()
        results=together([lambda:accept(p['d1'],one['id']),lambda:accept(p['d1'],two['id'])])
        outcomes.append(statuses(results))
        with Session(engine) as db:
            assert db.query(Consultation).filter_by(doctor_id=p['d1']['id'],status='in_progress').count()==1
    return {'forced_races':len(outcomes),'statuses':outcomes,'one_active_patient_per_doctor':True}


def immediate_accept_same_patient():
    outcomes=[]
    for _ in range(5):
        p=people(); item=book(p['p1']).json()
        results=together([lambda:accept(p['d1'],item['id']),lambda:accept(p['d2'],item['id'])],table='patients')
        outcomes.append(statuses(results))
        with Session(engine) as db:
            row=db.get(Consultation,item['id'])
            assert row.status=='in_progress' and row.doctor_id in [p['d1']['id'],p['d2']['id']]
            assert db.query(HealthAuditLog).filter_by(resource_id=row.id,action='consultation_accepted').count()==1
    return {'forced_races':len(outcomes),'statuses':outcomes,'one_owner_and_acceptance_audit':True}


def exact_retry():
    outcomes=[]
    for _ in range(5):
        p=people(); slot=publish(p['d1']); key=str(uuid4())
        results=together([lambda:book(p['p1'],slot,key),lambda:book(p['p1'],slot,key)])
        outcomes.append(statuses(results,(200,200)))
        ids={r.json()['id'] for r in results}
        assert len(ids)==1
        replay=book(p['p1'],slot,key)
        assert replay.status_code==200 and replay.json()['id'] in ids
        with Session(engine) as db:
            assert db.query(Consultation).filter_by(patient_id=p['p1']['id'],booking_request_key=key).count()==1
            assert db.query(HealthAuditLog).filter_by(resource_id=next(iter(ids)),action='consultation_booked').count()==1
    return {'forced_races':len(outcomes),'statuses':outcomes,'exact_replay_single_record_and_audit':True}


def cancellation_rebooking_stale_write():
    outcomes=[]
    for _ in range(5):
        p=people(); slot=publish(p['d1']); key=str(uuid4()); first=book(p['p1'],slot,key).json()
        with Session(engine) as stale:
            old=stale.get(Consultation,first['id'])
            results=together([lambda:cancel(p['p1'],first['id']),lambda:book(p['p2'],slot)])
            assert results[0].status_code==200,(results[0].status_code,results[0].text)
            assert results[1].status_code in (200,409),(results[1].status_code,results[1].text)
            outcomes.append([r.status_code for r in results])
            replacement=results[1] if results[1].status_code==200 else book(p['p2'],slot)
            assert replacement.status_code==200,(replacement.status_code,replacement.text)
            replay=book(p['p1'],slot,key)
            assert replay.status_code==200 and replay.json()['status']=='cancelled'
            try:
                transition(stale,old,actor_id=p['p1']['uid'],action='consultation_cancelled',allowed_from=('requested',),status='cancelled')
            except HTTPException as error:
                assert error.status_code==409
            else: raise AssertionError('stale cancellation unexpectedly succeeded')
        with Session(engine) as db:
            assert db.get(AppointmentSlot,slot['id']).reserved_consultation_id==replacement.json()['id']
            assert db.get(Consultation,replacement.json()['id']).status=='requested'
    return {'forced_races':len(outcomes),'statuses':outcomes,'replacement_claim_survives_stale_cancel_and_replay':True}


def late_start_and_overrun():
    p=people(); now=datetime.utcnow()
    with Session(engine,expire_on_commit=False) as db:
        late=Consultation(patient_id=p['p1']['id'],doctor_id=p['d1']['id'],status='scheduled',country='AO',
            scheduled_at=now-timedelta(hours=2),scheduled_end_at=now-timedelta(hours=1))
        following=Consultation(patient_id=p['p2']['id'],doctor_id=p['d1']['id'],status='scheduled',country='AO',
            scheduled_at=now+timedelta(minutes=15),scheduled_end_at=now+timedelta(minutes=45))
        db.add_all([late,following]);db.commit();late_id=late.id;next_id=following.id
    response=client.post(f'/api/v1/doctor/queue/{late_id}/start',headers=p['d1']['headers'])
    assert response.status_code==409,(response.status_code,response.text)
    with Session(engine) as db:
        assert db.get(Consultation,late_id).status=='scheduled'
        row=db.get(Consultation,late_id);row.status='in_progress';row.started_at=now-timedelta(hours=2);db.commit()
    response2=client.post(f'/api/v1/doctor/queue/{next_id}/start',headers=p['d1']['headers'])
    assert response2.status_code==409,(response2.status_code,response2.text)
    return {'late_start_status':response.status_code,'overrun_status':response2.status_code,'scheduled_state_retained':True}


def current_revocation():
    p=people(); slot=publish(p['d1']); item=book(p['p1'],slot).json()
    second=publish(p['d1'],datetime.now(ZoneInfo('Africa/Luanda'))+timedelta(days=3))
    with Session(engine) as db:
        credential=db.query(ClinicianCredential).filter_by(user_id=p['d1']['uid']).one();credential.status='revoked';db.commit()
    accepted=accept(p['d1'],item['id'])
    assert accepted.status_code in (403,409),(accepted.status_code,accepted.text)
    attempted=book(p['p2'],second)
    assert attempted.status_code in (400,403,409),(attempted.status_code,attempted.text)
    listed=client.get('/api/v1/appointments/slots',headers=p['p2']['headers'])
    assert listed.status_code==200
    assert second['id'] not in {row['id'] for row in listed.json()}
    return {'accept_after_revocation':accepted.status_code,'book_after_revocation':attempted.status_code,'revoked_slots_hidden':True}


def revocation_during_acceptance_wait():
    p=people();slot=publish(p['d1']);item=book(p['p1'],slot).json()
    arrived=Event();proceed=Event()
    def pause(conn,cursor,statement,parameters,context,executemany):
        if statement.lower().startswith('update doctors set'):
            arrived.set();assert proceed.wait(8),'revocation coordinator timed out'
    event.listen(engine,'before_cursor_execute',pause)
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future=pool.submit(accept,p['d1'],item['id'])
            assert arrived.wait(8),'accept did not reach capacity lock'
            with Session(engine) as db:
                credential=db.query(ClinicianCredential).filter_by(user_id=p['d1']['uid']).one();credential.status='revoked';db.commit()
            proceed.set();response=future.result(timeout=20)
        assert response.status_code in (403,409),(response.status_code,response.text)
        with Session(engine) as db:
            assert db.get(Consultation,item['id']).status=='requested'
    finally:
        proceed.set();event.remove(engine,'before_cursor_execute',pause)
    return {'status':response.status_code,'revoked_after_auth_before_capacity_lock':True,'requested_state_retained':True}


def notification_duplicate_delivery():
    from app.services.notifications import enqueue_notification
    patient = person('patient')
    for _ in range(5):
        key = 'pg-notification:' + uuid4().hex
        audit_ids = [str(uuid4()), str(uuid4())]
        def deliver(audit_id):
            with Session(engine) as db:
                db.add(HealthAuditLog(id=audit_id, actor_user_id=patient['uid'],
                                     action='synthetic_independent_write', resource_type='synthetic'))
                row = enqueue_notification(db, user_id=patient['uid'], event_key=key,
                                           title='Synthetic update', message='Synthetic inbox update')
                identifier = row.id
                db.commit()
                return identifier
        ids = together([lambda: deliver(audit_ids[0]), lambda: deliver(audit_ids[1])],
                       sql_prefix='insert into notifications')
        assert ids[0] == ids[1]
        with Session(engine) as db:
            assert db.query(Notification).filter_by(user_id=patient['uid'], event_key=key).count() == 1
            assert db.query(HealthAuditLog).filter(HealthAuditLog.id.in_(audit_ids)).count() == 2
    return {'forced_races': 5, 'single_event_without_rolling_back_other_transaction_work': True}


def notification_concurrent_read():
    from app.services.notifications import enqueue_notification
    patient = person('patient')
    for _ in range(5):
        with Session(engine) as db:
            row = enqueue_notification(db, user_id=patient['uid'], event_key='pg-read:' + uuid4().hex,
                                       title='Synthetic update', message='Synthetic inbox update')
            identifier = row.id
            db.commit()
        def mark():
            return client.patch(f'/api/v1/notifications/{identifier}/read', headers=patient['headers'])
        responses = together([mark, mark], table='notifications')
        assert all(response.status_code == 200 for response in responses)
        assert responses[0].json()['read_at'] == responses[1].json()['read_at']
        with Session(engine) as db:
            assert db.query(HealthAuditLog).filter_by(resource_id=identifier, action='notification_marked_read').count() == 1
            assert db.get(Notification, identifier).is_read is True
    return {'forced_races': 5, 'first_read_timestamp_and_single_audit_preserved': True}


def closed_episode(follow_up=False):
    p = people()
    booked = book(p['p1'])
    assert booked.status_code == 200, booked.text
    identifier = booked.json()['id']
    assert accept(p['d1'], identifier).status_code == 200
    closeout = {
        'assessment': 'Synthetic assessment', 'plan': 'Synthetic plan',
        'patient_summary': 'Synthetic original summary', 'outcome': 'follow_up' if follow_up else 'resolved',
        'follow_up_required': follow_up}
    if follow_up:
        closeout.update(follow_up_instructions='Synthetic retained follow-up', follow_up_due_at='2099-01-01T10:00:00Z')
    closed = client.post(f'/api/v1/consultations/{identifier}/complete', headers=p['d1']['headers'], json=closeout)
    assert closed.status_code == 200, closed.text
    view = client.get(f'/api/v1/consultations/{identifier}/closeout', headers=p['d1']['headers'])
    assert view.status_code == 200, view.text
    body = {'expected_digest': view.json()['closeout']['current_digest'], 'reason': 'Synthetic private correction',
            'publish_to_patient': True, 'subjective': 'Synthetic revised history', 'objective': None,
            'assessment': 'Synthetic revised assessment', 'plan': 'Synthetic revised plan',
            'patient_summary': 'Synthetic revised summary'}
    return p, identifier, body


def correct(doctor, identifier, body, key):
    return client.post(f'/api/v1/consultations/{identifier}/closeout/amendments', json=body,
                       headers=doctor['headers'] | {'Idempotency-Key': key})


def amendment_competing_writes():
    outcomes = []
    for _ in range(5):
        p, identifier, body = closed_episode()
        responses = together([lambda: correct(p['d1'], identifier, body, str(uuid4())),
                              lambda: correct(p['d1'], identifier, body | {'plan': 'Other synthetic correction'}, str(uuid4()))])
        outcomes.append(statuses(responses))
        with Session(engine) as db:
            note = db.query(ConsultationNotes).filter_by(consultation_id=identifier).one()
            assert db.query(ConsultationAmendment).filter_by(note_id=note.id).count() == 1
            assert db.query(HealthAuditLog).filter_by(resource_id=identifier, action='consultation_amended').count() == 1
        rejected = next(response for response in responses if response.status_code == 409)
        assert rejected.json()['detail']['code'] == 'amendment_stale_head'
    return {'forced_races': 5, 'statuses': outcomes, 'single_verified_chain_and_audit': True}


def amendment_exact_retry():
    outcomes = []
    for _ in range(5):
        p, identifier, body = closed_episode()
        key = str(uuid4())
        responses = together([lambda: correct(p['d1'], identifier, body, key),
                              lambda: correct(p['d1'], identifier, body, key)])
        outcomes.append(statuses(responses, (200, 200)))
        assert responses[0].json() == responses[1].json()
        amendment_id = responses[0].json()['closeout']['amendments'][0]['id']
        with Session(engine) as db:
            row = db.get(ConsultationAmendment, amendment_id)
            assert db.query(ConsultationAmendment).filter_by(note_id=row.note_id).count() == 1
            assert db.query(HealthAuditLog).filter_by(resource_id=identifier, action='consultation_amended').count() == 1
            assert db.query(Notification).filter_by(event_key=f'amendment:{amendment_id}:created').count() == 2
    return {'forced_races': 5, 'statuses': outcomes, 'same_correction_one_audit_and_notice_per_recipient': True}


def clinical_record_retention():
    from sqlalchemy import delete, update
    from sqlalchemy.exc import IntegrityError
    p, identifier, body = closed_episode(follow_up=True)
    response = correct(p['d1'], identifier, body, str(uuid4()))
    assert response.status_code == 200, response.text
    amendment_id = response.json()['closeout']['amendments'][0]['id']
    with Session(engine) as db:
        note = db.query(ConsultationNotes).filter_by(consultation_id=identifier).one()
        note_id, original_digest, task_id = note.id, note.finalization_digest, note.follow_up_task_id
        assert task_id is not None
    statements = [
        delete(ConsultationNotes).where(ConsultationNotes.id == note_id),
        update(ConsultationNotes).where(ConsultationNotes.id == note_id).values(patient_summary='unauthorized rewrite'),
        delete(ConsultationAmendment).where(ConsultationAmendment.id == amendment_id),
        update(ConsultationAmendment).where(ConsultationAmendment.id == amendment_id).values(reason='unauthorized rewrite'),
        delete(Consultation).where(Consultation.id == identifier),
        update(Consultation).where(Consultation.id == identifier).values(country='PT'),
        delete(Patient).where(Patient.id == p['p1']['id']),
        delete(Doctor).where(Doctor.id == p['d1']['id']),
        delete(User).where(User.id == p['p1']['uid']),
        delete(ClinicalCareTask).where(ClinicalCareTask.id == task_id),
        update(ClinicalCareTask).where(ClinicalCareTask.id == task_id).values(patient_id=p['p2']['id']),
        update(ClinicalCareTask).where(ClinicalCareTask.id == task_id).values(consultation_id=str(uuid4())),
        update(ClinicalCareTask).where(ClinicalCareTask.id == task_id).values(id=str(uuid4())),
    ]
    for statement in statements:
        with Session(engine) as db:
            try:
                db.execute(statement); db.commit()
            except IntegrityError:
                db.rollback()
            else:
                raise AssertionError('SQL retention guard did not reject mutation')
    with Session(engine) as db:
        db.delete(db.get(Consultation, identifier))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
        else:
            raise AssertionError('ORM parent deletion escaped retention')
        assert db.get(ConsultationNotes, note_id).finalization_digest == original_digest
        assert db.get(ConsultationAmendment, amendment_id) is not None
        db.execute(update(ClinicalCareTask).where(ClinicalCareTask.id == task_id).values(
            status='completed', due_at=datetime(2099, 1, 2), assigned_user_id=p['d2']['uid'],
            completed_by_user_id=p['d2']['uid'], completed_at=datetime.utcnow()))
        db.commit()
    read = client.get(f'/api/v1/consultations/{identifier}/closeout', headers=p['p1']['headers'])
    assert read.status_code == 200 and read.json()['closeout']['published_revision'] == 1, read.text
    return {'rejected_sql_mutations': len(statements), 'rejected_orm_parent_delete': True,
            'original_digest_history_and_patient_read_preserved': True, 'follow_up_operational_updates_allowed': True}


def clinical_amendment_migration():
    import importlib.util
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    spec = importlib.util.spec_from_file_location('pg_amendment_migration', pathlib.Path('alembic/versions/clinical_amendments_v1.py'))
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    schema = 'synthetic_amendment_' + uuid4().hex
    with engine.begin() as conn:
        conn.exec_driver_sql(f'CREATE SCHEMA {schema}')
        conn.exec_driver_sql(f'SET LOCAL search_path TO {schema}')
        conn.exec_driver_sql('CREATE TABLE users (id VARCHAR(36) PRIMARY KEY, email TEXT UNIQUE)')
        conn.exec_driver_sql('CREATE TABLE patients (id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36))')
        conn.exec_driver_sql('CREATE TABLE doctors (id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36), slug VARCHAR(120) UNIQUE)')
        conn.exec_driver_sql('CREATE TABLE consultations (id VARCHAR(36) PRIMARY KEY, patient_id VARCHAR(36), doctor_id VARCHAR(36), country VARCHAR(2), timezone VARCHAR(50), status VARCHAR(20), booking_request_key VARCHAR(36))')
        conn.exec_driver_sql('CREATE TABLE consultation_notes (id VARCHAR(36) PRIMARY KEY, consultation_id VARCHAR(36), doctor_id VARCHAR(36), finalized_at TIMESTAMP, finalized_by_user_id VARCHAR(36), finalization_digest VARCHAR(64), patient_summary TEXT)')
        conn.execute(text("INSERT INTO consultation_notes(id, finalized_at, finalization_digest, patient_summary) VALUES ('historical', '2026-01-01', :digest, 'retained original')"), {'digest': 'a' * 64})
        with Operations.context(MigrationContext.configure(conn)):
            module.upgrade(); module.upgrade()
            assert conn.execute(text("SELECT patient_summary FROM consultation_notes WHERE id='historical'")).scalar() == 'retained original'
            try:
                module.downgrade()
            except RuntimeError as error:
                assert 'Finalized clinical records' in str(error)
            else:
                raise AssertionError('Migration downgrade removed clinical retention')
        conn.exec_driver_sql('SET LOCAL search_path TO public')
        conn.exec_driver_sql(f'DROP SCHEMA {schema} CASCADE')
    return {'upgrade_adoption_preserved_original': True, 'destructive_downgrade_refused': True}


cases={}
for name,fn in [('same_slot_reservation',same_slot),('overlapping_patient_different_doctors',same_patient_different_doctors),
                ('immediate_acceptance_same_doctor',immediate_accept_same_doctor),('immediate_acceptance_competing_doctors',immediate_accept_same_patient),
                ('concurrent_exact_idempotent_retry',exact_retry),('cancellation_rebooking_stale_write',cancellation_rebooking_stale_write),
                ('late_start_and_overrun',late_start_and_overrun),('current_revocation',current_revocation),('revocation_during_acceptance_wait',revocation_during_acceptance_wait),
                ('notification_duplicate_delivery', notification_duplicate_delivery), ('notification_concurrent_read', notification_concurrent_read),
                ('amendment_competing_writes', amendment_competing_writes), ('amendment_exact_retry', amendment_exact_retry),
                ('clinical_record_retention', clinical_record_retention), ('clinical_amendment_migration', clinical_amendment_migration)]:
    started=time.monotonic()
    try:
        result=fn();cases[name]={'passed':True,'seconds':round(time.monotonic()-started,3),**result}
    except Exception:
        cases[name]={'passed':False,'traceback':traceback.format_exc()}
    print(json.dumps({name:cases[name]}),flush=True)
with engine.connect() as conn:
    meta={name:conn.execute(text(query)).scalar() for name,query in [('version','SELECT version()'),('database','SELECT current_database()'),('listen_addresses','SHOW listen_addresses'),('isolation','SHOW transaction_isolation')]}
report={'metadata':meta,'cases':cases,'passed':sum(case['passed'] for case in cases.values()),'total':len(cases),'forced_races':sum(case.get('forced_races',0) for case in cases.values())}
(root/'report.json').write_text(json.dumps(report,indent=2))
client.close();engine.dispose()
print(json.dumps({'summary':{key:value for key,value in report.items() if key!='cases'}}),flush=True)
raise SystemExit(0 if report['passed']==report['total'] else 1)
