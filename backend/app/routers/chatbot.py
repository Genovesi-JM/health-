from __future__ import annotations
"""
Chatbot Router — AI-powered patient assistant.

Smart rule-based chatbot that:
- Detects user intent from Portuguese natural language
- Provides contextual responses based on patient state
- Guides users through triage, consultations, and platform navigation
- Handles emergency detection with immediate ER guidance
- Encourages conversion: Triage → Consultation → Payment

Endpoint:
- POST /api/v1/chatbot/message — Send message, get response
"""
import logging
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import Patient, TriageSession, TriageResult, Consultation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/chatbot", tags=["chatbot"])


# ── Schemas ──

class ChatMessage(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    action: Optional[str] = None  # navigate, link, none
    action_target: Optional[str] = None  # e.g. /triage, /consultations
    suggestions: list[str] = []


# ── Intent Detection ──

EMERGENCY_KEYWORDS = [
    "emergência", "emergencia", "urgência", "urgencia",
    "dor no peito", "dor peito", "não consigo respirar", "nao consigo respirar",
    "dificuldade respirar", "avc", "derrame", "desmaio", "desmaiei",
    "hemorragia", "sangramento grave", "convulsão", "convulsao",
    "overdose", "envenenamento", "ataque cardíaco", "ataque cardiaco",
    "perda de consciência", "perda de consciencia", "vou morrer",
    "socorro", "112", "ambulância", "ambulancia",
]

TRIAGE_KEYWORDS = [
    "triagem", "sintoma", "sintomas", "o que tenho", "diagnóstico",
    "diagnostico", "avaliar", "avaliação", "avaliacao", "doente",
    "mal disposto", "febre", "dor", "tosse", "gripe", "constipação",
    "constipacao", "diarreia", "vomitar", "vómito", "vomito",
    "dor de cabeça", "dor cabeca", "tontura", "alergia",
    "iniciar triagem", "fazer triagem", "quero triagem",
    "check-up", "checkup", "como me sinto",
]

CONSULTATION_KEYWORDS = [
    "consulta", "consultas", "marcar consulta", "agendar", "médico",
    "medico", "doutor", "doutora", "especialista", "teleconsulta",
    "videochamada", "falar com médico", "falar com medico",
    "quando posso", "disponibilidade", "horário", "horario",
    "próxima consulta", "proxima consulta", "cancelar consulta",
]

PRICING_KEYWORDS = [
    "preço", "preco", "custo", "quanto custa", "pagamento",
    "pagar", "valor", "plano", "grátis", "gratis", "gratuito",
    "desconto", "promoção", "promocao",
]

NAVIGATION_KEYWORDS = [
    "como funciona", "ajuda", "onde", "encontrar", "perfil",
    "definições", "definicoes", "configurações", "configuracoes",
    "palavra-passe", "password", "conta", "dados", "histórico",
    "historico", "resultado", "relatório", "relatorio",
]

GREETING_KEYWORDS = [
    "olá", "ola", "oi", "bom dia", "boa tarde", "boa noite",
    "hello", "hi", "hey", "obrigado", "obrigada", "thanks",
    "tudo bem", "como vai",
]


def detect_intent(text: str) -> str:
    """Detect user intent from message text."""
    lower = text.lower().strip()

    # Emergency always takes priority
    for kw in EMERGENCY_KEYWORDS:
        if kw in lower:
            return "emergency"

    # Check each category
    for kw in GREETING_KEYWORDS:
        if kw in lower:
            return "greeting"

    for kw in TRIAGE_KEYWORDS:
        if kw in lower:
            return "triage"

    for kw in CONSULTATION_KEYWORDS:
        if kw in lower:
            return "consultation"

    for kw in PRICING_KEYWORDS:
        if kw in lower:
            return "pricing"

    for kw in NAVIGATION_KEYWORDS:
        if kw in lower:
            return "navigation"

    return "general"


def get_patient_context(user: User, db: Session) -> dict:
    """Gather patient state for contextual responses."""
    ctx: dict = {
        "is_patient": False,
        "has_triage": False,
        "last_risk": None,
        "pending_consultations": 0,
        "triage_in_progress": False,
    }

    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        return ctx

    ctx["is_patient"] = True

    # Latest triage
    latest_triage = (
        db.query(TriageSession)
        .filter(TriageSession.patient_id == patient.id)
        .order_by(TriageSession.created_at.desc())
        .first()
    )
    if latest_triage:
        ctx["has_triage"] = True
        ctx["triage_in_progress"] = latest_triage.status == "in_progress"
        result = (
            db.query(TriageResult)
            .filter(TriageResult.triage_session_id == latest_triage.id)
            .first()
        )
        if result:
            ctx["last_risk"] = result.risk_level

    # Pending consultations
    pending = (
        db.query(Consultation)
        .filter(
            Consultation.patient_id == patient.id,
            Consultation.status.in_(["requested", "scheduled"]),
        )
        .count()
    )
    ctx["pending_consultations"] = pending

    return ctx


# ── Response Generators ──

def emergency_response() -> ChatResponse:
    return ChatResponse(
        reply=(
            "🚨 **EMERGÊNCIA DETECTADA**\n\n"
            "Se está em perigo imediato, ligue **112** agora.\n\n"
            "⚠️ Sinais de emergência:\n"
            "• Dor forte no peito\n"
            "• Dificuldade em respirar\n"
            "• Perda de consciência\n"
            "• Hemorragia grave\n"
            "• Sinais de AVC\n\n"
            "**Não espere — dirija-se às Urgências mais próximas ou ligue 112.**"
        ),
        action="emergency",
        suggestions=["Ligar 112", "Como fazer triagem"],
    )


def greeting_response(ctx: dict, user_name: str) -> ChatResponse:
    hour = datetime.now().hour
    if hour < 12:
        greeting = "Bom dia"
    elif hour < 19:
        greeting = "Boa tarde"
    else:
        greeting = "Boa noite"

    name = user_name.split()[0] if user_name else ""
    base = f"{greeting}{', ' + name if name else ''}! 👋\n\nSou o assistente da Health Platform."

    if ctx.get("triage_in_progress"):
        base += "\n\n📋 Notei que tem uma **triagem em curso**. Quer continuar?"
        suggestions = ["Continuar triagem", "Marcar consulta", "Como funciona?"]
    elif ctx.get("last_risk") in ("HIGH", "URGENT"):
        base += (
            "\n\n⚠️ A sua última triagem indicou **risco elevado**. "
            "Recomendo marcar uma consulta médica."
        )
        suggestions = ["Marcar consulta", "Ver resultados", "Ajuda"]
    elif ctx.get("has_triage"):
        base += "\n\nComo posso ajudar hoje?"
        suggestions = ["Nova triagem", "Marcar consulta", "Ver histórico"]
    else:
        base += "\n\nPosso ajudá-lo(a) a:\n• Fazer uma triagem de sintomas\n• Marcar uma consulta\n• Navegar a plataforma"
        suggestions = ["Fazer triagem", "Marcar consulta", "Como funciona?"]

    return ChatResponse(reply=base, suggestions=suggestions)


def triage_response(ctx: dict) -> ChatResponse:
    if ctx.get("triage_in_progress"):
        return ChatResponse(
            reply=(
                "📋 **Tem uma triagem em curso!**\n\n"
                "Clique no botão abaixo para continuar a responder às perguntas e obter a sua avaliação de risco."
            ),
            action="navigate",
            action_target="/triage",
            suggestions=["Ir para triagem", "O que é a triagem?"],
        )

    if ctx.get("last_risk"):
        risk_labels = {"LOW": "baixo", "MEDIUM": "médio", "HIGH": "alto", "URGENT": "urgente"}
        risk = risk_labels.get(ctx["last_risk"], ctx["last_risk"])
        reply = (
            f"📊 A sua última triagem indicou risco **{risk}**.\n\n"
        )
        if ctx["last_risk"] in ("HIGH", "URGENT"):
            reply += "⚠️ **Recomendação:** Marque uma consulta médica o mais rápido possível.\n\n"
        elif ctx["last_risk"] == "MEDIUM":
            reply += "💡 **Recomendação:** Considere marcar uma consulta nas próximas 24 horas.\n\n"
        else:
            reply += "✅ **Recomendação:** Monitore os sintomas. Se piorarem, faça nova triagem.\n\n"

        reply += "Pode iniciar uma **nova triagem** a qualquer momento."
        return ChatResponse(
            reply=reply,
            action="navigate",
            action_target="/triage",
            suggestions=["Nova triagem", "Marcar consulta", "Ver histórico"],
        )

    return ChatResponse(
        reply=(
            "🩺 **Triagem Digital**\n\n"
            "A triagem analisa os seus sintomas e indica o nível de risco:\n\n"
            "🟢 **Baixo** — Auto-cuidado em casa\n"
            "🟡 **Médio** — Consulta em 24h\n"
            "🟠 **Alto** — Consulta urgente\n"
            "🔴 **Urgente** — Urgências / 112\n\n"
            "É rápido (2-3 minutos) e completamente confidencial.\n"
            "Quer iniciar agora?"
        ),
        action="navigate",
        action_target="/triage",
        suggestions=["Iniciar triagem", "Falar com médico"],
    )


def consultation_response(ctx: dict) -> ChatResponse:
    if ctx.get("pending_consultations", 0) > 0:
        n = ctx["pending_consultations"]
        return ChatResponse(
            reply=(
                f"📅 Tem **{n} consulta{'s' if n > 1 else ''} pendente{'s' if n > 1 else ''}**.\n\n"
                "Pode verificar o estado, horário e detalhes na página de consultas."
            ),
            action="navigate",
            action_target="/consultations",
            suggestions=["Ver consultas", "Marcar mais uma", "Cancelar consulta"],
        )

    if not ctx.get("has_triage"):
        return ChatResponse(
            reply=(
                "📋 **Antes de marcar consulta**, recomendamos fazer uma triagem rápida.\n\n"
                "A triagem ajuda o médico a preparar-se e priorizar o seu caso. "
                "Demora apenas 2-3 minutos!\n\n"
                "Quer iniciar a triagem primeiro?"
            ),
            action="navigate",
            action_target="/triage",
            suggestions=["Fazer triagem", "Marcar consulta direto"],
        )

    return ChatResponse(
        reply=(
            "👨‍⚕️ **Marcar Consulta**\n\n"
            "Pode agendar uma teleconsulta com um dos nossos médicos verificados.\n\n"
            "📌 **Como funciona:**\n"
            "1. Escolha a especialidade\n"
            "2. Marque o horário\n"
            "3. Receba confirmação\n"
            "4. Consulta por videochamada\n\n"
            "O médico terá acesso aos seus resultados de triagem para melhor atendimento."
        ),
        action="navigate",
        action_target="/consultations",
        suggestions=["Marcar agora", "Ver médicos disponíveis", "Preços"],
    )


def pricing_response() -> ChatResponse:
    return ChatResponse(
        reply=(
            "💰 **Informações de Preço**\n\n"
            "• **Triagem Digital** — Gratuita ✅\n"
            "• **Teleconsulta** — A partir de 5.000 Kz\n"
            "• **Receita Digital** — Incluída na consulta\n"
            "• **Relatório de Triagem** — Gratuito\n\n"
            "A triagem é sempre gratuita e ajuda a priorizar o seu caso!\n\n"
            "Quer fazer uma triagem gratuita agora?"
        ),
        action=None,
        suggestions=["Fazer triagem grátis", "Marcar consulta", "Falar com suporte"],
    )


def navigation_response(text: str) -> ChatResponse:
    lower = text.lower()

    if any(w in lower for w in ["perfil", "dados", "conta"]):
        return ChatResponse(
            reply=(
                "👤 **O Seu Perfil**\n\n"
                "Na página de perfil pode:\n"
                "• Atualizar dados pessoais\n"
                "• Adicionar alergias e condições\n"
                "• Definir contacto de emergência\n\n"
                "Manter o perfil atualizado ajuda na triagem!"
            ),
            action="navigate",
            action_target="/patient/profile",
            suggestions=["Ir ao perfil", "Fazer triagem", "Ajuda"],
        )

    if any(w in lower for w in ["histórico", "historico", "resultado", "relatório", "relatorio"]):
        return ChatResponse(
            reply=(
                "📊 **Histórico**\n\n"
                "Pode ver todo o seu histórico no Dashboard:\n"
                "• Triagens anteriores e níveis de risco\n"
                "• Consultas passadas e futuras\n"
                "• Receitas e referências médicas"
            ),
            action="navigate",
            action_target="/dashboard",
            suggestions=["Ir ao dashboard", "Nova triagem", "Marcar consulta"],
        )

    if any(w in lower for w in ["password", "palavra-passe", "definições", "definicoes", "configurações", "configuracoes"]):
        return ChatResponse(
            reply=(
                "⚙️ **Definições**\n\n"
                "Nas definições pode:\n"
                "• Alterar a palavra-passe\n"
                "• Gerir notificações\n"
                "• Configurar preferências"
            ),
            action="navigate",
            action_target="/settings",
            suggestions=["Ir às definições", "Ajuda", "Dashboard"],
        )

    return ChatResponse(
        reply=(
            "🏥 **Como Funciona a Plataforma**\n\n"
            "1️⃣ **Triagem** — Responda a perguntas sobre sintomas (grátis)\n"
            "2️⃣ **Resultado** — Receba avaliação de risco imediata\n"
            "3️⃣ **Consulta** — Marque teleconsulta se necessário\n"
            "4️⃣ **Tratamento** — Receita digital e acompanhamento\n\n"
            "Tudo seguro, confidencial e com médicos verificados. 🔒"
        ),
        action=None,
        suggestions=["Iniciar triagem", "Marcar consulta", "Ver preços"],
    )


def general_response(text: str) -> ChatResponse:
    return ChatResponse(
        reply=(
            "Entendo! Posso ajudá-lo(a) com:\n\n"
            "🩺 **Saúde** — Triagem de sintomas, consultas\n"
            "📋 **Plataforma** — Navegação, perfil, histórico\n"
            "💰 **Preços** — Informações sobre custos\n"
            "🆘 **Emergência** — Orientação urgente\n\n"
            "Que tema gostaria de explorar?"
        ),
        suggestions=["Fazer triagem", "Marcar consulta", "Preços", "Como funciona?"],
    )


# ── Main Endpoint ──

@router.post("/message", response_model=ChatResponse)
def chat_message(
    body: ChatMessage,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Process a chat message and return contextual response."""
    text = body.message.strip()
    if not text:
        return ChatResponse(
            reply="Por favor, escreva uma mensagem. 😊",
            suggestions=["Fazer triagem", "Ajuda"],
        )

    intent = detect_intent(text)
    ctx = get_patient_context(current_user, db)
    user_name = current_user.full_name if hasattr(current_user, "full_name") else ""

    if intent == "emergency":
        return emergency_response()
    elif intent == "greeting":
        return greeting_response(ctx, user_name or "")
    elif intent == "triage":
        return triage_response(ctx)
    elif intent == "consultation":
        return consultation_response(ctx)
    elif intent == "pricing":
        return pricing_response()
    elif intent == "navigation":
        return navigation_response(text)
    else:
        return general_response(text)
