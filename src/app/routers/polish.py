"""HTTP layer for polish / translate."""
from fastapi import APIRouter, Header, HTTPException

from app.config import settings
from app.models import PolishRequest, PolishResponse
from app.services.polisher import PolisherService

router = APIRouter(prefix="/api", tags=["polish"])
_service = PolisherService()


def _check_api_key(x_api_key: str | None) -> None:
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="invalid or missing api key")


@router.post("/polish", response_model=PolishResponse)
async def polish(
    req: PolishRequest,
    x_api_key: str | None = Header(default=None),
) -> PolishResponse:
    _check_api_key(x_api_key)
    try:
        return await _service.polish(req)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"polish failed: {exc}")
