"""
PDF Generation Service — Simple templates for prescriptions and referrals.

Uses a lightweight HTML-to-text approach for MVP (no heavy PDF lib dependency).
Falls back to a simple text-based PDF using reportlab if available,
otherwise generates a structured text file.
"""
import io
import logging
from datetime import datetime
from typing import List, Optional

logger = logging.getLogger(__name__)


def _try_reportlab() -> bool:
    try:
        import reportlab  # noqa: F401
        return True
    except ImportError:
        return False


def generate_prescription_pdf(
    patient_name: str,
    patient_dob: Optional[str],
    doctor_name: str,
    doctor_license: str,
    medications: List[dict],
    instructions: Optional[str] = None,
    date: Optional[datetime] = None,
) -> bytes:
    """Generate a prescription PDF (or text fallback).

    Each medication dict: {name, dosage, frequency, duration, notes}
    """
    date = date or datetime.utcnow()
    date_str = date.strftime("%d/%m/%Y")

    if _try_reportlab():
        return _prescription_reportlab(
            patient_name, patient_dob, doctor_name, doctor_license,
            medications, instructions, date_str,
        )
    return _prescription_text(
        patient_name, patient_dob, doctor_name, doctor_license,
        medications, instructions, date_str,
    )


def generate_referral_pdf(
    patient_name: str,
    patient_dob: Optional[str],
    doctor_name: str,
    doctor_license: str,
    destination: str,
    specialty: Optional[str],
    reason: Optional[str],
    urgency: str,
    date: Optional[datetime] = None,
) -> bytes:
    """Generate a referral PDF (or text fallback)."""
    date = date or datetime.utcnow()
    date_str = date.strftime("%d/%m/%Y")

    if _try_reportlab():
        return _referral_reportlab(
            patient_name, patient_dob, doctor_name, doctor_license,
            destination, specialty, reason, urgency, date_str,
        )
    return _referral_text(
        patient_name, patient_dob, doctor_name, doctor_license,
        destination, specialty, reason, urgency, date_str,
    )


# ═══════════════════════════════════════════════════════════════
# ReportLab implementations
# ═══════════════════════════════════════════════════════════════

def _prescription_reportlab(
    patient_name, patient_dob, doctor_name, doctor_license,
    medications, instructions, date_str,
) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, h - 50, "RECEITA MÉDICA")
    c.setFont("Helvetica", 10)
    c.drawString(50, h - 70, f"Data: {date_str}")

    y = h - 100
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, y, "Paciente:")
    c.setFont("Helvetica", 11)
    c.drawString(120, y, f"{patient_name}" + (f"  (DN: {patient_dob})" if patient_dob else ""))

    y -= 30
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, y, "Medicação:")
    y -= 20

    c.setFont("Helvetica", 10)
    for i, med in enumerate(medications, 1):
        name = med.get("name", "")
        dosage = med.get("dosage", "")
        freq = med.get("frequency", "")
        dur = med.get("duration", "")
        notes = med.get("notes", "")

        line = f"{i}. {name} — {dosage}, {freq}"
        if dur:
            line += f", durante {dur}"
        c.drawString(60, y, line)
        y -= 15
        if notes:
            c.drawString(70, y, f"   Obs: {notes}")
            y -= 15

    if instructions:
        y -= 15
        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, y, "Instruções:")
        y -= 15
        c.setFont("Helvetica", 10)
        for line in instructions.split("\n"):
            c.drawString(60, y, line)
            y -= 15

    y -= 40
    c.setFont("Helvetica", 10)
    c.drawString(50, y, f"Médico: Dr(a). {doctor_name}")
    y -= 15
    c.drawString(50, y, f"Cédula: {doctor_license}")
    y -= 30
    c.drawString(50, y, "Assinatura: ______________________________")

    c.save()
    return buf.getvalue()


def _referral_reportlab(
    patient_name, patient_dob, doctor_name, doctor_license,
    destination, specialty, reason, urgency, date_str,
) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, h - 50, "GUIA DE REFERÊNCIA")
    c.setFont("Helvetica", 10)
    c.drawString(50, h - 70, f"Data: {date_str}")

    y = h - 100
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, y, "Paciente:")
    c.setFont("Helvetica", 11)
    c.drawString(120, y, f"{patient_name}" + (f"  (DN: {patient_dob})" if patient_dob else ""))

    y -= 30
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, y, "Destino:")
    c.setFont("Helvetica", 11)
    c.drawString(120, y, destination)

    if specialty:
        y -= 20
        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, y, "Especialidade:")
        c.setFont("Helvetica", 11)
        c.drawString(140, y, specialty)

    y -= 20
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, y, "Urgência:")
    c.setFont("Helvetica", 11)
    c.drawString(120, y, urgency.upper())

    if reason:
        y -= 30
        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, y, "Motivo:")
        y -= 15
        c.setFont("Helvetica", 10)
        for line in reason.split("\n"):
            c.drawString(60, y, line)
            y -= 15

    y -= 40
    c.setFont("Helvetica", 10)
    c.drawString(50, y, f"Médico: Dr(a). {doctor_name}")
    y -= 15
    c.drawString(50, y, f"Cédula: {doctor_license}")
    y -= 30
    c.drawString(50, y, "Assinatura: ______________________________")

    c.save()
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════
# Text fallback (when reportlab is not installed)
# ═══════════════════════════════════════════════════════════════

def _prescription_text(
    patient_name, patient_dob, doctor_name, doctor_license,
    medications, instructions, date_str,
) -> bytes:
    lines = [
        "=" * 60,
        "RECEITA MÉDICA",
        "=" * 60,
        f"Data: {date_str}",
        "",
        f"Paciente: {patient_name}" + (f"  (DN: {patient_dob})" if patient_dob else ""),
        "",
        "MEDICAÇÃO:",
    ]
    for i, med in enumerate(medications, 1):
        line = f"  {i}. {med.get('name', '')} — {med.get('dosage', '')}, {med.get('frequency', '')}"
        if med.get("duration"):
            line += f", durante {med['duration']}"
        lines.append(line)
        if med.get("notes"):
            lines.append(f"     Obs: {med['notes']}")

    if instructions:
        lines.extend(["", "INSTRUÇÕES:", instructions])

    lines.extend([
        "",
        f"Médico: Dr(a). {doctor_name}",
        f"Cédula: {doctor_license}",
        "",
        "Assinatura: ______________________________",
        "=" * 60,
    ])
    return "\n".join(lines).encode("utf-8")


def _referral_text(
    patient_name, patient_dob, doctor_name, doctor_license,
    destination, specialty, reason, urgency, date_str,
) -> bytes:
    lines = [
        "=" * 60,
        "GUIA DE REFERÊNCIA",
        "=" * 60,
        f"Data: {date_str}",
        "",
        f"Paciente: {patient_name}" + (f"  (DN: {patient_dob})" if patient_dob else ""),
        f"Destino: {destination}",
    ]
    if specialty:
        lines.append(f"Especialidade: {specialty}")
    lines.append(f"Urgência: {urgency.upper()}")
    if reason:
        lines.extend(["", "MOTIVO:", reason])

    lines.extend([
        "",
        f"Médico: Dr(a). {doctor_name}",
        f"Cédula: {doctor_license}",
        "",
        "Assinatura: ______________________________",
        "=" * 60,
    ])
    return "\n".join(lines).encode("utf-8")
