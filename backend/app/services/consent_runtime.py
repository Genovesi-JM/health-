"""Persisted exact-text consent; an empty catalog grants no runtime authority."""
from datetime import datetime
import hashlib
import hmac
import json
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func

from app.consent import ConsentDocument, ConsentLedger, ConsentRecord, NECESSARY_KINDS, OPTIONAL_KINDS, has_effective_consent
from app.health_models import ConsentCatalogDocument, PatientConsentEvent, ConsultationConsentSnapshot, HealthAuditLog, Patient
from app.services.appointments import lock_resources
from app.services.cursors import utc_timestamp

REQUIRED_PURPOSES = ('privacy_policy', 'telemedicine_consent', 'terms_of_service', 'health_data_processing', 'medical_disclaimer')


def canonical(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def normalized_key(value):
    try: return str(UUID(value))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(422, 'Indique uma chave UUID para guardar ou recuperar a decisão.') from None


def valid_scope(country, language):
    if country not in ('AO', 'PT') or not isinstance(language, str) or not 2 <= len(language) <= 10:
        raise HTTPException(409, {'code': 'consent_scope_unconfirmed', 'message': 'Escolha explicitamente o país e idioma dos consentimentos.'})


def _domain(document):
    return ConsentDocument(doc_id=document.document_key, version=document.version, content_hash=document.content_hash,
        jurisdiction=document.country, language=document.language, purpose=document.purpose, kind=document.kind,
        required=document.required, effective_from=document.effective_from, effective_to=document.effective_to,
        approved_source=document.approved_source)


def valid_document(document, now=None):
    now = now or datetime.utcnow()
    return bool(document and document.status == 'approved' and document.approved_source and document.approved_source.strip()
        and document.country in ('AO', 'PT') and document.version >= 1
        and document.document_key == f'{document.country}:{document.language}:{document.purpose}'
        and document.kind in NECESSARY_KINDS | OPTIONAL_KINDS
        and bool(document.required) == (document.purpose in REQUIRED_PURPOSES)
        and document.kind in (NECESSARY_KINDS if document.required else OPTIONAL_KINDS)
        and document.content and hmac.compare_digest(hashlib.sha256(document.content.encode()).hexdigest(), document.content_hash)
        and document.effective_from <= now and (document.effective_to is None or now < document.effective_to))


def catalog_rows(db, country, language, now=None):
    valid_scope(country, language); now = now or datetime.utcnow()
    rows = db.query(ConsentCatalogDocument).filter_by(country=country, language=language).filter(
        ConsentCatalogDocument.effective_from <= now).order_by(ConsentCatalogDocument.version.desc()).all()
    selected = {}
    for row in rows:
        if row.purpose not in selected: selected[row.purpose] = row
    return selected


def document_out(row):
    return {**{name: getattr(row, name) for name in ('id', 'document_key', 'version', 'content_hash', 'country', 'language',
        'purpose', 'kind', 'required', 'title', 'content', 'approved_source')},
        'effective_from': utc_timestamp(row.effective_from), 'effective_to': utc_timestamp(row.effective_to)}


def catalog_out(db, country, language):
    selected = catalog_rows(db, country, language)
    available = {purpose: row for purpose, row in selected.items() if valid_document(row)}
    missing = [purpose for purpose in REQUIRED_PURPOSES if purpose not in available]
    return {'country': country, 'language': language, 'available': not missing, 'required_purposes': list(REQUIRED_PURPOSES),
        'unavailable_purposes': missing, 'documents': [document_out(available[key]) for key in sorted(available)]}


def revision(db, patient_id):
    return int(db.query(func.max(PatientConsentEvent.sequence)).filter_by(patient_id=patient_id).scalar() or 0) if patient_id else 0


def event_out(db, event):
    document = db.get(ConsentCatalogDocument, event.document_id)
    return {'id': event.id, 'sequence': event.sequence, 'document_id': event.document_id, 'purpose': document.purpose,
        'version': document.version, 'content_hash': document.content_hash, 'country': document.country, 'language': document.language,
        'action': event.action, 'created_at': utc_timestamp(event.created_at), 'request_key': event.request_key}


def latest_events(db, patient_id, country, language, *, max_sequence=None):
    rows = db.query(PatientConsentEvent, ConsentCatalogDocument).join(ConsentCatalogDocument,
        ConsentCatalogDocument.id == PatientConsentEvent.document_id).filter(PatientConsentEvent.patient_id == patient_id,
        ConsentCatalogDocument.country == country, ConsentCatalogDocument.language == language)
    if max_sequence is not None: rows = rows.filter(PatientConsentEvent.sequence <= max_sequence)
    rows = rows.order_by(PatientConsentEvent.sequence.desc()).all()
    result = {}
    for event, document in rows:
        if document.purpose not in result: result[document.purpose] = (event, document)
    # Refusal and withdrawal are purpose decisions within a market, not a
    # translation toggle. A later exact-language grant may reauthorize that
    # language; an older translation can never bypass the denial.
    denials = db.query(PatientConsentEvent, ConsentCatalogDocument).join(ConsentCatalogDocument,
        ConsentCatalogDocument.id == PatientConsentEvent.document_id).filter(PatientConsentEvent.patient_id == patient_id,
        ConsentCatalogDocument.country == country, PatientConsentEvent.action.in_(('refuse', 'withdraw')))
    if max_sequence is not None: denials = denials.filter(PatientConsentEvent.sequence <= max_sequence)
    denials = denials.order_by(PatientConsentEvent.sequence.desc()).all()
    for event, document in denials:
        if document.purpose not in result or event.sequence > result[document.purpose][0].sequence:
            result[document.purpose] = (event, document)
    return result


def effective(event, accepted_document, current_document, patient_id, language, now=None):
    if not valid_document(current_document, now): return False
    ledger = ConsentLedger()
    ledger.append(ConsentRecord(subject_id=patient_id, doc_id=accepted_document.document_key, version=accepted_document.version,
        content_hash=accepted_document.content_hash, action=event.action, timestamp=event.created_at,
        actor_id=event.actor_user_id, language=accepted_document.language, notice_evidence=event.id))
    return has_effective_consent(ledger, patient_id, _domain(current_document), language, now)


def state_out(db, patient_id, country, language):
    # Events are immutable and sequence allocation is serialized per patient.
    # Bound every decision read to one committed prefix: a later withdrawal can
    # never be combined with a revision the displayed decisions did not include.
    observed_revision = revision(db, patient_id)
    selected = catalog_rows(db, country, language)
    latest = latest_events(db, patient_id, country, language, max_sequence=observed_revision) if patient_id else {}
    states = []
    for purpose in sorted(set(REQUIRED_PURPOSES) | set(selected) | set(latest)):
        document = selected.get(purpose); previous = latest.get(purpose)
        allowed = bool(previous and effective(*previous, document, patient_id, language))
        if not valid_document(document): status = 'unavailable'
        elif not previous: status = 'missing'
        elif previous[0].action == 'withdraw': status = 'withdrawn'
        elif previous[0].action == 'refuse': status = 'refused'
        else: status = 'granted' if allowed else 'stale'
        states.append({'purpose': purpose, 'status': status, 'effective': allowed,
            'document': document_out(document) if valid_document(document) else None,
            'latest_event': event_out(db, previous[0]) if previous else None})
    return {'country': country, 'language': language, 'available': all(valid_document(selected.get(p)) for p in REQUIRED_PURPOSES),
        'revision': observed_revision, 'required_purposes': list(REQUIRED_PURPOSES), 'states': states}


def require_effective(db, patient_id, country, language='pt', purposes=REQUIRED_PURPOSES):
    valid_scope(country, language)
    selected = catalog_rows(db, country, language); latest = latest_events(db, patient_id, country, language)
    missing = [p for p in purposes if p not in latest or not effective(*latest[p], selected.get(p), patient_id, language)]
    if missing:
        raise HTTPException(403, {'code': 'consent_required', 'country': country, 'language': language, 'missing_purposes': missing,
            'message': 'Reveja os textos aprovados e registe a sua decisão antes de iniciar novos cuidados ou processamento.'})
    return [latest[p][0] for p in purposes]


def _not_committed(message):
    return HTTPException(409, {'code': 'consent_not_committed', 'request_key_committed': False, 'message': message})


def append_event(db, patient, actor_id, body, key):
    if patient.user_id != actor_id: raise HTTPException(403, 'A decisão pertence ao titular paciente.')
    key = normalized_key(key); digest = canonical(body)
    def replay():
        row = db.query(PatientConsentEvent).filter_by(patient_id=patient.id, request_key=key).first()
        if row and (row.actor_user_id != actor_id or not hmac.compare_digest(row.request_digest, digest)):
            raise HTTPException(409, 'Esta chave já pertence a outra decisão. Recupere a decisão original.')
        return row
    old = replay()
    if old: return old
    lock_resources(db, None, patient.id)
    old = replay()
    if old: return old
    if body['expected_revision'] != revision(db, patient.id): raise _not_committed('Os consentimentos mudaram. Atualize antes de decidir.')
    document = db.get(ConsentCatalogDocument, body['document_id'])
    if not document or any(getattr(document, field) != body[field] for field in ('version', 'content_hash', 'country', 'language')):
        raise _not_committed('O texto indicado não corresponde ao catálogo. Reveja o texto atual.')
    if body['action'] != 'withdraw':
        current = catalog_rows(db, document.country, document.language).get(document.purpose)
        if not current or current.id != document.id or not valid_document(document):
            raise _not_committed('Este texto deixou de estar disponível. Reveja o catálogo atual.')
    else:
        previous = latest_events(db, patient.id, document.country, document.language).get(document.purpose)
        if not previous or previous[0].document_id != document.id:
            raise _not_committed('Atualize a decisão que pretende retirar.')
    event = PatientConsentEvent(patient_id=patient.id, actor_user_id=actor_id, document_id=document.id,
        sequence=body['expected_revision'] + 1, action=body['action'], request_key=key, request_digest=digest)
    db.add(event); db.flush()
    db.add(HealthAuditLog(actor_user_id=actor_id, action='consent_' + body['action'], resource_type='consent_event', resource_id=event.id,
        metadata_json=json.dumps({'purpose': document.purpose, 'country': document.country, 'version': document.version})))
    db.flush()
    return event


def receipt_out(db, event):
    data = event_out(db, event)
    state = state_out(db, event.patient_id, data['country'], data['language'])
    return {'event': data, 'revision': state['revision'], 'state': state}


def snapshot_digest(row):
    return canonical({'consultation_id': row.consultation_id, 'patient_id': row.patient_id, 'country': row.country,
        'language': row.language, 'grant_ids': json.loads(row.grant_ids_json), 'captured_at': utc_timestamp(row.captured_at)})


def capture_episode(db, consultation):
    previous = db.query(ConsultationConsentSnapshot).filter_by(consultation_id=consultation.id).first()
    if previous:
        require_episode(db, consultation)
        return previous
    # A missing historic snapshot is never backfilled from later grants.
    if consultation.started_at or consultation.status in ('in_progress', 'completed'):
        raise HTTPException(409, {'code': 'legacy_episode_consent_review', 'message': 'O registo anterior requer revisão explícita da autorização do episódio.'})
    events = require_effective(db, consultation.patient_id, consultation.country, consultation.consent_language)
    row = ConsultationConsentSnapshot(consultation_id=consultation.id, patient_id=consultation.patient_id,
        country=consultation.country, language=consultation.consent_language,
        grant_ids_json=json.dumps([event.id for event in events]), captured_at=datetime.utcnow())
    row.content_digest = snapshot_digest(row)
    # Enlist before the clinical CAS, flush after it. Immediate appointments
    # assign their doctor in that same CAS, before retention freezes identity.
    db.add(row)
    return row


def require_episode(db, consultation):
    row = db.query(ConsultationConsentSnapshot).filter_by(consultation_id=consultation.id).first()
    if not row:
        if consultation.started_at or consultation.status in ('in_progress', 'completed'):
            raise HTTPException(409, {'code': 'legacy_episode_consent_review', 'message': 'A autorização histórica do episódio requer revisão explícita.'})
        require_effective(db, consultation.patient_id, consultation.country, consultation.consent_language)
        return
    try:
        ids = json.loads(row.grant_ids_json)
        events = db.query(PatientConsentEvent).filter(PatientConsentEvent.id.in_(ids)).all()
        if (row.patient_id != consultation.patient_id or row.country != consultation.country or row.language != consultation.consent_language
                or not hmac.compare_digest(row.content_digest, snapshot_digest(row)) or len(ids) != len(REQUIRED_PURPOSES) or len(events) != len(ids)):
            raise ValueError()
        purposes = set()
        for event in events:
            document = db.get(ConsentCatalogDocument, event.document_id)
            if (event.patient_id != consultation.patient_id or event.action != 'grant' or event.created_at > row.captured_at
                    or document.country != row.country or document.language != row.language
                    or not valid_document(document, row.captured_at)):
                raise ValueError()
            purposes.add(document.purpose)
        if purposes != set(REQUIRED_PURPOSES): raise ValueError()
    except (ValueError, TypeError, KeyError):
        raise HTTPException(409, {'code': 'episode_consent_integrity_review', 'message': 'A prova de autorização do episódio requer verificação.'}) from None
