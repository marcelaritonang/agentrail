# Requirements — Document Extraction

## Introduction
The document extraction feature lets a client upload a document and receive
structured, validated fields as JSON, each with a confidence score. This is the
core capability of the product.

## Requirements

### Requirement 1 — Upload and extract
**User story:** As an API client, I want to submit a document and get structured
fields back, so that I can skip manual data entry.

#### Acceptance criteria
1. WHEN a client POSTs a supported file to `/extract` THEN the system SHALL return
   a JSON object with extracted fields and a per-field confidence score.
2. WHEN the file type is unsupported THEN the system SHALL return HTTP 415 with a
   clear error message.
3. WHEN the file exceeds the size limit THEN the system SHALL return HTTP 413.
4. IF no `X-API-Key` header is present THEN the system SHALL return HTTP 401.

### Requirement 2 — Confidence and review
**User story:** As an ops reviewer, I want low-confidence fields flagged, so that
I only review what needs a human.

#### Acceptance criteria
1. WHEN a field's confidence is below the configured threshold THEN the system
   SHALL mark that field with `needs_review: true`.
2. WHEN all fields are above threshold THEN the response SHALL set
   `review_required: false` at the document level.

### Requirement 3 — Document type support
**User story:** As a product owner, I want to add new document types without
rewriting the core, so that we can grow coverage safely.

#### Acceptance criteria
1. WHEN a new document type is registered THEN the system SHALL route extraction
   to the matching schema WITHOUT changes to the `/extract` router.
2. IF the document type cannot be detected THEN the system SHALL fall back to a
   generic extractor and set `document_type: "unknown"`.

### Requirement 4 — Observability & privacy
**User story:** As an operator, I want traceable, privacy-safe processing.

#### Acceptance criteria
1. WHEN a document is processed THEN the system SHALL log metadata only
   (size, type, duration, request id) and SHALL NOT log document content.
2. WHEN processing completes THEN the response SHALL include a unique
   `extraction_id` for traceability.
