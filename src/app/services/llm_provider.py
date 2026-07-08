"""Pluggable LLM provider.

The services depend on the LLMProvider Protocol, never on a concrete vendor.
Today: GeminiProvider (real, free tier) or MockLLMProvider (offline dev/tests).
Later: add a BedrockProvider with the same `complete` signature — this is what
AWS Activate credits will fund. No other code changes needed.
"""
from typing import Protocol

import httpx

from app.config import settings


class LLMProvider(Protocol):
    async def complete(self, system: str, user: str) -> str:
        """Return the model's text completion for a system+user prompt."""
        ...


class MockLLMProvider:
    """Deterministic, offline provider for dev and tests (no API key needed).

    It does NOT fake real content dishonestly — it clearly echoes a structured,
    labelled stub so the whole app is testable end-to-end with $0 and no network.
    """

    name = "mock"

    async def complete(self, system: str, user: str) -> str:
        return (
            "[MOCK OUTPUT — set GEMINI_API_KEY for real AI]\n"
            f"(task) {system.strip()[:80]}\n"
            f"(input) {user.strip()[:200]}"
        )


class GeminiProvider:
    """Real provider using Google Gemini REST API (free tier, works from ID)."""

    name = "gemini"

    def __init__(self, api_key: str, model: str) -> None:
        self._key = api_key
        self._model = model

    async def complete(self, system: str, user: str) -> str:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self._model}:generateContent"
        )
        payload = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                url, params={"key": self._key}, json=payload
            )
            resp.raise_for_status()
            data = resp.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except (KeyError, IndexError) as exc:  # malformed / blocked response
            raise RuntimeError(f"unexpected Gemini response: {data}") from exc


def get_provider() -> LLMProvider:
    """Factory: pick the provider based on config (auto-falls back to mock)."""
    if settings.resolved_provider() == "gemini":
        return GeminiProvider(settings.gemini_api_key, settings.gemini_model)
    return MockLLMProvider()
