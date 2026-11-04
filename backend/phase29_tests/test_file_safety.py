"""Phase 29 secure file handling: fail-closed upload validation (allowlist,
extension match, size ceiling, magic bytes), malware-scan gate before download,
authorization on every access (no IDOR), and storage/URL guardrails.
"""
from __future__ import annotations

import pytest

from app import file_safety as F

PDF_HDR = b"%PDF-1.7\n..."
JPG_HDR = b"\xff\xd8\xff\xe0..."
PNG_HDR = b"\x89PNG\r\n\x1a\n..."
EXE_HDR = b"MZ\x90\x00..."          # a Windows executable


# ── Upload validation ────────────────────────────────────────────────────────

def test_valid_pdf_upload():
    r = F.validate_upload("application/pdf", "report.pdf", 2048, PDF_HDR)
    assert r.ok, r.reason


def test_valid_image_upload():
    assert F.validate_upload("image/jpeg", "scan.jpg", 1000, JPG_HDR).ok
    assert F.validate_upload("image/png", "scan.png", 1000, PNG_HDR).ok


def test_disallowed_content_type():
    r = F.validate_upload("application/x-msdownload", "a.exe", 1000, EXE_HDR)
    assert not r.ok and "not allowed" in r.reason


def test_extension_mismatch_rejected():
    r = F.validate_upload("application/pdf", "report.exe", 1000, PDF_HDR)
    assert not r.ok and "extension" in r.reason


def test_magic_byte_mismatch_rejected():
    # declared pdf, extension pdf, but the bytes are an executable
    r = F.validate_upload("application/pdf", "report.pdf", 1000, EXE_HDR)
    assert not r.ok and "do not match" in r.reason


def test_oversize_rejected():
    r = F.validate_upload("application/pdf", "big.pdf", F.MAX_UPLOAD_BYTES + 1, PDF_HDR)
    assert not r.ok and "exceeds max" in r.reason


def test_empty_and_missing_name_rejected():
    assert not F.validate_upload("application/pdf", "x.pdf", 0, PDF_HDR).ok
    assert not F.validate_upload("application/pdf", "", 100, PDF_HDR).ok


# ── Malware-scan gate ────────────────────────────────────────────────────────

def test_download_only_when_clean():
    assert F.download_allowed(F.SCAN_CLEAN)
    assert not F.download_allowed(F.SCAN_PENDING)
    assert not F.download_allowed(F.SCAN_INFECTED)
    assert not F.download_allowed(F.SCAN_ERROR)


def test_quarantine_states():
    assert F.quarantined(F.SCAN_INFECTED)
    assert F.quarantined(F.SCAN_ERROR)
    assert not F.quarantined(F.SCAN_CLEAN)


# ── Authorization on every access (no IDOR) ──────────────────────────────────

def _file(**kw):
    base = dict(storage_key="health/reports/20260101_deadbeef_report.pdf",
                owner_patient_id="pat-1", episode_id="ep-1", org_id="org-1",
                scan_state=F.SCAN_CLEAN)
    base.update(kw)
    return F.FileRef(**base)


def _clinician(**kw):
    base = dict(user_id="doc-1", role="doctor", org_ids=frozenset({"org-1"}),
                assigned_episode_ids=frozenset({"ep-1"}),
                privileges=frozenset({"clinical_read"}))
    base.update(kw)
    return F.AccessContext(**base)


def _patient(**kw):
    base = dict(user_id="pat-1", role="patient", org_ids=frozenset(),
                assigned_episode_ids=frozenset(), privileges=frozenset(),
                subject_patient_id="pat-1")
    base.update(kw)
    return F.AccessContext(**base)


def test_assigned_clinician_authorized():
    assert F.authorize_access(_file(), _clinician())


def test_unassigned_clinician_denied_even_with_key():
    assert not F.authorize_access(_file(), _clinician(assigned_episode_ids=frozenset({"ep-9"})))
    assert not F.authorize_access(_file(), _clinician(org_ids=frozenset({"org-9"})))
    assert not F.authorize_access(_file(), _clinician(privileges=frozenset()))


def test_patient_can_access_own_only():
    assert F.authorize_access(_file(), _patient())
    assert not F.authorize_access(_file(owner_patient_id="pat-2"), _patient())


def test_require_access_raises_for_outsider():
    with pytest.raises(F.FileAccessDenied):
        F.require_access(_file(), _clinician(assigned_episode_ids=frozenset()))


def test_can_download_requires_authorized_and_clean():
    assert F.can_download(_file(), _clinician())
    assert not F.can_download(_file(scan_state=F.SCAN_PENDING), _clinician())   # not scanned
    assert not F.can_download(_file(), _clinician(org_ids=frozenset()))          # not authorized


# ── Storage / URL guardrails ─────────────────────────────────────────────────

def test_safe_key_checks():
    assert F.is_safe_key("health/reports/20260101_deadbeef_a.pdf")
    assert not F.is_safe_key("health/../etc/passwd")
    assert not F.is_safe_key("other/x")
    assert not F.is_safe_key("health/a\x00b")


def test_unguessable_key():
    assert F.is_unguessable_key("health/reports/20260101_deadbeef_a.pdf")
    assert not F.is_unguessable_key("health/reports/consult-1.pdf")


def test_signed_url_ttl_bounds():
    assert F.signed_url_ttl_ok(3600)
    assert not F.signed_url_ttl_ok(0)
    assert not F.signed_url_ttl_ok(F.MAX_SIGNED_URL_TTL + 1)


def test_persisted_signed_url_detected():
    assert F.persisted_url_prohibited("https://x.blob.core.windows.net/c/k?sig=abc&se=2026")
    assert F.persisted_url_prohibited("https://s3/k?X-Amz-Signature=deadbeef")
    assert not F.persisted_url_prohibited("health/reports/20260101_deadbeef_a.pdf")
    assert not F.persisted_url_prohibited(None)


def test_public_acl_refused():
    F.reject_public_acl("private")           # ok, no raise
    with pytest.raises(F.FileSafetyError):
        F.reject_public_acl("public-read")


def test_bucket_privacy():
    assert F.bucket_must_be_private(None)
    assert F.bucket_must_be_private("none")
    assert not F.bucket_must_be_private("blob")
