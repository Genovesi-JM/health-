"""Patient document journeys on real authenticated routes with synthetic storage/scanner."""
from datetime import date, timedelta
import importlib.util
import io
import json
from pathlib import Path
import struct
from uuid import uuid4

import pytest
from fastapi import HTTPException
from reportlab.pdfgen import canvas
from sqlalchemy import create_engine, event, inspect
from sqlalchemy.orm import Session

from app.config import settings
from app.health_models import (
    ClinicianCredential, Consultation, Doctor, HealthAuditLog, MfaCredential,
    Patient, PatientConsent, PatientDocument, PrescriptionRequest,
)
from app.models import User
from app.oauth2 import create_access_token
from app.routers import patient_documents as routes
from app.services import patient_documents as scanner

ROOT = "/api/v1/patient-documents"


def headers(user, mfa=False):
    return {"Authorization": "Bearer " + create_access_token({
        "sub": user.email, "uid": user.id, "role": user.role, "mfa_verified": mfa,
    })}


def pdf_bytes():
    buffer = io.BytesIO()
    writer = canvas.Canvas(buffer)
    writer.drawString(40, 780, "Synthetic document for patient review")
    writer.save()
    return buffer.getvalue()


@pytest.fixture
def documents(db_session, monkeypatch):
    monkeypatch.setattr(settings, "patient_documents_enabled", True)
    monkeypatch.setattr(settings, "patient_document_clamav_host", "synthetic.invalid")
    user = User(email=f"documents-{uuid4().hex}@example.com", role="patient", password_hash="unused", is_active=True)
    db_session.add(user)
    db_session.flush()
    patient = Patient(user_id=user.id, allergies_json='["existing allergy"]')
    db_session.add(patient)
    db_session.flush()
    from consent_fixtures import grant_all
    consent, = grant_all(db_session, patient, purposes=("health_data_processing",))
    db_session.commit()

    class Storage:
        def __init__(self):
            self.objects = {}
            self.deleted = []

        def upload_bytes(self, data, category, filename, content_type):
            key = f"health/{category}/{uuid4().hex}_{filename}"
            self.objects[key] = data
            return key, "private-storage-location"

        def download_bytes(self, key):
            return self.objects[key]

        def delete(self, key):
            self.deleted.append(key)
            self.objects.pop(key, None)
            return True

    storage = Storage()
    monkeypatch.setattr(routes, "get_health_storage", lambda: storage)
    monkeypatch.setattr(routes, "scan_document", lambda data: "clean")
    return {"user": user, "patient": patient, "consent": consent, "headers": headers(user), "storage": storage}


def upload(client, documents, *, data=None, name="synthetic.pdf", kind="application/pdf", key=None, consent="true"):
    return client.post(ROOT, headers={**documents["headers"], "Idempotency-Key": key or str(uuid4())},
                       data={"processing_consent": consent, "country": "AO"},
                       files={"file": (name, pdf_bytes() if data is None else data, kind)})


def process(client, documents, document):
    return client.post(f"{ROOT}/{document['id']}/process", headers=documents["headers"], json={"version": document["version"]})


def review(client, documents, document, *, text="Reviewed synthetic text", decision="confirm"):
    return client.put(f"{ROOT}/{document['id']}/review", headers=documents["headers"],
                      json={"version": document["version"], "decision": decision, "text": text})


def test_upload_real_pdf_extract_review_and_private_download(client, db_session, documents):
    data = pdf_bytes()
    response = upload(client, documents, data=data)
    assert response.status_code == 201, response.text
    document = response.json()
    assert document["status"] == "pending_processing" and document["version"] == 1
    assert document["scan_status"] == "pending"
    assert "storage_key" not in document and "sha256" not in document
    assert response.headers["cache-control"] == "private, no-store"
    assert client.get(f"{ROOT}/{document['id']}/download", headers=documents["headers"]).status_code == 409
    processed = process(client, documents, document)
    assert processed.status_code == 200, processed.text
    document = processed.json()
    assert document["status"] == "ready_for_review" and document["version"] == 2
    assert "Synthetic document" in document["extracted_text"]
    assert document["reviewed_text"] is None
    original_text = document["extracted_text"]
    result = review(client, documents, document)
    assert result.status_code == 200, result.text
    reviewed = result.json()
    assert reviewed["status"] == "confirmed" and reviewed["version"] == 3
    assert reviewed["reviewed_text"] == "Reviewed synthetic text"
    assert reviewed["extracted_text"] == original_text
    downloaded = client.get(f"{ROOT}/{document['id']}/download", headers=documents["headers"])
    assert downloaded.status_code == 200 and downloaded.content == data
    assert downloaded.headers["content-disposition"].startswith("attachment;")
    assert downloaded.headers["cache-control"] == "private, no-store"
    listed = client.get(ROOT, headers=documents["headers"])
    assert [entry["id"] for entry in listed.json()] == [document["id"]]
    db_session.refresh(documents["patient"])
    assert json.loads(documents["patient"].allergies_json) == ["existing allergy"]
    audits = db_session.query(HealthAuditLog).filter_by(resource_id=document["id"]).all()
    assert {a.action for a in audits} >= {"patient_document_uploaded", "patient_document_processed", "patient_document_reviewed", "patient_document_downloaded"}
    upload_audit = next(a for a in audits if a.action == "patient_document_uploaded")
    assert json.loads(upload_audit.metadata_json)["processing_consent"] is True
    assert json.loads(upload_audit.metadata_json)["consent_version"] == "patient-document-v1"
    for audit in audits:
        assert "Synthetic" not in (audit.metadata_json or "")
        assert "synthetic.pdf" not in (audit.metadata_json or "")


def test_image_is_manual_review_without_invented_text(client, documents):
    response = upload(client, documents, data=b"\x89PNG\r\n\x1a\nsynthetic", name="image.png", kind="image/png")
    result = process(client, documents, response.json()).json()
    assert result["status"] == "needs_manual_review"
    assert result["error_code"] == "ocr_required"
    assert result["extracted_text"] == "" and result["extraction_method"] == "none"
    assert review(client, documents, result, text=" ").status_code == 422
    rejected = review(client, documents, result, text="", decision="reject").json()
    assert rejected["status"] == "rejected" and rejected["reviewed_text"] is None


@pytest.mark.parametrize("scan,expected", [("infected", "blocked"), ("error", "processing_failed"), ("unknown", "processing_failed")])
def test_scan_failures_never_extract_review_or_download(client, documents, monkeypatch, scan, expected):
    monkeypatch.setattr(routes, "scan_document", lambda data: scan)
    monkeypatch.setattr(routes, "extract_document", lambda *args: pytest.fail("unscanned content reached parser"))
    result = process(client, documents, upload(client, documents).json()).json()
    assert result["status"] == expected
    assert result["extracted_text"] == ""
    assert review(client, documents, result).status_code == 409
    assert client.get(f"{ROOT}/{result['id']}/download", headers=documents["headers"]).status_code == 409


def test_scanner_unavailability_can_retry_with_fresh_version(client, documents, monkeypatch):
    monkeypatch.setattr(routes, "scan_document", lambda data: "error")
    failed = process(client, documents, upload(client, documents).json()).json()
    monkeypatch.setattr(routes, "scan_document", lambda data: "clean")
    assert process(client, documents, failed).json()["status"] == "ready_for_review"


@pytest.mark.parametrize("data,name,kind,status", [
    (b"", "empty.pdf", "application/pdf", 422),
    (b"%PDF-" + b"a" * scanner.MAX_BYTES, "huge.pdf", "application/pdf", 413),
    (b"MZexecutable", "forged.pdf", "application/pdf", 415),
    (b"%PDF-1.7", "wrong.exe", "application/pdf", 415),
    (b"%PDF-1.7", "wrong.png", "image/png", 415),
    (b"II*\x00", "scan.tiff", "image/tiff", 415),
])
def test_upload_validation_precedes_storage(client, documents, data, name, kind, status):
    result = upload(client, documents, data=data, name=name, kind=kind)
    assert result.status_code == status, result.text
    assert documents["storage"].objects == {}


def test_idempotent_retry_and_conflicting_file(client, documents, db_session):
    key, data = str(uuid4()), pdf_bytes()
    first = upload(client, documents, key=key, data=data)
    repeated = upload(client, documents, key=key, data=data)
    assert first.status_code == repeated.status_code == 201
    assert first.json()["id"] == repeated.json()["id"]
    assert len(documents["storage"].objects) == 1
    assert upload(client, documents, key=key, data=data + b"\nchanged").status_code == 409
    assert upload(client, documents, key="invalid", data=data).status_code == 422
    assert client.post(ROOT, headers={**documents["headers"], "Idempotency-Key": ""},
                       data={"processing_consent": "true", "country": "AO"},
                       files={"file": ("synthetic.pdf", data, "application/pdf")}).status_code == 422
    assert db_session.query(PatientDocument).filter_by(patient_id=documents["patient"].id).count() == 1


def test_feature_configuration_and_explicit_consent_fail_closed(client, documents, monkeypatch):
    assert upload(client, documents, consent="false").status_code == 422
    for attribute, value in [("patient_documents_enabled", False), ("patient_document_clamav_host", None)]:
        with monkeypatch.context() as patch:
            patch.setattr(settings, attribute, value)
            assert client.get(ROOT + "/capabilities", headers=documents["headers"]).json()["upload_enabled"] is False
            assert upload(client, documents).status_code == 503
    assert not documents["storage"].objects


def test_health_consent_required_for_upload_process_and_review(client, documents, db_session):
    first = upload(client, documents).json()
    second = process(client, documents, upload(client, documents).json()).json()
    from consent_fixtures import withdraw
    withdraw(db_session, documents["patient"], "health_data_processing")
    db_session.commit()
    assert upload(client, documents).status_code == 403
    assert process(client, documents, first).status_code == 403
    assert review(client, documents, second).status_code == 403
    # A patient can still retrieve their existing records.
    assert client.get(f"{ROOT}/{second['id']}", headers=documents["headers"]).status_code == 200


def test_other_patient_cannot_read_process_review_or_download(client, documents, db_session):
    document = upload(client, documents).json()
    other = User(email=f"other-{uuid4().hex}@example.com", role="patient", password_hash="unused", is_active=True)
    db_session.add(other)
    db_session.flush()
    db_session.add(Patient(user_id=other.id))
    db_session.commit()
    for method, suffix, body in [("GET", "", None), ("GET", "/download", None),
                                 ("POST", "/process", {"version": 1}),
                                 ("PUT", "/review", {"version": 1, "decision": "confirm", "text": "bad"})]:
        response = client.request(method, ROOT + "/" + document["id"] + suffix, headers=headers(other), json=body)
        assert response.status_code == 404
    assert client.get(ROOT, headers=headers(other)).json() == []
    assert client.get(ROOT).status_code in (401, 403)


def clinician(db_session, documents, *, status="verified", consultation_status="scheduled"):
    user = User(email=f"doctor-{uuid4().hex}@example.com", role="doctor", password_hash="unused", is_active=True)
    db_session.add(user)
    db_session.flush()
    credential = ClinicianCredential(
        user_id=user.id, profession="doctor", legal_name="Synthetic Doctor", practice_country="AO",
        licence_country="AO", issuing_authority="Synthetic", licence_number="SYNTHETIC",
        diploma_country="AO", diploma_institution="Synthetic", degree_title="Medicine", status=status,
    )
    doctor = Doctor(user_id=user.id, verification_status="verified")
    db_session.add_all([credential, doctor, MfaCredential(user_id=user.id, secret="JBSWY3DPEHPK3PXP", enabled=True)])
    db_session.flush()
    db_session.add(Consultation(patient_id=documents["patient"].id, doctor_id=doctor.id, status=consultation_status))
    db_session.commit()
    return headers(user, True), credential


@pytest.mark.parametrize("authority", ["verified", "revoked", "expired", "licence_elapsed", "requested"])
def test_clinician_read_requires_current_authority_and_accepted_relationship(client, documents, db_session, authority):
    document = process(client, documents, upload(client, documents).json()).json()
    doctor_headers, credential = clinician(db_session, documents,
        status=authority if authority in {"revoked", "expired"} else "verified",
        consultation_status="requested" if authority == "requested" else "scheduled")
    if authority == "licence_elapsed":
        credential.licence_expiry_date = (date.today() - timedelta(days=1)).isoformat()
        db_session.commit()
    for suffix in ["", "/download"]:
        response = client.get(ROOT + "/" + document["id"] + suffix, headers=doctor_headers)
        assert response.status_code == (200 if authority == "verified" else 403), response.text
    assert client.put(ROOT + "/" + document["id"] + "/review", headers=doctor_headers,
                      json={"version": 2, "decision": "confirm", "text": "doctor change"}).status_code == 403
    if authority == "verified":
        summary = client.get(f"/api/v1/doctor/patients/{documents['patient'].id}/clinical-summary", headers=doctor_headers)
        assert summary.status_code == 200, summary.text
        assert summary.json()["uploaded_files"][0]["id"] == document["id"]
    # Do not leave an expiry candidate for independent scanner tests.
    credential.licence_expiry_date = None
    db_session.commit()


def test_stale_review_never_overwrites_confirmed_text(client, documents):
    document = process(client, documents, upload(client, documents).json()).json()
    assert review(client, documents, document, text="first review").status_code == 200
    assert review(client, documents, document, text="stale review").status_code == 409
    stored = client.get(ROOT + "/" + document["id"], headers=documents["headers"]).json()
    assert stored["reviewed_text"] == "first review"
    assert review(client, documents, stored, text="terminal change").status_code == 409


@pytest.mark.parametrize("status", ["pending", "rejected", "cancelled", "approved", "adjusted"])
def test_prescription_request_document_access_requires_accepted_decision(client, documents, db_session, status):
    document = process(client, documents, upload(client, documents).json()).json()
    doctor_headers, credential = clinician(db_session, documents, consultation_status="cancelled")
    doctor = db_session.query(Doctor).filter_by(user_id=credential.user_id).one()
    db_session.add(PrescriptionRequest(patient_id=documents["patient"].id, doctor_id=doctor.id,
                                      medication_name="Synthetic medication", status=status))
    db_session.commit()
    accepted = status in {"approved", "adjusted"}
    assert client.get(f"{ROOT}/{document['id']}", headers=doctor_headers).status_code == (200 if accepted else 403)
    summary = client.get(f"/api/v1/doctor/patients/{documents['patient'].id}/clinical-summary", headers=doctor_headers)
    assert summary.status_code == 200
    assert bool(summary.json()["uploaded_files"]) == accepted


def test_separate_session_cas_prevents_stale_processing(db_session, client, documents):
    document = upload(client, documents).json()
    with Session(bind=db_session.get_bind()) as first, Session(bind=db_session.get_bind()) as stale:
        a = first.get(PatientDocument, document["id"])
        b = stale.get(PatientDocument, document["id"])
        routes._mutate(first, a, 1, status="blocked", scan_status="infected")
        first.commit()
        with pytest.raises(HTTPException) as conflict:
            routes._mutate(stale, b, 1, status="ready_for_review", scan_status="clean")
        assert conflict.value.status_code == 409
    db_session.expire_all()
    assert db_session.get(PatientDocument, document["id"]).status == "blocked"


def test_upload_audit_failure_rolls_back_metadata_and_removes_new_blob(client, documents, db_session, monkeypatch):
    def fail(*args):
        raise RuntimeError("synthetic audit failure")
    monkeypatch.setattr(routes, "_audit", fail)
    result = upload(client, documents)
    assert result.status_code == 503
    assert not documents["storage"].objects and len(documents["storage"].deleted) == 1
    assert db_session.query(PatientDocument).filter_by(patient_id=documents["patient"].id).count() == 0


def test_committed_upload_survives_response_refresh_failure(client, documents, db_session, monkeypatch):
    key, data = str(uuid4()), pdf_bytes()
    original = Session.refresh
    def fail_document_refresh(session, instance, *args, **kwargs):
        if isinstance(instance, PatientDocument):
            raise RuntimeError("synthetic read failure after commit")
        return original(session, instance, *args, **kwargs)
    with monkeypatch.context() as patch:
        patch.setattr(Session, "refresh", fail_document_refresh)
        result = upload(client, documents, key=key, data=data)
        assert result.status_code == 503
    assert len(documents["storage"].objects) == 1 and not documents["storage"].deleted
    recovered = upload(client, documents, key=key, data=data)
    assert recovered.status_code == 201, recovered.text
    assert db_session.query(PatientDocument).filter_by(patient_id=documents["patient"].id).count() == 1
    assert process(client, documents, recovered.json()).status_code == 200


def test_upload_commit_acknowledgment_failure_keeps_committed_original(client, documents, db_session, monkeypatch):
    original = Session.commit
    def commit_then_fail(session):
        document_commit = any(isinstance(row, HealthAuditLog) and row.action == "patient_document_uploaded" for row in session.new)
        original(session)
        if document_commit:
            raise RuntimeError("synthetic acknowledgment lost")
    monkeypatch.setattr(Session, "commit", commit_then_fail)
    result = upload(client, documents)
    assert result.status_code == 201, result.text
    assert len(documents["storage"].objects) == 1 and not documents["storage"].deleted
    assert db_session.get(PatientDocument, result.json()["id"]) is not None


def test_legacy_patient_role_can_upload_and_review(client, documents, db_session):
    documents["user"].role = "cliente"
    db_session.commit()
    documents["headers"] = headers(documents["user"])
    assert client.get(ROOT + "/capabilities", headers=documents["headers"]).json()["upload_enabled"] is True
    uploaded = upload(client, documents)
    assert uploaded.status_code == 201, uploaded.text
    processed = process(client, documents, uploaded.json())
    assert processed.status_code == 200, processed.text
    assert review(client, documents, processed.json()).status_code == 200


def test_review_commit_failure_keeps_prior_version_and_text(client, documents, db_session, monkeypatch):
    document = process(client, documents, upload(client, documents).json()).json()
    def fail_commit(session):
        if any(isinstance(row, HealthAuditLog) and row.action == "patient_document_reviewed" for row in session.new):
            raise RuntimeError("synthetic transaction failure")
    event.listen(Session, "before_commit", fail_commit)
    try:
        result = review(client, documents, document)
        assert result.status_code == 503, result.text
    finally:
        event.remove(Session, "before_commit", fail_commit)
    db_session.expire_all()
    stored = db_session.get(PatientDocument, document["id"])
    assert stored.version == 2 and stored.reviewed_text is None and stored.status == "ready_for_review"


def test_storage_substitution_blocks_download_and_processing(client, documents, db_session):
    first = upload(client, documents).json()
    second = process(client, documents, upload(client, documents).json()).json()
    for document in (first, second):
        stored = db_session.get(PatientDocument, document["id"])
        documents["storage"].objects[stored.storage_key] = b"substituted"
    assert process(client, documents, first).json()["error_code"] == "integrity_failed"
    assert client.get(f"{ROOT}/{second['id']}/download", headers=documents["headers"]).status_code == 409


class Socket:
    def __init__(self, replies):
        self.replies = iter(replies)
        self.sent = []
        self.timeouts = []
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def settimeout(self, timeout): self.timeouts.append(timeout)
    def sendall(self, data): self.sent.append(data)
    def recv(self, count): return next(self.replies, b"")


@pytest.mark.parametrize("reply,expected", [
    (b"stream: OK\0", "clean"), (b"stream: Eicar-Test-Signature FOUND\0", "infected"),
    (b"stream: OK ERROR\0", "error"), (b"stream: OK", "error"),
    (b"INSTREAM size limit exceeded. ERROR\0", "error"), (b"stream: OK\n", "error"),
    (b"ERROR secret internal details\0", "error"), (b"x" * 4096, "error"),
])
def test_clamav_protocol_exact_result_and_chunk_framing(documents, monkeypatch, reply, expected):
    connection = Socket([reply])
    monkeypatch.setattr(scanner.socket, "create_connection", lambda *args, **kwargs: connection)
    data = b"x" * 70000
    assert scanner.scan_document(data) == expected
    assert connection.sent == [b"zINSTREAM\0", struct.pack("!I", 65536) + data[:65536],
                               struct.pack("!I", 4464) + data[65536:], struct.pack("!I", 0)]
    assert all(0 < timeout <= 10 for timeout in connection.timeouts)


def test_clamav_timeout_missing_configuration_and_total_deadline(documents, monkeypatch):
    def timeout(*args, **kwargs): raise TimeoutError("sensitive internal endpoint")
    monkeypatch.setattr(scanner.socket, "create_connection", timeout)
    assert scanner.scan_document(b"data") == "error"
    monkeypatch.setattr(settings, "patient_document_clamav_host", None)
    monkeypatch.setattr(scanner.socket, "create_connection", lambda *args, **kwargs: pytest.fail("unconfigured socket"))
    assert scanner.scan_document(b"data") == "error"
    monkeypatch.setattr(settings, "patient_document_clamav_host", "synthetic.invalid")
    connection = Socket([b"stream: OK\0"])
    monkeypatch.setattr(scanner.socket, "create_connection", lambda *args, **kwargs: connection)
    clock = iter([0, 0, 0, 21])
    monkeypatch.setattr(scanner.time, "monotonic", lambda: next(clock))
    assert scanner.scan_document(b"data") == "error"
    assert connection.sent == [b"zINSTREAM\0"]


def test_document_migration_round_trip_on_disposable_database(tmp_path):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    source = Path(__file__).resolve().parents[1] / "alembic/versions/patient_documents_v1.py"
    spec = importlib.util.spec_from_file_location("patient_document_migration", source)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite:///" + str(tmp_path / "documents-migration.db"))
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE patients (id VARCHAR(36) PRIMARY KEY)")
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        inspector = inspect(connection)
        # This historical migration predates explicit processing market scope.
        assert {c["name"] for c in inspector.get_columns("patient_documents")} == set(PatientDocument.__table__.columns.keys()) - {"country", "consent_language"}
        assert any(index["name"] == "uq_patient_document_request" and index["unique"] for index in inspector.get_indexes("patient_documents"))
        migration.upgrade()  # An application-bootstrapped table is adopted unchanged.
        migration.downgrade()
        assert "patient_documents" not in inspect(connection).get_table_names()
        PatientDocument.__table__.create(connection)
        connection.exec_driver_sql("INSERT INTO patients (id) VALUES ('synthetic-patient')")
        connection.execute(PatientDocument.__table__.insert().values(
            id="synthetic-document", patient_id="synthetic-patient", original_filename="test.pdf",
            content_type="application/pdf", size_bytes=10, storage_key="health/synthetic/test.pdf",
            sha256="a" * 64, request_digest="b" * 64,
        ))
        migration.upgrade()
        assert connection.exec_driver_sql("SELECT id FROM patient_documents").scalar_one() == "synthetic-document"
        migration.downgrade()
    engine.dispose()
