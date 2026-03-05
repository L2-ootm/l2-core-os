from dataclasses import dataclass


@dataclass
class TriageResult:
    intent: str
    confidence: float
    route: str


def classify_intent(text: str) -> TriageResult:
    t = (text or "").strip().lower()

    if any(k in t for k in ["confirmo", "confirm", "ok", "certo"]):
        return TriageResult(intent="confirm", confidence=0.93, route="automation")

    if any(k in t for k in ["cancelo", "cancelar", "cancel", "desmarcar"]):
        return TriageResult(intent="cancel", confidence=0.93, route="automation")

    if any(k in t for k in ["remarcar", "reagendar", "trocar horario", "mudar horario"]):
        return TriageResult(intent="reschedule", confidence=0.90, route="automation")

    if any(k in t for k in ["dor", "febre", "sintoma", "urgente", "sangramento"]):
        return TriageResult(intent="clinical_query", confidence=0.70, route="human_review")

    return TriageResult(intent="other", confidence=0.55, route="human_review")
