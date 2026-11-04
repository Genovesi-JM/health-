from __future__ import annotations
"""
Private health files: explicitly selected Azure Blob, S3, or local development.

Handles prescription/referral PDFs and doctor document uploads.
"""
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import BinaryIO, Optional, Tuple
from urllib.parse import quote

logger = logging.getLogger(__name__)

# Local uploads directory (fallback for dev)
LOCAL_UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
_HOSTED_ENVIRONMENTS = {"pilot", "stage", "staging", "prod", "production"}


class HealthStorageError(RuntimeError):
    """Storage is unavailable; never expose provider responses or signed URLs."""


class HealthStorageService:
    """Preserves the existing key/URL interface without cross-provider fallback.

    Azure needs an existing private container and managed-identity RBAC. Container
    privacy is checked on every operation; account-wide anonymous/shared-key
    restrictions and network policy must additionally be enforced by deployment.
    """

    def __init__(self):
        from app.config import settings

        self.provider = settings.health_storage_provider.strip().lower()
        if self.provider not in {"auto", "local", "s3", "azure_blob"}:
            raise HealthStorageError("Invalid HEALTH_STORAGE_PROVIDER.")
        if (settings.env.strip().lower() in _HOSTED_ENVIRONMENTS
                and self.provider in {"auto", "local"}):
            raise HealthStorageError(
                "Private durable health storage requires explicit azure_blob or s3 "
                "configuration in pilot, staging and production; local filesystem "
                "fallback is disabled."
            )

        self._client = None
        self._credential = None
        self._azure_container_client = None
        self._use_local = False
        if self.provider == "azure_blob":
            self._configure_azure(settings)
            return

        # Existing S3 environment-variable contract is retained for development
        # and explicitly selected S3 deployments. Azure never reads these keys.
        self.spaces_key = os.getenv("DO_SPACES_KEY")
        self.spaces_secret = os.getenv("DO_SPACES_SECRET")
        self.spaces_bucket = os.getenv("DO_SPACES_BUCKET", "health-platform")
        self.spaces_region = os.getenv("DO_SPACES_REGION", "nyc3")
        self.spaces_endpoint = os.getenv(
            "DO_SPACES_ENDPOINT",
            f"https://{self.spaces_region}.digitaloceanspaces.com",
        )
        if self.provider == "auto":
            self.provider = "s3" if self.spaces_key and self.spaces_secret else "local"
        if self.provider == "s3" and not (self.spaces_key and self.spaces_secret):
            raise HealthStorageError("S3 health storage credentials are incomplete.")
        self._use_local = self.provider == "local"

        if self._use_local:
            logger.info("[HealthStorage] Using local file storage (dev mode)")
            LOCAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        else:
            logger.info("[HealthStorage] Using private S3 storage")

    def _configure_azure(self, settings) -> None:
        account = settings.azure_storage_account_name or ""
        container = settings.azure_storage_container or ""
        if not re.fullmatch(r"[a-z0-9]{3,24}", account):
            raise HealthStorageError("AZURE_STORAGE_ACCOUNT_NAME must be a valid account name.")
        if (not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,61}[a-z0-9]", container)
                or "--" in container):
            raise HealthStorageError("AZURE_STORAGE_CONTAINER must be a valid private container name.")
        client_id = settings.azure_storage_managed_identity_client_id
        if client_id:
            try:
                client_id = str(uuid.UUID(client_id))
            except (ValueError, AttributeError):
                raise HealthStorageError("Invalid managed identity client ID.") from None
        ttl = settings.azure_storage_signed_url_seconds
        if isinstance(ttl, bool) or not isinstance(ttl, int) or not 60 <= ttl <= 900:
            raise HealthStorageError("AZURE_STORAGE_SIGNED_URL_SECONDS must be between 60 and 900.")
        self.azure_account = account
        self.azure_container = container
        self.azure_client_id = client_id or None
        self.azure_signed_url_seconds = ttl
        # No arbitrary endpoints, connection strings, account keys or SAS config.
        # Private endpoints use this same hostname with private DNS resolution.
        self.azure_account_url = f"https://{account}.blob.core.windows.net"
        logger.info("[HealthStorage] Using private Azure Blob storage with managed identity")

    @property
    def client(self):
        if self._client is None and self.provider == "azure_blob":
            try:
                from azure.identity import ManagedIdentityCredential
                from azure.storage.blob import BlobServiceClient

                self._credential = ManagedIdentityCredential(client_id=self.azure_client_id)
                self._client = BlobServiceClient(
                    account_url=self.azure_account_url,
                    credential=self._credential,
                    retry_total=2,
                    connection_timeout=5,
                    read_timeout=20,
                    logging_enable=False,
                    logging_body=False,
                )
            except Exception:
                raise HealthStorageError("Azure health storage could not be initialized.") from None
        elif self._client is None and self.provider == "s3":
            import boto3
            from botocore.config import Config

            self._client = boto3.client(
                "s3",
                region_name=self.spaces_region,
                endpoint_url=self.spaces_endpoint,
                aws_access_key_id=self.spaces_key,
                aws_secret_access_key=self.spaces_secret,
                config=Config(signature_version="s3v4"),
            )
        return self._client

    def _private_azure_blob(self, key: str):
        if self._azure_container_client is None:
            self._azure_container_client = self.client.get_container_client(self.azure_container)
        properties = self._azure_container_client.get_container_properties()
        # SDK ContainerProperties always exposes public_access; missing/unknown
        # state is not evidence that a container is private.
        if properties.get("public_access", "unknown") is not None:
            raise HealthStorageError("Azure health storage container must be private.")
        return self._azure_container_client.get_blob_client(key)

    def _azure_blob_url(self, key: str) -> str:
        return f"{self.azure_account_url}/{self.azure_container}/{quote(key, safe='/')}"

    @staticmethod
    def _validate_key(key: str) -> None:
        if (not isinstance(key, str) or not key.startswith("health/")
                or "\\" in key or "\x00" in key
                or any(part in {"", ".", ".."} for part in key.split("/"))):
            raise ValueError("Invalid health storage key.")

    def _generate_key(self, category: str, filename: str) -> str:
        """Generate a storage key with category prefix."""
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        safe = "".join(c for c in filename if c.isalnum() or c in "._-")
        uid = uuid.uuid4().hex[:8]
        key = f"health/{category}/{ts}_{uid}_{safe}"
        self._validate_key(key)
        return key

    def upload_bytes(
        self,
        data: bytes,
        category: str,
        filename: str,
        content_type: str = "application/pdf",
    ) -> Tuple[str, str]:
        """
        Returns (storage_key, stable_private_url_or_local_path).

        Never persist an Azure SAS in database file_url fields. The existing
        authorized download endpoints request a fresh short-lived URL instead.
        """
        key = self._generate_key(category, filename)

        if self.provider == "azure_blob":
            try:
                from azure.storage.blob import ContentSettings

                self._private_azure_blob(key).upload_blob(
                    data,
                    overwrite=False,
                    content_settings=ContentSettings(
                        content_type=content_type, cache_control="private, no-store",
                    ),
                )
                return key, self._azure_blob_url(key)
            except HealthStorageError:
                raise
            except Exception:
                raise HealthStorageError("Azure health file upload failed.") from None

        if self._use_local:
            local_path = LOCAL_UPLOAD_DIR / key
            local_path.parent.mkdir(parents=True, exist_ok=True)
            local_path.write_bytes(data)
            return key, str(local_path)

        self.client.put_object(
            Bucket=self.spaces_bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
            ACL="private",
        )
        return key, f"{self.spaces_endpoint}/{self.spaces_bucket}/{key}"

    def upload_file(
        self,
        file_obj: BinaryIO,
        category: str,
        filename: str,
        content_type: str = "application/pdf",
    ) -> Tuple[str, str]:
        """Upload a file-like object. Returns (storage_key, url)."""
        file_obj.seek(0)
        data = file_obj.read()
        return self.upload_bytes(data, category, filename, content_type)

    def get_signed_url_expiry_seconds(self, expires_seconds: int = 3600) -> int:
        """Effective TTL shared by signing and API response metadata."""
        if (isinstance(expires_seconds, bool) or not isinstance(expires_seconds, int)
                or expires_seconds <= 0):
            raise ValueError("Download URL expiry must be a positive number of seconds.")
        if self.provider == "azure_blob":
            return min(expires_seconds, self.azure_signed_url_seconds)
        return expires_seconds

    def get_signed_url(self, key: str, expires_seconds: int = 3600) -> str:
        """Generate a pre-signed download URL (or local path for dev)."""
        self._validate_key(key)
        expires_seconds = self.get_signed_url_expiry_seconds(expires_seconds)
        if self.provider == "azure_blob":
            try:
                from azure.storage.blob import BlobSasPermissions, generate_blob_sas

                self._private_azure_blob(key)
                now = datetime.now(timezone.utc)
                start = now - timedelta(minutes=1)
                expiry = now + timedelta(seconds=expires_seconds)
                delegation_key = self.client.get_user_delegation_key(
                    key_start_time=start, key_expiry_time=expiry,
                )
                sas = generate_blob_sas(
                    account_name=self.azure_account,
                    container_name=self.azure_container,
                    blob_name=key,
                    user_delegation_key=delegation_key,
                    permission=BlobSasPermissions(read=True),
                    start=start,
                    expiry=expiry,
                    protocol="https",
                    cache_control="private, no-store",
                )
                return f"{self._azure_blob_url(key)}?{sas}"
            except HealthStorageError:
                raise
            except Exception:
                raise HealthStorageError("Azure health file download authorization failed.") from None
        if self._use_local:
            local_path = LOCAL_UPLOAD_DIR / key
            return str(local_path)

        url = self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.spaces_bucket, "Key": key},
            ExpiresIn=expires_seconds,
        )
        return url

    def download_bytes(self, key: str) -> bytes:
        """Read a private object without exposing its storage location."""
        self._validate_key(key)
        if self.provider == "azure_blob":
            try:
                return self._private_azure_blob(key).download_blob().readall()
            except HealthStorageError:
                raise
            except Exception:
                raise HealthStorageError("Azure health file download failed.") from None
        if self._use_local:
            return (LOCAL_UPLOAD_DIR / key).read_bytes()

        response = self.client.get_object(Bucket=self.spaces_bucket, Key=key)
        return response["Body"].read()

    def delete(self, key: str) -> bool:
        """Delete a stored object."""
        self._validate_key(key)
        if self.provider == "azure_blob":
            try:
                from azure.core.exceptions import ResourceNotFoundError

                blob = self._private_azure_blob(key)
                try:
                    # Do not remove snapshots/versions or override retention.
                    blob.delete_blob()
                except ResourceNotFoundError as exc:
                    if exc.error_code != "BlobNotFound":
                        raise
                return True
            except Exception:
                # No object keys, clinical filenames, tokens or SDK responses.
                logger.error("[HealthStorage] Azure health file deletion failed")
                return False
        if self._use_local:
            local_path = LOCAL_UPLOAD_DIR / key
            if local_path.exists():
                local_path.unlink()
            return True

        try:
            self.client.delete_object(Bucket=self.spaces_bucket, Key=key)
            return True
        except Exception:
            logger.error("[HealthStorage] S3 health file deletion failed")
            return False


# Singleton
_health_storage: Optional[HealthStorageService] = None


def get_health_storage() -> HealthStorageService:
    global _health_storage
    if _health_storage is None:
        _health_storage = HealthStorageService()
    return _health_storage
