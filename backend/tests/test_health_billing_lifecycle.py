"""Synthetic provider observations and durable checkout recovery; no money moves."""
from datetime import datetime, timedelta
import importlib.util
from pathlib import Path
from uuid import uuid4

from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session

from app.database import engine
from app.health_models import AppointmentSlot, ClinicianCredential, Consultation, HealthAuditLog, HealthPayment
from app.routers import appointments, consultations, health_billing as billing
from app.services.payments import Currency, IBANTransferAdapter, PaymentIntent, PaymentProvider, PaymentResult, PaymentStatus
from test_appointments import people, book, publish  # noqa: F401

ROOT = '/api/v1/billing'


@pytest.fixture
def api(monkeypatch):
    class Adapter:
        calls = []
        outcome = PaymentStatus.PENDING
        polls = 0
        raises = False
        success = True
        async def create_payment(self, intent):
            # A separate connection must see the request before any dispatch.
            with Session(engine) as db:
                row = db.get(HealthPayment, intent.id)
                assert row and row.checkout_request_key and row.dispatch_state == 'dispatching'
            self.calls.append(intent.id)
            if self.raises: raise TimeoutError('Synthetic lost provider response')
            return PaymentResult(success=self.success, payment_id=intent.id, status=self.outcome,
                                 provider_reference='synthetic-' + intent.id,
                                 error_code='synthetic_timeout' if not self.success else None,
                                 error_message='private adapter detail' if not self.success else None)
        async def check_status(self, reference):
            self.polls += 1
            return self.outcome
        def verify_webhook(self, raw, signature):
            return signature == 'synthetic-valid'
    adapter = Adapter()
    monkeypatch.setattr(billing, '_ADAPTERS', {provider: adapter for provider in PaymentProvider})
    monkeypatch.setattr(billing, '_provider_configured', lambda *args: True)
    application = FastAPI()
    for router in (appointments.router, consultations.router, billing.router): application.include_router(router)
    with TestClient(application, raise_server_exceptions=False) as client:
        client.adapter = adapter
        yield client


def appointment(api, people):
    return book(api, people, publish(api, people)).json()


def checkout(api, people, item, key, *, provider='multicaixa_express', who='patient'):
    return api.post(ROOT + '/consultation/checkout', json={'consultation_id': item['id'], 'payment_method': provider},
                    headers=people[who]['headers'] | {'Idempotency-Key': key})


def status(api, people, item, key, who='patient'):
    return api.get(ROOT + f'/consultation/{item["id"]}/payment-status', params={'request_key': key}, headers=people[who]['headers'])


def webhook(api, payment, outcome='completed', provider='multicaixa_express'):
    return api.post(ROOT + '/webhook/' + provider, json={'payment_id': payment['provider_reference'], 'status': outcome},
                    headers={'X-Signature': 'synthetic-valid'})


def test_checkout_commits_identity_before_dispatch_and_replays_exact_attempt(api, people, db_session):
    item = appointment(api, people); key = str(uuid4())
    first = checkout(api, people, item, key)
    assert first.status_code == 200, first.text
    assert first.headers['cache-control'] == 'private, no-store'
    payment = first.json()
    assert payment['status'] == 'pending' and payment['dispatch_state'] == 'response_recorded'
    assert payment['financial_review_status'] == 'not_required' and not payment['consultation_paid']
    assert checkout(api, people, item, key.upper()).json()['payment_id'] == payment['payment_id']
    assert len(api.adapter.calls) == 1
    changed = checkout(api, people, item, key, provider='visa_mastercard')
    assert changed.status_code == 409 and isinstance(changed.json()['detail'], str)
    fresh = checkout(api, people, item, str(uuid4()), provider='visa_mastercard')
    assert fresh.status_code == 409 and fresh.json()['detail']['request_key_committed'] is False
    assert fresh.json()['detail']['reason'] == 'existing_payment_attempt'
    assert status(api, people, item, key).json()['payment_id'] == payment['payment_id']
    assert status(api, people, item, key, who='other_patient').status_code == 404
    assert db_session.query(HealthPayment).filter_by(consultation_id=item['id']).count() == 1


@pytest.mark.parametrize('mode', ['exception', 'unsuccessful_result'])
def test_uncertain_provider_outcome_is_retained_and_never_automatically_redispatched(api, people, db_session, mode):
    item = appointment(api, people); key = str(uuid4())
    api.adapter.raises = mode == 'exception'; api.adapter.success = mode != 'unsuccessful_result'
    result = checkout(api, people, item, key)
    assert result.status_code == 200, result.text
    payment = result.json()
    assert payment['status'] == 'pending' and payment['dispatch_state'] == 'unknown'
    assert payment['financial_review_status'] == 'required' and payment['financial_review_reason'] == 'payment_outcome_unknown'
    assert not payment['consultation_paid']
    assert checkout(api, people, item, key).json()['payment_id'] == payment['payment_id']
    assert len(api.adapter.calls) == 1
    assert checkout(api, people, item, str(uuid4())).status_code == 409
    assert status(api, people, item, key).json()['dispatch_state'] == 'unknown'
    assert api.adapter.polls == 0
    if mode == 'unsuccessful_result':
        import json
        row = db_session.get(HealthPayment, payment['payment_id'])
        assert row.provider_reference == 'synthetic-' + row.id
        evidence = json.loads(row.metadata_json)['dispatch_observation']
        assert evidence['adapter_success'] is False and evidence['error_code'] == 'synthetic_timeout'
        assert len(evidence['error_detail_sha256']) == 64
        assert 'private adapter detail' not in row.metadata_json
        assert 'dispatch_observation' not in payment


@pytest.mark.parametrize('invalid', ['expired', 'cancelled', 'no_show', 'overdue', 'revoked', 'unassigned', 'PT', 'provider'])
def test_fresh_ineligible_checkout_has_no_local_or_provider_attempt(api, people, db_session, invalid):
    item = appointment(api, people)
    row = db_session.get(Consultation, item['id'])
    if invalid in ('expired', 'cancelled', 'no_show'): row.status = invalid
    elif invalid == 'overdue':
        row.created_at = datetime.utcnow() - timedelta(days=3)
        row.requested_expires_at = datetime.utcnow() - timedelta(minutes=1)
    elif invalid == 'revoked': db_session.query(ClinicianCredential).filter_by(user_id=people['doctor']['user'].id).one().status = 'revoked'
    elif invalid == 'unassigned': row.doctor_id = None
    elif invalid == 'PT': row.country = 'PT'
    db_session.commit()
    response = checkout(api, people, item, str(uuid4()), provider='missing' if invalid == 'provider' else 'multicaixa_express')
    assert response.status_code == 409, response.text
    assert response.json()['detail']['code'] == 'checkout_not_committed' and response.json()['detail']['request_key_committed'] is False
    assert not api.adapter.calls and not db_session.query(HealthPayment).filter_by(consultation_id=item['id']).count()


@pytest.mark.parametrize('terminal', ['cancelled', 'expired', 'overdue'])
def test_late_confirmed_money_requires_review_without_confirming_or_reopening_care(api, people, db_session, terminal):
    item = appointment(api, people); key = str(uuid4()); payment = checkout(api, people, item, key).json()
    row = db_session.get(Consultation, item['id'])
    if terminal == 'overdue':
        row.created_at = datetime.utcnow() - timedelta(days=3); row.requested_expires_at = datetime.utcnow() - timedelta(minutes=1)
    else: row.status = terminal
    db_session.commit()
    first = webhook(api, payment); second = webhook(api, payment)
    assert first.status_code == second.status_code == 200, first.text
    result = status(api, people, item, key).json()
    assert result['status'] == 'paid' and result['financial_review_status'] == 'required' and not result['consultation_paid']
    assert checkout(api, people, item, key).json()['payment_id'] == payment['payment_id']
    assert len(api.adapter.calls) == 1
    assert db_session.get(Consultation, item['id'], populate_existing=True).status == ('requested' if terminal == 'overdue' else terminal)
    assert db_session.get(Consultation, item['id']).payment_status == 'pending'
    assert db_session.query(HealthAuditLog).filter_by(resource_id=payment['payment_id'], action='health_payment_financial_review_required').count() == 1
    assert db_session.query(HealthAuditLog).filter_by(resource_id=payment['payment_id'], action='health_payment_confirmed').count() == 1


def test_paid_observation_applies_once_and_delayed_failure_cannot_erase_receipt(api, people, db_session):
    item = appointment(api, people); key = str(uuid4()); payment = checkout(api, people, item, key).json()
    assert webhook(api, payment).status_code == 200
    assert webhook(api, payment, 'failed').json()['new_status'] == 'paid'
    result = status(api, people, item, key).json()
    assert result['status'] == 'paid' and result['financial_review_status'] == 'not_required' and result['consultation_paid']
    assert db_session.query(HealthAuditLog).filter_by(resource_id=payment['payment_id'], action='health_payment_confirmed').count() == 1


def test_provider_reference_is_bound_to_the_provider(api, people, db_session):
    item = appointment(api, people); payment = checkout(api, people, item, str(uuid4()), provider='visa_mastercard').json()
    assert webhook(api, payment).json()['status'] == 'no_match'
    assert db_session.get(HealthPayment, payment['payment_id'], populate_existing=True).status == 'pending'


@pytest.mark.parametrize('late', ['completed', 'pending', 'failed'])
def test_recorded_refund_cannot_be_undone_by_delayed_callbacks(api, people, db_session, late):
    from app.services.consultation_payments import apply_observation
    item = appointment(api, people); key = str(uuid4()); payment = checkout(api, people, item, key).json()
    assert webhook(api, payment).status_code == 200
    # Refund provider reconciliation is not activated in this milestone.
    # Exercise its persisted observation boundary without inventing a webhook.
    row = db_session.get(HealthPayment, payment['payment_id'])
    apply_observation(db_session, row, 'refunded', source='synthetic_refund_receipt')
    db_session.commit()
    apply_observation(db_session, row, 'paid' if late == 'completed' else late, source='synthetic_delayed_receipt')
    db_session.commit()
    if late != 'pending':
        assert webhook(api, payment, late).json()['new_status'] == 'refunded'
    result = status(api, people, item, key).json()
    assert result['status'] == 'refunded' and not result['consultation_paid']
    assert result['financial_review_reason'] == 'refund_requires_reconciliation'
    assert checkout(api, people, item, key).json()['status'] == 'refunded'
    assert db_session.query(HealthAuditLog).filter_by(resource_id=payment['payment_id'], action='health_payment_confirmed').count() == 1


def test_pending_poll_returns_callback_receipt_arriving_during_await(api, people, monkeypatch):
    from app.services.consultation_payments import apply_observation
    item = appointment(api, people); key = str(uuid4()); payment = checkout(api, people, item, key).json()
    async def stale_pending(reference):
        with Session(engine) as db:
            apply_observation(db, db.get(HealthPayment, payment['payment_id']), 'paid', source='synthetic_concurrent_callback')
            db.commit()
        return PaymentStatus.PENDING
    monkeypatch.setattr(api.adapter, 'check_status', stale_pending)
    result = status(api, people, item, key)
    assert result.status_code == 200, result.text
    assert result.json()['status'] == 'paid' and result.json()['consultation_paid']
    recovered = api.get(ROOT + f'/consultation/{item["id"]}/payment-status', headers=people['patient']['headers']).json()
    assert recovered['request_key'] == key and recovered['provider'] == 'multicaixa_express'
    assert recovered['amount'] == payment['amount'] and recovered['currency'] == 'AOA'


def test_lost_initial_commit_ack_keeps_a_claimed_attempt_without_dispatching_again(api, people, monkeypatch):
    item = appointment(api, people); key = str(uuid4()); original = Session.commit; seen = []
    def lost(session):
        original(session)
        if not seen:
            seen.append(True); raise RuntimeError('Synthetic commit acknowledgment loss')
    monkeypatch.setattr(Session, 'commit', lost)
    payment = checkout(api, people, item, key).json()
    assert payment['dispatch_state'] == 'dispatching' and payment['financial_review_status'] == 'required'
    assert checkout(api, people, item, key).json()['payment_id'] == payment['payment_id']
    assert not api.adapter.calls


def test_audit_failure_rolls_back_confirmation_and_retry_recovers_same_receipt(api, people, db_session):
    item = appointment(api, people); payment = checkout(api, people, item, str(uuid4())).json()
    def fail(mapper, connection, row):
        if row.action == 'health_payment_confirmed': raise RuntimeError('Synthetic audit failure')
    event.listen(HealthAuditLog, 'before_insert', fail)
    try:
        assert webhook(api, payment).status_code == 500
    finally:
        event.remove(HealthAuditLog, 'before_insert', fail)
    assert db_session.get(HealthPayment, payment['payment_id'], populate_existing=True).status == 'pending'
    assert db_session.get(Consultation, item['id'], populate_existing=True).payment_status == 'pending'
    assert webhook(api, payment).status_code == 200


def test_portugal_methods_are_planned_and_bank_requires_actual_recipient(api, monkeypatch):
    methods = api.get(ROOT + '/payment-methods', params={'country': 'PT', 'currency': 'EUR', 'include_planned': 'true'}).json()['methods']
    assert methods and all(not method['enabled'] for method in methods)
    for name in ('COMPANY_IBAN', 'COMPANY_BIC', 'COMPANY_BANK_NAME', 'COMPANY_BENEFICIARY'):
        monkeypatch.delenv(name, raising=False)
    assert not IBANTransferAdapter.recipient_configured('AOA')
    assert not any(IBANTransferAdapter.bank_details('AOA').values())


def test_missing_or_invalid_key_cannot_dispatch(api, people):
    item = appointment(api, people)
    for key in ('', 'invalid'):
        assert checkout(api, people, item, key).status_code == 422
    assert not api.adapter.calls


def test_migration_preserves_legacy_unassessed_state_and_retains_new_attempts():
    spec = importlib.util.spec_from_file_location('payment_attempt_migration', Path(__file__).parents[1] / 'alembic/versions/health_payment_attempts_v1.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    database = create_engine('sqlite://')
    with database.begin() as connection:
        connection.exec_driver_sql('CREATE TABLE health_payments (id VARCHAR(36) PRIMARY KEY, patient_id VARCHAR(36), status VARCHAR(20))')
        connection.exec_driver_sql("INSERT INTO health_payments VALUES ('legacy','owner','paid')")
        with Operations.context(MigrationContext.configure(connection)):
            module.upgrade(); module.upgrade()
            assert connection.execute(text("SELECT dispatch_state FROM health_payments WHERE id='legacy'")).scalar() is None
            connection.execute(text("UPDATE health_payments SET checkout_request_key=:key WHERE id='legacy'"), {'key': str(uuid4())})
            with pytest.raises(RuntimeError, match='Retained'): module.downgrade()
    database.dispose()


def test_checkout_recovery_survives_withdrawal_but_fresh_attempt_cannot_dispatch(api, people, db_session):
    from consent_fixtures import withdraw
    item = appointment(api, people); key = str(uuid4()); payment = checkout(api, people, item, key).json()
    withdraw(db_session, people['patient']['profile'], 'health_data_processing'); db_session.commit()
    recovered = checkout(api, people, item, key)
    assert recovered.status_code == 200 and recovered.json()['payment_id'] == payment['payment_id']
    denied = checkout(api, people, item, str(uuid4()))
    assert denied.status_code == 409 and denied.json()['detail']['request_key_committed'] is False
    assert denied.json()['detail']['reason'] == 'consent_required'
    assert len(api.adapter.calls) == 1
