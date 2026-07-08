import pytest

from app.models import GenerateRequest
from app.services.generator import GeneratorService
from app.services.llm_provider import MockLLMProvider


@pytest.mark.asyncio
async def test_generate_cover_letter_uses_provider_and_inputs():
    svc = GeneratorService(provider=MockLLMProvider())
    req = GenerateRequest(
        kind="cover_letter",
        profile="Backend developer, 2 years Python.",
        opportunity="Junior Engineer at Acme.",
        notes="Keep it short.",
    )
    res = await svc.generate(req)

    assert res.kind == "cover_letter"
    assert res.provider == "mock"
    # Mock echoes truncated input, proving the prompt carried the real data.
    assert "Backend developer" in res.output


@pytest.mark.asyncio
async def test_generate_all_kinds_supported():
    svc = GeneratorService(provider=MockLLMProvider())
    for kind in ("cv_bullets", "cover_letter", "scholarship_essay"):
        res = await svc.generate(
            GenerateRequest(kind=kind, profile="p", opportunity="o")
        )
        assert res.output
