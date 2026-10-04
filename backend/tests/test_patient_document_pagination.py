"""Complete document history without large preview bodies or broader sharing."""
import base64
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.config import settings
from app.health_models import Consultation, Doctor, HealthAuditLog, Patient, PatientDocument
from app.models import User
from app.services.cursors import decode_position, encode_position
from tests.test_patient_documents import ROOT, clinician, documents, headers  # noqa: F401


@pytest.fixture(autouse=True)
def cursor_key(monkeypatch):
    monkeypatch.setattr(settings, "secret_key", "synthetic-document-cursor-key-for-tests-only")


def seed_rows(db, patient_id, count, *, clean=True, start=None):
    base = start or datetime(2026, 1, 1, 12)
    positions = []
    for index in range(count):
        identifier = str(uuid4())
        stamp = base + timedelta(seconds=index // 3)
        positions.append((stamp, identifier))
        db.add(PatientDocument(id=identifier, patient_id=patient_id, original_filename=f"synthetic-{index}.pdf",
               content_type="application/pdf", size_bytes=123, storage_key="PRIVATE ORIGINAL LOCATION",
               sha256="a" * 64, request_digest="b" * 64, status="reviewed" if clean else "pending_processing",
               scan_status="clean" if clean else "pending", version=3, extraction_method="pdf_text",
               extracted_text="PRIVATE EXTRACTED TEXT", reviewed_text="PRIVATE REVIEWED TEXT",
               created_at=stamp, reviewed_at=stamp if clean else None))
    db.commit()
    return [identifier for stamp, identifier in sorted(positions, reverse=True)]


def other_patient(db):
    account = User(email=f"cursor-other-{uuid4().hex}@example.test", role="patient", password_hash="unused", is_active=True)
    db.add(account); db.flush()
    patient = Patient(user_id=account.id)
    db.add(patient); db.commit()
    return patient, headers(account)


def page(client, documents, **params):
    return client.get(ROOT + "/page", headers=documents["headers"], params=params)


def test_complete_history_crosses_old_100_limit_with_ties_and_metadata_only_sql(client, documents, db_session):
    expected = seed_rows(db_session, documents["patient"].id, 130)
    seen, cursor, statements = [], None, []
    def capture(conn, target, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT") and "FROM patient_documents" in statement:
            statements.append(statement)
    engine = db_session.get_bind()
    event.listen(engine, "before_cursor_execute", capture)
    try:
        while True:
            result = page(client, documents, limit=17, **({"cursor": cursor} if cursor else {}))
            assert result.status_code == 200, result.text
            assert result.headers["cache-control"] == "private, no-store"
            assert result.headers["x-content-type-options"] == "nosniff"
            data = result.json()
            assert set(data) == {"items", "next_cursor"}
            for row in data["items"]:
                assert set(row) == {"country", "consent_language", "id", "original_filename", "content_type", "size_bytes", "status", "scan_status",
                                    "version", "extraction_method", "created_at", "reviewed_at", "error_code"}
                assert row["created_at"].endswith("+00:00") and row["reviewed_at"].endswith("+00:00")
            assert "PRIVATE" not in result.text
            seen.extend(row["id"] for row in data["items"])
            cursor = data["next_cursor"]
            if cursor is None:
                break
    finally:
        event.remove(engine, "before_cursor_execute", capture)
    assert seen == expected and len(set(seen)) == 130
    assert statements and all("extracted_text" not in sql and "reviewed_text" not in sql and "storage_key" not in sql for sql in statements)
    detail = client.get(ROOT + "/" + expected[-1], headers=documents["headers"])
    assert detail.status_code == 200 and detail.json()["reviewed_text"] == "PRIVATE REVIEWED TEXT"
    assert db_session.query(HealthAuditLog).filter_by(actor_user_id=documents["user"].id,
        action="patient_documents_listed", resource_id=documents["patient"].id).count() == 8


def test_legacy_array_retains_shape_and_default_limit_with_honest_continuation(client, documents, db_session):
    expected = seed_rows(db_session, documents["patient"].id, 130)
    first = client.get(ROOT, headers=documents["headers"])
    assert first.status_code == 200 and len(first.json()) == 100
    assert first.headers["x-has-more"] == "true"
    assert "extracted_text" in first.json()[0]
    continuation = first.headers["link"].split(">", 1)[0][1:]
    final = client.get(continuation, headers=documents["headers"])
    assert final.status_code == 200 and isinstance(final.json(), list)
    assert final.headers["x-has-more"] == "false" and "link" not in final.headers
    assert [row["id"] for row in first.json() + final.json()] == expected


def test_new_upload_between_pages_is_visible_on_refresh_without_repeating_old_rows(client, documents, db_session):
    expected = seed_rows(db_session, documents["patient"].id, 4)
    first = page(client, documents, limit=2).json()
    newest = seed_rows(db_session, documents["patient"].id, 1, start=datetime(2026, 2, 1))
    second = page(client, documents, limit=2, cursor=first["next_cursor"]).json()
    assert [row["id"] for row in first["items"] + second["items"]] == expected
    assert page(client, documents).json()["items"][0]["id"] == newest[0]


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 101}, {"limit": "invalid"}, {"cursor": ""},
    {"cursor": "x" * 1025}, {"cursor": "unsigned"}, {"cursor": "YQ=.YQ="}])
def test_invalid_page_parameters_are_rejected(client, documents, params):
    assert page(client, documents, **params).status_code == 422


def test_signed_cursor_rejects_tampering_owner_reuse_and_secret_rotation(client, documents, db_session, monkeypatch):
    seed_rows(db_session, documents["patient"].id, 3)
    cursor = page(client, documents, limit=1).json()["next_cursor"]
    raw, signature = cursor.split(".")
    changed = ("A" if signature[0] != "A" else "B") + signature[1:]
    assert page(client, documents, limit=1, cursor=raw + "." + changed).status_code == 422
    patient, other_headers = other_patient(db_session)
    assert client.get(ROOT + "/page", headers=other_headers, params={"cursor": cursor}).status_code == 422
    with monkeypatch.context() as patch:
        patch.setattr(settings, "secret_key", "different-synthetic-document-cursor-key")
        assert client.get(ROOT + "/page", headers=headers(documents["user"]), params={"cursor": cursor}).status_code == 422
    assert page(client, documents, limit=1, cursor=cursor).status_code == 200


@pytest.mark.parametrize("key", ["", "CHANGE_ME", "short"])
def test_cursor_signing_fails_closed_without_usable_secret(monkeypatch, key):
    position = {"scope": "test", "viewer_id": "viewer", "owner_id": "owner"}
    cursor = encode_position(**position, created_at=datetime.now(timezone.utc), identifier="record")
    monkeypatch.setattr(settings, "secret_key", key)
    for operation in (lambda: encode_position(**position, created_at=datetime.now(timezone.utc), identifier="record"),
                      lambda: decode_position(cursor, **position)):
        with pytest.raises(HTTPException) as error:
            operation()
        assert error.value.status_code == 503


def test_empty_page_and_patient_read_after_consent_withdrawal(client, documents, db_session):
    assert page(client, documents).json() == {"items": [], "next_cursor": None}
    seed_rows(db_session, documents["patient"].id, 1, clean=False)
    from consent_fixtures import withdraw
    withdraw(db_session, documents["patient"], "health_data_processing"); db_session.commit()
    result = page(client, documents)
    assert result.status_code == 200 and result.json()["items"][0]["scan_status"] == "pending"
    assert result.json()["items"][0]["reviewed_at"] is None


def test_legacy_patient_role_keeps_own_history_access(client, documents, db_session):
    documents["user"].role = "cliente"; db_session.commit()
    documents["headers"] = headers(documents["user"])
    assert page(client, documents).status_code == 200


def doctor_path(patient_id):
    return f"{ROOT}/patients/{patient_id}/page"


def test_doctor_pages_only_clean_documents_and_rechecks_authority(client, documents, db_session):
    expected = seed_rows(db_session, documents["patient"].id, 3)
    seed_rows(db_session, documents["patient"].id, 2, clean=False)
    doctor_headers, credential = clinician(db_session, documents)
    path = doctor_path(documents["patient"].id)
    first = client.get(path, headers=doctor_headers, params={"limit": 1})
    assert first.status_code == 200 and first.json()["items"][0]["id"] == expected[0]
    assert "PRIVATE" not in first.text
    assert first.headers["cache-control"] == "private, no-store"
    cursor = first.json()["next_cursor"]
    final = client.get(path, headers=doctor_headers, params={"cursor": cursor})
    assert [row["id"] for row in first.json()["items"] + final.json()["items"]] == expected
    credential.status = "revoked"; db_session.commit()
    assert client.get(path, headers=doctor_headers, params={"cursor": cursor}).status_code == 403


def test_doctor_cursor_bound_to_viewer_patient_and_clean_scope(client, documents, db_session):
    seed_rows(db_session, documents["patient"].id, 3)
    doctor_headers, credential = clinician(db_session, documents)
    path = doctor_path(documents["patient"].id)
    cursor = client.get(path, headers=doctor_headers, params={"limit": 1}).json()["next_cursor"]
    second_headers, _ = clinician(db_session, documents)
    assert client.get(path, headers=second_headers, params={"cursor": cursor}).status_code == 422
    other, _ = other_patient(db_session)
    doctor = db_session.query(Doctor).filter_by(user_id=credential.user_id).one()
    db_session.add(Consultation(patient_id=other.id, doctor_id=doctor.id, status="scheduled")); db_session.commit()
    assert client.get(doctor_path(other.id), headers=doctor_headers, params={"cursor": cursor}).status_code == 422
    own_cursor = page(client, documents, limit=1).json()["next_cursor"]
    assert client.get(path, headers=doctor_headers, params={"cursor": own_cursor}).status_code == 422


@pytest.mark.parametrize("scan_status", ["pending", "infected", "error"])
def test_doctor_direct_detail_cannot_bypass_clean_filter(client, documents, db_session, scan_status):
    identifier = seed_rows(db_session, documents["patient"].id, 1)[0]
    doctor_headers, _ = clinician(db_session, documents)
    assert client.get(ROOT + "/" + identifier, headers=doctor_headers).status_code == 200
    document = db_session.get(PatientDocument, identifier)
    document.scan_status = scan_status
    db_session.commit()
    for suffix in ("", "/download"):
        denied = client.get(ROOT + "/" + identifier + suffix, headers=doctor_headers)
        assert denied.status_code == 409 and "PRIVATE" not in denied.text
    assert client.get(ROOT + "/" + identifier, headers=documents["headers"]).status_code == 200


@pytest.mark.parametrize("relationship", ["requested", "cancelled", "no_show"])
def test_directed_or_inactive_relationship_does_not_grant_document_history(client, documents, db_session, relationship):
    doctor_headers, _ = clinician(db_session, documents, consultation_status=relationship)
    assert client.get(doctor_path(documents["patient"].id), headers=doctor_headers).status_code == 403


@pytest.mark.parametrize("role", ["nurse", "admin", "support", "patient"])
def test_new_doctor_listing_does_not_expand_disclosure(client, documents, db_session, role):
    account = User(email=f"cursor-role-{uuid4().hex}@example.test", role=role, password_hash="unused", is_active=True)
    db_session.add(account); db_session.commit()
    assert client.get(doctor_path(documents["patient"].id), headers=headers(account, True)).status_code == 403
    assert client.get(ROOT + "/page").status_code in (401, 403)


def test_page_audit_failure_returns_no_document_metadata(client, documents, db_session, monkeypatch):
    seed_rows(db_session, documents["patient"].id, 1)
    commit = Session.commit
    def fail(session):
        if any(isinstance(row, HealthAuditLog) and row.action == "patient_documents_listed" for row in session.new):
            raise RuntimeError("Synthetic audit failure")
        return commit(session)
    monkeypatch.setattr(Session, "commit", fail)
    response = page(client, documents)
    assert response.status_code == 503 and "synthetic-0.pdf" not in response.text
    assert not db_session.query(HealthAuditLog).filter_by(action="patient_documents_listed", resource_id=documents["patient"].id).count()


@pytest.mark.parametrize("change", [{"v": True}, {"at": "2026-01-01T00:00:00"}, {"at": "not-a-date"},
    {"id": ""}, {"id": "\n"}, {"extra": "unknown"}])
def test_cursor_codec_validates_signed_payload_structure(change):
    encoded = encode_position(scope="test", viewer_id="viewer", owner_id="owner", created_at=datetime.now(timezone.utc), identifier="record")
    raw = encoded.split(".")[0]
    payload = json.loads(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)))
    payload.update(change)
    body = json.dumps(payload).encode()
    signature = hmac.digest(settings.secret_key.encode(), b"kaya.cursor.v1\x00" + body, hashlib.sha256)
    malformed = ".".join(base64.urlsafe_b64encode(item).decode().rstrip("=") for item in (body, signature))
    with pytest.raises(HTTPException) as error:
        decode_position(malformed, scope="test", viewer_id="viewer", owner_id="owner")
    assert error.value.status_code == 422
