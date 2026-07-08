"""FastAPI app entrypoint for the AI Application Assistant."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import applications, generate, jobfetch, polish

app = FastAPI(title="AI Application Assistant", version="1.0.0")

app.include_router(generate.router)
app.include_router(polish.router)
app.include_router(jobfetch.router)
app.include_router(applications.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "provider": settings.resolved_provider()}


# Serve the frontend (website/) as the app UI. Resolved relative to repo root.
_WEB_DIR = Path(__file__).resolve().parents[2] / "website"
if _WEB_DIR.is_dir():
    @app.get("/")
    async def index() -> FileResponse:
        return FileResponse(_WEB_DIR / "index.html")

    app.mount("/", StaticFiles(directory=str(_WEB_DIR)), name="static")
