"""Secure clinical file/document handling (Phase 29). Domain-pure.

Uploads and downloads of clinical documents cannot be abused. This module is the
canonical, fail-closed policy that complements the transport controls already in
`app/services/health_storage.py` (private ACL, no-store, traversal-safe
unguessable keys, short-lived signed URLs). It adds:

  * Upload validation — an allowlist of content types with matching extensions,
    a size ceiling, and a magic-byte check so a declared type must match the
    actual bytes (a renamed executable is rejected).
  * A malware-scan gate — an uploaded object is not downloadable until it has been
    scanned and found clean; pending/infected/error all BLOCK (fail-closed).
  * Authorization on every access (no insecure direct object reference) —
    possessing or guessing a key is never enough; the requester must be
    authorized for the clinical object the file belongs to.
  * Storage/URL guardrails — keys must be safe and unguessable, buckets must be
    private, public ACLs are rejected, and signed URLs must be short-lived and
    freshly minted (never persisted).

Stdlib-only and importable without the app, so it is tested in place while the
app is held.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

# ── Errors ───────────────────────────────────────────────────────────────────

class FileSafetyError(Exception):
    """A file-safety rule was violated (fail-closed)."""


class FileAccessDenied(FileSafetyError):
    """The requester is not authorized for this file's clinical object."""


# ── Upload validation ────────────────────────────────────────────────────────

# Allowlist: content type -> (allowed extensions, magic-byte prefixes)
_ALLOWED: dict = {
    "application/pdf": ((".pdf",), (b"%PDF-",)),
    "image/jpeg": ((".jpg", ".jpeg"), (b"\xff\xd8\xff",)),
    "image/png": ((".png",), (b"\x89PNG\r\n\x1a\n",)),
    "image/tiff": ((".tif", ".tiff"), (b"II*\x00", b"MM\x00*")),
}

MAX_UPLOAD_BYTES = 25 * 1024 * 1024        # 25 MiB ceiling
_DICOM_MAGIC_AT_128 = b"DICM"


def _ext(filename: str) -> str:
    name = filename.lower().strip()
    i = name.rfind(".")
    return name[i:] if i >= 0 else ""


def allowed_content_type(content_type: str) -> bool:
    return content_type in _ALLOWED


def _magic_ok(content_type: str, header: bytes) -> bool:
    _, magics = _ALLOWED[content_type]
    return any(header.startswith(m) for m in magics)


@dataclass(frozen=True)
class UploadValidation:
    ok: bool
    reason: str = ""


def validate_upload(content_type: str, filename: str, size_bytes: int,
                    header_bytes: bytes) -> UploadValidation:
    """Fail-closed upload validation. The declared type must be allowlisted, the
    extension must match the type, the size must be within bounds, and the magic
    bytes must match the declared type."""
    if not filename or not filename.strip():
        return UploadValidation(False, "missing filename")
    if size_bytes <= 0:
        return UploadValidation(False, "empty file")
    if size_bytes > MAX_UPLOAD_BYTES:
        return UploadValidation(False, f"file exceeds max {MAX_UPLOAD_BYTES} bytes")
    if not allowed_content_type(content_type):
        return UploadValidation(False, f"content type not allowed: {content_type}")
    allowed_exts, _ = _ALLOWED[content_type]
    if _ext(filename) not in allowed_exts:
        return UploadValidation(False, "extension does not match content type")
    if not header_bytes or not _magic_ok(content_type, header_bytes):
        return UploadValidation(False, "file bytes do not match declared type")
    return UploadValidation(True, "ok")


# ── Malware-scan gate ────────────────────────────────────────────────────────

SCAN_PENDING = "pending"
SCAN_CLEAN = "clean"
SCAN_INFECTED = "infected"
SCAN_ERROR = "error"


def download_allowed(scan_state: str) -> bool:
    """A file is downloadable only after it has been scanned clean. Anything
    else — not yet scanned, infected, or a scan error — BLOCKS."""
    return scan_state == SCAN_CLEAN


def quarantined(scan_state: str) -> bool:
    return scan_state in (SCAN_INFECTED, SCAN_ERROR)


# ── Authorization on every access (no IDOR) ──────────────────────────────────

@dataclass(frozen=True)
class FileRef:
    storage_key: str
    owner_patient_id: str
    episode_id: str
    org_id: str
    scan_state: str = SCAN_PENDING


@dataclass(frozen=True)
class AccessContext:
    user_id: str
    role: str                      # patient | doctor | nurse | ...
    org_ids: frozenset
    assigned_episode_ids: frozenset
    privileges: frozenset
    # patient-subject linkage (adopting layer supplies it):
    subject_patient_id: Optional[str] = None


_CLINICIAN_ROLES = {"doctor", "nurse", "clinician", "midwife"}


def authorize_access(file_ref: FileRef, ctx: AccessContext) -> bool:
    """Possessing/guessing the key is never enough. A clinician must be assigned
    to the file's episode, in-org, with clinical-read; a patient must be the
    file's own subject. No one else, ever."""
    if ctx.role == "patient":
        return ctx.subject_patient_id is not None and ctx.subject_patient_id == file_ref.owner_patient_id
    if ctx.role in _CLINICIAN_ROLES:
        return (
            file_ref.org_id in ctx.org_ids
            and file_ref.episode_id in ctx.assigned_episode_ids
            and "clinical_read" in ctx.privileges
        )
    return False


def require_access(file_ref: FileRef, ctx: AccessContext) -> None:
    if not authorize_access(file_ref, ctx):
        raise FileAccessDenied("not authorized for this file's clinical object")


def can_download(file_ref: FileRef, ctx: AccessContext) -> bool:
    """Both must hold: authorized AND scanned clean."""
    return authorize_access(file_ref, ctx) and download_allowed(file_ref.scan_state)


# ── Storage / URL guardrails ─────────────────────────────────────────────────

def is_safe_key(key: str) -> bool:
    """No traversal, no null, no empty/`.`/`..` segments, expected prefix."""
    if not isinstance(key, str) or not key.startswith("health/"):
        return False
    if "\\" in key or "\x00" in key:
        return False
    return not any(part in {"", ".", ".."} for part in key.split("/"))


def is_unguessable_key(key: str) -> bool:
    """The key must carry random entropy (the storage layer injects a uuid), so it
    is not enumerable from a patient/consultation id."""
    tail = key.rsplit("/", 1)[-1]
    hexish = [c for c in tail if c in "0123456789abcdef"]
    return len(hexish) >= 8


MAX_SIGNED_URL_TTL = 3600           # 1 hour ceiling


def signed_url_ttl_ok(ttl_seconds: int) -> bool:
    return 0 < ttl_seconds <= MAX_SIGNED_URL_TTL


def persisted_url_prohibited(url_field_value: Optional[str]) -> bool:
    """A short-lived signed URL (SAS/presigned) must never be stored in a DB
    field; only a fresh one is minted per authorized request. Returns True when a
    value looks like a persisted signed URL that must be rejected."""
    if not url_field_value:
        return False
    markers = ("sig=", "X-Amz-Signature", "se=", "AWSAccessKeyId", "X-Amz-Credential")
    return any(m.lower() in url_field_value.lower() for m in markers)


def reject_public_acl(acl: str) -> None:
    """Clinical object storage is private; a public ACL is refused."""
    if acl and acl.lower() not in ("private",):
        raise FileSafetyError(f"public/non-private ACL refused: {acl}")


def bucket_must_be_private(public_access: Optional[str]) -> bool:
    """True only when the container/bucket is private (no public access)."""
    return public_access in (None, "none", "None")
