from __future__ import annotations
"""
Triage Engine — Rule-Based MVP for Health Platform

Config-driven rule engine that evaluates patient symptoms and produces:
- risk_level: LOW | MEDIUM | URGENT
- recommended_action: SELF_CARE | DOCTOR_24H | DOCTOR_NOW | ER_NOW
- reasoning_json: structured explanation for audit

Design:
- Hard red-flag overrides (chest pain, breathing difficulty, stroke signs, etc.)
- Weighted scoring for gradual risk classification
- All rules defined as data (easy to extend without code changes)
"""
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# Triage Questions (config)
# ═══════════════════════════════════════════════════════════════

TRIAGE_QUESTIONS = [
    {
        "key": "age",
        "text": "Qual é a sua idade?",
        "type": "number",
        "required": True,
    },
    {
        "key": "temperature",
        "text": "Qual é a sua temperatura corporal (°C)? (0 se não sabe)",
        "type": "number",
        "required": False,
    },
    {
        "key": "chest_pain",
        "text": "Tem dor no peito?",
        "type": "boolean",
        "required": True,
    },
    {
        "key": "breathing_difficulty",
        "text": "Tem dificuldade em respirar?",
        "type": "boolean",
        "required": True,
    },
    {
        "key": "fainting",
        "text": "Desmaiou ou sentiu que ia desmaiar?",
        "type": "boolean",
        "required": True,
    },
    {
        "key": "stroke_signs",
        "text": "Apresenta sinais de AVC (dormência facial, dificuldade em falar, fraqueza num lado do corpo)?",
        "type": "boolean",
        "required": True,
    },
    {
        "key": "severe_bleeding",
        "text": "Tem hemorragia grave que não para?",
        "type": "boolean",
        "required": True,
    },
    {
        "key": "fever_days",
        "text": "Há quantos dias tem febre? (0 se não tem)",
        "type": "number",
        "required": False,
    },
    {
        "key": "pain_level",
        "text": "Nível de dor de 0 a 10?",
        "type": "number",
        "required": True,
    },
    {
        "key": "chronic_conditions",
        "text": "Tem doenças crónicas (diabetes, hipertensão, asma, etc.)?",
        "type": "boolean",
        "required": True,
    },
    {
        "key": "pregnant",
        "text": "Está grávida ou pode estar grávida?",
        "type": "boolean",
        "required": False,
    },
    {
        "key": "symptoms_duration_hours",
        "text": "Há quantas horas começaram os sintomas?",
        "type": "number",
        "required": False,
    },
    {
        "key": "vomiting_diarrhea",
        "text": "Tem vómitos ou diarreia persistentes?",
        "type": "boolean",
        "required": False,
    },
    {
        "key": "rash_skin",
        "text": "Tem erupção cutânea ou lesões na pele?",
        "type": "boolean",
        "required": False,
    },
    {
        "key": "mental_health_crisis",
        "text": "Está em situação de crise de saúde mental (pensamentos suicidas, autolesão)?",
        "type": "boolean",
        "required": True,
    },
]


# ═══════════════════════════════════════════════════════════════
# Red Flag Rules (hard overrides → URGENT / ER_NOW)
# ═══════════════════════════════════════════════════════════════

RED_FLAG_KEYS = [
    "chest_pain",
    "breathing_difficulty",
    "fainting",
    "stroke_signs",
    "severe_bleeding",
    "mental_health_crisis",
]

# ═══════════════════════════════════════════════════════════════
# Weighted Scoring Rules
# ═══════════════════════════════════════════════════════════════

SCORING_RULES = [
    # (question_key, condition_fn, points, reason)
    ("age", lambda v: _num(v) < 2 or _num(v) > 70, 15, "Idade de risco (< 2 ou > 70 anos)"),
    ("temperature", lambda v: _num(v) >= 39.5, 15, "Febre alta (≥ 39.5°C)"),
    ("temperature", lambda v: 38.0 <= _num(v) < 39.5, 8, "Febre moderada (38-39.5°C)"),
    ("fever_days", lambda v: _num(v) >= 3, 12, "Febre persistente (≥ 3 dias)"),
    ("pain_level", lambda v: _num(v) >= 8, 15, "Dor intensa (≥ 8/10)"),
    ("pain_level", lambda v: 5 <= _num(v) < 8, 8, "Dor moderada (5-7/10)"),
    ("chronic_conditions", lambda v: _bool(v), 10, "Doenças crónicas reportadas"),
    ("pregnant", lambda v: _bool(v), 10, "Gravidez reportada"),
    ("vomiting_diarrhea", lambda v: _bool(v), 8, "Vómitos/diarreia persistentes"),
    ("symptoms_duration_hours", lambda v: _num(v) > 72, 10, "Sintomas > 72h sem melhoria"),
    ("rash_skin", lambda v: _bool(v), 5, "Erupção cutânea"),
]


def _num(v: Any) -> float:
    """Safely parse a numeric value from answer."""
    if v is None:
        return 0
    try:
        return float(v)
    except (ValueError, TypeError):
        return 0


def _bool(v: Any) -> bool:
    """Safely parse a boolean value from answer."""
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.lower() in ("true", "yes", "sim", "1")
    return bool(v)


# ═══════════════════════════════════════════════════════════════
# Triage Result
# ═══════════════════════════════════════════════════════════════

@dataclass
class TriageEvaluation:
    risk_level: str  # LOW, MEDIUM, URGENT
    recommended_action: str  # SELF_CARE, DOCTOR_24H, DOCTOR_NOW, ER_NOW
    score: float
    reasoning: Dict[str, Any] = field(default_factory=dict)


# ═══════════════════════════════════════════════════════════════
# Engine
# ═══════════════════════════════════════════════════════════════

def get_triage_questions() -> List[dict]:
    """Return the list of triage questions for the frontend."""
    return TRIAGE_QUESTIONS


def evaluate_triage(answers: Dict[str, Any]) -> TriageEvaluation:
    """
    Evaluate a set of triage answers and produce a risk classification.

    Args:
        answers: dict mapping question_key → answer value

    Returns:
        TriageEvaluation with risk_level, recommended_action, score, reasoning
    """
    triggered_red_flags: List[str] = []
    triggered_rules: List[str] = []
    score = 0.0

    # 1) Check red flags (hard override)
    for key in RED_FLAG_KEYS:
        val = answers.get(key)
        if _bool(val):
            triggered_red_flags.append(key)

    if triggered_red_flags:
        return TriageEvaluation(
            risk_level="URGENT",
            recommended_action="ER_NOW",
            score=100.0,
            reasoning={
                "red_flags": triggered_red_flags,
                "triggered_rules": [],
                "message": "Sinais de alerta grave detectados. Procure atendimento de emergência imediatamente.",
            },
        )

    # 2) Weighted scoring
    for key, condition_fn, points, reason in SCORING_RULES:
        val = answers.get(key)
        if val is not None:
            try:
                if condition_fn(val):
                    score += points
                    triggered_rules.append(reason)
            except Exception:
                pass

    # 3) Classify based on score
    if score >= 40:
        risk_level = "URGENT"
        recommended_action = "DOCTOR_NOW"
    elif score >= 20:
        risk_level = "MEDIUM"
        recommended_action = "DOCTOR_24H"
    else:
        risk_level = "LOW"
        recommended_action = "SELF_CARE"

    return TriageEvaluation(
        risk_level=risk_level,
        recommended_action=recommended_action,
        score=min(score, 100.0),
        reasoning={
            "red_flags": [],
            "triggered_rules": triggered_rules,
            "score_breakdown": score,
            "message": _action_message(recommended_action),
        },
    )


def _action_message(action: str) -> str:
    messages = {
        "SELF_CARE": "Sintomas ligeiros. Autocuidado recomendado. Monitorize os sintomas.",
        "DOCTOR_24H": "Recomenda-se consulta médica nas próximas 24 horas.",
        "DOCTOR_NOW": "Consulta médica urgente recomendada. Agende imediatamente.",
        "ER_NOW": "Emergência. Dirija-se ao serviço de urgência mais próximo.",
    }
    return messages.get(action, "Monitorize os sintomas.")
