"""Real pinned Azure SDKs, with identity and every network operation isolated.

The security-test container installs the real deployment dependencies. The host
test suite may skip this module when these optional packages are not installed.
No real service, account, file, token or patient is used here.
"""
from __future__ import annotations

import base64
import inspect
import os
from datetime import datetime, timezone
from importlib.metadata import version
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit
from unittest.mock import Mock

import pytest

identity = pytest.importorskip("azure.identity")
blob_sdk = pytest.importorskip("azure.storage.blob")

from azure.core.exceptions import ResourceNotFoundError  # noqa: E402
from app.config import settings  # noqa: E402
from app.services.health_storage import HealthStorageService  # noqa: E402


def test_real_managed_identity_constructor_without_token_or_network(monkeypatch):
    assert version("azure-identity") == "1.25.3"
    assert version("azure-storage-blob") == "12.30.1"
    assert "client_id" in inspect.signature(identity.ManagedIdentityCredential).parameters
    # Do not select a host's identity endpoints or configuration. Unlike a
    # DefaultAzureCredential chain, this does not inspect local CLI credentials.
    for name in list(os.environ):
        if name.startswith(("AZURE_", "MSI_", "IDENTITY_", "IMDS_")):
            monkeypatch.delenv(name, raising=False)
    with identity.ManagedIdentityCredential(client_id=None) as credential:
        assert callable(credential.get_token)
    # No get_token call: the autouse fixture blocks sockets as a second guard.


def test_real_blob_sdk_types_and_user_delegation_signing(monkeypatch):
    monkeypatch.setattr(settings, "health_storage_provider", "azure_blob")
    monkeypatch.setattr(settings, "azure_storage_account_name", "kayasynthetictest")
    monkeypatch.setattr(settings, "azure_storage_container", "clinical-private")
    monkeypatch.setattr(settings, "azure_storage_managed_identity_client_id", None)
    monkeypatch.setattr(settings, "azure_storage_signed_url_seconds", 300)
    objects = {}
    upload_settings = []
    observed_blobs = []

    credential = SimpleNamespace(get_token=Mock(side_effect=AssertionError("No live token requests")))
    factory = Mock(return_value=credential)
    monkeypatch.setattr(identity, "ManagedIdentityCredential", factory)
    # Use actual ContainerProperties, exercising its dictionary/public_access
    # semantics rather than assuming a mock dict matches the pinned SDK.
    monkeypatch.setattr(blob_sdk.ContainerClient, "get_container_properties", lambda self: blob_sdk.ContainerProperties())

    def upload(blob, data, **kwargs):
        observed_blobs.append(blob)
        upload_settings.append(kwargs)
        objects[blob.blob_name] = data

    def download(blob):
        return SimpleNamespace(readall=lambda: objects[blob.blob_name])

    def delete(blob):
        if blob.blob_name not in objects:
            error = ResourceNotFoundError("Synthetic missing blob")
            error.error_code = "BlobNotFound"
            raise error
        del objects[blob.blob_name]

    def delegation(service, *, key_start_time, key_expiry_time):
        assert service.account_name == "kayasynthetictest"
        key = blob_sdk.UserDelegationKey()
        key.signed_oid = "11111111-1111-4111-8111-111111111111"
        key.signed_tid = "22222222-2222-4222-8222-222222222222"
        key.signed_start = key_start_time.strftime("%Y-%m-%dT%H:%M:%SZ")
        key.signed_expiry = key_expiry_time.strftime("%Y-%m-%dT%H:%M:%SZ")
        key.signed_service = "b"
        key.signed_version = "2025-11-05"
        key.value = base64.b64encode(b"synthetic-test-signing-bytes-not-an-azure-secret").decode("ascii")
        return key

    monkeypatch.setattr(blob_sdk.BlobClient, "upload_blob", upload)
    monkeypatch.setattr(blob_sdk.BlobClient, "download_blob", download)
    monkeypatch.setattr(blob_sdk.BlobClient, "delete_blob", delete)
    monkeypatch.setattr(blob_sdk.BlobServiceClient, "get_user_delegation_key", delegation)

    storage = HealthStorageService()
    try:
        key, stable_url = storage.upload_bytes(b"synthetic bytes", "test", "solução.pdf")
        factory.assert_called_once_with(client_id=None)
        assert isinstance(storage.client, blob_sdk.BlobServiceClient)
        assert isinstance(observed_blobs[0], blob_sdk.BlobClient)
        assert observed_blobs[0].url == stable_url
        assert "%C3%A7" in stable_url
        assert isinstance(upload_settings[0]["content_settings"], blob_sdk.ContentSettings)
        assert upload_settings[0]["content_settings"].cache_control == "private, no-store"
        assert upload_settings[0]["overwrite"] is False
        assert storage.download_bytes(key) == b"synthetic bytes"

        url = storage.get_signed_url(key)
        query = parse_qs(urlsplit(url).query)
        assert query["sp"] == ["r"]
        assert query["spr"] == ["https"]
        assert query["sr"] == ["b"]
        assert query["skoid"] == ["11111111-1111-4111-8111-111111111111"]
        assert query["rscc"] == ["private, no-store"]
        assert "sig" in query
        expiry = datetime.fromisoformat(query["se"][0].replace("Z", "+00:00"))
        assert 295 <= (expiry - datetime.now(timezone.utc)).total_seconds() <= 300
        assert storage.delete(key) is True
        assert storage.delete(key) is True
        credential.get_token.assert_not_called()
    finally:
        if storage._client is not None:
            storage._client.close()
