"""Retain one exact document decision before delivering its immutable PDF bytes."""
from datetime import datetime
import hashlib
import hmac
import io
import json
from uuid import uuid4

from fastapi import HTTPException

from app.clinical_document_models import ClinicalDocumentRequest
from app.health_models import (Consultation, ConsultationConsentSnapshot, Doctor,
    HealthAuditLog, Patient, PatientConsentEvent, Prescription, Referral)
from app.models import User, UserProfile
from app.services.appointments import current_doctor, lock_resources
from app.services.consent_runtime import (REQUIRED_PURPOSES, canonical, normalized_key,
    require_effective, require_episode, valid_document)
from app.services.cursors import utc_timestamp
from app.services.clinician_access import require_current_clinician

MAX_PDF_BYTES = 2 * 1024 * 1024


def evidence_digest(row):
    return canonical({name: getattr(row, name) for name in (
        'id', 'actor_user_id', 'doctor_id', 'patient_id', 'consultation_id',
        'episode_snapshot_id', 'prescription_id', 'referral_id', 'kind', 'country',
        'consent_language', 'request_key', 'request_digest', 'request_json',
        'grant_ids_json', 'clinician_evidence_json', 'storage_key', 'pdf_sha256')} | {'created_at': utc_timestamp(row.created_at)})


def verify_request(db, row):
    """Verify retained scope, clinical content, bytes and exact grant provenance."""
    from app.health_models import ConsentCatalogDocument
    try:
        if (not hmac.compare_digest(row.evidence_digest, evidence_digest(row))
                or hashlib.sha256(row.pdf_bytes).hexdigest() != row.pdf_sha256
                or not row.pdf_bytes.startswith(b'%PDF-') or not 1 <= len(row.pdf_bytes) <= MAX_PDF_BYTES):
            raise ValueError()
        clinician = json.loads(row.clinician_evidence_json)
        if (clinician['actor_user_id'] != row.actor_user_id or clinician['practice_country'] != row.country
                or clinician['profession'] != 'doctor' or clinician['status'] != 'verified' or not clinician['credential_id']): raise ValueError()
        original = json.loads(row.request_json)
        if canonical(original) != row.request_digest or original['kind'] != row.kind or original['consultation_id'] != row.consultation_id:
            raise ValueError()
        consultation = db.get(Consultation, row.consultation_id, populate_existing=True)
        if (not consultation or consultation.patient_id != row.patient_id or consultation.doctor_id != row.doctor_id
                or consultation.country != row.country or consultation.consent_language != row.consent_language): raise ValueError()
        snapshot = db.get(ConsultationConsentSnapshot, row.episode_snapshot_id)
        if not snapshot or snapshot.consultation_id != row.consultation_id: raise ValueError()
        require_episode(db, consultation)
        ids = json.loads(row.grant_ids_json)
        events = db.query(PatientConsentEvent).filter(PatientConsentEvent.id.in_(ids)).all()
        if len(ids) != len(REQUIRED_PURPOSES) or len(events) != len(ids): raise ValueError()
        purposes = set()
        for event in events:
            document = db.get(ConsentCatalogDocument, event.document_id)
            if (event.action != 'grant' or event.patient_id != row.patient_id or event.created_at > row.created_at
                    or document.country != row.country or document.language != row.consent_language
                    or not valid_document(document, row.created_at)): raise ValueError()
            purposes.add(document.purpose)
        if purposes != set(REQUIRED_PURPOSES): raise ValueError()
        record = db.get(Prescription if row.kind == 'prescription' else Referral,
                        row.prescription_id or row.referral_id, populate_existing=True)
        if not record or record.consultation_id != row.consultation_id or record.created_at != row.created_at: raise ValueError()
        if row.kind == 'prescription':
            actual = {'medications': json.loads(record.medications_json), 'instructions': record.instructions}
        else: actual = {name: getattr(record, name) for name in ('destination','specialty','reason','urgency')}
        if actual != original['body'] or record.file_storage_key not in (None, row.storage_key) or record.file_url is not None: raise ValueError()
        return record
    except (ValueError, TypeError, KeyError, AttributeError):
        raise HTTPException(409, {'code': 'clinical_document_integrity_review',
            'message': 'A integridade do documento retido requer verificação.'}) from None


def document_out(db, row):
    record = verify_request(db, row)
    original = json.loads(row.request_json)['body']
    return {'id': record.id, 'consultation_id': row.consultation_id, **original,
            'file_url': None, 'created_at': utc_timestamp(row.created_at),
            'request_key': row.request_key, 'artifact_status': 'ready' if record.file_storage_key else 'pending',
            'pdf_sha256': row.pdf_sha256}


def lookup(db, user, request_key):
    key = normalized_key(request_key)
    row = db.query(ClinicalDocumentRequest).filter_by(actor_user_id=user.id, request_key=key).populate_existing().first()
    if not row:
        raise HTTPException(404, {'code': 'clinical_document_request_not_found',
            'request_in_flight_may_commit': True, 'message': 'Ainda não foi encontrado um resultado para esta chave.'})
    return {'kind': row.kind, 'request_key': row.request_key, 'document': document_out(db, row)}


def _deliver(db, row, storage_factory):
    """One stable object key and retained bytes survive upload/commit uncertainty."""
    lock_resources(db, row.doctor_id, row.patient_id)
    current_doctor(db, row.doctor_id, row.country)
    row = db.get(ClinicalDocumentRequest, row.id, populate_existing=True)
    record = verify_request(db, row)
    if record.file_storage_key:
        confirm_stored_pdf(storage_factory(), row)
        return document_out(db, row)
    try:
        storage = storage_factory()
        storage.write_retained_bytes(row.pdf_bytes, row.storage_key)
        record.file_storage_key = row.storage_key
        db.add(record)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(503, {'code': 'clinical_document_delivery_pending', 'request_committed': True,
            'request_key': row.request_key, 'message': 'O documento foi registado. A entrega do ficheiro ainda não foi confirmada; conserve a mesma chave.'}) from None
    return document_out(db, row)


def confirm_stored_pdf(storage, row):
    try:
        actual = storage.download_bytes(row.storage_key)
    except Exception:
        raise HTTPException(503, {'code':'clinical_document_storage_unavailable',
            'message':'O ficheiro retido não está disponível. Tente novamente mais tarde.'}, headers={'Cache-Control':'private, no-store'}) from None
    if not isinstance(actual, bytes) or not hmac.compare_digest(hashlib.sha256(actual).hexdigest(), row.pdf_sha256):
        raise HTTPException(409, {'code':'clinical_document_storage_integrity_review',
            'message':'O ficheiro armazenado não corresponde ao registo. A transferência foi bloqueada para revisão.'}, headers={'Cache-Control':'private, no-store'})


def generate(db, user, consultation_id, kind, body, request_key, *, storage_factory, render):
    key = normalized_key(request_key)
    payload = {'kind': kind, 'consultation_id': consultation_id, 'body': body}
    digest = canonical(payload)
    doctor = db.query(Doctor).filter_by(user_id=user.id).first()
    if not doctor: raise HTTPException(403, 'Perfil de médico não encontrado.')
    consultation = db.query(Consultation).filter_by(id=consultation_id, doctor_id=doctor.id).first()
    if not consultation: raise HTTPException(404, 'Consulta não encontrada ou não atribuída a si.')
    lock_resources(db, doctor.id, consultation.patient_id)
    row = db.query(ClinicalDocumentRequest).filter_by(actor_user_id=user.id, request_key=key).populate_existing().first()
    if row:
        if not hmac.compare_digest(row.request_digest, digest):
            raise HTTPException(409, {'code': 'clinical_document_key_conflict', 'request_key_committed': True,
                'message': 'Esta chave já identifica outro conteúdo. Recupere o pedido original.'})
        verify_request(db, row)
        # An existing authored decision does not become a new prescription after withdrawal.
        return _deliver(db, row, storage_factory)
    consultation = db.get(Consultation, consultation_id, populate_existing=True)
    doctor = current_doctor(db, doctor.id, consultation.country)
    if consultation.status != 'completed': raise HTTPException(409, 'Conclua a consulta antes de gerar o documento.')
    require_episode(db, consultation)
    grants = require_effective(db, consultation.patient_id, consultation.country, consultation.consent_language)
    snapshot = db.query(ConsultationConsentSnapshot).filter_by(consultation_id=consultation.id).one()
    patient = db.get(Patient, consultation.patient_id)
    patient_profile = db.get(UserProfile, patient.user_id)
    doctor_profile = db.get(UserProfile, user.id)
    # Captured bytes retain names/date even if profiles subsequently change.
    credential = require_current_clinician(db.get(User, user.id, populate_existing=True), db)
    created_at = datetime.utcnow()
    try:
        pdf = render(patient_name=(patient_profile.full_name if patient_profile else None) or 'Paciente',
            patient_dob=patient.date_of_birth, doctor_name=(doctor_profile.full_name if doctor_profile else None) or 'Médico',
            doctor_license=credential.licence_number or '', date=created_at, **body)
        if not isinstance(pdf, bytes) or not pdf.startswith(b'%PDF-') or not 1 <= len(pdf) <= MAX_PDF_BYTES:
            raise ValueError('PDF output unavailable')
        from pypdf import PdfReader
        if not 1 <= len(PdfReader(io.BytesIO(pdf), strict=True).pages) <= 64:
            raise ValueError('PDF page count outside supported range')
    except Exception:
        db.rollback()
        raise HTTPException(503, {'code': 'clinical_document_render_unavailable',
            'message': 'Não foi possível preparar um PDF válido. Conserve a chave e tente novamente.'}) from None
    identifier = str(uuid4())
    if kind == 'prescription':
        record = Prescription(id=identifier, consultation_id=consultation.id,
            medications_json=json.dumps(body['medications'], ensure_ascii=False), instructions=body['instructions'], created_at=created_at)
    else: record = Referral(id=identifier, consultation_id=consultation.id, created_at=created_at, **body)
    request_id = str(uuid4())
    row = ClinicalDocumentRequest(id=request_id, actor_user_id=user.id, doctor_id=doctor.id, patient_id=patient.id,
        consultation_id=consultation.id, episode_snapshot_id=snapshot.id, kind=kind, country=consultation.country,
        consent_language=consultation.consent_language, request_key=key, request_digest=digest,
        request_json=json.dumps(payload, sort_keys=True, separators=(',', ':')), grant_ids_json=json.dumps([grant.id for grant in grants]),
        clinician_evidence_json=json.dumps({'actor_user_id':user.id,'credential_id':credential.id,'practice_country':credential.practice_country,
            'profession':credential.profession,'status':credential.status,'licence_country':credential.licence_country,
            'licence_number':credential.licence_number,'licence_expiry_date':credential.licence_expiry_date}),
        prescription_id=identifier if kind=='prescription' else None, referral_id=identifier if kind=='referral' else None,
        storage_key=f'health/clinical-documents/{request_id}.pdf', pdf_sha256=hashlib.sha256(pdf).hexdigest(), pdf_bytes=pdf, created_at=created_at)
    row.evidence_digest = evidence_digest(row)
    try:
        db.add(record); db.flush(); db.add(row)
        db.add(HealthAuditLog(actor_user_id=user.id, action=kind+'_recorded', resource_type=kind, resource_id=identifier,
            metadata_json=json.dumps({'request_key':key, 'country':row.country, 'pdf_sha256':row.pdf_sha256})))
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(503, {'code':'clinical_document_outcome_unconfirmed',
            'message':'Não foi possível confirmar o registo. Recupere ou repita apenas com a mesma chave.'}) from None
    # External storage is deliberately outside the clinical record transaction.
    return _deliver(db, row, storage_factory)
