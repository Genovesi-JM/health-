"""Bounded, local PDF text extraction. No OCR, model calls or clinical inference.

Only call after the file has passed the malware-scan gate. Parsing runs in a
short-lived child with CPU limits and, on Linux, an address-space limit;
this is not a full OS sandbox. macOS cannot enforce RLIMIT_AS reliably.
Original text is untrusted document data and must be reviewed before use.
"""
from __future__ import annotations

import io
import json
import os
from pathlib import Path
import subprocess
import sys

MAX_BYTES = 10 * 1024 * 1024
MAX_PAGES = 40
MAX_TEXT = 100_000
TIMEOUT_SECONDS = 10


def _result(status: str, *, text: str = "", method: str = "none", error: str | None = None) -> dict:
    return {"status": status, "text": text, "method": method, "error_code": error}


def _read_pdf(data: bytes) -> dict:
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data), strict=True)
        if reader.is_encrypted:
            return _result("needs_manual_review", error="encrypted_pdf")
        count = len(reader.pages)
        if count == 0 or count > MAX_PAGES:
            return _result("needs_manual_review", error="page_limit")
        pages: list[str] = []
        missing_text = False
        total = 0
        for page in reader.pages:
            content = page.extract_text() or ""
            content = "".join(c for c in content if c.isprintable() or c in "\n\t").strip()
            missing_text = missing_text or not content
            total += len(content) + 2
            if total > MAX_TEXT:
                return _result("needs_manual_review", error="text_limit")
            pages.append(content)
        text = "\n\n".join(pages).strip()
        if not text:
            return _result("needs_manual_review", error="ocr_required")
        return _result(
            "needs_manual_review" if missing_text else "ready_for_review",
            text=text, method="pdf_text",
            error="partial_text_requires_ocr" if missing_text else None,
        )
    except Exception:
        # Parser errors can contain document content; never return/log them.
        return _result("processing_failed", error="invalid_pdf")


def extract_document(data: bytes, content_type: str) -> dict:
    if not data or len(data) > MAX_BYTES:
        return _result("processing_failed", error="invalid_size")
    if content_type in {"image/jpeg", "image/png"}:
        return _result("needs_manual_review", error="ocr_required")
    if content_type != "application/pdf" or not data.startswith(b"%PDF-"):
        return _result("processing_failed", error="unsupported_file")
    try:
        child = subprocess.run(
            [sys.executable, "-I", str(Path(__file__).resolve()), "--worker"],
            input=data, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            timeout=TIMEOUT_SECONDS, check=False,
            # Never inherit storage credentials, database URLs or provider keys.
            env={"PATH": os.defpath, "LANG": "C.UTF-8", "PYTHONIOENCODING": "utf-8"},
        )
        if child.returncode != 0 or len(child.stdout) > 1024 * 1024:
            return _result("processing_failed", error="extraction_unavailable")
        result = json.loads(child.stdout)
        if (not isinstance(result, dict)
                or result.get("status") not in {"ready_for_review", "needs_manual_review", "processing_failed"}
                or not isinstance(result.get("text"), str) or len(result["text"]) > MAX_TEXT
                or result.get("method") not in {"pdf_text", "none"}):
            return _result("processing_failed", error="extraction_unavailable")
        return result
    except subprocess.TimeoutExpired:
        return _result("processing_failed", error="extraction_timeout")
    except (OSError, ValueError):
        return _result("processing_failed", error="extraction_unavailable")


def _worker() -> None:
    import resource
    import socket

    resource.setrlimit(resource.RLIMIT_CPU, (6, 6))
    if sys.platform.startswith("linux"):
        resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))

    def no_network(*args, **kwargs):
        raise RuntimeError("Document extraction has no network access")

    socket.create_connection = no_network
    socket.socket.connect = no_network
    socket.socket.connect_ex = no_network
    socket.getaddrinfo = no_network
    data = sys.stdin.buffer.read(MAX_BYTES + 1)
    if not data or len(data) > MAX_BYTES:
        result = _result("processing_failed", error="invalid_size")
    else:
        result = _read_pdf(data)
    sys.stdout.write(json.dumps(result, ensure_ascii=True))


if __name__ == "__main__" and sys.argv[1:] == ["--worker"]:
    _worker()
