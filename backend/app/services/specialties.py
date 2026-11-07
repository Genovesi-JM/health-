"""Shared specialty normalization for booking and published availability."""
from typing import Optional

# Canonical specialty codes (match Doctor.specialization). Legacy English UI
# codes and free-text labels are normalised to these so bookings always reach
# the right doctor's queue.
_SPECIALTY_ALIASES = {
    "general": "clinica_geral", "clinica geral": "clinica_geral",
    "cardiology": "cardiologia", "dermatology": "dermatologia",
    "pediatrics": "pediatria", "orthopedics": "ortopedia",
    "neurology": "neurologia", "gynecology": "ginecologia",
    "ophthalmology": "oftalmologia", "psychiatry": "psiquiatria",
    "internal": "medicina_interna", "internal medicine": "medicina_interna",
    "surgery": "cirurgia", "other": "outra",
}


def normalize_specialty(value: Optional[str]) -> str:
    """Map any specialty input to a canonical snake_case code."""
    if not value:
        return "clinica_geral"
    v = value.strip().lower()
    if v in _SPECIALTY_ALIASES:
        return _SPECIALTY_ALIASES[v]
    snake = v.replace(" ", "_")
    return _SPECIALTY_ALIASES.get(snake, snake)
