"""HTTP layer for reading a posting from a URL."""
from fastapi import APIRouter, Header, HTTPException

from app.config import settings
from app.models import FetchJobRequest, FetchJobResponse
from app.services.job_reader import JobReaderService

router = APIRouter(prefix="/api", tags=["jobfetch"])
_service = JobReaderService()


def _check_api_key(x_api_key: str | None) -> None:
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="invalid or missing api key")


@router.post("/fetch-job", response_model=FetchJobResponse)
async def fetch_job(
    req: FetchJobRequest,
    x_api_key: str | None = Header(default=None),
) -> FetchJobResponse:
    _check_api_key(x_api_key)
    try:
        text = await _service.fetch(req.url)
    except RuntimeError as exc:  # expected, user-facing failures -> 422
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"fetch failed: {exc}")
    return FetchJobResponse(text=text)
