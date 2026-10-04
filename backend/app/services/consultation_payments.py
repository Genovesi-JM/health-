"""Serialize financial observations with care without making money care approval.

Provider delivery/refunds/settlement remain separate launch work. This module
never calls a provider and never creates, restarts or reallocates clinical care.
"""
from datetime import datetime, timezone
import hashlib
import hmac
import json
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import update

from app.health_models import ClinicianCredential, Consultation, Doctor, HealthAuditLog, HealthPayment
from app.models import User
from app.services.appointments import lock_resources
from app.services.clinician_access import require_current_clinician
from app.services.request_expiry import annotate_expiry
from app.services.payments import PaymentProvider


def request_key(value):
    try:
        return str(UUID(value))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(422, 'Indique uma chave UUID para iniciar ou recuperar o pagamento.') from None


def _not_committed(reason, message, **details):
    return HTTPException(409, {'code': 'checkout_not_committed', 'request_key_committed': False,
                              'reason': reason, 'message': message, **details})


def _metadata(payment):
    try:
        value = json.loads(payment.metadata_json or '{}')
    except (TypeError, ValueError):
        return {'legacy_metadata_raw': payment.metadata_json}, False
    if not isinstance(value, dict):
        return {'legacy_metadata_value': value}, False
    return value, True


def review_fields(payment):
    metadata, _ = _metadata(payment)
    review = metadata.get('financial_review')
    if not isinstance(review, dict) or review.get('status') not in ('not_required', 'required'):
        return {'financial_review_status': 'unassessed', 'financial_review_reason': None}
    return {'financial_review_status': review['status'], 'financial_review_reason': review.get('reason')}


def _lock_consultation(db, identifier):
    item = db.get(Consultation, identifier, populate_existing=True) if identifier else None
    if item:
        doctor_id, patient_id = item.doctor_id, item.patient_id
        lock_resources(db, doctor_id, patient_id)
        db.refresh(item)
        if item.doctor_id != doctor_id or item.patient_id != patient_id:
            raise HTTPException(409, 'A consulta mudou. Atualize antes de continuar o pagamento.')
    return item


def _authority_reason(db, item):
    if not item.doctor_id:
        return 'clinician_unassigned'
    if item.country not in ('AO', 'PT'):
        return 'country_unconfirmed'
    doctor = db.get(Doctor, item.doctor_id, populate_existing=True)
    user = db.get(User, doctor.user_id, populate_existing=True) if doctor else None
    if not user:
        return 'clinician_authority_changed'
    # Refresh only authority rows. Expiring the entire session could discard
    # a provider observation which the caller has just received.
    db.query(ClinicianCredential).filter_by(user_id=user.id).populate_existing().all()
    try:
        credential = require_current_clinician(user, db)
    except HTTPException:
        return 'clinician_authority_changed'
    return None if credential.practice_country == item.country else 'clinician_country_changed'


def _care_reason(db, item):
    if not item:
        return 'consultation_missing'
    if item.status not in ('requested', 'scheduled', 'in_progress', 'completed'):
        return 'consultation_closed'
    if item.status == 'requested' and annotate_expiry([item], db)[0].request_expiry_state != 'open':
        return 'request_deadline_elapsed' if item.requested_expires_at and item.requested_expires_at <= datetime.utcnow() else 'request_requires_review'
    return _authority_reason(db, item)


def checkout_guard(db, item, patient_id):
    item = _lock_consultation(db, item.id)
    if not item or item.patient_id != patient_id:
        raise HTTPException(404, 'Consulta não encontrada.')
    reason = _care_reason(db, item)
    if reason:
        raise HTTPException(409, {'code': 'consultation_not_payable', 'reason': reason,
            'message': 'A consulta não permite iniciar este pagamento. Atualize ou contacte a equipa.'})
    if item.payment_status == 'paid':
        raise HTTPException(400, 'Consulta já paga.')
    if db.query(HealthPayment.id).filter_by(consultation_id=item.id, status='paid').first():
        raise HTTPException(409, {'code': 'financial_review_required',
            'message': 'Já existe um pagamento confirmado que requer reconciliação. Contacte a equipa.'})
    return item


def prepare_checkout(db, *, patient_id, actor_id, consultation_id, method, key, provider_gate, amount, currency):
    """Commit one owned intent before external dispatch; never redispatch replay."""
    key = request_key(key)
    method = method or PaymentProvider.MULTICAIXA_EXPRESS.value
    digest = hashlib.sha256(json.dumps({'consultation_id': consultation_id, 'provider': method},
                                      sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    def replay():
        previous = db.query(HealthPayment).filter_by(patient_id=patient_id, checkout_request_key=key).populate_existing().first()
        if previous and not hmac.compare_digest(previous.checkout_request_digest or '', digest):
            raise HTTPException(409, 'Esta chave pertence a outro pedido de pagamento. Recupere o pedido original.')
        return previous
    previous = replay()
    if previous:
        return previous, False
    item = db.get(Consultation, consultation_id)
    if not item or item.patient_id != patient_id:
        raise HTTPException(404, 'Consulta não encontrada.')
    try:
        item = _lock_consultation(db, consultation_id)
        previous = replay()
        if previous:
            return previous, False
        try:
            provider = PaymentProvider(method)
        except ValueError:
            raise _not_committed('provider_unavailable', 'Escolha um método de pagamento disponível.') from None
        if item.country != 'AO':
            raise _not_committed('quote_unavailable', 'O preço e a moeda deste mercado ainda aguardam aprovação.')
        try:
            checkout_guard(db, item, patient_id)
            from app.services.consent_runtime import require_effective
            require_effective(db, patient_id, item.country, item.consent_language)
            provider_gate(provider)
        except HTTPException as error:
            reason = error.detail.get('reason', error.detail.get('code', 'payment_unavailable')) if isinstance(error.detail, dict) else 'payment_unavailable'
            raise _not_committed(reason, 'Não foi criado um novo pedido de pagamento. Atualize ou contacte a equipa.') from None
        prior = db.query(HealthPayment).filter_by(consultation_id=consultation_id).order_by(HealthPayment.created_at.desc()).all()
        existing = next((row for row in prior if row.status != 'failed' or row.dispatch_state != 'response_recorded'
                         or review_fields(row)['financial_review_status'] != 'not_required'), None)
        if existing:
            raise _not_committed('existing_payment_attempt', 'Já existe um pedido de pagamento para esta consulta. Recupere-o antes de continuar.', payment_id=existing.id)
        payment = HealthPayment(patient_id=patient_id, consultation_id=consultation_id, payment_type='consultation',
            amount=amount, currency=currency, status='pending', provider=provider.value, description='Consulta KAYA',
            checkout_request_key=key, checkout_request_digest=digest, dispatch_state='dispatching',
            metadata_json=json.dumps({'financial_review': {'status': 'required', 'reason': 'payment_outcome_unknown',
                                                          'recorded_at': datetime.now(timezone.utc).isoformat()}}))
        db.add(payment); db.flush()
        _audit_once(db, payment, 'health_payment_checkout_requested', actor_id=actor_id, source='patient_checkout',
                    provider=provider.value, amount=amount, currency=currency)
        db.commit()
        db.refresh(payment)
        return payment, True
    except HTTPException:
        db.rollback(); raise
    except Exception:
        db.rollback()
        previous = replay()
        if previous:
            return previous, False
        raise HTTPException(503, 'Não foi possível confirmar o pedido. Repita com a mesma chave e conteúdo.') from None


def _audit_once(db, payment, action, *, actor_id, source, **metadata):
    if not db.query(HealthAuditLog.id).filter_by(resource_type='health_payment', resource_id=payment.id, action=action).first():
        db.add(HealthAuditLog(actor_user_id=actor_id, action=action, resource_type='health_payment', resource_id=payment.id,
                             metadata_json=json.dumps({'source': source, **metadata})))


def apply_observation(db, payment, status, *, source, actor_id=None):
    """Keep confirmed receipts, serialize duplicate callbacks, never revive care.

    Caller owns commit/rollback. It must not dirty this payment before locking;
    checkout flushes its newly created provider result while holding care locks.
    """
    item = _lock_consultation(db, payment.consultation_id)
    table = HealthPayment.__table__
    db.execute(update(table).where(table.c.id == payment.id).values(id=payment.id))
    db.refresh(payment)
    # A delayed delivery must never undo a recorded refund. Financial
    # reconciliation is explicit; callback order cannot restore a charge.
    if payment.status == 'refunded' and status != 'refunded':
        return payment
    # A delayed failure must not erase an already confirmed receipt.
    if payment.status == 'paid' and status not in ('paid', 'refunded'):
        return payment
    metadata, readable = _metadata(payment)
    existing_review = review_fields(payment)
    if status == 'paid':
        reason = _care_reason(db, item) if payment.payment_type == 'consultation' else None
        if item and payment.patient_id != item.patient_id:
            reason = 'patient_mismatch'
        if item and item.payment_status == 'paid' and item.payment_id != payment.id:
            reason = 'multiple_confirmed_payments'
        if not readable:
            reason = 'payment_metadata_unreadable'
        if existing_review['financial_review_status'] == 'required' and existing_review['financial_review_reason'] != 'payment_outcome_unknown':
            reason = existing_review['financial_review_reason'] or 'previous_financial_review'
        payment.status = 'paid'
        payment.dispatch_state = 'response_recorded'
        metadata['financial_review'] = {'status': 'required' if reason else 'not_required', 'reason': reason,
            'recorded_at': (metadata.get('financial_review') or {}).get('recorded_at') if isinstance(metadata.get('financial_review'), dict) else None}
        metadata['financial_review']['recorded_at'] = metadata['financial_review']['recorded_at'] or datetime.now(timezone.utc).isoformat()
        if source == 'admin' and actor_id:
            metadata['confirmed_by'] = actor_id
        if reason:
            _audit_once(db, payment, 'health_payment_financial_review_required', actor_id=actor_id, source=source, reason=reason)
        elif item:
            item.payment_status = 'paid'
            item.payment_id = payment.id
        _audit_once(db, payment, 'health_payment_confirmed', actor_id=actor_id, source=source,
                    financial_review_required=bool(reason))
        payment.metadata_json = json.dumps(metadata)
    else:
        payment.status = status
        payment.dispatch_state = 'response_recorded'
        if existing_review['financial_review_reason'] == 'payment_outcome_unknown':
            metadata['financial_review'] = {'status': 'not_required', 'reason': None,
                                           'recorded_at': datetime.now(timezone.utc).isoformat()}
            payment.metadata_json = json.dumps(metadata)
        reason = _care_reason(db, item) if payment.payment_type == 'consultation' else None
        if reason and status == 'pending':
            metadata['financial_review'] = {'status': 'required', 'reason': reason,
                                           'recorded_at': datetime.now(timezone.utc).isoformat()}
            payment.metadata_json = json.dumps(metadata)
            _audit_once(db, payment, 'health_payment_financial_review_required', actor_id=actor_id, source=source, reason=reason)
        if status == 'refunded':
            metadata['financial_review'] = {'status': 'required', 'reason': 'refund_requires_reconciliation',
                                           'recorded_at': datetime.now(timezone.utc).isoformat()}
            payment.metadata_json = json.dumps(metadata)
            _audit_once(db, payment, 'health_payment_financial_review_required', actor_id=actor_id,
                        source=source, reason='refund_requires_reconciliation')
    db.add(payment)
    db.flush()
    return payment


def consultation_payment_applied(payment, item):
    return bool(payment.status == 'paid' and item and item.status in ('requested', 'scheduled', 'in_progress', 'completed')
        and item.payment_status == 'paid' and item.payment_id == payment.id
        and review_fields(payment)['financial_review_status'] == 'not_required')


def refresh_known_receipt(db, payment):
    if payment.status == 'paid' or (payment.status == 'pending' and payment.dispatch_state == 'response_recorded'):
        apply_observation(db, payment, payment.status, source='owner_recovery')
        db.commit(); db.refresh(payment)
    return payment


def mark_unknown(db, identifier):
    payment = db.get(HealthPayment, identifier, populate_existing=True)
    _lock_consultation(db, payment.consultation_id)
    db.execute(update(HealthPayment.__table__).where(HealthPayment.id == identifier).values(id=identifier))
    db.refresh(payment)
    if payment.dispatch_state == 'dispatching':
        payment.dispatch_state = 'unknown'
        _audit_once(db, payment, 'health_payment_outcome_unknown', actor_id=None, source='checkout_dispatch')
    db.commit(); db.refresh(payment)
    return payment


def record_dispatch_result(db, identifier, result):
    payment = db.get(HealthPayment, identifier, populate_existing=True)
    _lock_consultation(db, payment.consultation_id)
    db.execute(update(HealthPayment.__table__).where(HealthPayment.id == identifier).values(id=identifier))
    db.refresh(payment)
    # A webhook may have delivered a definitive outcome before checkout returned.
    if payment.dispatch_state != 'dispatching':
        return payment
    if not result.success:
        # An unsuccessful adapter response can still identify an external
        # attempt. Preserve bounded reconciliation evidence without treating
        # an adapter/network failure as proof that no charge exists.
        metadata, _ = _metadata(payment)
        metadata['dispatch_observation'] = {
            'adapter_success': False,
            'adapter_status': getattr(result.status, 'value', str(result.status)),
            'error_code': str(result.error_code)[:200] if result.error_code is not None else None,
            'error_detail_sha256': hashlib.sha256(str(result.error_message).encode()).hexdigest() if result.error_message else None,
            'recorded_at': datetime.now(timezone.utc).isoformat(),
        }
        if result.provider_reference:
            reference = str(result.provider_reference)
            if len(reference) <= 200:
                payment.provider_reference = reference
            else:
                metadata['dispatch_observation']['provider_reference_sha256'] = hashlib.sha256(reference.encode()).hexdigest()
        payment.metadata_json = json.dumps(metadata)
        db.flush()
        return mark_unknown(db, identifier)
    raw = result.raw_response or {}
    metadata, _ = _metadata(payment)
    metadata.update({name: raw.get(name) for name in ('transfer_details', 'instructions')})
    metadata.update(qr_code=result.qr_code, redirect_url=result.redirect_url, client_secret=result.client_secret,
                    mock=bool(raw.get('mock')))
    payment.provider_reference = result.provider_reference
    payment.metadata_json = json.dumps(metadata)
    db.flush()
    from app.services.payments import PaymentStatus
    status = 'paid' if result.status == PaymentStatus.COMPLETED else 'failed' if result.status in (PaymentStatus.FAILED, PaymentStatus.CANCELLED) else 'pending'
    apply_observation(db, payment, status, source='checkout_response')
    db.commit(); db.refresh(payment)
    return payment
