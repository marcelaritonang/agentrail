"""HTTP layer for document generation."""
from fastapi import APIRouter, Header, HTTPException

from app.config import settings
from app.models import (
    AnalyzeRequest,
    AnalyzeResponse,
    GenerateRequest,
    GenerateResponse,
)
from app.services.analyzer import AnalyzerService
from app.services.generator import GeneratorService

router = APIRouter(prefix="/api", tags=["generate"])
_service = GeneratorService()
_analyzer = AnalyzerService()


def _check_api_key(x_api_key: str | None) -> None:
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="invalid or missing api key")


@router.post("/generate", response_model=GenerateResponse)
async def generate(
    req: GenerateRequest,
    x_api_key: str | None = Header(default=None),
) -> GenerateResponse:
    _check_api_key(x_api_key)
    try:
        return await _service.generate(req)
    except Exception as exc:  # noqa: BLE001 — provider failures become 502
        raise HTTPException(status_code=502, detail=f"generation failed: {exc}")


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    req: AnalyzeRequest,
    x_api_key: str | None = Header(default=None),
) -> AnalyzeResponse:
    _check_api_key(x_api_key)
    try:
        return await _analyzer.analyze(req)
    except Exception as exc:  # noqa: BLE001 — provider failures become 502
        raise HTTPException(status_code=502, detail=f"analysis failed: {exc}")
