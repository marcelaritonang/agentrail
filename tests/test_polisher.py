import pytest

from app.models import PolishRequest
from app.services.llm_provider import MockLLMProvider
from app.services.polisher import PolisherService


@pytest.mark.asyncio
async def test_polish_translate_mode():
    svc = PolisherService(provider=MockLLMProvider())
    res = await svc.polish(PolishRequest(text="Saya seorang insinyur.", mode="translate"))
    assert res.provider == "mock"
    assert "insinyur" in res.output  # mock echoes the input text


@pytest.mark.asyncio
async def test_polish_improve_mode():
    svc = PolisherService(provider=MockLLMProvider())
    res = await svc.polish(PolishRequest(text="i has experiences", mode="improve"))
    assert res.output
