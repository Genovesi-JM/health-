from __future__ import annotations

import re
from datetime import date
from urllib.parse import urlparse


COUNTRIES = {
    "AO": "Angola",
    "US": "Estados Unidos",
    "GB": "Reino Unido",
    "CU": "Cuba",
    "RU": "Rússia",
    "ES": "Espanha",
    "PT": "Portugal",
    "BR": "Brasil",
    "CV": "Cabo Verde",
    "MZ": "Moçambique",
    "CD": "República Democrática do Congo",
    "ST": "São Tomé e Príncipe",
    "ZW": "Zimbabwe",
    "ZA": "África do Sul", "NA": "Namíbia", "GW": "Guiné-Bissau",
    "AT": "Áustria", "BE": "Bélgica", "BG": "Bulgária", "HR": "Croácia",
    "CY": "Chipre", "CZ": "Chéquia", "DK": "Dinamarca", "EE": "Estónia",
    "FI": "Finlândia", "FR": "França", "DE": "Alemanha", "GR": "Grécia",
    "HU": "Hungria", "IE": "Irlanda", "IT": "Itália", "LV": "Letónia",
    "LT": "Lituânia", "LU": "Luxemburgo", "MT": "Malta", "NL": "Países Baixos",
    "PL": "Polónia", "RO": "Roménia", "SK": "Eslováquia", "SI": "Eslovénia",
    "SE": "Suécia",
}

EU_COUNTRIES = {
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE",
    "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT",
    "RO", "SK", "SI", "ES", "SE",
}

# Official links are review aids, not an assertion that an API check succeeded.
REGISTRIES = {
    ("AO", "doctor"): {
        "authority": "Ordem dos Médicos de Angola",
        "url": "https://ordemdosmedicos.ao/",
        "mode": "manual",
    },
    ("AO", "nurse"): {
        "authority": "Ordem dos Enfermeiros de Angola (ORDENFA)",
        "url": "https://ordenfa.org/a-ordem/faqs/",
        "mode": "manual",
    },
    ("PT", "doctor"): {
        "authority": "Ordem dos Médicos",
        "url": "https://ordemdosmedicos.pt/",
        "mode": "public_registry",
    },
    ("PT", "nurse"): {
        "authority": "Ordem dos Enfermeiros",
        "url": "https://www.ordemenfermeiros.pt/",
        "mode": "public_registry",
    },
    ("ES", "doctor"): {
        "authority": "Consejo General de Colegios Oficiales de Médicos",
        "url": "https://certificados.cgcom.es/verificar",
        "mode": "public_registry",
    },
    ("ES", "nurse"): {
        "authority": "Consejo General de Enfermería",
        "url": "https://www.consejogeneralenfermeria.org/",
        "mode": "public_registry",
    },
    ("BR", "doctor"): {
        "authority": "Conselho Federal de Medicina",
        "url": "https://portal.cfm.org.br/busca-medicos/",
        "mode": "public_registry",
    },
    ("BR", "nurse"): {
        "authority": "Conselho Federal de Enfermagem",
        "url": "https://www.cofen.gov.br/",
        "mode": "public_registry",
    },
    ("CU", "doctor"): {
        "authority": "Ministerio de Salud Pública de Cuba",
        "url": "https://salud.msp.gob.cu/",
        "mode": "manual",
    },
    ("CU", "nurse"): {
        "authority": "Ministerio de Salud Pública de Cuba",
        "url": "https://salud.msp.gob.cu/",
        "mode": "manual",
    },
    ("RU", "doctor"): {
        "authority": "Ministry of Health / Rosobrnadzor education register",
        "url": "https://frdocabinet.obrnadzor.gov.ru/",
        "mode": "manual",
    },
    ("RU", "nurse"): {
        "authority": "Ministry of Health / Rosobrnadzor education register",
        "url": "https://frdocabinet.obrnadzor.gov.ru/",
        "mode": "manual",
    },
    ("GB", "doctor"): {
        "authority": "General Medical Council",
        "url": "https://www.gmc-uk.org/registration-and-licensing/our-registers",
        "mode": "public_registry",
    },
    ("GB", "nurse"): {
        "authority": "Nursing and Midwifery Council",
        "url": "https://www.nmc.org.uk/registration/search-the-register/",
        "mode": "public_registry",
    },
    ("US", "doctor"): {
        "authority": "State medical board (FSMB directory)",
        "url": "https://www.fsmb.org/contact-a-state-medical-board/",
        "mode": "jurisdiction_registry",
        "jurisdiction_required": True,
    },
    ("US", "nurse"): {
        "authority": "State board of nursing / Nursys",
        "url": "https://www.nursys.com/",
        "mode": "jurisdiction_registry",
        "jurisdiction_required": True,
    },
}

ALLOWED_REGISTRY_DOMAINS = {
    urlparse(item["url"]).hostname
    for item in REGISTRIES.values()
    if urlparse(item["url"]).hostname
}


def normalise_country(value: str | None) -> str:
    code = (value or "").strip().upper()
    if code not in COUNTRIES:
        raise ValueError("País não suportado. Use um código ISO de 2 letras da lista publicada.")
    return code


def registry_for(country: str, profession: str) -> dict:
    if (country, profession) in REGISTRIES:
        return REGISTRIES[(country, profession)]
    if country in EU_COUNTRIES:
        return {
            "authority": "Autoridade competente do país de exercício",
            "url": "https://ec.europa.eu/growth/tools-databases/regprof/",
            "mode": "eu_competent_authority",
            "automatic_recognition_possible": profession in {"doctor", "nurse"},
        }
    return {
        "authority": "Autoridade profissional nacional competente",
        "url": None,
        "mode": "manual",
    }


def required_evidence(credential) -> list[str]:
    required = ["professional_card", "diploma"]
    if credential.practice_country != credential.diploma_country:
        required.append("recognition")
    if credential.practice_country != credential.licence_country:
        required.append("local_registration")
    return required


def run_automated_checks(credential, evidence_kinds: set[str]) -> tuple[list[dict], int]:
    """Run deterministic triage checks. These checks never grant approval."""
    checks: list[dict] = []

    def add(code: str, passed: bool, label: str, severity: str = "required"):
        checks.append({"code": code, "passed": passed, "label": label, "severity": severity})

    add("licence_format", bool(re.fullmatch(r"[\wÀ-ÿ./ -]{2,100}", credential.licence_number or "")),
        "Número de licença com formato válido")
    add("authority_present", len((credential.issuing_authority or "").strip()) >= 2,
        "Autoridade emissora informada")
    if credential.licence_country == "US":
        add("us_licence_jurisdiction", len((credential.licence_jurisdiction or "").strip()) >= 2,
            "Estado ou jurisdição da licença dos EUA informado")
    add("diploma_present", len((credential.diploma_institution or "").strip()) >= 2,
        "Instituição e diploma informados")
    if credential.graduation_year:
        add("graduation_year", 1900 <= credential.graduation_year <= date.today().year,
            "Ano de conclusão plausível")
    if credential.licence_expiry_date:
        add("licence_not_expired", credential.licence_expiry_date >= date.today().isoformat(),
            "Licença não expirada")

    for kind in required_evidence(credential):
        add(f"evidence_{kind}", kind in evidence_kinds, f"Documento obrigatório: {kind}")

    if credential.registry_profile_url:
        host = urlparse(credential.registry_profile_url).hostname
        add("official_registry_link", host in ALLOWED_REGISTRY_DOMAINS,
            "Ligação de registo pertence a domínio oficial", severity="advisory")

    required_checks = [c for c in checks if c["severity"] == "required"]
    score = round(100 * sum(1 for c in required_checks if c["passed"]) / max(1, len(required_checks)))
    return checks, score
