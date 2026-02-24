from __future__ import annotations
"""
Health Storage Service — S3-compatible (DigitalOcean Spaces) + local fallback.

Handles prescription/referral PDFs and doctor document uploads.
"""
import hashlib
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import BinaryIO, Optional, Tuple

import logging

logger = logging.getLogger(__name__)

# Local uploads directory (fallback for dev)
LOCAL_UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"


class HealthStorageService:
    """S3-compatible storage with local fallback for development."""

    def __init__(self):
        self.spaces_key = os.getenv("DO_SPACES_KEY")
        self.spaces_secret = os.getenv("DO_SPACES_SECRET")
        self.spaces_bucket = os.getenv("DO_SPACES_BUCKET", "health-platform")
        self.spaces_region = os.getenv("DO_SPACES_REGION", "nyc3")
        self.spaces_endpoint = os.getenv(
            "DO_SPACES_ENDPOINT",
            f"https://{self.spaces_region}.digitaloceanspaces.com",
        )
        self._client = None
        self._use_local = not (self.spaces_key and self.spaces_secret)

        if self._use_local:
            logger.info("[HealthStorage] Using local file storage (dev mode)")
            LOCAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        else:
            logger.info(f"[HealthStorage] Using DO Spaces: {self.spaces_bucket}")

    @property
    def client(self):
        if self._client is None and not self._use_local:
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

    def _generate_key(self, category: str, filename: str) -> str:
        """Generate a storage key with category prefix."""
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        safe = "".join(c for c in filename if c.isalnum() or c in "._-")
        uid = uuid.uuid4().hex[:8]
        return f"health/{category}/{ts}_{uid}_{safe}"

    def upload_bytes(
        self,
        data: bytes,
        category: str,
        filename: str,
        content_type: str = "application/pdf",
    ) -> Tuple[str, str]:
        """
        Upload raw bytes. Returns (storage_key, download_url_or_path).
        """
        key = self._generate_key(category, filename)

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

    def get_signed_url(self, key: str, expires_seconds: int = 3600) -> str:
        """Generate a pre-signed download URL (or local path for dev)."""
        if self._use_local:
            local_path = LOCAL_UPLOAD_DIR / key
            return str(local_path)

        url = self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.spaces_bucket, "Key": key},
            ExpiresIn=expires_seconds,
        )
        return url

    def delete(self, key: str) -> bool:
        """Delete a stored object."""
        if self._use_local:
            local_path = LOCAL_UPLOAD_DIR / key
            if local_path.exists():
                local_path.unlink()
            return True

        try:
            self.client.delete_object(Bucket=self.spaces_bucket, Key=key)
            return True
        except Exception as exc:
            logger.error(f"Failed to delete {key}: {exc}")
            return False


# Singleton
_health_storage: Optional[HealthStorageService] = None


def get_health_storage() -> HealthStorageService:
    global _health_storage
    if _health_storage is None:
        _health_storage = HealthStorageService()
    return _health_storage
