"""Generate tailored application documents. No HTTP concerns here."""
from app.config import settings
from app.models import GenerateRequest, GenerateResponse
from app.services.llm_provider import LLMProvider, get_provider

# System prompts per document kind. Each one steers the AI to produce strong,
# natural English tailored to the specific opportunity — the whole point.
_SYSTEM = {
    "cv_bullets": (
        "You are an expert career coach. Write 4-6 concise, achievement-focused "
        "CV bullet points in strong, natural English. Start each with a strong "
        "action verb, quantify impact where possible, and tailor them to the "
        "target opportunity. Output only the bullets, one per line starting with "
        "'- '. No preamble."
    ),
    "cover_letter": (
        "You are an expert career coach. Write a professional cover letter in "
        "strong, natural English, tailored to the specific opportunity. Keep it "
        "to 3-4 short paragraphs, confident but not arrogant, concrete not "
        "generic. Output only the letter body. No placeholders like [Your Name]."
    ),
    "scholarship_essay": (
        "You are an expert scholarship advisor. Write a compelling motivation "
        "essay in strong, natural English, tailored to the scholarship. Show "
        "genuine motivation, connect the applicant's background to the "
        "opportunity's goals, and keep a clear narrative arc. Output only the "
        "essay."
    ),
}


class GeneratorService:
    def __init__(self, provider: LLMProvider | None = None) -> None:
        self._provider = provider or get_provider()

    async def generate(self, req: GenerateRequest) -> GenerateResponse:
        system = _SYSTEM[req.kind]
        user = _build_user_prompt(req)
        output = await self._provider.complete(system, user)
        return GenerateResponse(
            kind=req.kind,
            output=output,
            provider=getattr(self._provider, "name", "unknown"),
        )


def _build_user_prompt(req: GenerateRequest) -> str:
    profile = req.profile[: settings.max_input_chars]
    opportunity = req.opportunity[: settings.max_input_chars]
    parts = [
        "APPLICANT PROFILE:",
        profile,
        "",
        "TARGET OPPORTUNITY:",
        opportunity,
    ]
    if req.notes.strip():
        parts += ["", "EXTRA INSTRUCTIONS:", req.notes[: settings.max_input_chars]]
    return "\n".join(parts)
