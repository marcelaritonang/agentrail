"""Settings loaded from environment variables. No secrets committed."""
import os
from pathlib import Path


def _load_dotenv() -> None:
    """Minimal .env loader (stdlib only). Loads repo-root .env if present."""
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip()
        # Don't overwrite vars already set in the real environment.
        os.environ.setdefault(key, value)


_load_dotenv()


class Settings:
    # LLM provider: "gemini" for real AI, "mock" for offline dev/tests.
    # Auto-falls back to mock when no GEMINI_API_KEY is present.
    llm_provider: str = os.getenv("LLM_PROVIDER", "auto")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # Simple API key guarding write/generate endpoints (dev default).
    api_key: str = os.getenv("API_KEY", "dev-key")

    # SQLite path for the application tracker (real persistence, stdlib only).
    db_path: str = os.getenv("DB_PATH", "data/apply.db")

    # Max characters accepted in a single text field (guards prompt size/cost).
    max_input_chars: int = int(os.getenv("MAX_INPUT_CHARS", "8000"))

    def resolved_provider(self) -> str:
        """Decide which provider to actually use."""
        if self.llm_provider == "auto":
            return "gemini" if self.gemini_api_key else "mock"
        return self.llm_provider


settings = Settings()
