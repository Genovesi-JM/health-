"""Real PDF parsing stays local, bounded and explicit about missing OCR."""
from io import BytesIO
import subprocess
from types import SimpleNamespace

from pypdf import PdfReader, PdfWriter
import pytest
from reportlab.pdfgen import canvas

from app.services import patient_document_extraction as extraction


def text_pdf(text="Resultado sintético: hemoglobina 13,5 g/dL", blank_page=False):
    target = BytesIO()
    document = canvas.Canvas(target)
    document.drawString(50, 750, text)
    document.showPage()
    if blank_page:
        document.showPage()
    document.save()
    return target.getvalue()


def test_actual_pdf_text_is_returned_for_patient_review():
    result = extraction.extract_document(text_pdf(), "application/pdf")
    assert result["status"] == "ready_for_review"
    assert "hemoglobina 13,5 g/dL" in result["text"]
    assert result["method"] == "pdf_text"
    assert result["error_code"] is None


@pytest.mark.parametrize("content_type", ["image/jpeg", "image/png"])
def test_images_need_ocr_and_never_get_invented_results(content_type):
    result = extraction.extract_document(b"synthetic-scanned-file", content_type)
    assert result == {"status": "needs_manual_review", "text": "", "method": "none", "error_code": "ocr_required"}


def test_blank_and_partially_readable_pdfs_are_explicitly_incomplete():
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    stream = BytesIO()
    writer.write(stream)
    assert extraction.extract_document(stream.getvalue(), "application/pdf")["error_code"] == "ocr_required"
    mixed = extraction.extract_document(text_pdf(blank_page=True), "application/pdf")
    assert mixed["status"] == "needs_manual_review"
    assert mixed["error_code"] == "partial_text_requires_ocr"
    assert "hemoglobina" in mixed["text"]


def test_encrypted_pdf_does_not_prompt_or_attempt_decryption():
    writer = PdfWriter()
    writer.append(PdfReader(BytesIO(text_pdf())))
    writer.encrypt("synthetic-password")
    stream = BytesIO()
    writer.write(stream)
    result = extraction.extract_document(stream.getvalue(), "application/pdf")
    assert result["error_code"] == "encrypted_pdf"
    assert result["text"] == ""


def test_page_limit_never_silently_returns_a_partial_document():
    writer = PdfWriter()
    for _ in range(extraction.MAX_PAGES + 1):
        writer.add_blank_page(width=100, height=100)
    stream = BytesIO()
    writer.write(stream)
    result = extraction.extract_document(stream.getvalue(), "application/pdf")
    assert result["error_code"] == "page_limit"
    assert result["text"] == ""


def test_invalid_pdf_and_oversize_have_no_parser_detail_or_content():
    result = extraction.extract_document(b"%PDF-1.7\nprivate-synthetic-content", "application/pdf")
    assert result["error_code"] == "invalid_pdf"
    assert "private-synthetic-content" not in str(result)
    assert extraction.extract_document(b"x" * (extraction.MAX_BYTES + 1), "application/pdf")["error_code"] == "invalid_size"
    assert extraction.extract_document(b"MZexe", "application/pdf")["error_code"] == "unsupported_file"


def test_worker_has_timeout_and_does_not_inherit_environment_secrets(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "synthetic-must-not-be-inherited")
    calls = []
    def timed_out(*args, **kwargs):
        calls.append((args, kwargs))
        raise subprocess.TimeoutExpired(args[0], timeout=kwargs["timeout"])
    monkeypatch.setattr(extraction.subprocess, "run", timed_out)
    result = extraction.extract_document(text_pdf(), "application/pdf")
    assert result["error_code"] == "extraction_timeout"
    assert calls[0][0][0][1] == "-I"
    assert "SECRET_KEY" not in calls[0][1]["env"]
    assert calls[0][1]["stderr"] == subprocess.DEVNULL


def test_worker_failure_or_bad_output_never_looks_like_success(monkeypatch):
    for output in [SimpleNamespace(returncode=1, stdout=b""), SimpleNamespace(returncode=0, stdout=b'{}')]:
        monkeypatch.setattr(extraction.subprocess, "run", lambda *args, **kwargs: output)
        result = extraction.extract_document(text_pdf(), "application/pdf")
        assert result["status"] == "processing_failed"
        assert result["text"] == ""
