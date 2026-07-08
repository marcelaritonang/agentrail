# Tech Steering

## Stack
- **Language:** Python 3.11+
- **API framework:** FastAPI
- **Server:** Uvicorn
- **Validation:** Pydantic v2
- **Testing:** pytest
- **AI layer:** pluggable provider interface (start with a mock, swap in a real
  LLM/vision model later). Never hardcode a single vendor.

## Conventions
- All request/response bodies are Pydantic models. No raw dicts crossing the API boundary.
- Business logic lives in `src/app/services/`, never inside routers.
- Routers in `src/app/routers/` only do: parse input, call a service, shape output.
- Every new capability starts as a spec in `.kiro/specs/` before code is written.

## Security & config
- Secrets come from environment variables only. Never commit keys.
- API requires an API key header (`X-API-Key`) on all non-health endpoints.
- Uploaded files are validated for type and size before processing.
- No document content is logged. Log metadata (size, type, duration) only.

## Testing rules
- Every service function has at least one unit test.
- Every router has at least one endpoint test (happy path + one failure path).
- Run `pytest` before considering any task done.
