"""Safe serialization and structured-log redaction (Phase 9).

No log line, error body, screenshot, model prompt, or serialized payload may
carry a raw secret, token, MFA seed, recovery code, signed URL, full payment
detail, provider payload, or raw clinical text. This module redacts them. It is
domain-pure (stdlib only) and side-effect free.
"""
from __future__ import annotations

import logging
import re
from typing import Any

REDACTED = "«REDACTED»"

# Value patterns that must never appear in a sink.
_PATTERNS = [
    re.compile(r"(?i)bearer\s+[A-Za-z0-9._\-]{8,}"),
    re.compile(r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{6,}"),  # JWT
    re.compile(r"(?i)\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{6,}"),                     # Stripe-style
    re.compile(r"(?i)\bwhsec_[A-Za-z0-9]{6,}"),
    re.compile(r"(?i)\bFLWSECK[-_][A-Za-z0-9\-]{6,}"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\b(?:\d[ -]?){13,19}\b"),                                          # PAN (card number)
    # Signed URLs: any URL carrying a signature/token query parameter.
    re.compile(r"https?://[^\s\"']*[?&](?:sig|signature|token|x-amz-signature|se|sp|sig=)[^\s\"']*", re.IGNORECASE),
]

# Sensitive keys whose values are always replaced, regardless of content.
_SENSITIVE_KEYS = re.compile(
    r"(?i)(password|passwd|secret|token|authorization|api[_-]?key|mfa|totp|otp|"
    r"recovery|seed|private[_-]?key|cvv|cvc|pan|card[_-]?number|iban|signed_?url)"
)
# Keys carrying raw clinical text (redacted in logs; stored only in the record).
_CLINICAL_KEYS = re.compile(
    r"(?i)(subjective|objective|assessment|clinical_note|notes?|symptom|diagnos|"
    r"chief_complaint|prescription_text|triage_answers|photo|image_data)"
)


def redact(text: str) -> str:
    """Redact secret/token/signed-URL/payment/key patterns from free text."""
    if not isinstance(text, str):
        text = str(text)
    for rx in _PATTERNS:
        text = rx.sub(REDACTED, text)
    return text


def redact_mapping(data: Any, _depth: int = 0) -> Any:
    """Recursively redact a mapping/sequence for safe serialization: sensitive
    and clinical keys are replaced; free strings are pattern-redacted."""
    if _depth > 8:
        return REDACTED
    if isinstance(data, dict):
        out = {}
        for k, v in data.items():
            if isinstance(k, str) and (_SENSITIVE_KEYS.search(k) or _CLINICAL_KEYS.search(k)):
                out[k] = REDACTED
            else:
                out[k] = redact_mapping(v, _depth + 1)
        return out
    if isinstance(data, (list, tuple)):
        return type(data)(redact_mapping(v, _depth + 1) for v in data)
    if isinstance(data, str):
        return redact(data)
    return data


class RedactingFilter(logging.Filter):
    """Logging filter that redacts formatted messages before they reach a sink."""

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003
        try:
            record.msg = redact(record.getMessage())
            record.args = ()
        except Exception:  # never let redaction break logging
            record.msg = REDACTED
            record.args = ()
        return True


def install_redacting_log_filter(logger: logging.Logger | None = None) -> None:
    """Attach the redacting filter to a logger (root by default)."""
    (logger or logging.getLogger()).addFilter(RedactingFilter())
