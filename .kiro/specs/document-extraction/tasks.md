# Tasks — Document Extraction

Execute top to bottom. Each task maps to acceptance criteria in requirements.md.
Mark a task done only after its tests pass.

- [x] 1. Scaffold config and shared models
  - Create `config.py` (env-driven settings: API key, max size, allowed types, threshold).
  - Create `models.py` (`FieldValue`, `ExtractionResult`).
  - _Requirements: 1, 2, 4_

- [x] 2. Build the AI provider interface + mock
  - Define `AIProvider` Protocol in `services/ai_provider.py`.
  - Implement `MockAIProvider` with deterministic sample output.
  - Unit test the mock.
  - _Requirements: 3_

- [x] 3. Implement ExtractionService
  - `detect_document_type()` with generic fallback → `"unknown"`.
  - `extract()` that calls the provider and applies the confidence threshold.
  - Unit tests for detection + confidence flagging.
  - _Requirements: 2, 3_

- [x] 4. Build the /extract router
  - API-key check (401), type check (415), size check (413).
  - Wire to `ExtractionService`, return `ExtractionResult`.
  - Endpoint tests: happy path + 401 + 415 + 413.
  - _Requirements: 1, 4_

- [x] 5. Wire the FastAPI app
  - `main.py` mounts the router and a `/health` endpoint.
  - Confirm `pytest` is green end-to-end.
  - _Requirements: 1, 4_
