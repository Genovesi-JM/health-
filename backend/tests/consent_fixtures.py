"""Explicit synthetic catalog/grants for disposable tests, never app startup."""
from datetime import datetime, timedelta
import hashlib
import json
from uuid import uuid4

from app.health_models import ConsentCatalogDocument, ConsultationConsentSnapshot
from app.services import consent_runtime as runtime


def catalog(db, country='AO', language='pt', purposes=None):
    purposes = tuple(purposes or runtime.REQUIRED_PURPOSES)
    selected = runtime.catalog_rows(db, country, language)
    rows = []
    for purpose in purposes:
        row = selected.get(purpose)
        if not runtime.valid_document(row):
            previous = db.query(ConsentCatalogDocument).filter_by(country=country, language=language, purpose=purpose).all()
            version = max((document.version for document in previous), default=0) + 1
            content = f'SYNTHETIC TEST TEXT ONLY; no production legal approval. {country}/{language}/{purpose}/{version}'
            row = ConsentCatalogDocument(document_key=f'{country}:{language}:{purpose}', version=version, country=country,
                language=language, purpose=purpose, kind='clinical_informed_consent' if purpose in runtime.REQUIRED_PURPOSES else 'images',
                required=purpose in runtime.REQUIRED_PURPOSES, title='Synthetic fixture: ' + purpose, content=content,
                content_hash=hashlib.sha256(content.encode()).hexdigest(), status='approved',
                approved_source='synthetic-fixture://disposable-tests-only', effective_from=datetime.utcnow() - timedelta(days=1))
            db.add(row); db.flush()
        rows.append(row)
    return rows


def references(db, country='AO', language='pt', purposes=None):
    return [{name: getattr(row, 'id' if name == 'document_id' else name) for name in
        ('document_id', 'version', 'content_hash', 'country', 'language')} for row in catalog(db, country, language, purposes)]


def grant_all(db, patient, country='AO', language='pt', purposes=None):
    rows = []
    for reference in references(db, country, language, purposes):
        rows.append(runtime.append_event(db, patient, patient.user_id,
            reference | {'action': 'grant', 'expected_revision': runtime.revision(db, patient.id)}, str(uuid4())))
    return rows


def withdraw(db, patient, purpose, country='AO', language='pt'):
    event, document = runtime.latest_events(db, patient.id, country, language)[purpose]
    body = {name: getattr(document, 'id' if name == 'document_id' else name) for name in
        ('document_id', 'version', 'content_hash', 'country', 'language')}
    return runtime.append_event(db, patient, patient.user_id, body | {
        'action': 'withdraw', 'expected_revision': runtime.revision(db, patient.id)}, str(uuid4()))


def seed_episode(db, consultation):
    """Explicit synthetic evidence for a fixture whose care already started."""
    events = runtime.require_effective(db, consultation.patient_id, consultation.country, consultation.consent_language)
    row = ConsultationConsentSnapshot(consultation_id=consultation.id, patient_id=consultation.patient_id,
        country=consultation.country, language=consultation.consent_language,
        grant_ids_json=json.dumps([event.id for event in events]), captured_at=datetime.utcnow())
    row.content_digest = runtime.snapshot_digest(row)
    db.add(row); db.flush()
    return row
