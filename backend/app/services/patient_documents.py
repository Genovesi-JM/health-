"""Bounded patient uploads and fail-closed scanning through private ClamAV."""
import socket
import struct
import time

from fastapi import HTTPException

from app.config import settings
from app.file_safety import validate_upload as file_safety_validate_upload

MAX_BYTES = 10 * 1024 * 1024
MAX_TEXT = 100_000
ACCEPTED_TYPES = ("application/pdf", "image/jpeg", "image/png")


def doctor_has_document_relationship(doctor_id: str, patient_id: str, db) -> bool:
    """Document sharing starts after clinical acceptance, not a directed request."""
    from app.health_models import CareEscalation, Consultation, PrescriptionRequest

    return bool(
        db.query(Consultation.id).filter(
            Consultation.doctor_id == doctor_id, Consultation.patient_id == patient_id,
            Consultation.status.in_(("scheduled", "in_progress", "completed")),
        ).first()
        or db.query(CareEscalation.id).filter(
            CareEscalation.assigned_doctor_id == doctor_id, CareEscalation.patient_id == patient_id,
            CareEscalation.status.in_(("accepted", "resolved")),
        ).first()
        or db.query(PrescriptionRequest.id).filter(
            PrescriptionRequest.doctor_id == doctor_id, PrescriptionRequest.patient_id == patient_id,
            PrescriptionRequest.status.in_(("approved", "adjusted")),
        ).first()
    )


def processing_configured() -> bool:
    return bool(
        settings.patient_documents_enabled
        and (settings.patient_document_clamav_host or "").strip()
        and 1 <= settings.patient_document_clamav_port <= 65535
    )


def validate_upload(data: bytes, content_type: str, filename: str) -> None:
    if not data:
        raise HTTPException(422, "O documento está vazio.")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "O documento excede o limite de 10 MB.")
    if content_type not in ACCEPTED_TYPES:
        raise HTTPException(415, "Use um documento PDF ou uma imagem JPEG ou PNG.")
    result = file_safety_validate_upload(content_type, filename, len(data), data[:16])
    if not result.ok:
        raise HTTPException(415, "O nome, o conteúdo e o tipo do documento devem corresponder.")


def scan_document(data: bytes) -> str:
    """Return clean/infected/error; never return the daemon's sensitive message.

    INSTREAM sends bytes only to the explicitly configured private daemon.
    Missing configuration, timeouts, oversized or unrecognised replies fail closed.
    The daemon and network isolation must be provisioned separately before enablement.
    """
    if not processing_configured() or not data or len(data) > MAX_BYTES:
        return "error"
    deadline = time.monotonic() + 20

    def remaining() -> float:
        value = deadline - time.monotonic()
        if value <= 0:
            raise TimeoutError("scan deadline")
        return min(10, value)

    try:
        with socket.create_connection(
            (settings.patient_document_clamav_host, settings.patient_document_clamav_port),
            timeout=remaining(),
        ) as connection:
            connection.settimeout(remaining())
            connection.sendall(b"zINSTREAM\0")
            for offset in range(0, len(data), 65536):
                chunk = data[offset:offset + 65536]
                connection.settimeout(remaining())
                connection.sendall(struct.pack("!I", len(chunk)) + chunk)
            connection.settimeout(remaining())
            connection.sendall(struct.pack("!I", 0))
            reply = bytearray()
            while b"\0" not in reply and len(reply) < 4096:
                connection.settimeout(remaining())
                chunk = connection.recv(min(1024, 4096 - len(reply)))
                if not chunk:
                    break
                reply.extend(chunk)
            if b"\0" not in reply:
                return "error"
            result = bytes(reply).split(b"\0", 1)[0]
            if result == b"stream: OK":
                return "clean"
            if result.startswith(b"stream: ") and result.endswith(b" FOUND"):
                return "infected"
    except (OSError, ValueError, TypeError):
        pass
    return "error"
