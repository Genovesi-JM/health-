from __future__ import annotations
"""In-process document-expiry scheduler.

A tiny asyncio loop (no third-party scheduler dependency) that runs the
credential-expiry scan on a fixed interval while the app is up. Opt-in via
``EXPIRY_SCAN_ENABLED`` so tests and dev don't spin a background loop.

The scan itself is synchronous DB work, so each tick runs it in a thread
(via ``run_in_executor``) to avoid blocking the event loop. Exceptions in a
tick are logged and swallowed — one bad run must never kill the scheduler.

For horizontally-scaled deployments prefer an external cron hitting
``POST /api/v1/compliance/expiry/scan`` on a single worker, to avoid every
replica scanning at once. This in-process loop is ideal for a single-worker
pilot deployment.
"""
import asyncio
import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


class ExpiryScheduler:
    def __init__(self, interval_hours: Optional[int] = None) -> None:
        self.interval_seconds = (interval_hours or settings.expiry_scan_interval_hours) * 3600
        self._task: Optional[asyncio.Task] = None
        self._stopped = asyncio.Event()

    async def _run_once(self) -> None:
        """Run a single expiry scan in a worker thread."""
        loop = asyncio.get_running_loop()
        try:
            result = await loop.run_in_executor(None, self._scan_sync)
            logger.info(
                "[ExpiryScheduler] scan complete: scanned=%s reminders=%s expired=%s",
                result.get("scanned"), result.get("reminders_fired"),
                result.get("credentials_expired"),
            )
        except Exception as exc:  # noqa: BLE001 — a bad tick must not kill the loop
            logger.exception("[ExpiryScheduler] scan failed: %s", exc)

    @staticmethod
    def _scan_sync() -> dict:
        # Import here so the module has no import-time DB dependency.
        from app.database import SessionLocal
        from app.services.document_expiry import scan_credentials
        db = SessionLocal()
        try:
            return scan_credentials(db).to_dict()
        finally:
            db.close()

    async def _loop(self) -> None:
        logger.info(
            "[ExpiryScheduler] started (every %s h)",
            self.interval_seconds / 3600,
        )
        # Run once shortly after startup, then on the interval.
        await self._run_once()
        while not self._stopped.is_set():
            try:
                await asyncio.wait_for(self._stopped.wait(), timeout=self.interval_seconds)
            except asyncio.TimeoutError:
                await self._run_once()
        logger.info("[ExpiryScheduler] stopped")

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._stopped.clear()
            self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        self._stopped.set()
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=5)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                self._task.cancel()
            self._task = None


# Module-level singleton used by the FastAPI startup/shutdown hooks.
scheduler = ExpiryScheduler()
