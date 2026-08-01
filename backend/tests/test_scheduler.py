"""Tests for the in-process expiry scheduler."""
from __future__ import annotations

import asyncio
import uuid
from datetime import date, timedelta

import pytest

from app.database import SessionLocal
from app.health_models import ClinicianCredential, DocumentExpiryReminder
from app.services.scheduler import ExpiryScheduler


def _make_credential(expiry: str, user_id: str) -> str:
    from app.models import User
    from app.utils import hash_password
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.id == user_id).first():
            db.add(User(id=user_id, email=f"sch-{user_id[:8]}@example.com",
                        password_hash=hash_password("x"), role="doctor", is_active=True))
            db.commit()
        cred = ClinicianCredential(
            user_id=user_id, profession="doctor", legal_name="Sched Doc",
            practice_country="AO", licence_country="AO", issuing_authority="Ordem",
            licence_number=f"LIC-{uuid.uuid4().hex[:6]}", licence_expiry_date=expiry,
            diploma_country="AO", diploma_institution="UAN", degree_title="Medicina",
            status="verified",
        )
        db.add(cred)
        db.commit()
        return cred.id
    finally:
        db.close()


def test_scheduler_disabled_by_default(client):
    from app.config import settings
    # Default config keeps the scheduler off so app creation never spins a loop.
    assert settings.expiry_scan_enabled is False


def test_scheduler_run_once_fires_reminders(client):
    """A single scheduler tick runs the expiry scan and writes reminders."""
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    cid = _make_credential((date.today() + timedelta(days=20)).isoformat(), user_id)

    sched = ExpiryScheduler(interval_hours=24)

    async def _drive():
        await sched._run_once()

    asyncio.run(_drive())

    db = SessionLocal()
    try:
        reminders = db.query(DocumentExpiryReminder).filter(
            DocumentExpiryReminder.entity_id == cid
        ).all()
        # 20 days out → 90/60/30 thresholds fire.
        assert len(reminders) >= 1
    finally:
        db.close()


def test_scheduler_start_stop_lifecycle(client):
    """start() spawns a task; stop() cancels it cleanly."""
    sched = ExpiryScheduler(interval_hours=24)

    async def _drive():
        sched.start()
        assert sched._task is not None
        # Give the loop a moment to run its initial scan.
        await asyncio.sleep(0.05)
        await sched.stop()
        assert sched._task is None

    asyncio.run(_drive())


def test_scheduler_bad_tick_does_not_raise(client, monkeypatch):
    """A failing scan is logged and swallowed, not propagated."""
    sched = ExpiryScheduler(interval_hours=24)

    def _boom() -> dict:
        raise RuntimeError("db down")

    monkeypatch.setattr(sched, "_scan_sync", staticmethod(_boom))

    async def _drive():
        # Must not raise.
        await sched._run_once()

    asyncio.run(_drive())
