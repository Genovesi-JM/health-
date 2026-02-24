from __future__ import annotations
"""
Chatbot Router — AI-powered patient assistant (GeoVision-style).

Like GeoVision's GAIA chatbot but for health:
- Multi-turn conversation with full message history
- OpenAI GPT integration with health-specific system prompt
- Page context awareness (knows which page the user is viewing)
- Patient state context (triage history, consultations, risk level)
- Demo/fallback mode with smart rule-based responses when no API key
- Emergency detection always handled locally (no AI delay)

Endpoints:
- POST /api/v1/chatbot/chat — Multi-turn chat (GeoVision-style)
- POST /api/v1/chatbot/message — Legacy single-message (backward compat)
"""
import asyncio
import logging
import os
from datetime import datetime
from typing import List, Literal, Optional

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import Patient, TriageSession, TriageResult, Consultation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/chatbot", tags=["chatbot"])


# ═══════════════════════════════════════════════════════════════
# Schemas
# ═══════════════════════════════════════════════════════════════

class ChatMessageItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    """GeoVision-style chat request with full conversation history."""
    messages: List[ChatMessageItem]
    page: Optional[str] = None
    page_title: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    action: Optional[str] = None
    action_target: Optional[str] = None
    suggestions: list[str] = []


# Legacy single-message schema (backward compat)
class SingleMessage(BaseModel):
    message: str


# ═══════════════════════════════════════════════════════════════
# Health System Prompt
# ═══════════════════════════════════════════════════════════════

HEALTH_SYSTEM_PROMPT = """
Es a assistente de saude AI da Health Platform, focada em Angola e paises lusofonos.

Tens acesso a contexto adicional:
- `page`: pagina actual onde o utilizador se encontra.
- `page_title`: titulo da pagina.
- `patient_context`: estado clinico do paciente (triagens, consultas, risco).

Regras importantes:
- Responde SEMPRE em portugues.
- Se empatica, profissional e clara.
- Se detectares sintomas de EMERGENCIA (dor no peito, dificuldade respirar,
  AVC, hemorragia grave, perda de consciencia), responde IMEDIATAMENTE
  com instrucao para ligar 112 ou ir as Urgencias. Nao facas diagnostico.
- NUNCA facas diagnostico medico. Podes orientar e recomendar triagem/consulta.
- Usa emojis moderadamente para tornar as respostas amigaveis.
- Mantem respostas concisas (maximo 150 palavras).
- Incentiva o fluxo: Triagem -> Consulta -> Tratamento.
- Se o utilizador perguntar sobre "esta pagina" ou conteudo visivel,
  usa o contexto da pagina para responder.

Servicos da plataforma:
- Triagem Digital (gratuita, 2-3 minutos, avaliacao de risco)
- Teleconsulta (a partir de 5.000 Kz, com medicos verificados)
- Receita Digital (incluida na consulta)
- Historico clinico e acompanhamento

Niveis de risco da triagem:
Verde/Baixo: Auto-cuidado em casa
Amarelo/Medio: Consulta em 24h recomendada
Laranja/Alto: Consulta urgente necessaria
Vermelho/Urgente: Urgencias / Ligar 112

Objectivo: ajudar pacientes a navegar a plataforma, compreender
resultados, marcar consultas e sentir-se apoiados no seu percurso de saude.
"""


# ═══════════════════════════════════════════════════════════════
# Emergency Detection (always local, never wait for AI)
# ═══════════════════════════════════════════════════════════════

EMERGENCY_KEYWORDS = [
    "emergencia", "urgencia",
    "dor no peito", "dor peito", "nao consigo respirar",
    "dificuldade respirar",
    "avc", "derrame", "desmaio", "desmaiei",
    "hemorragia", "sangramento grave", "convulsao",
    "overdose", "envenenamento", "ataque cardiaco",
    "perda de consciencia",
    "vou morrer", "socorro", "112", "ambulancia",
]


def is_emergency(text: str) -> bool:
    lower = text.lower().replace("ê", "e").replace("â", "a").replace("í", "i").replace("á", "a").replace("ã", "a").replace("ó", "o").replace("ú", "u")
    return any(kw in lower for kw in EMERGENCY_KEYWORDS)


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


# ═══════════════════════════════════════════════════════════════
# Patient Context Builder
# ═══════════════════════════════════════════════════════════════

def get_patient_context(user: User, db: Session) -> str:
    """Build a text summary of patient state for the AI system prompt."""
    parts: list[str] = []

    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        parts.append("Utilizador sem perfil de paciente registado.")
        return " | ".join(parts)

    # Triage state
    latest_triage = (
        db.query(TriageSession)
        .filter(TriageSession.patient_id == patient.id)
        .order_by(TriageSession.created_at.desc())
        .first()
    )
    triage_count = (
        db.query(TriageSession)
        .filter(TriageSession.patient_id == patient.id)
        .count()
    )

    if latest_triage:
        parts.append(f"Total triagens: {triage_count}")
        parts.append(f"Ultima triagem: {latest_triage.status} ({latest_triage.created_at.strftime('%d/%m/%Y')})")
        if latest_triage.chief_complaint:
            parts.append(f"Queixa: {latest_triage.chief_complaint}")
        result = (
            db.query(TriageResult)
            .filter(TriageResult.triage_session_id == latest_triage.id)
            .first()
        )
        if result:
            parts.append(f"Risco: {result.risk_level}")
            parts.append(f"Acao recomendada: {result.recommended_action}")
        elif latest_triage.status == "in_progress":
            parts.append("Triagem em curso (nao concluida)")
    else:
        parts.append("Sem triagens realizadas.")

    # Consultations
    pending = (
        db.query(Consultation)
        .filter(
            Consultation.patient_id == patient.id,
            Consultation.status.in_(["requested", "scheduled"]),
        )
        .count()
    )
    completed = (
        db.query(Consultation)
        .filter(
            Consultation.patient_id == patient.id,
            Consultation.status == "completed",
        )
        .count()
    )
    parts.append(f"Consultas pendentes: {pending}")
    parts.append(f"Consultas concluidas: {completed}")

    return " | ".join(parts)


def get_patient_context_dict(user: User, db: Session) -> dict:
    """Get structured patient context for demo/fallback responses."""
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

    ctx["pending_consultations"] = (
        db.query(Consultation)
        .filter(
            Consultation.patient_id == patient.id,
            Consultation.status.in_(["requested", "scheduled"]),
        )
        .count()
    )

    return ctx


# ═══════════════════════════════════════════════════════════════
# OpenAI Integration (GeoVision-style)
# ═══════════════════════════════════════════════════════════════

async def call_openai(
    messages: List[ChatMessageItem],
    patient_context: str,
    page: Optional[str] = None,
    page_title: Optional[str] = None,
) -> str:
    """Call OpenAI with health system prompt + patient context."""
    api_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    model = settings.openai_model or "gpt-4o-mini"

    if not api_key:
        return ""  # Signal to use demo mode

    # Build system messages
    chat_messages = [{"role": "system", "content": HEALTH_SYSTEM_PROMPT}]

    # Add patient + page context
    context_parts = []
    if patient_context:
        context_parts.append(f"Estado do paciente: {patient_context}")
    if page:
        context_parts.append(f"Pagina actual: {page}")
    if page_title:
        context_parts.append(f"Titulo da pagina: {page_title}")

    if context_parts:
        chat_messages.append({
            "role": "system",
            "content": " | ".join(context_parts),
        })

    # Add conversation history
    for m in messages:
        chat_messages.append({"role": m.role, "content": m.content})

    headers = {"Authorization": f"Bearer {api_key}"}
    payload = {"model": model, "messages": chat_messages}

    # Retry with backoff (same as GeoVision)
    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                )
        except httpx.RequestError as exc:
            logger.error("OpenAI request failed (attempt %s): %s", attempt, exc)
            if attempt < max_attempts:
                await asyncio.sleep(2 ** attempt)
                continue
            return ""

        if res.status_code != 200:
            logger.error("OpenAI HTTP %s (attempt %s): %s", res.status_code, attempt, res.text[:300])
            if attempt < max_attempts:
                await asyncio.sleep(2 ** attempt)
                continue
            return ""

        try:
            data = res.json()
            return data["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError) as exc:
            logger.error("OpenAI response parse error: %s", exc)
            if attempt < max_attempts:
                await asyncio.sleep(2 ** attempt)
                continue
            return ""

    return ""


# ═══════════════════════════════════════════════════════════════
# Demo / Fallback Response Engine
# ═══════════════════════════════════════════════════════════════

INTENT_KEYWORDS = {
    "greeting": [
        "ola", "oi", "bom dia", "boa tarde", "boa noite",
        "hello", "hi", "hey", "obrigado", "obrigada", "tudo bem",
    ],
    "triage": [
        "triagem", "sintoma", "sintomas", "diagnostico",
        "doente", "febre", "dor", "tosse", "gripe", "diarreia",
        "vomitar", "tontura", "alergia", "mal disposto",
        "iniciar triagem", "fazer triagem", "check-up",
    ],
    "pricing": [
        "preco", "custo", "quanto custa", "pagamento",
        "pagar", "valor", "gratis", "gratuito", "custa",
    ],
    "consultation": [
        "consulta", "marcar", "agendar", "medico",
        "doutor", "doutora", "especialista", "teleconsulta",
        "videochamada", "cancelar consulta",
    ],
    "navigation": [
        "como funciona", "ajuda", "perfil", "definicoes",
        "password", "conta", "historico",
        "resultado", "relatorio",
    ],
}


def _normalize(text: str) -> str:
    """Strip accents for keyword matching."""
    replacements = {
        "á": "a", "à": "a", "â": "a", "ã": "a",
        "é": "e", "ê": "e", "í": "i", "ó": "o",
        "ô": "o", "õ": "o", "ú": "u", "ç": "c",
    }
    result = text.lower()
    for src, dst in replacements.items():
        result = result.replace(src, dst)
    return result


def detect_intent(text: str) -> str:
    normalized = _normalize(text)
    for intent, keywords in INTENT_KEYWORDS.items():
        for kw in keywords:
            if kw in normalized:
                return intent
    return "general"


def demo_response(
    messages: List[ChatMessageItem],
    ctx: dict,
    user_name: str,
    page: Optional[str] = None,
) -> ChatResponse:
    """Smart fallback when OpenAI is not available."""
    last_text = messages[-1].content if messages else ""
    intent = detect_intent(last_text)

    if intent == "greeting":
        hour = datetime.now().hour
        greeting = "Bom dia" if hour < 12 else "Boa tarde" if hour < 19 else "Boa noite"
        name = user_name.split()[0] if user_name else ""
        base = f"{greeting}{', ' + name if name else ''}! 👋\n\nSou a assistente da Health Platform."

        if ctx.get("triage_in_progress"):
            base += "\n\n📋 Tem uma **triagem em curso**. Quer continuar?"
            suggestions = ["Continuar triagem", "Marcar consulta", "Como funciona?"]
        elif ctx.get("last_risk") in ("HIGH", "URGENT"):
            base += "\n\n⚠️ A sua ultima triagem indicou **risco elevado**. Recomendo marcar consulta."
            suggestions = ["Marcar consulta", "Ver resultados", "Ajuda"]
        elif ctx.get("has_triage"):
            base += "\n\nComo posso ajudar hoje?"
            suggestions = ["Nova triagem", "Marcar consulta", "Ver historico"]
        else:
            base += "\n\nPosso ajuda-lo(a) a:\n• Fazer triagem de sintomas\n• Marcar consulta\n• Navegar a plataforma"
            suggestions = ["Fazer triagem", "Marcar consulta", "Como funciona?"]

        return ChatResponse(reply=base, suggestions=suggestions)

    if intent == "triage":
        if ctx.get("triage_in_progress"):
            return ChatResponse(
                reply="📋 **Tem uma triagem em curso!**\n\nContinue a responder para obter a avaliacao de risco.",
                action="navigate", action_target="/triage",
                suggestions=["Ir para triagem", "O que e a triagem?"],
            )
        if ctx.get("last_risk"):
            risk_labels = {"LOW": "baixo", "MEDIUM": "medio", "HIGH": "alto", "URGENT": "urgente"}
            risk = risk_labels.get(ctx["last_risk"], ctx["last_risk"])
            reply = f"📊 A sua ultima triagem indicou risco **{risk}**.\n\n"
            if ctx["last_risk"] in ("HIGH", "URGENT"):
                reply += "⚠️ **Recomendacao:** Marque consulta o mais rapido possivel.\n\n"
            elif ctx["last_risk"] == "MEDIUM":
                reply += "💡 **Recomendacao:** Considere marcar consulta nas proximas 24h.\n\n"
            else:
                reply += "✅ **Recomendacao:** Monitore os sintomas. Se piorarem, faca nova triagem.\n\n"
            reply += "Pode iniciar uma **nova triagem** a qualquer momento."
            return ChatResponse(
                reply=reply, action="navigate", action_target="/triage",
                suggestions=["Nova triagem", "Marcar consulta", "Ver historico"],
            )
        return ChatResponse(
            reply=(
                "🩺 **Triagem Digital**\n\n"
                "Analisa os seus sintomas e indica o nivel de risco:\n\n"
                "🟢 **Baixo** — Auto-cuidado\n🟡 **Medio** — Consulta em 24h\n"
                "🟠 **Alto** — Consulta urgente\n🔴 **Urgente** — 112\n\n"
                "E rapido (2-3 minutos) e gratuito. Quer iniciar?"
            ),
            action="navigate", action_target="/triage",
            suggestions=["Iniciar triagem", "Falar com medico"],
        )

    if intent == "consultation":
        if ctx.get("pending_consultations", 0) > 0:
            n = ctx["pending_consultations"]
            return ChatResponse(
                reply=f"📅 Tem **{n} consulta{'s' if n > 1 else ''} pendente{'s' if n > 1 else ''}**.\n\nVerifique o estado na pagina de consultas.",
                action="navigate", action_target="/consultations",
                suggestions=["Ver consultas", "Marcar mais uma"],
            )
        if not ctx.get("has_triage"):
            return ChatResponse(
                reply="📋 **Antes de marcar consulta**, recomendamos fazer triagem rapida.\n\nAjuda o medico a preparar-se e demora so 2-3 minutos!",
                action="navigate", action_target="/triage",
                suggestions=["Fazer triagem", "Marcar consulta direto"],
            )
        return ChatResponse(
            reply=(
                "👨‍⚕️ **Marcar Consulta**\n\n"
                "Agende teleconsulta com medicos verificados.\n\n"
                "📌 **Passos:**\n1. Escolha especialidade\n2. Marque horario\n"
                "3. Confirmacao\n4. Videochamada\n\n"
                "O medico tera acesso aos seus resultados de triagem."
            ),
            action="navigate", action_target="/consultations",
            suggestions=["Marcar agora", "Precos"],
        )

    if intent == "pricing":
        return ChatResponse(
            reply=(
                "💰 **Precos**\n\n"
                "• **Triagem Digital** — Gratuita ✅\n"
                "• **Teleconsulta** — A partir de 5.000 Kz\n"
                "• **Receita Digital** — Incluida\n"
                "• **Relatorio de Triagem** — Gratuito\n\n"
                "Quer fazer uma triagem gratuita agora?"
            ),
            suggestions=["Fazer triagem gratis", "Marcar consulta"],
        )

    if intent == "navigation":
        lower = _normalize(last_text)
        if any(w in lower for w in ["perfil", "dados", "conta"]):
            return ChatResponse(
                reply="👤 **O Seu Perfil**\n\nAtualize dados pessoais, alergias e contacto de emergencia.\nManter o perfil atualizado ajuda na triagem!",
                action="navigate", action_target="/patient/profile",
                suggestions=["Ir ao perfil", "Fazer triagem"],
            )
        if any(w in lower for w in ["historico", "resultado"]):
            return ChatResponse(
                reply="📊 **Historico**\n\nVeja triagens anteriores, consultas e receitas no Dashboard.",
                action="navigate", action_target="/dashboard",
                suggestions=["Ir ao dashboard", "Nova triagem"],
            )
        if any(w in lower for w in ["password", "palavra-passe", "definicoes"]):
            return ChatResponse(
                reply="⚙️ **Definicoes**\n\nAltere palavra-passe, notificacoes e preferencias.",
                action="navigate", action_target="/settings",
                suggestions=["Ir as definicoes", "Ajuda"],
            )
        return ChatResponse(
            reply=(
                "🏥 **Como Funciona**\n\n"
                "1️⃣ **Triagem** — Responda sobre sintomas (gratis)\n"
                "2️⃣ **Resultado** — Avaliacao de risco imediata\n"
                "3️⃣ **Consulta** — Teleconsulta se necessario\n"
                "4️⃣ **Tratamento** — Receita digital\n\n"
                "Seguro, confidencial e com medicos verificados. 🔒"
            ),
            suggestions=["Iniciar triagem", "Marcar consulta", "Precos"],
        )

    # General / unknown
    return ChatResponse(
        reply=(
            "Posso ajuda-lo(a) com:\n\n"
            "🩺 **Saude** — Triagem, consultas\n"
            "📋 **Plataforma** — Navegacao, perfil, historico\n"
            "💰 **Precos** — Custos e planos\n"
            "🆘 **Emergencia** — Orientacao urgente\n\n"
            "Que tema gostaria de explorar?"
        ),
        suggestions=["Fazer triagem", "Marcar consulta", "Precos", "Como funciona?"],
    )


def parse_ai_response(ai_text: str) -> ChatResponse:
    """Parse AI response and detect navigation hints."""
    action = None
    action_target = None
    suggestions: list[str] = []

    lower = _normalize(ai_text)

    if "triagem" in lower and any(w in lower for w in ["iniciar", "fazer", "comecar"]):
        action = "navigate"
        action_target = "/triage"
        suggestions = ["Iniciar triagem", "Marcar consulta"]
    elif "consulta" in lower and any(w in lower for w in ["marcar", "agendar"]):
        action = "navigate"
        action_target = "/consultations"
        suggestions = ["Marcar consulta", "Fazer triagem"]
    elif "perfil" in lower:
        suggestions = ["Ir ao perfil", "Fazer triagem", "Ajuda"]
    elif "112" in ai_text or "urgencia" in lower or "emergencia" in lower:
        action = "emergency"
        suggestions = ["Ligar 112", "Fazer triagem"]
    else:
        suggestions = ["Fazer triagem", "Marcar consulta", "Ajuda"]

    return ChatResponse(
        reply=ai_text,
        action=action,
        action_target=action_target,
        suggestions=suggestions,
    )


# ═══════════════════════════════════════════════════════════════
# Main Endpoints
# ═══════════════════════════════════════════════════════════════

@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """GeoVision-style multi-turn chat with AI + patient context."""
    if not request.messages:
        return ChatResponse(
            reply="Por favor, escreva uma mensagem. 😊",
            suggestions=["Fazer triagem", "Ajuda"],
        )

    last_text = request.messages[-1].content.strip()

    # Emergency detection — always local, never wait for AI
    if is_emergency(last_text):
        return emergency_response()

    # Build patient context
    patient_ctx_text = get_patient_context(current_user, db)
    patient_ctx_dict = get_patient_context_dict(current_user, db)
    user_name = getattr(current_user, "full_name", "") or ""

    logger.info(
        "chatbot.chat: page=%s title=%s msgs=%d",
        request.page, (request.page_title or "")[:50], len(request.messages),
    )

    # Try OpenAI first (GeoVision-style)
    ai_reply = await call_openai(
        messages=request.messages,
        patient_context=patient_ctx_text,
        page=request.page,
        page_title=request.page_title,
    )

    if ai_reply:
        return parse_ai_response(ai_reply)

    # Fallback to demo mode (smart rule-based)
    return demo_response(
        messages=request.messages,
        ctx=patient_ctx_dict,
        user_name=user_name,
        page=request.page,
    )


@router.post("/message", response_model=ChatResponse)
async def chat_message_legacy(
    body: SingleMessage,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Legacy single-message endpoint (backward compatibility)."""
    request = ChatRequest(
        messages=[ChatMessageItem(role="user", content=body.message)],
    )
    return await chat(request, current_user, db)
