"""Polish or translate a draft into strong, natural English."""
from app.config import settings
from app.models import PolishRequest, PolishResponse
from app.services.llm_provider import LLMProvider, get_provider

_SYSTEM = {
    "translate": (
        "You are a professional translator. Translate the user's text into "
        "natural, professional English suitable for a job or scholarship "
        "application. Preserve meaning and tone; do not add or invent facts. "
        "Output only the translated English text."
    ),
    "improve": (
        "You are an expert English editor. Rewrite the user's text into clear, "
        "professional, natural English. Fix grammar and awkward phrasing, keep "
        "the original meaning, and do not invent facts. Output only the improved "
        "text."
    ),
}


class PolisherService:
    def __init__(self, provider: LLMProvider | None = None) -> None:
        self._provider = provider or get_provider()

    async def polish(self, req: PolishRequest) -> PolishResponse:
        system = _SYSTEM[req.mode]
        user = req.text[: settings.max_input_chars]
        output = await self._provider.complete(system, user)
        return PolishResponse(
            output=output,
            provider=getattr(self._provider, "name", "unknown"),
        )
