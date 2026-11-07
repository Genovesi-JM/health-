"""No dotenv, vendor or patient access: security_tests conftest isolates I/O."""
import pytest
from app.config import settings
from app.services.verification.entra import EntraVerifiedIdProvider
from app.services.verification.base import DigitalCredentialRequest, ProviderMode, VerificationStatus


@pytest.mark.parametrize("configured", [False, True])
def test_entra_never_claims_live_or_accepts_callback(monkeypatch, configured):
    for field in ("entra_tenant_id", "entra_client_id", "entra_client_secret"):
        monkeypatch.setattr(settings, field, "synthetic-canary" if configured else None)
    provider = EntraVerifiedIdProvider()
    assert provider.mode == ProviderMode.UNAVAILABLE
    results = [provider.create_presentation_request(DigitalCredentialRequest("synthetic-ref", "Test User")),
               provider.fetch_status("synthetic-ref"),
               provider.parse_webhook({"requestStatus": "presentation_verified", "state": "synthetic-canary"})]
    assert provider.verify_webhook(b"{}", {"api-key": "synthetic-canary"}) is False
    for result in results:
        assert result.status == VerificationStatus.NOT_CONFIGURED
        assert result.mode == ProviderMode.UNAVAILABLE
        assert result.action_url is None and result.provider_reference is None
        assert "synthetic-canary" not in str(result.raw)
        assert not result.is_terminal()
