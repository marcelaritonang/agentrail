"""HTTP layer for the application tracker (CRUD)."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models import Application, ApplicationIn
from app.services.tracker import TrackerService

router = APIRouter(prefix="/api/applications", tags=["applications"])
_service = TrackerService()


class StatusUpdate(BaseModel):
    status: str


@router.get("", response_model=list[Application])
async def list_applications() -> list[Application]:
    return _service.list()


@router.post("", response_model=Application, status_code=201)
async def add_application(app_in: ApplicationIn) -> Application:
    return _service.add(app_in)


@router.patch("/{app_id}", response_model=Application)
async def update_status(app_id: int, body: StatusUpdate) -> Application:
    updated = _service.update_status(app_id, body.status)
    if updated is None:
        raise HTTPException(status_code=404, detail="application not found")
    return updated


@router.delete("/{app_id}", status_code=204)
async def delete_application(app_id: int) -> None:
    if not _service.delete(app_id):
        raise HTTPException(status_code=404, detail="application not found")
