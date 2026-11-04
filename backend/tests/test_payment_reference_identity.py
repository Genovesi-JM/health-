"""Reference correlation only; all provider observations are synthetic."""
import asyncio
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.database import engine
from app.health_models import Consultation, HealthAuditLog, HealthPayment
from app.services.payments import Currency, IBANTransferAdapter, PaymentIntent, PaymentProvider, PaymentStatus
from test_health_billing_lifecycle import api, people, appointment, checkout, status, webhook  # noqa: F401


def test_bank_reference_uses_entire_attempt_and_is_stable(monkeypatch):
    adapter = IBANTransferAdapter()
    monkeypatch.setattr(adapter, 'recipient_configured', lambda currency: True)
    monkeypatch.setattr(adapter, 'bank_details', lambda currency: {'beneficiary': 'Synthetic reference test'})
    identifiers = ['12345678-1234-4234-8234-1111deadbeef', '12345678-5678-4234-8234-1111deadbeef']
    intents = [PaymentIntent(id=value, company_id='synthetic', order_id='same-synthetic-order', amount=100,
                             currency=Currency.AOA, provider=PaymentProvider.IBAN_TRANSFER,
                             description='Synthetic reference test') for value in identifiers]
    results = [asyncio.run(adapter.create_payment(intent)) for intent in intents]
    assert results[0].provider_reference != results[1].provider_reference
    assert results[0].provider_reference == 'KAYA-' + identifiers[0].replace('-', '').upper()
    assert asyncio.run(adapter.create_payment(intents[0])).provider_reference == results[0].provider_reference


def duplicate(db, payment, patient_id, *, provider=None):
    row = HealthPayment(patient_id=patient_id, payment_type='consultation', amount=payment['amount'],
        currency=payment['currency'], status='pending', provider=provider or payment['provider'],
        provider_reference=payment['provider_reference'])
    db.add(row); db.commit()
    return row.id


@pytest.mark.parametrize('channel', ['webhook', 'status'])
def test_ambiguous_legacy_reference_cannot_credit_first_matching_patient(api, people, db_session, channel):
    item = appointment(api, people); key = str(uuid4())
    payment = checkout(api, people, item, key).json()
    other = duplicate(db_session, payment, people['other_patient']['profile'].id)
    api.adapter.outcome = PaymentStatus.COMPLETED
    result = webhook(api, payment) if channel == 'webhook' else status(api, people, item, key)
    assert result.status_code == 409, result.text
    assert result.json()['detail']['code'] == 'payment_reference_ambiguous'
    assert api.adapter.polls == 0
    assert db_session.get(HealthPayment, payment['payment_id'], populate_existing=True).status == 'pending'
    assert db_session.get(HealthPayment, other, populate_existing=True).status == 'pending'
    assert db_session.get(Consultation, item['id'], populate_existing=True).payment_status == 'pending'
    assert db_session.query(HealthAuditLog).filter_by(resource_id=payment['payment_id'], action='health_payment_confirmed').count() == 0


def test_provider_namespace_prevents_false_reference_collision(api, people, db_session):
    item = appointment(api, people); key = str(uuid4())
    payment = checkout(api, people, item, key).json()
    other = duplicate(db_session, payment, people['other_patient']['profile'].id, provider='visa_mastercard')
    assert webhook(api, payment).status_code == 200
    assert status(api, people, item, key).json()['consultation_paid'] is True
    assert db_session.get(HealthPayment, other, populate_existing=True).status == 'pending'


def test_reference_is_rechecked_after_provider_await(api, people, db_session, monkeypatch):
    item = appointment(api, people); key = str(uuid4())
    payment = checkout(api, people, item, key).json()
    other_patient_id = people['other_patient']['profile'].id
    async def delayed(reference):
        with Session(engine) as db:
            duplicate(db, payment, other_patient_id)
        return PaymentStatus.COMPLETED
    monkeypatch.setattr(api.adapter, 'check_status', delayed)
    response = status(api, people, item, key)
    assert response.status_code == 409
    assert db_session.get(Consultation, item['id'], populate_existing=True).payment_status == 'pending'
