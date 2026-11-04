"""Private Azure storage contract, with synthetic bytes and a mocked SDK only."""
from __future__ import annotations

import io
import sys
from datetime import datetime, timezone
from types import ModuleType, SimpleNamespace
from unittest.mock import Mock

import pytest

from app.config import settings
from app.services import health_storage
from app.services.health_storage import HealthStorageError, HealthStorageService


@pytest.fixture
def azure_sdk(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "health_storage_provider", "azure_blob")
    monkeypatch.setattr(settings, "azure_storage_account_name", "kayasynthetictest")
    monkeypatch.setattr(settings, "azure_storage_container", "clinical-private")
    monkeypatch.setattr(settings, "azure_storage_managed_identity_client_id", None)
    monkeypatch.setattr(settings, "azure_storage_signed_url_seconds", 300)
    monkeypatch.setattr(health_storage, "LOCAL_UPLOAD_DIR", tmp_path / "must-not-be-created")

    class FakeNotFound(Exception):
        def __init__(self, error_code):
            self.error_code = error_code

    state = SimpleNamespace(
        objects={}, calls=[], properties={"public_access": None},
        privacy_error=None, operation_error=None, credential_error=None,
        delegation_error=None, missing_code="BlobNotFound",
        credential_args=[], service_args=[], signed_args=[], delegation_args=[],
        delegation_key=object(),
    )

    class FakeCredential:
        def __init__(self, **kwargs):
            state.credential_args.append(kwargs)
            if state.credential_error:
                raise state.credential_error

    class FakeBlob:
        def __init__(self, key):
            self.key = key

        def upload_blob(self, data, **kwargs):
            state.calls.append(("upload", self.key, kwargs))
            if state.operation_error:
                raise state.operation_error
            assert self.key not in state.objects
            state.objects[self.key] = data

        def download_blob(self):
            state.calls.append(("download", self.key))
            if state.operation_error:
                raise state.operation_error
            if self.key not in state.objects:
                raise FakeNotFound("BlobNotFound")
            return SimpleNamespace(readall=lambda: state.objects[self.key])

        def delete_blob(self, **kwargs):
            state.calls.append(("delete", self.key, kwargs))
            if state.operation_error:
                raise state.operation_error
            if self.key not in state.objects:
                raise FakeNotFound(state.missing_code)
            del state.objects[self.key]

    class FakeContainer:
        def get_container_properties(self):
            state.calls.append(("privacy",))
            if state.privacy_error:
                raise state.privacy_error
            return state.properties

        def get_blob_client(self, key):
            return FakeBlob(key)

    class FakeService:
        def __init__(self, **kwargs):
            state.service_args.append(kwargs)

        def get_container_client(self, name):
            assert name == "clinical-private"
            return FakeContainer()

        def get_user_delegation_key(self, **kwargs):
            state.delegation_args.append(kwargs)
            if state.delegation_error:
                raise state.delegation_error
            return state.delegation_key

    def fake_sas(**kwargs):
        state.signed_args.append(kwargs)
        return "synthetic-read-only-sas-not-a-credential"

    for name in ("azure", "azure.identity", "azure.storage", "azure.storage.blob", "azure.core", "azure.core.exceptions"):
        monkeypatch.setitem(sys.modules, name, ModuleType(name))
    monkeypatch.setattr(sys.modules["azure.identity"], "ManagedIdentityCredential", FakeCredential, raising=False)
    blob_module = sys.modules["azure.storage.blob"]
    monkeypatch.setattr(blob_module, "BlobServiceClient", FakeService, raising=False)
    monkeypatch.setattr(blob_module, "ContentSettings", lambda **kw: SimpleNamespace(**kw), raising=False)
    monkeypatch.setattr(blob_module, "BlobSasPermissions", lambda **kw: kw, raising=False)
    monkeypatch.setattr(blob_module, "generate_blob_sas", fake_sas, raising=False)
    monkeypatch.setattr(sys.modules["azure.core.exceptions"], "ResourceNotFoundError", FakeNotFound, raising=False)
    return state


@pytest.mark.parametrize("environment", ["pilot", "staging", "stage", "prod", "production", " PRODUCTION "])
@pytest.mark.parametrize("provider", ["auto", "local"])
def test_hosted_storage_requires_explicit_durable_provider(monkeypatch, tmp_path, environment, provider):
    monkeypatch.setattr(settings, "env", environment)
    monkeypatch.setattr(settings, "health_storage_provider", provider)
    monkeypatch.setattr(health_storage, "LOCAL_UPLOAD_DIR", tmp_path / "forbidden")
    # Even existing S3 credentials cannot silently select a deployment backend.
    monkeypatch.setenv("DO_SPACES_KEY", "synthetic")
    monkeypatch.setenv("DO_SPACES_SECRET", "synthetic")
    with pytest.raises(HealthStorageError, match="explicit azure_blob or s3"):
        HealthStorageService()
    assert not health_storage.LOCAL_UPLOAD_DIR.exists()


@pytest.mark.parametrize("field,value", [
    ("health_storage_provider", "azure"),
    ("azure_storage_account_name", None),
    ("azure_storage_account_name", "UPPERCASE"),
    ("azure_storage_account_name", "https://example.test?sig=forbidden"),
    ("azure_storage_account_name", "a" * 25),
    ("azure_storage_container", None),
    ("azure_storage_container", "ab"),
    ("azure_storage_container", "-private"),
    ("azure_storage_container", "private--files"),
    ("azure_storage_container", "private/files"),
    ("azure_storage_container", "a" * 64),
    ("azure_storage_managed_identity_client_id", "not-an-identity-id"),
    ("azure_storage_signed_url_seconds", 59),
    ("azure_storage_signed_url_seconds", 901),
    ("azure_storage_signed_url_seconds", True),
])
def test_azure_invalid_configuration_fails_before_any_sdk_use(azure_sdk, monkeypatch, field, value):
    monkeypatch.setattr(settings, field, value)
    with pytest.raises(HealthStorageError):
        HealthStorageService()
    assert not azure_sdk.credential_args
    assert not azure_sdk.calls
    assert not health_storage.LOCAL_UPLOAD_DIR.exists()


def test_azure_upload_download_file_and_delete_contract(azure_sdk):
    storage = HealthStorageService()
    data = b"synthetic-document-no-patient-information"
    key, stable_url = storage.upload_bytes(data, "prescriptions", "synthetic.pdf")
    assert key.startswith("health/prescriptions/")
    assert stable_url == f"https://kayasynthetictest.blob.core.windows.net/clinical-private/{key}"
    assert "?" not in stable_url
    assert not azure_sdk.signed_args  # No signed URL persisted in file_url.
    assert storage.download_bytes(key) == data
    upload = next(call for call in azure_sdk.calls if call[0] == "upload")
    assert upload[2]["overwrite"] is False
    assert upload[2]["content_settings"].content_type == "application/pdf"
    assert upload[2]["content_settings"].cache_control == "private, no-store"
    stream = io.BytesIO(b"synthetic-image")
    stream.seek(4)
    image_key, _ = storage.upload_file(stream, "triage", "synthetic.png", "image/png")
    assert storage.download_bytes(image_key) == b"synthetic-image"
    assert storage.delete(key) is True
    assert storage.delete(key) is True  # Existing S3/local idempotent contract.
    assert key not in azure_sdk.objects
    assert all(call[2] == {} for call in azure_sdk.calls if call[0] == "delete")
    assert len([call for call in azure_sdk.calls if call[0] == "privacy"]) == 6
    assert not health_storage.LOCAL_UPLOAD_DIR.exists()


@pytest.mark.parametrize("client_id", [None, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"])
def test_azure_uses_only_selected_managed_identity(azure_sdk, monkeypatch, client_id):
    monkeypatch.setattr(settings, "azure_storage_managed_identity_client_id", client_id)

    def forbidden_env(*args, **kwargs):
        raise AssertionError("Azure must not read S3, account keys, or credential-chain variables")

    monkeypatch.setattr(health_storage.os, "getenv", forbidden_env)
    storage = HealthStorageService()
    storage.upload_bytes(b"synthetic", "test", "test.pdf")
    assert azure_sdk.credential_args == [{"client_id": client_id}]
    client_args = azure_sdk.service_args[0]
    assert client_args["account_url"] == "https://kayasynthetictest.blob.core.windows.net"
    assert not isinstance(client_args["credential"], (str, dict))
    assert client_args["logging_enable"] is False
    assert client_args["logging_body"] is False
    assert storage.provider == "azure_blob"
    assert storage._use_local is False


@pytest.mark.parametrize("requested,configured,expected", [(3600, 300, 300), (86400, 900, 900), (30, 300, 30)])
def test_azure_download_sas_is_short_read_only_https_and_blob_scoped(azure_sdk, monkeypatch, requested, configured, expected):
    monkeypatch.setattr(settings, "azure_storage_signed_url_seconds", configured)
    storage = HealthStorageService()
    key = "health/prescriptions/synthetic.pdf"
    before = datetime.now(timezone.utc)
    result = storage.get_signed_url(key, requested)
    after = datetime.now(timezone.utc)
    args = azure_sdk.signed_args[0]
    assert args["account_name"] == "kayasynthetictest"
    assert args["container_name"] == "clinical-private"
    assert args["blob_name"] == key
    assert args["permission"] == {"read": True}
    assert args["protocol"] == "https"
    assert args["user_delegation_key"] is azure_sdk.delegation_key
    assert "account_key" not in args
    assert args["cache_control"] == "private, no-store"
    assert before.timestamp() + expected <= args["expiry"].timestamp() <= after.timestamp() + expected
    assert (args["expiry"] - args["start"]).total_seconds() == expected + 60
    assert azure_sdk.delegation_args == [{"key_start_time": args["start"], "key_expiry_time": args["expiry"]}]
    assert result.endswith("?synthetic-read-only-sas-not-a-credential")
    assert azure_sdk.calls == [("privacy",)]


@pytest.mark.parametrize("expiry", [0, -1, True, "300", None])
def test_invalid_sas_expiry_rejected_before_network(azure_sdk, expiry):
    with pytest.raises(ValueError):
        HealthStorageService().get_signed_url("health/test/synthetic.pdf", expiry)
    assert not azure_sdk.calls


@pytest.mark.parametrize("public_access", ["blob", "container", "", "unknown", False])
@pytest.mark.parametrize("operation", ["upload", "download", "sign", "delete"])
def test_public_or_unknown_privacy_never_accesses_files(azure_sdk, public_access, operation):
    azure_sdk.properties = {"public_access": public_access}
    storage = HealthStorageService()
    actions = {
        "upload": lambda: storage.upload_bytes(b"synthetic", "test", "file.pdf"),
        "download": lambda: storage.download_bytes("health/test/file.pdf"),
        "sign": lambda: storage.get_signed_url("health/test/file.pdf"),
        "delete": lambda: storage.delete("health/test/file.pdf"),
    }
    if operation == "delete":
        assert actions[operation]() is False
    else:
        with pytest.raises(HealthStorageError, match="must be private"):
            actions[operation]()
    assert azure_sdk.calls == [("privacy",)]
    assert not azure_sdk.signed_args
    assert not azure_sdk.objects


def test_missing_privacy_property_is_not_assumed_private(azure_sdk):
    azure_sdk.properties = {}
    with pytest.raises(HealthStorageError, match="must be private"):
        HealthStorageService().upload_bytes(b"synthetic", "test", "file.pdf")


def test_privacy_is_rechecked_after_configuration_changes(azure_sdk):
    storage = HealthStorageService()
    key, _ = storage.upload_bytes(b"synthetic", "test", "file.pdf")
    azure_sdk.properties = {"public_access": "blob"}
    with pytest.raises(HealthStorageError):
        storage.download_bytes(key)
    assert not any(call[0] == "download" for call in azure_sdk.calls)


@pytest.mark.parametrize("failure", ["credential_error", "privacy_error", "operation_error", "delegation_error"])
def test_azure_failures_never_fall_back_or_expose_provider_details(azure_sdk, monkeypatch, caplog, failure):
    monkeypatch.setenv("DO_SPACES_KEY", "synthetic-fallback-must-not-be-used")
    monkeypatch.setenv("DO_SPACES_SECRET", "synthetic-fallback-must-not-be-used")
    marker = "synthetic-sensitive-provider-response-must-not-appear"
    setattr(azure_sdk, failure, RuntimeError(marker))
    storage = HealthStorageService()
    with pytest.raises(HealthStorageError) as error:
        if failure == "delegation_error":
            storage.get_signed_url("health/test/synthetic.pdf")
        else:
            storage.upload_bytes(b"synthetic", "test", "file.pdf")
    assert marker not in str(error.value)
    assert marker not in caplog.text
    assert error.value.__suppress_context__ is True
    assert storage.provider == "azure_blob"
    assert storage._use_local is False
    assert not health_storage.LOCAL_UPLOAD_DIR.exists()


def test_missing_azure_dependency_fails_closed(azure_sdk, monkeypatch):
    monkeypatch.setitem(sys.modules, "azure.identity", None)
    with pytest.raises(HealthStorageError):
        HealthStorageService().download_bytes("health/test/synthetic.pdf")
    assert not health_storage.LOCAL_UPLOAD_DIR.exists()


def test_azure_delete_error_does_not_claim_success(azure_sdk, caplog):
    azure_sdk.operation_error = RuntimeError("sensitive-provider-response")
    assert HealthStorageService().delete("health/test/synthetic.pdf") is False
    assert "sensitive-provider-response" not in caplog.text


def test_missing_container_is_not_treated_as_missing_blob(azure_sdk):
    azure_sdk.missing_code = "ContainerNotFound"
    assert HealthStorageService().delete("health/test/synthetic.pdf") is False


@pytest.mark.parametrize("key", ["../record.pdf", "health/../record.pdf", "health//file.pdf", "health/test/./file", "/health/file", "health/test\\file", "other-project/file"])
def test_storage_keys_cannot_escape_health_namespace(azure_sdk, key):
    storage = HealthStorageService()
    for method in (storage.download_bytes, storage.delete, storage.get_signed_url):
        with pytest.raises(ValueError):
            method(key)
    assert not azure_sdk.calls


def test_development_auto_preserves_s3_selection_and_contract(monkeypatch):
    monkeypatch.setattr(settings, "health_storage_provider", "auto")
    monkeypatch.setenv("DO_SPACES_KEY", "synthetic")
    monkeypatch.setenv("DO_SPACES_SECRET", "synthetic")
    storage = HealthStorageService()
    client = Mock()
    storage._client = client
    client.get_object.return_value = {"Body": io.BytesIO(b"synthetic")}
    client.generate_presigned_url.return_value = "https://synthetic.example.invalid/download"
    key, url = storage.upload_bytes(b"synthetic", "test", "file.pdf")
    assert storage.provider == "s3"
    assert url.endswith(key)
    assert client.put_object.call_args.kwargs["ACL"] == "private"
    assert storage.download_bytes(key) == b"synthetic"
    assert storage.get_signed_url(key, 600) == "https://synthetic.example.invalid/download"
    assert client.generate_presigned_url.call_args.kwargs["ExpiresIn"] == 600
    assert storage.delete(key) is True


def test_explicit_s3_missing_credentials_does_not_fall_back(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "health_storage_provider", "s3")
    monkeypatch.setattr(health_storage, "LOCAL_UPLOAD_DIR", tmp_path / "forbidden")
    with pytest.raises(HealthStorageError, match="incomplete"):
        HealthStorageService()
    assert not health_storage.LOCAL_UPLOAD_DIR.exists()


@pytest.mark.parametrize("document_type", ["prescription", "referral"])
@pytest.mark.parametrize("ttl", [60, 300, 900])
def test_authorized_document_download_reports_actual_azure_ttl(azure_sdk, monkeypatch, document_type, ttl):
    from app.routers import prescriptions

    monkeypatch.setattr(settings, "azure_storage_signed_url_seconds", ttl)
    storage = HealthStorageService()
    document = SimpleNamespace(
        id="synthetic-document", consultation_id="synthetic-consultation",
        file_storage_key="health/test/synthetic.pdf",
    )
    consultation = SimpleNamespace(id="synthetic-consultation")
    result_values = [document, consultation] if document_type == "prescription" else [None, document, consultation]
    queries = []
    for value in result_values:
        query = Mock()
        query.filter.return_value.first.return_value = value
        queries.append(query)
    database = Mock()
    retained_query = Mock()
    retained_query.filter_by.return_value.first.return_value = None
    database.query.side_effect = queries + [retained_query]
    monkeypatch.setattr(prescriptions, "get_health_storage", lambda: storage)
    monkeypatch.setattr(prescriptions, "_has_document_access", lambda *a: True)
    response = prescriptions.download_file("synthetic-document", user=SimpleNamespace(), db=database)
    assert response.expires_in_seconds == ttl
    args = azure_sdk.signed_args[0]
    assert (args["expiry"] - args["start"]).total_seconds() == response.expires_in_seconds + 60
    assert "synthetic-read-only-sas" in response.download_url


@pytest.mark.parametrize("document_type", ["prescription", "referral"])
def test_unauthorized_document_does_not_request_storage_url(azure_sdk, monkeypatch, document_type):
    from fastapi import HTTPException
    from app.routers import prescriptions

    document = SimpleNamespace(id="synthetic-document", consultation_id="synthetic-consultation")
    values = [document, object()] if document_type == "prescription" else [None, document, object()]
    queries = []
    for value in values:
        query = Mock()
        query.filter.return_value.first.return_value = value
        queries.append(query)
    database = Mock()
    database.query.side_effect = queries
    get_storage = Mock(side_effect=AssertionError("Storage must not run before authorization"))
    monkeypatch.setattr(prescriptions, "get_health_storage", get_storage)
    monkeypatch.setattr(prescriptions, "_has_document_access", lambda *a: False)
    with pytest.raises(HTTPException) as error:
        prescriptions.download_file("synthetic-document", user=SimpleNamespace(), db=database)
    assert error.value.status_code == 403
    get_storage.assert_not_called()
    assert not azure_sdk.calls


def test_file_response_requires_explicit_expiry_metadata():
    from pydantic import ValidationError
    from app.health_schemas import FileDownloadResponse

    with pytest.raises(ValidationError):
        FileDownloadResponse(file_id="synthetic", download_url="https://example.invalid", filename="synthetic.pdf")


def test_retained_azure_pdf_recovers_lost_upload_and_never_overwrites(azure_sdk, monkeypatch):
    from uuid import uuid4
    storage = HealthStorageService()
    key = f'health/clinical-documents/{uuid4()}.pdf'
    data = b'%PDF-1.7\nsynthetic retained bytes'
    blob_type = type(storage._private_azure_blob(key))
    original = blob_type.upload_blob
    def lost(self, content, **kwargs):
        original(self, content, **kwargs)
        raise TimeoutError('synthetic lost upload response')
    monkeypatch.setattr(blob_type, 'upload_blob', lost)
    storage.write_retained_bytes(data, key)
    storage.write_retained_bytes(data, key)
    assert azure_sdk.objects == {key: data}
    uploads = [call for call in azure_sdk.calls if call[0] == 'upload']
    assert len(uploads) == 1 and uploads[0][2]['overwrite'] is False
    with pytest.raises(HealthStorageError): storage.write_retained_bytes(b'%PDF-1.7\nconflicting bytes', key)
    assert azure_sdk.objects[key] == data


def test_retained_azure_container_missing_is_not_object_absence(azure_sdk):
    from uuid import uuid4
    storage = HealthStorageService()
    azure_sdk.missing_code = 'ContainerNotFound'
    # A container permission/configuration failure must not initiate an upload.
    azure_sdk.privacy_error = RuntimeError('synthetic inaccessible container')
    with pytest.raises(HealthStorageError): storage.write_retained_bytes(b'%PDF-1.7\nsynthetic', f'health/clinical-documents/{uuid4()}.pdf')
    assert not any(call[0] == 'upload' for call in azure_sdk.calls)


def test_retained_local_pdf_atomic_create_and_content_conflict(monkeypatch, tmp_path):
    from uuid import uuid4
    monkeypatch.setattr(settings, 'health_storage_provider', 'local')
    monkeypatch.setattr(health_storage, 'LOCAL_UPLOAD_DIR', tmp_path)
    storage = HealthStorageService(); key = f'health/clinical-documents/{uuid4()}.pdf'
    data = b'%PDF-1.7\nsynthetic'
    storage.write_retained_bytes(data, key); storage.write_retained_bytes(data, key)
    assert (tmp_path/key).read_bytes() == data
    with pytest.raises(HealthStorageError): storage.write_retained_bytes(b'%PDF-1.7\nother', key)
    assert (tmp_path/key).read_bytes() == data
    assert len(list((tmp_path/key).parent.iterdir())) == 1


def test_retained_s3_uses_conditional_create_and_recovers_exact_bytes(monkeypatch):
    from uuid import uuid4
    from botocore.exceptions import ClientError
    monkeypatch.setattr(settings, 'health_storage_provider', 's3')
    monkeypatch.setenv('DO_SPACES_KEY', 'synthetic'); monkeypatch.setenv('DO_SPACES_SECRET', 'synthetic')
    storage = HealthStorageService(); objects = {}; writes = []
    class Client:
        def get_object(self, **kwargs):
            key = kwargs['Key']
            if key not in objects: raise ClientError({'Error': {'Code': 'NoSuchKey'}}, 'GetObject')
            return {'Body': io.BytesIO(objects[key])}
        def put_object(self, **kwargs):
            writes.append(kwargs); assert kwargs['IfNoneMatch'] == '*'
            assert kwargs['Key'] not in objects
            objects[kwargs['Key']] = kwargs['Body']
            raise TimeoutError('synthetic uploaded but response lost')
    storage._client = Client()
    key = f'health/clinical-documents/{uuid4()}.pdf'; data = b'%PDF-1.7\nsynthetic'
    storage.write_retained_bytes(data, key); storage.write_retained_bytes(data, key)
    assert objects == {key: data} and len(writes) == 1
    with pytest.raises(HealthStorageError): storage.write_retained_bytes(b'%PDF-1.7\nwrong', key)
    assert len(writes) == 1
