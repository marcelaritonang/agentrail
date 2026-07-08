"""Real keyword match between an applicant profile and an opportunity.

Honesty contract: this returns matched/missing keywords ONLY when a real model
produced them. In mock mode, or if the model output can't be parsed, it returns
analyzed=False with empty lists — the UI then shows an honest "needs live AI"
state instead of inventing chips. This is the whole reason Job Match is real.
"""
import json
import re

from app.config import settings
from app.models import AnalyzeRequest, AnalyzeResponse
from app.services.llm_provider import LLMProvider, get_provider

_SYSTEM = (
    "You are an ATS keyword analyst. Given an APPLICANT PROFILE and a TARGET "
    "OPPORTUNITY, extract the concrete skills/requirements the opportunity asks "
    "for, then decide which the profile clearly demonstrates and which it does "
    "not. Reply with ONLY a JSON object, no prose, of the form: "
    '{"matched": ["..."], "missing": ["..."]}. '
    "Use short keyword phrases (1-3 words). Max 8 items per list. "
    "Base the decision only on evidence in the profile — do not guess."
)


class AnalyzerService:
    def __init__(self, provider: LLMProvider | None = None) -> None:
        self._provider = provider or get_provider()

    async def analyze(self, req: AnalyzeRequest) -> AnalyzeResponse:
        name = getattr(self._provider, "name", "unknown")

        # Mock provider cannot do a real match — say so honestly, invent nothing.
        if name == "mock":
            return AnalyzeResponse(analyzed=False, provider=name)

        profile = req.profile[: settings.max_input_chars]
        opportunity = req.opportunity[: settings.max_input_chars]
        user = (
            f"APPLICANT PROFILE:\n{profile}\n\n"
            f"TARGET OPPORTUNITY:\n{opportunity}"
        )
        raw = await self._provider.complete(_SYSTEM, user)

        parsed = _parse_keywords(raw)
        if parsed is None:
            # Model replied but we couldn't trust the shape — don't fake it.
            return AnalyzeResponse(analyzed=False, provider=name)

        matched, missing = parsed
        return AnalyzeResponse(
            matched=matched, missing=missing, analyzed=True, provider=name
        )


def _parse_keywords(raw: str) -> tuple[list[str], list[str]] | None:
    """Extract {matched, missing} from model text. Returns None if untrusted."""
    # Models sometimes wrap JSON in ```json fences or extra prose — find the object.
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None

    def clean(key: str) -> list[str]:
        items = data.get(key, [])
        if not isinstance(items, list):
            return []
        out: list[str] = []
        for item in items:
            if isinstance(item, str) and item.strip():
                out.append(item.strip()[:40])
        return out[:8]

    return clean("matched"), clean("missing")
