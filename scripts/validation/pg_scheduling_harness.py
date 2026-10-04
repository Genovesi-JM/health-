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
                              AppointmentSlot, Consultation, HealthAuditLog, Notification)
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


cases={}
for name,fn in [('same_slot_reservation',same_slot),('overlapping_patient_different_doctors',same_patient_different_doctors),
                ('immediate_acceptance_same_doctor',immediate_accept_same_doctor),('immediate_acceptance_competing_doctors',immediate_accept_same_patient),
                ('concurrent_exact_idempotent_retry',exact_retry),('cancellation_rebooking_stale_write',cancellation_rebooking_stale_write),
                ('late_start_and_overrun',late_start_and_overrun),('current_revocation',current_revocation),('revocation_during_acceptance_wait',revocation_during_acceptance_wait),
                ('notification_duplicate_delivery', notification_duplicate_delivery), ('notification_concurrent_read', notification_concurrent_read)]:
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
