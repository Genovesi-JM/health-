from __future__ import annotations
"""
GeoVision Services Package

Multi-tenant platform services:
- Storage: S3-compatible object storage
- Payments: Multi-provider payment orchestration
- Risk Engine: Rule-based risk assessment
"""

__all__ = [
    "get_storage_service",
    "StorageService",
    "get_payment_orchestrator",
    "PaymentOrchestrator",
    "get_risk_engine",
    "RiskEngine",
]


def __getattr__(name):
    """Load optional provider dependencies only when their service is used."""
    if name in {"get_storage_service", "StorageService"}:
        from app.services.storage import get_storage_service, StorageService
        return {"get_storage_service": get_storage_service, "StorageService": StorageService}[name]
    if name in {"get_payment_orchestrator", "PaymentOrchestrator"}:
        from app.services.payments import get_payment_orchestrator, PaymentOrchestrator
        return {
            "get_payment_orchestrator": get_payment_orchestrator,
            "PaymentOrchestrator": PaymentOrchestrator,
        }[name]
    if name in {"get_risk_engine", "RiskEngine"}:
        from app.services.risk_engine import get_risk_engine, RiskEngine
        return {"get_risk_engine": get_risk_engine, "RiskEngine": RiskEngine}[name]
    raise AttributeError(name)
