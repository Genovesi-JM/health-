"""Durable correction, patient disclosure, retry and retention regressions."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import importlib.util
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import HTTPException
from sqlalchemy import create_engine, delete, event, inspect, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import Base
from app.health_models import (
    ClinicalCareTask, ClinicianCredential, Consultation, ConsultationAmendment, ConsultationNotes,
    Doctor, HealthAuditLog, Notification, Patient, PatientConsent,
)
from app.models import User
from app.services.consultation_closeout import closeout_result, note_digest
from tests.test_consultation_closeout import complete, payload, read
from tests.test_consultation_lifecycle import api, people, seed_consultation  # noqa: F401


def finalized(api, people, db, **values):
    item = seed_consultation(db, people, "in_progress", country="AO", **values)
    assert complete(api, item, people).status_code == 200
    return item


def correction(api, item, people, **changes):
    latest = read(api, item, people, "doctor").json()["closeout"]
    return {"expected_digest": latest["current_digest"], "reason": "Private correction reason",
            "publish_to_patient": False, "subjective": "Corrected private history", "objective": None,
            "assessment": "Corrected private assessment", "plan": "Corrected private plan",
            "patient_summary": "Corrected patient summary", **changes}


def amend(api, item, people, body, *, key=None, who="doctor"):
    return api.post(f"/api/v1/consultations/{item.id}/closeout/amendments", json=body,
                    headers={**people[who]["headers"], "Idempotency-Key": key if key is not None else str(uuid4())})


def test_private_then_published_corrections_preserve_original_and_patient_boundary(api, people, db_session):
    item = finalized(api, people, db_session)
    original = db_session.query(ConsultationNotes).filter_by(consultation_id=item.id).one()
    original_digest = original.finalization_digest
    private = amend(api, item, people, correction(api, item, people))
    assert private.status_code == 200, private.text
    assert private.headers["cache-control"] == "private, no-store"
    clinical = private.json()["closeout"]
    assert clinical["current_revision"] == 1 and clinical["current_is_published"] is False
    assert clinical["original"]["notes"]["assessment"] == "Private synthetic assessment"
    patient = read(api, item, people)
    assert patient.json()["closeout"]["patient_summary"] == "Explicit patient instructions"
    assert patient.json()["closeout"]["published_revision"] == 0
    assert "Corrected" not in patient.text and "Private" not in patient.text
    published = amend(api, item, people, correction(api, item, people, publish_to_patient=True))
    assert published.status_code == 200, published.text
    patient = read(api, item, people)
    result = patient.json()["closeout"]
    assert result["patient_summary"] == "Corrected patient summary"
    assert [row["revision"] for row in result["published_history"]] == [0, 2]
    assert result["published_revision"] == 2
    assert all(row["published_at"].endswith("+00:00") for row in result["published_history"])
    for forbidden in ("current_revision", "current_digest", "original", "amendments", "notes", "reason"):
        assert forbidden not in result
    assert "private" not in patient.text.lower()
    db_session.refresh(original)
    assert original.finalization_digest == original_digest and original.patient_summary == "Explicit patient instructions"


def test_private_revision_after_publication_does_not_replace_patient_summary(api, people, db_session):
    item = finalized(api, people, db_session)
    assert amend(api, item, people, correction(api, item, people, publish_to_patient=True)).status_code == 200
    assert amend(api, item, people, correction(api, item, people, patient_summary="INTERNAL ONLY")).status_code == 200
    result = read(api, item, people)
    assert result.json()["closeout"]["published_revision"] == 1
    assert "INTERNAL ONLY" not in result.text


def test_retry_is_exact_and_stale_versions_cannot_overwrite(api, people, db_session):
    item = finalized(api, people, db_session)
    body, key = correction(api, item, people), str(uuid4())
    first = amend(api, item, people, body, key=key)
    assert first.status_code == 200
    assert amend(api, item, people, body, key=key).json() == first.json()
    assert amend(api, item, people, {**body, "reason": "different"}, key=key).status_code == 409
    stale = amend(api, item, people, body)
    assert stale.status_code == 409
    assert stale.json()["detail"]["code"] == "amendment_stale_head"
    assert stale.json()["detail"]["request_key_committed"] is False
    note = db_session.query(ConsultationNotes).filter_by(consultation_id=item.id).one()
    assert db_session.query(ConsultationAmendment).filter_by(note_id=note.id).count() == 1
    assert db_session.query(HealthAuditLog).filter_by(resource_id=item.id, action="consultation_amended").count() == 1


@pytest.mark.parametrize("same_key", [False, True])
def test_concurrent_corrections_serialize_without_duplicate_events(api, people, db_session, same_key):
    item = finalized(api, people, db_session)
    body, key = correction(api, item, people, publish_to_patient=True), str(uuid4())
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = [future.result() for future in [
            pool.submit(amend, api, item, people, body, key=key),
            pool.submit(amend, api, item, people, body, key=key if same_key else str(uuid4())),
        ]]
    assert sorted(result.status_code for result in results) == ([200, 200] if same_key else [200, 409])
    note = db_session.query(ConsultationNotes).filter_by(consultation_id=item.id).one()
    assert db_session.query(ConsultationAmendment).filter_by(note_id=note.id).count() == 1
    assert db_session.query(Notification).filter(Notification.related_entity_id == item.id,
                                               Notification.event_key.like("amendment:%")).count() == 2


@pytest.mark.parametrize("key", ["", "not-a-uuid"])
def test_malformed_retry_key_cannot_create_correction(api, people, db_session, key):
    item = finalized(api, people, db_session)
    assert amend(api, item, people, correction(api, item, people), key=key).status_code == 422


@pytest.mark.parametrize("change", [
    {"reason": " "}, {"assessment": " "}, {"plan": ""}, {"patient_summary": " "},
    {"publish_to_patient": "true"}, {"outcome": "er"}, {"follow_up_required": True},
    {"follow_up_instructions": "changed"}, {"follow_up_due_at": "2099-01-01T00:00:00Z"},
])
def test_corrections_require_explicit_content_and_cannot_rewrite_workflow(api, people, db_session, change):
    item = finalized(api, people, db_session)
    assert amend(api, item, people, correction(api, item, people, **change)).status_code == 422


@pytest.mark.parametrize("who,expected", [("patient", 403), ("other_patient", 403), ("other_doctor", 404), ("unverified", 403)])
def test_only_current_assigned_verified_doctor_can_correct(api, people, db_session, who, expected):
    item = finalized(api, people, db_session)
    assert amend(api, item, people, correction(api, item, people), who=who).status_code == expected


@pytest.mark.parametrize("mutation,expected", [("suspended", 403), ("country", 409), ("unknown_country", 409), ("consent", 409)])
def test_correction_rechecks_authority_country_and_consent(api, people, db_session, mutation, expected):
    item = seed_consultation(db_session, people, "in_progress", country=None if mutation == "unknown_country" else "AO")
    assert complete(api, item, people).status_code == 200
    body = correction(api, item, people)
    credential = db_session.query(ClinicianCredential).filter_by(user_id=people["doctor"]["user"].id).one()
    if mutation == "suspended":
        credential.status = "suspended"
    elif mutation == "country":
        credential.practice_country = "PT"
    elif mutation == "consent":
        db_session.query(PatientConsent).filter_by(patient_id=item.patient_id, consent_type="telemedicine_consent").delete()
    db_session.commit()
    assert amend(api, item, people, body).status_code == expected


def test_correction_never_duplicates_or_changes_existing_follow_up(api, people, db_session):
    item = seed_consultation(db_session, people, "in_progress", country="AO")
    assert complete(api, item, people, payload(outcome="follow_up", follow_up_required=True,
                    follow_up_instructions="Existing task instructions", follow_up_due_at="2099-01-01T10:00:00Z")).status_code == 200
    task = db_session.query(ClinicalCareTask).filter_by(consultation_id=item.id).one()
    old = (task.id, task.instructions, task.due_at, task.status)
    body, key = correction(api, item, people, publish_to_patient=True), str(uuid4())
    assert amend(api, item, people, body, key=key).status_code == 200
    assert amend(api, item, people, body, key=key).status_code == 200
    db_session.refresh(task)
    assert (task.id, task.instructions, task.due_at, task.status) == old
    assert db_session.query(ClinicalCareTask).filter_by(consultation_id=item.id).count() == 1


def test_audit_failure_rolls_back_amendment_and_notifications(api, people, db_session):
    item = finalized(api, people, db_session)
    body = correction(api, item, people, publish_to_patient=True)
    def fail(mapper, connection, target):
        if target.action == "consultation_amended":
            raise RuntimeError("synthetic audit failure")
    event.listen(HealthAuditLog, "before_insert", fail)
    try:
        assert amend(api, item, people, body).status_code == 503
    finally:
        event.remove(HealthAuditLog, "before_insert", fail)
    assert read(api, item, people, "doctor").json()["closeout"]["current_revision"] == 0
    assert not db_session.query(Notification).filter(Notification.related_entity_id == item.id,
                                                   Notification.event_key.like("amendment:%")).count()


def test_lost_commit_acknowledgement_reuses_saved_correction(api, people, db_session, monkeypatch):
    item = finalized(api, people, db_session)
    body, key = correction(api, item, people, publish_to_patient=True), str(uuid4())
    original_commit = Session.commit
    def lose_ack(session):
        original_commit(session)
        raise RuntimeError("synthetic lost acknowledgement")
    with monkeypatch.context() as patch:
        patch.setattr(Session, "commit", lose_ack)
        assert amend(api, item, people, body, key=key).status_code == 503
    result = amend(api, item, people, body, key=key)
    assert result.status_code == 200
    assert result.json()["closeout"]["current_revision"] == 1


@pytest.mark.parametrize("route", ["agenda", "clinical-summary"])
def test_clinician_summary_routes_read_the_effective_correction(api, people, db_session, route):
    from tests.test_doctor_note_integrity import read_summary
    item = finalized(api, people, db_session, scheduled_at=datetime(2026, 10, 5, 12))
    assert amend(api, item, people, correction(api, item, people)).status_code == 200
    result = read_summary(api, item, people, route)
    assert result.status_code == 200, result.text
    assert "Corrected private history" in result.text
    assert "Private synthetic history" not in result.text


def test_clinician_360_uses_verified_effective_content_and_own_record_capabilities(api, people, db_session):
    from app.routers import clinician_workspace
    api.app.include_router(clinician_workspace.router)
    item = finalized(api, people, db_session)
    assert amend(api, item, people, correction(api, item, people)).status_code == 200
    result = api.get(f"/api/v1/clinician/patients/{item.patient_id}/360", headers=people["doctor"]["headers"])
    assert result.status_code == 200, result.text
    assert "Corrected private history" in result.text
    assert "Private synthetic history" not in result.text
    row = next(row for row in result.json()["consultations"] if row["id"] == item.id)
    assert row["can_read_closeout"] is True and row["can_amend"] is True


@pytest.mark.parametrize("field,value", [("country", "PT"), ("timezone", "Europe/Lisbon"), ("status", "cancelled")])
def test_finalized_episode_jurisdiction_and_status_cannot_be_rewritten(api, people, db_session, field, value):
    item = finalized(api, people, db_session)
    with pytest.raises(IntegrityError, match="finalized_clinical_record_is_retained"):
        db_session.execute(update(Consultation).where(Consultation.id == item.id).values(**{field: value}))
    db_session.rollback()
    assert read(api, item, people).status_code == 200


@pytest.mark.parametrize("target", ["note", "amendment", "consultation", "patient", "doctor", "patient_user", "doctor_user"])
def test_sql_deletion_and_parent_cascades_cannot_remove_finalized_records(api, people, db_session, target):
    item = finalized(api, people, db_session)
    assert amend(api, item, people, correction(api, item, people)).status_code == 200
    note = db_session.query(ConsultationNotes).filter_by(consultation_id=item.id).one()
    amendment = db_session.query(ConsultationAmendment).filter_by(note_id=note.id).one()
    model, identity = {"note": (ConsultationNotes, note.id), "amendment": (ConsultationAmendment, amendment.id),
                       "consultation": (Consultation, item.id), "patient": (Patient, item.patient_id),
                       "doctor": (Doctor, item.doctor_id), "patient_user": (User, people["patient"]["user"].id),
                       "doctor_user": (User, people["doctor"]["user"].id)}[target]
    with pytest.raises(IntegrityError, match="finalized_clinical_record_is_retained"):
        db_session.execute(delete(model).where(model.id == identity))
    db_session.rollback()
    assert read(api, item, people, "doctor").json()["closeout"]["current_revision"] == 1


def test_orm_parent_delete_and_amendment_updates_are_blocked(api, people, db_session):
    item = finalized(api, people, db_session)
    response = amend(api, item, people, correction(api, item, people))
    identity = response.json()["closeout"]["amendments"][0]["id"]
    with pytest.raises(IntegrityError, match="finalized_clinical_record_is_retained"):
        db_session.execute(update(ConsultationAmendment).where(ConsultationAmendment.id == identity).values(reason="rewritten"))
    db_session.rollback()
    db_session.delete(item)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
    assert read(api, item, people).status_code == 200


@pytest.mark.parametrize("target,conflict", [
    ("note", "id"), ("note", "consultation_id"), ("amendment", "id"),
    ("amendment", "revision"), ("amendment", "request_key"),
    ("consultation", "id"), ("consultation", "booking_request_key"),
    ("patient", "id"), ("patient", "user_id"), ("doctor", "id"), ("doctor", "user_id"), ("doctor", "slug"),
    ("user", "id"), ("user", "email"),
])
def test_sqlite_replace_cannot_delete_retained_unique_identity(api, people, db_session, target, conflict):
    item = finalized(api, people, db_session, booking_request_key=str(uuid4()))
    if conflict == "slug":
        db_session.get(Doctor, item.doctor_id).slug = f"retained-{uuid4().hex}"
        db_session.commit()
    result = amend(api, item, people, correction(api, item, people))
    note = db_session.query(ConsultationNotes).filter_by(consultation_id=item.id).one()
    amendment_id = result.json()["closeout"]["amendments"][0]["id"]
    model, identity = {"note": (ConsultationNotes, note.id), "amendment": (ConsultationAmendment, amendment_id),
                       "consultation": (Consultation, item.id), "patient": (Patient, item.patient_id),
                       "doctor": (Doctor, item.doctor_id), "user": (User, people["patient"]["user"].id)}[target]
    table = model.__table__
    db_session.rollback()
    with db_session.get_bind().connect() as conn:
        assert conn.exec_driver_sql("PRAGMA recursive_triggers").scalar() == 0
        values = dict(conn.execute(select(table).where(table.c.id == identity)).mappings().one())
        if conflict != "id":
            values["id"] = str(uuid4())
        elif target == "note":
            values["consultation_id"] = str(uuid4())
        elif target in ("patient", "doctor"):
            values["user_id"] = str(uuid4())
        elif target == "user":
            values["email"] = f"replace-{uuid4().hex}@example.test"
        if target == "amendment":
            if conflict != "revision":
                values["revision"] = 99
            if conflict != "request_key":
                values["request_key"] = str(uuid4())
        if target == "consultation" and conflict == "id":
            values["booking_request_key"] = str(uuid4())
        if conflict == "slug":
            values["user_id"] = str(uuid4())
        with pytest.raises(IntegrityError, match="finalized_clinical_record_is_retained"):
            conn.execute(table.insert().prefix_with("OR REPLACE").values(**values))
        conn.rollback()
    assert read(api, item, people, "doctor").json()["closeout"]["current_revision"] == 1


@pytest.mark.parametrize("target,conflict", [
    ("note", "id"), ("note", "consultation_id"), ("consultation", "id"),
    ("consultation", "booking_request_key"), ("patient", "id"), ("patient", "user_id"),
    ("doctor", "id"), ("doctor", "user_id"), ("doctor", "slug"), ("user", "id"), ("user", "email"),
])
def test_sqlite_update_replace_from_unretained_source_cannot_remove_retained_target(api, people, db_session, target, conflict):
    item = finalized(api, people, db_session, booking_request_key=str(uuid4()))
    if conflict == "slug":
        db_session.get(Doctor, item.doctor_id).slug = f"retained-{uuid4().hex}"
        db_session.commit()
    note = db_session.query(ConsultationNotes).filter_by(consultation_id=item.id).one()
    model, identity = {"note": (ConsultationNotes, note.id), "consultation": (Consultation, item.id),
                       "patient": (Patient, item.patient_id), "doctor": (Doctor, item.doctor_id),
                       "user": (User, people["patient"]["user"].id)}[target]
    table = model.__table__
    db_session.rollback()
    with db_session.get_bind().connect() as conn:
        assert conn.exec_driver_sql("PRAGMA recursive_triggers").scalar() == 0
        original = dict(conn.execute(select(table).where(table.c.id == identity)).mappings().one())
        source = {**original, "id": str(uuid4())}
        if target == "note":
            source.update(consultation_id=str(uuid4()), finalized_at=None, finalized_by_user_id=None, finalization_digest=None)
        elif target == "consultation":
            source["booking_request_key"] = str(uuid4())
        elif target in ("patient", "doctor"):
            source["user_id"] = str(uuid4())
            if target == "doctor":
                source["slug"] = None
        else:
            source["email"] = f"source-{uuid4().hex}@example.test"
        conn.execute(table.insert().values(**source)); conn.commit()
        with pytest.raises(IntegrityError, match="finalized_clinical_record_is_retained"):
            conn.execute(update(table).prefix_with("OR REPLACE").where(table.c.id == source["id"]).values(**{conflict: original[conflict]}))
        conn.rollback()
    assert read(api, item, people).json()["closeout"]["patient_summary"] == "Explicit patient instructions"


@pytest.mark.parametrize("mutation", ["delete", "orm_delete", "id", "patient_id", "consultation_id", "insert_replace", "update_replace"])
def test_referenced_follow_up_identity_is_retained(api, people, db_session, mutation):
    item = seed_consultation(db_session, people, "in_progress", country="AO")
    assert complete(api, item, people, payload(outcome="follow_up", follow_up_required=True,
                    follow_up_instructions="Retained instructions", follow_up_due_at="2099-01-01T10:00:00Z")).status_code == 200
    task = db_session.query(ClinicalCareTask).filter_by(consultation_id=item.id).one()
    task_id = task.id
    if mutation in ("insert_replace", "update_replace"):
        table = ClinicalCareTask.__table__
        values = dict(db_session.execute(select(table).where(table.c.id == task_id)).mappings().one())
        if mutation == "update_replace":
            source_id = str(uuid4())
            db_session.execute(table.insert().values(**{**values, "id": source_id}))
            db_session.commit()
            statement = update(table).prefix_with("OR REPLACE").where(table.c.id == source_id).values(id=task_id)
        else:
            statement = table.insert().prefix_with("OR REPLACE").values(**values)
    elif mutation == "delete":
        statement = delete(ClinicalCareTask).where(ClinicalCareTask.id == task_id)
    elif mutation != "orm_delete":
        statement = update(ClinicalCareTask).where(ClinicalCareTask.id == task_id).values(**{mutation: str(uuid4())})
    with pytest.raises(IntegrityError, match="finalized_clinical_record_is_retained"):
        if mutation == "orm_delete":
            db_session.delete(task)
            db_session.commit()
        else:
            db_session.execute(statement)
    db_session.rollback()
    assert db_session.get(ClinicalCareTask, task_id) is not None
    assert read(api, item, people).status_code == 200


def test_retained_follow_up_still_allows_operational_updates(api, people, db_session):
    item = seed_consultation(db_session, people, "in_progress", country="AO")
    assert complete(api, item, people, payload(outcome="follow_up", follow_up_required=True,
                    follow_up_instructions="Retained instructions", follow_up_due_at="2099-01-01T10:00:00Z")).status_code == 200
    task = db_session.query(ClinicalCareTask).filter_by(consultation_id=item.id).one()
    task.status = "completed"
    task.due_at = datetime(2099, 1, 2, 10)
    task.assigned_user_id = people["other_doctor"]["user"].id
    task.completed_by_user_id = task.assigned_user_id
    task.completed_at = datetime(2026, 10, 4, 10)
    task.completion_note = "Private operational note"
    db_session.commit()
    result = read(api, item, people)
    assert result.status_code == 200, result.text
    assert result.json()["closeout"]["follow_up"]["id"] == task.id
    assert "Private operational note" not in result.text


def migration():
    path = Path(__file__).parents[1] / "alembic/versions/clinical_amendments_v1.py"
    spec = importlib.util.spec_from_file_location("clinical_amendments_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("corrupt", [False, True, "missing_time"])
def test_migration_preserves_historical_records_and_read_guards_imported_corruption(tmp_path, corrupt):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    # Create an old database table-by-table, before metadata retention events or
    # the amendment migration existed. Never disable a guard on an active DB.
    with engine.begin() as connection:
        for table in Base.metadata.sorted_tables:
            if table.name != "consultation_amendments":
                table.create(connection)
    with Session(engine) as db:
        item = Consultation(id=str(uuid4()), patient_id="historical-patient", doctor_id="historical-doctor", status="completed", country="AO")
        note = ConsultationNotes(id=str(uuid4()), consultation_id=item.id, doctor_id=item.doctor_id,
                                 assessment="Original clinical assessment", plan="Original plan", patient_summary="Original summary",
                                 follow_up_required=False, finalized_at=datetime(2026, 1, 1), finalized_by_user_id="historical-author")
        note.finalization_digest = note_digest(note)
        if corrupt == "missing_time":
            note.finalized_at = None
        elif corrupt:
            note.assessment = "IMPORTED CORRUPTION"
        db.add_all([item, note]); db.commit()
        note_id, consultation_id, original_digest = note.id, item.id, note.finalization_digest
    module = migration()
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        module.upgrade()
        module.upgrade()
        assert connection.execute(text("SELECT finalization_digest FROM consultation_notes WHERE id=:id"), {"id": note_id}).scalar() == original_digest
        with pytest.raises(RuntimeError, match="Finalized clinical records"):
            module.downgrade()
    with Session(engine) as db:
        item = db.get(Consultation, consultation_id)
        if corrupt:
            with pytest.raises(HTTPException) as denied:
                from app.services.consultation_amendments import effective_clinician_notes
                effective_clinician_notes(db, item)
            assert denied.value.status_code == 409
        else:
            assert closeout_result(db, item, clinician=False)["closeout"]["patient_summary"] == "Original summary"
        with pytest.raises(IntegrityError, match="finalized_clinical_record_is_retained"):
            db.execute(delete(ConsultationNotes).where(ConsultationNotes.id == note_id))
        db.rollback()
    engine.dispose()


def test_migration_adopts_current_schema_and_refuses_missing_constraint(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'current.db'}")
    Base.metadata.create_all(engine)
    module = migration()
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        module.upgrade()
        connection.exec_driver_sql("DROP INDEX uq_consultation_amendment_revision")
        with pytest.raises(RuntimeError, match="uniqueness"):
            module.upgrade()
    engine.dispose()


def test_empty_amendment_schema_can_be_downgraded(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'empty.db'}")
    Base.metadata.create_all(engine)
    module = migration()
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        module.upgrade(); module.downgrade()
        assert "consultation_amendments" not in inspect(connection).get_table_names()
    engine.dispose()
