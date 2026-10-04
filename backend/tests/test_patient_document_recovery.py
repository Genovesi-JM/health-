"""Recover an acknowledged or uncertain upload without retaining device bytes."""
from uuid import uuid4

import pytest
from sqlalchemy import event

from app.config import settings
from app.health_models import HealthAuditLog, PatientConsent, PatientDocument
from tests.test_patient_documents import ROOT, clinician, documents, headers, upload  # noqa: F401
from tests.test_patient_document_pagination import other_patient


def lookup(client, auth, key):
    return client.get(ROOT + '/requests/' + key, headers=auth)


def test_owner_recovers_committed_upload_without_bytes_and_current_version(client, documents, db_session, monkeypatch):
    key = str(uuid4())
    document = upload(client, documents, key=key).json()
    row = db_session.get(PatientDocument, document['id'])
    row.reviewed_text = 'Synthetic reviewed text'; row.version = 3
    db_session.query(PatientConsent).filter_by(patient_id=documents['patient'].id).delete()
    db_session.commit()
    monkeypatch.setattr(settings, 'patient_documents_enabled', False)
    result = lookup(client, documents['headers'], key.upper())
    assert result.status_code == 200, result.text
    assert result.headers['cache-control'] == 'private, no-store'
    assert result.json()['id'] == document['id'] and result.json()['version'] == 3
    assert result.json()['reviewed_text'] == 'Synthetic reviewed text'
    assert set(result.json()) == set(document)
    assert 'storage_key' not in result.text and 'idempotency_key' not in result.text
    capabilities = client.get(ROOT + '/capabilities', headers=documents['headers']).json()
    assert not capabilities['upload_enabled'] and capabilities['request_lookup_enabled']
    audit = db_session.query(HealthAuditLog).filter_by(resource_id=document['id'], action='patient_document_request_recovered').one()
    assert key not in audit.metadata_json and 'Synthetic' not in audit.metadata_json


def test_missing_snapshot_does_not_claim_an_inflight_upload_cannot_commit(client, documents):
    key = str(uuid4())
    missing = lookup(client, documents['headers'], key)
    assert missing.status_code == 404
    assert missing.headers['cache-control'] == 'private, no-store'
    assert missing.json()['detail']['code'] == 'document_request_not_found'
    assert missing.json()['detail']['request_in_flight_may_commit'] is True
    document = upload(client, documents, key=key).json()
    assert lookup(client, documents['headers'], key).json()['id'] == document['id']


def test_request_lookup_is_owner_only_even_with_clinical_relationship(client, documents, db_session):
    key = str(uuid4()); document = upload(client, documents, key=key).json()
    _, other_auth = other_patient(db_session)
    response = lookup(client, other_auth, key)
    assert response.status_code == 404 and document['id'] not in response.text
    doctor_auth, _ = clinician(db_session, documents)
    assert lookup(client, doctor_auth, key).status_code == 403
    assert client.get(ROOT + '/requests/' + key).status_code == 403


def test_legacy_patient_role_can_recover_its_own_upload(client, documents, db_session):
    key = str(uuid4()); document = upload(client, documents, key=key).json()
    documents['user'].role = 'cliente'
    db_session.commit()
    assert lookup(client, headers(documents['user']), key).json()['id'] == document['id']


@pytest.mark.parametrize('key', ['not-a-uuid', 'x' * 65])
def test_invalid_uuid_is_rejected_without_lookup(client, documents, key):
    assert lookup(client, documents['headers'], key).status_code == 422


def test_failed_recovery_audit_does_not_disclose_document(client, documents):
    key = str(uuid4()); upload(client, documents, key=key)
    def fail(mapper, connection, row):
        if row.action == 'patient_document_request_recovered':
            raise RuntimeError('Synthetic read audit failure')
    event.listen(HealthAuditLog, 'before_insert', fail)
    try:
        result = lookup(client, documents['headers'], key)
        assert result.status_code == 503 and 'synthetic.pdf' not in result.text
    finally:
        event.remove(HealthAuditLog, 'before_insert', fail)
    assert lookup(client, documents['headers'], key).status_code == 200
