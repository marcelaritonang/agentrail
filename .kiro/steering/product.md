# Product Steering

## What we are building
An **AI Document Intelligence API** — a service that turns unstructured documents
(PDF invoices, receipts, contracts, ID cards) into clean, structured JSON that
downstream systems can consume.

## Who it is for
- Fintech / accounting startups that need to ingest invoices and receipts.
- Ops teams drowning in manual data entry.
- Developers who want a single `/extract` endpoint instead of gluing OCR +
  parsing + validation themselves.

## Core value proposition
1. Upload a document, get structured fields back with confidence scores.
2. Human-in-the-loop review for low-confidence fields.
3. Auditable: every extraction is versioned and traceable.

## Non-goals (for the MVP)
- We are NOT building a full document management system.
- We are NOT storing documents long-term beyond the processing window.
- We are NOT doing e-signature or workflow automation yet.

## Success signals
- p95 extraction latency < 8s for a 5-page PDF.
- Field-level accuracy > 90% on the target document types.
- A new document type can be added via a spec, without rewriting the core.
