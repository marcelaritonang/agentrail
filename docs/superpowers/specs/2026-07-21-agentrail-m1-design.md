# AgentRail Milestone 1 Design Specification

**Status:** Approved for implementation

**Date:** 2026-07-21

**License:** Apache-2.0
**Product position:** The flight recorder for AI agents

## 1. Objective

AgentRail is an open-source observability pipeline for developers building AI agents. It records model calls, retrievals, tool invocations, delegated actions, actor identity, latency, tokens, and cost in one forensic trace. Milestone 1 must be useful as a local developer tool, credible as an AWS-hosted technical demo, and small enough to deliver as a focused MVP.

The primary user is a solo or small-team TypeScript developer who needs to answer:

- What did the agent do?
- Which actor initiated or authorized the action?
- Which model, retrieval, or tool span caused a failure?
- What did the trace cost?
- Which input or output evidence supports the diagnosis?

Milestone 1 is successful when a developer can instrument an agent, send spans through the ingestion pipeline, open a trace waterfall, inspect redacted evidence, review the action ledger, and run the complete system locally with Docker.

## 2. Scope

### 2.1 Included

- TypeScript SDK with `rail.trace()`, child spans, actor inheritance, action recording, buffering, retry, and `shutdown()`.
- Hono ingestion API authenticated by project API key.
- Redis Streams queue locally and an SQS adapter for AWS.
- Asynchronous worker for idempotent persistence, pricing, trace aggregation, and blob storage.
- PostgreSQL metadata storage.
- MinIO locally and S3 on AWS for large or sensitive payload blobs.
- Next.js dashboard with `/traces` and `/traces/[traceId]`.
- Trace Rail waterfall, Evidence Drawer, cost tracking, and Action Ledger.
- Local Docker Compose environment and a documented AWS deployment mapping.
- A dark technical landing page at `/`, created only after the real dashboard can be captured.
- One synthetic, clearly labeled sample project for the public demo.
- Apache-2.0 license, contribution documentation, and security reporting instructions.

### 2.2 Excluded from Milestone 1

- User accounts, teams, invitations, RBAC, SSO, billing, and subscriptions.
- Python SDK and framework-specific integrations.
- Live collaborative trace viewing.
- Automated evaluation, prompt scoring, or model quality ranking.
- Alerting, anomaly detection, and long-term analytics.
- Multi-region ingestion and enterprise retention controls.
- Browser access to S3 or MinIO credentials or presigned object URLs.
- Production claims such as compliance certification, guaranteed uptime, or verified customer metrics.

## 3. System Architecture

The system is a pnpm monorepo on Node.js 24 LTS.

```text
TypeScript SDK
    |
    | POST /v1/spans
    v
Hono Ingestion API --------> SDK receives 202 Accepted
    |
    | fast durable enqueue only
    v
Redis Streams (local) / SQS (AWS)
    |
    v
Worker
    |-- validates canonical span envelope
    |-- applies (project_id, span_id) idempotency
    |-- calculates cost from shared pricing catalog
    |-- writes trace/span metadata to PostgreSQL
    `-- writes redacted payload blobs to MinIO/S3

Browser
    |
    v
Next.js server/API routes
    |-- reads project-scoped PostgreSQL metadata
    `-- fetches payload blobs server-side after authorization checks
```

`202 Accepted` is the response from the ingestion API to the SDK. It is not an arrow from the API to the queue. The API sends `202` only after the queue adapter confirms a successful enqueue. Pricing, blob writes, trace aggregation, and database persistence never occur in the request path.

### 3.1 Repository boundaries

```text
apps/
  web/                 Next.js landing page, dashboard, and server-only data routes
  ingest/              Hono ingestion service
  worker/              Queue consumer and processing pipeline
packages/
  contracts/           Zod schemas and shared TypeScript types
  sdk/                 Public TypeScript SDK
  config/              Typed environment configuration and shared constants
  db/                  Drizzle schema, migrations, and repositories
  pricing/             Versioned model catalog and deterministic cost calculation
  queue/               Redis Streams and SQS adapters
  blob/                MinIO and S3 adapters
  testkit/             Synthetic fixtures and integration helpers
infra/
  docker/              Local service configuration
docs/                  Quickstart, architecture, deployment, and security material
```

Each package exposes a narrow public interface. Applications depend on package interfaces rather than importing private implementation files.

## 4. Canonical Data Model

### 4.1 Project

- `project_id`: UUID
- `name`: string
- `created_at`: timestamp
- `payload_mode`: `none | redacted | full`

Milestone 1 operates on one configured local project. The hosted demo exposes one read-only synthetic project.

### 4.2 API key

- `api_key_id`: UUID
- `project_id`: UUID
- `key_prefix`: non-secret display prefix
- `key_digest`: HMAC-SHA-256 digest of the high-entropy secret using a server-side pepper
- `created_at`: timestamp
- `revoked_at`: nullable timestamp

The raw key contains at least 32 random bytes, is displayed once during project bootstrap, and is never persisted or logged. Authentication looks up the key prefix, computes the HMAC digest, and uses a timing-safe comparison. A deliberately slow password hash is not used in the ingestion hot path.

### 4.3 Trace

- `project_id`: UUID
- `trace_id`: OpenTelemetry-compatible 32-character lowercase hexadecimal ID
- `root_span_id`: OpenTelemetry-compatible 16-character lowercase hexadecimal ID
- `name`: string
- `agent_id`: string
- `on_behalf_of`: nullable string
- `started_at`: timestamp
- `ended_at`: nullable timestamp
- `outcome`: `ok | error | null`
- `completion_state`: `complete | incomplete | null`
- `total_cost_usd`: nullable decimal
- `pricing_unknown`: boolean

There is no `running` status. A trace with a completed root span is `complete`. A trace without a completed root span has `completion_state = null` before the timeout and becomes `incomplete` after the configured timeout. The dashboard renders the null state without a status badge and does not invent a synonym for running.

### 4.4 Span

- `project_id`: UUID
- `trace_id`: trace ID
- `span_id`: span ID
- `parent_span_id`: nullable span ID
- `kind`: `trace | llm | retrieval | tool | action | custom`
- `name`: string
- `agent_id`: string
- `on_behalf_of`: nullable string
- `started_at`: timestamp
- `ended_at`: nullable timestamp
- `outcome`: `ok | error | null`
- `model`: nullable string
- `input_tokens`: nullable integer
- `output_tokens`: nullable integer
- `cost_usd`: nullable decimal
- `pricing_unknown`: boolean
- `pricing_catalog_version`: nullable string
- `attributes`: JSONB containing bounded, non-secret metadata
- `payload_ref`: nullable opaque blob reference
- `payload_truncated`: boolean

The database has a unique constraint on `(project_id, span_id)`. This tuple is the canonical idempotency key. The phrase “event ID” must not introduce another identifier or uniqueness rule. Queue delivery may be at least once; the worker makes persistence idempotent with this exact key.

Milestone 1 spans are immutable completion envelopes. The SDK emits a span after its callback closes rather than sending separate start and update events for the same `span_id`. Every child envelope repeats the minimum trace context needed to create or reconcile its parent trace if a process terminates before the root span is delivered.

Actions are represented as spans with `kind = action` or `kind = tool`. This keeps actor identity, timing, evidence, and idempotency in one model. The Action Ledger is a filtered projection, not a second mutable audit table.

## 5. SDK Contract

### 5.1 Initialization

```ts
const rail = new AgentRail({
  apiKey: process.env.AGENTRAIL_API_KEY,
  endpoint: "http://localhost:4318",
  actor: {
    agentId: "research-agent",
    onBehalfOf: "user_42",
  },
  payloadMode: "redacted",
});
```

### 5.2 Trace lifecycle

```ts
await rail.trace({ name: "research.answer" }, async (trace) => {
  await trace.span(
    { kind: "llm", name: "plan", model: "anthropic.claude-sonnet" },
    async (span) => {
      span.setUsage({ inputTokens: 812, outputTokens: 194 });
    },
  );

  await trace.action(
    { name: "web.search", attributes: { query: "AWS startup credits" } },
    async () => searchWeb(),
  );
});

await rail.shutdown();
```

`rail.trace()` creates the root trace and closes it in a `finally` path. Child spans inherit `agent_id` and `on_behalf_of` from the trace automatically. A child span may override either actor field explicitly. An omitted override never clears the inherited value.

The SDK records failures and rethrows the original application error. Telemetry delivery must not replace or hide application behavior.

### 5.3 Delivery behavior

- The SDK maintains a bounded in-memory batch buffer.
- Normal application work never waits for worker processing.
- The SDK posts batches to `POST /v1/spans`.
- Retry uses capped exponential backoff with jitter for retryable network and 5xx failures.
- A full buffer invokes the configured `onDrop` callback and increments a local dropped-span counter; it does not grow without bound.
- `shutdown()` flushes pending batches within a configurable timeout and returns a delivery summary.
- API keys and redacted values never appear in SDK diagnostic logs.

## 6. Ingestion API

### 6.1 Endpoint

`POST /v1/spans` accepts:

```ts
type IngestSpanBatch = {
  spans: SpanEnvelope[];
};
```

Constraints:

- 1 to 100 spans per batch.
- Maximum uncompressed request body: 240 KiB so the same canonical message fits both queue adapters without an ingestion-time blob write.
- JSON only in Milestone 1.
- Every span must pass the shared Zod contract before enqueue.
- The authenticated `project_id` is derived from the API key, never trusted from the request body.
- The API attaches the authenticated `project_id` to every canonical envelope.

Successful response:

```json
{
  "accepted": 12,
  "request_id": "req_01..."
}
```

The `request_id` is only a request correlation identifier. It is not an idempotency key. Span idempotency remains `(project_id, span_id)`.

### 6.2 Latency budget

- The request path performs authentication, body limiting, schema validation, canonicalization, and one queue enqueue operation.
- It performs no pricing lookup, PostgreSQL write, S3/MinIO write, trace aggregation, or dashboard cache invalidation.
- Target server-side p95 is at most 100 ms for a valid batch of up to 100 spans under the documented local load profile, excluding client network latency.
- `202` is returned only after the queue adapter acknowledges enqueue.
- Queue unavailable or enqueue timeout returns `503` with a retryable error code.
- Invalid keys return `401`; invalid payloads return `400`; oversized bodies return `413`; rate limits return `429`.

The queue adapter exposes one operation:

```ts
interface SpanQueue {
  enqueue(batch: CanonicalSpanBatch): Promise<{ messageId: string }>;
}
```

Redis Streams implements this with one `XADD`. SQS implements it with one `SendMessage` call. The API does not wait for a consumer acknowledgment.

## 7. Worker Pipeline

For each queued batch, the worker:

1. Re-validates the canonical envelope version.
2. Redacts configured secret keys and enforces payload size limits.
3. Resolves pricing through `packages/pricing`.
4. Returns `cost_usd = null` and `pricing_unknown = true` when the model is absent from the catalog. Unknown pricing never defaults to zero.
5. Writes payload content to blob storage when the configured payload mode requires it.
6. Inserts or ignores each span using the unique `(project_id, span_id)` constraint.
7. Recomputes the affected trace aggregate from persisted spans.
8. Acknowledges the queue message only after durable writes succeed.

Retryable failures leave the message available for retry. Permanently invalid envelopes and messages exceeding the retry policy go to a dead-letter queue with secrets removed from diagnostics.

Cost is always calculated in the worker with the versioned shared pricing catalog. The SDK may record model and token usage but never calculates or submits authoritative `cost_usd`.

If any priced span in a trace has unknown pricing, the trace aggregate sets `total_cost_usd = null` and `pricing_unknown = true`. It does not present a partial known subtotal as the total cost.

## 8. Trace Completion

`TRACE_INCOMPLETE_AFTER_MS` is defined in `packages/config` and defaults to `900000` milliseconds, or 15 minutes.

The worker or scheduled reconciliation process marks a trace incomplete when:

- its root span has no `ended_at`, and
- `now - started_at >= TRACE_INCOMPLETE_AFTER_MS`.

The value is exposed to the web server through typed configuration. The dashboard never embeds a separate timeout or magic number.

## 9. Payload Evidence and Privacy

Payload modes:

- `none`: metadata only; no input or output blob is stored.
- `redacted`: default for local projects; keys matching the redaction policy are removed before storage.
- `full`: explicit opt-in for trusted local environments.

Default redaction keys include authorization headers, cookies, passwords, access tokens, API keys, and common secret field names. Oversized payloads are truncated deterministically and set `payload_truncated = true`.

The browser requests evidence from a Next.js backend route. That route verifies the configured project scope, resolves the opaque blob reference server-side, reads the object through the blob adapter, applies response headers, and returns only the authorized payload. The browser never connects directly to MinIO or S3 and never receives object-store credentials or raw storage keys.

The hosted demo uses synthetic payloads only and does not accept arbitrary public ingestion.

## 10. Dashboard Product Design

### 10.1 Routes

- `/traces`: dense searchable trace index.
- `/traces/[traceId]`: forensic trace detail.

There is no account, billing, settings, or team navigation in Milestone 1.

### 10.2 Trace index

The table shows trace name, trace ID fragment, primary actor, duration, span count, outcome, total cost, pricing state, and start time. It supports search, outcome filtering, actor filtering, and deterministic pagination. It includes purpose-built loading, empty, error, and no-results states.

### 10.3 Trace detail

- A compact header summarizes trace identity, actor, duration, outcome, aggregate cost, and completion state.
- Trace Rail is a time-scaled waterfall with parent-child indentation and semantic color by span kind.
- Selecting a span opens the Evidence Drawer through an accessible button and URL-stable selection state.
- Evidence Drawer shows metadata, usage, payload availability, redaction/truncation notices, and backend-fetched payload content.
- Action Ledger lists action/tool spans chronologically with actor, target, outcome, duration, and evidence link.
- Unknown prices display `UNPRICED`, never `$0.00`.

### 10.4 Dashboard visual identity

The dashboard uses a custom forensic flight-recorder system, not the landing-page taste skill:

- Graphite base, warm-white typography, amber for actions, cyan for LLM spans, violet for retrievals, and red for failures.
- Instrument Sans for interface copy and JetBrains Mono for identifiers, timestamps, durations, tokens, and currency.
- Small documented radii, 1 px separators, nearly no shadows, and no card-in-card nesting.
- Dense information with stable grid alignment.
- No gradients, glassmorphism, neon glow, decorative blobs, generic hero layout, or looping animation.
- Hover states use color or opacity only. No scale-on-hover and no `transition-all`.
- Phosphor is the only icon family.

Phosphor icons use `IconContext.Provider` with `weight="regular"` and a documented size scale of 16, 20, and 24 px. The project does not claim that a Lucide-style `strokeWidth={1.5}` overrides Phosphor's weight-specific internal paths.

## 11. Landing Page

The `design-taste-frontend` skill applies only to `/` and future marketing pages. It does not govern `/traces` or `/traces/[traceId]`.

Design read: a B2B developer-tool landing page for technical builders, with restrained Linear-style language and a serious forensic dark-graphite identity consistent with the product.

Configuration:

- `DESIGN_VARIANCE: 6`
- `MOTION_INTENSITY: 4`
- `VISUAL_DENSITY: 4`

The page uses one dark theme, warm-white type, and amber as its marketing accent. The real dashboard screenshot may retain its semantic trace colors.

Section order:

1. Minimal navigation.
2. Asymmetric split hero with a real Trace Rail screenshot captured from the running product.
3. One continuous “Instrument, Ingest, Process, Investigate” rail rather than equal feature cards.
4. A working TypeScript quickstart paired with the resulting real trace.
5. A bordered GitHub call to action with Docker command and Apache-2.0 status.
6. Minimal documentation, GitHub, license, and security footer.

Forbidden landing patterns include AI-purple or neon gradients, glassmorphism, decorative blobs, three equal hero feature cards, robot illustrations, decorative looping animation, emoji UI, fake screenshots, fake testimonials, fake customer logos, and fabricated metrics.

Landing implementation occurs after the dashboard. The implementation order is dashboard, seeded synthetic trace, automated screenshot capture, then landing integration.

## 12. Anti-Slop Quality Gate

The attached Soleur ZIP is not installed and none of its hooks execute. Its scanner is hardcoded to the Soleur monorepo and contains Soleur-specific gold and zero-radius brand rules that conflict with AgentRail.

AgentRail will own a repository-local advisory scanner or equivalent lint tests covering only applicable universal rules:

- no gradient text or purple-blue gradient;
- no pure black/white base tokens;
- no `transition-all` or repeated `hover:scale-105`;
- no layout-property animation;
- no placeholder people, companies, testimonials, or metrics;
- no component-level raw colors outside the token source;
- no off-scale arbitrary spacing;
- one icon family;
- no fake dashboard chrome or nested generic cards.

AgentRail-specific brand tests require semantic tokens, the approved small-radius system, accessible amber contrast, and the approved semantic trace colors. The check is advisory during development and blocking for explicitly defined brand/accessibility violations.

## 13. Security and Operational Behavior

- Secrets are excluded from structured logs and error messages.
- API key comparison uses the stored HMAC-SHA-256 digest and a timing-safe equality check.
- Request bodies are bounded before full parsing.
- Every database and blob query is project-scoped on the server.
- SQL is parameterized through the database layer.
- Queue messages carry schema version and correlation metadata.
- Worker logs identify request, queue message, project, trace, and span through non-secret identifiers.
- Health endpoints distinguish process liveness from database, queue, and blob readiness.
- Local Docker services bind only the ports documented in `.env.example`.
- The public demo is read-only and seeded with synthetic evidence.

## 14. Local and AWS Deployment

### 14.1 Local

Docker Compose starts PostgreSQL, Redis, MinIO, ingestion API, worker, and web application. One bootstrap command creates the local project, prints the API key once, seeds a synthetic trace, and makes the dashboard immediately inspectable.

### 14.2 AWS reference mapping

- Next.js web: AWS Amplify Hosting or an equivalent documented server runtime.
- Hono ingestion: API Gateway plus Lambda.
- Queue: SQS with dead-letter queue.
- Worker: Lambda SQS consumer for the initial demo workload.
- Metadata: RDS PostgreSQL.
- Evidence: private S3 bucket with public access blocked.
- Secrets: AWS Secrets Manager or SSM Parameter Store.
- Logs and metrics: CloudWatch.

The AWS deployment is an adapter of the same contracts used locally. It does not fork product behavior or move pricing into the request path.

## 15. Testing Strategy

### 15.1 Unit tests

- Zod contracts and schema-version rejection.
- Trace and span actor inheritance with per-span overrides.
- SDK trace closure on success and error.
- SDK buffer, retry, drop, and shutdown behavior.
- Pricing for known models and nullable unknown pricing.
- Redaction, truncation, and configuration parsing.
- Trace incomplete timeout at the configured boundary.

### 15.2 Integration tests

- API key authentication and project derivation.
- Ingestion validation and durable enqueue before `202`.
- Queue failure returning `503`.
- Duplicate delivery producing one span through `(project_id, span_id)`.
- Worker writes to PostgreSQL and MinIO with correct aggregate cost.
- Backend evidence route prevents cross-project access and hides storage details.

### 15.3 End-to-end and visual tests

- Trace index loading, empty, error, search, filter, and pagination states.
- Trace Rail selection and keyboard navigation.
- Evidence Drawer redacted, truncated, absent, and error states.
- Action Ledger and `UNPRICED` rendering.
- Desktop and mobile screenshots for dashboard and landing.
- Reduced-motion behavior, focus visibility, and WCAG AA contrast.
- Landing Lighthouse targets: LCP below 2.5 seconds, INP below 200 ms, and CLS below 0.1 in the documented test environment.

### 15.4 Performance tests

The ingestion benchmark sends valid batches of 100 spans with a canonical body at or below 240 KiB through a warm local API and queue. It uses 100 warm-up requests followed by 1,000 measured requests at concurrency 10. The server-side enqueue path must meet p95 at or below 100 ms without invoking worker processing. The report records hardware and queue configuration so the result is reproducible rather than a marketing claim.

## 16. Milestone 1 Acceptance Criteria

Milestone 1 is accepted when all of the following are true:

1. A clean checkout can start with documented Docker commands.
2. The bootstrap flow produces one local API key and a visible synthetic trace.
3. The TypeScript SDK records nested traces, inherited actors, overrides, actions, errors, usage, and shutdown delivery.
4. Ingestion returns `202` only after a fast queue acknowledgment and does no worker processing.
5. Duplicate span delivery is harmless because `(project_id, span_id)` is unique.
6. Worker pricing comes only from the shared catalog; unknown models remain nullable and display `UNPRICED`.
7. Trace Rail, Evidence Drawer, cost summary, and Action Ledger work with real persisted data.
8. Evidence is fetched through a project-scoped backend route, never directly from blob storage.
9. Incomplete traces use the shared 15-minute default configuration.
10. Dashboard anti-slop, accessibility, unit, integration, E2E, build, and Docker smoke checks pass.
11. Landing uses a real dashboard capture and passes its taste-skill preflight without changing dashboard design rules.
12. The repository contains Apache-2.0 license, README quickstart, architecture documentation, contribution guide, and security policy.

## 17. Delivery Order

1. Monorepo foundation, shared contracts, configuration, and test harness.
2. Database, queue, and blob interfaces with local adapters.
3. SDK trace model and delivery behavior.
4. Ingestion API with authentication, validation, enqueue latency budget, and `202` semantics.
5. Worker persistence, pricing, idempotency, payload handling, and trace reconciliation.
6. Synthetic seed and read models.
7. Trace index and forensic trace detail dashboard.
8. Backend evidence route and full UI state coverage.
9. Local Docker integration and AWS adapter documentation.
10. Real dashboard screenshot and landing page.
11. Anti-slop, accessibility, performance, E2E, and release documentation gates.
