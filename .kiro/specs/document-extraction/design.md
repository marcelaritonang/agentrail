# Design — Document Extraction

## Overview
`/extract` receives a file, validates it, detects the document type, runs the
matching extractor through a pluggable AI provider, scores confidence, and returns
structured JSON. No document content is persisted or logged.

## Architecture
```
Client ──POST /extract──▶ Router (auth + validation)
                              │
                              ▼
                        ExtractionService
                          ├─ detect_document_type()
                          ├─ AIProvider.extract()   ◀── pluggable (mock | real)
                          └─ score_confidence()
                              │
                              ▼
                        ExtractionResult (Pydantic) ──▶ JSON response
```

## Components

### Router — `routers/extract.py`
- Enforces `X-API-Key`.
- Validates content type against `ALLOWED_TYPES` (415 on mismatch).
- Validates size against `MAX_FILE_BYTES` (413 on exceed).
- Delegates to `ExtractionService`.

### AIProvider interface — `services/ai_provider.py`
```python
class AIProvider(Protocol):
    async def extract(self, content: bytes, doc_type: str) -> dict[str, FieldValue]: ...
```
- `MockAIProvider` returns deterministic sample fields (used for tests + local dev).
- A real provider (LLM/vision) implements the same Protocol later. The service
  depends on the interface, never a concrete vendor.

### ExtractionService — `services/extraction.py`
- `detect_document_type(content) -> str`
- `extract(content, filename) -> ExtractionResult`
- Applies confidence threshold from config → sets `needs_review` / `review_required`.

## Data models — `models.py`
```python
class FieldValue(BaseModel):
    value: str
    confidence: float          # 0.0 – 1.0
    needs_review: bool = False

class ExtractionResult(BaseModel):
    extraction_id: str
    document_type: str
    review_required: bool
    fields: dict[str, FieldValue]
```

## Error handling
| Condition            | Status | Body                          |
|----------------------|--------|-------------------------------|
| Missing API key      | 401    | `{"detail": "missing api key"}` |
| Unsupported type     | 415    | `{"detail": "unsupported type"}`|
| File too large       | 413    | `{"detail": "file too large"}`  |
| Provider failure     | 502    | `{"detail": "extraction failed"}`|

## Testing strategy
- Unit tests for `detect_document_type`, confidence scoring, and `MockAIProvider`.
- Endpoint tests: happy path, missing key (401), bad type (415), oversize (413).
