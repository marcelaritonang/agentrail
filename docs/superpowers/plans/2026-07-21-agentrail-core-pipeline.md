# AgentRail Core Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the testable AgentRail path from immutable TypeScript span envelopes through fast authenticated enqueue to idempotent PostgreSQL and blob persistence with worker-side pricing.

**Architecture:** A pnpm monorepo separates contracts, configuration, pricing, database, queue, blob storage, SDK, ingestion API, and worker. The ingestion API performs only authentication, bounds checking, schema validation, canonicalization, and one durable enqueue before returning `202`; the worker owns redaction, pricing, blob writes, trace aggregation, and `(project_id, span_id)` idempotency.

**Tech Stack:** Node.js 24 LTS, TypeScript, pnpm 11, Vitest 4, Zod 4, Hono, Drizzle ORM, PostgreSQL, Redis Streams, MinIO/S3, AWS SQS SDK, AWS S3 SDK, Docker Compose.

## Global Constraints

- The canonical idempotency key is exactly `(project_id, span_id)`; no separate event ID may be introduced.
- `202 Accepted` is returned only after the queue adapter acknowledges one fast enqueue operation.
- The ingestion request path performs no pricing lookup, PostgreSQL write, blob write, trace aggregation, or worker processing.
- Target ingestion server-side p95 is at most 100 ms for the approved benchmark profile.
- Cost is calculated only in the worker from `packages/pricing`.
- Unknown models produce `cost_usd = null` and `pricing_unknown = true`; they never default to zero.
- Child spans inherit `agent_id` and `on_behalf_of` from the trace unless explicitly overridden.
- Spans are immutable completion envelopes, not start/update event pairs.
- `TRACE_INCOMPLETE_AFTER_MS` defaults to `900000` in `packages/config`.
- Browser clients never access MinIO or S3 directly.
- Node.js is `>=24 <25`; packages use ESM and strict TypeScript.
- New behavior follows red-green-refactor TDD. Run each named test once in a confirmed failing state before implementation.
- Legacy ApplyMate deletions are intentional for this approved product replacement, but no unrelated user files may be removed.

## File Structure

```text
package.json                         workspace scripts and tool versions
pnpm-workspace.yaml                 workspace package discovery
turbo.json                          build/test dependency graph
tsconfig.base.json                  strict shared TypeScript settings
vitest.config.ts                    Vitest 4 project discovery
.env.example                        documented local variables
.gitignore                          Node, Docker, test, and local secret outputs
LICENSE                             Apache-2.0 text
packages/contracts/                 canonical public span schemas
packages/config/                    typed constants and environment parsing
packages/pricing/                   model catalog and worker-side calculator
packages/db/                        Drizzle schema, migrations, repositories
packages/queue/                     queue contract, Redis, SQS, and memory adapters
packages/blob/                      blob contract, MinIO/S3, and memory adapters
packages/sdk/                       public trace API and delivery buffer
apps/ingest/                        Hono factory and Node entry point
apps/worker/                        queue consumer and processing pipeline
packages/testkit/                   deterministic IDs, clocks, and fixtures
infra/docker/                       local PostgreSQL, Redis, and MinIO config
docker-compose.yml                  complete local service topology
scripts/bootstrap-local.ts          creates project/key and synthetic trace
```

---

### Task 1: Monorepo Foundation and Canonical Contracts

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `.editorconfig`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `LICENSE`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/src/span.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/span.test.ts`
- Create: `packages/config/package.json`
- Create: `packages/config/src/index.ts`
- Create: `packages/config/src/index.test.ts`
- Remove: legacy ApplyMate files already shown as deleted by `git status`

**Interfaces:**
- Produces: `SpanEnvelopeSchema`, `IngestSpanBatchSchema`, `CanonicalSpanEnvelope`, `TRACE_INCOMPLETE_AFTER_MS`, `MAX_INGEST_BODY_BYTES`, `MAX_SPANS_PER_BATCH`.
- Consumes: no earlier tasks.

- [ ] **Step 1: Create only the workspace tooling needed to execute tests**

Create root scripts with these exact responsibilities:

```json
{
  "name": "agentrail",
  "private": true,
  "packageManager": "pnpm@11.9.0",
  "engines": { "node": ">=24 <25" },
  "scripts": {
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "turbo run lint",
    "format:check": "prettier --check ."
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "prettier": "^3.6.0",
    "tsx": "^4.20.0",
    "turbo": "^2.5.0",
    "typescript": "^5.9.0",
    "vitest": "^4.1.6"
  }
}
```

Set `pnpm-workspace.yaml` packages to `apps/*` and `packages/*`. Configure Vitest 4 through `vitest.config.ts` with `test.projects`, not the removed `vitest.workspace.ts` or `defineWorkspace` API. Set TypeScript to `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `module: ESNext`, `moduleResolution: Bundler`, and `target: ES2024`.

Run: `rtk corepack enable` then `rtk pnpm install`
Expected: lockfile created and install exits 0.

- [ ] **Step 2: Write failing contract and configuration tests**

```ts
import { describe, expect, it } from "vitest";
import { IngestSpanBatchSchema } from "./span.js";

describe("IngestSpanBatchSchema", () => {
  it("accepts one immutable completed span", () => {
    const result = IngestSpanBatchSchema.safeParse({
      spans: [{
        schema_version: 1,
        trace_id: "0af7651916cd43dd8448eb211c80319c",
        span_id: "b7ad6b7169203331",
        parent_span_id: null,
        trace_name: "research.answer",
        kind: "llm",
        name: "plan",
        agent_id: "research-agent",
        on_behalf_of: "user_42",
        started_at: "2026-07-21T10:00:00.000Z",
        ended_at: "2026-07-21T10:00:01.000Z",
        outcome: "ok",
        attributes: {},
      }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 100 spans", () => {
    const result = IngestSpanBatchSchema.safeParse({ spans: Array(101).fill({}) });
    expect(result.success).toBe(false);
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import {
  MAX_INGEST_BODY_BYTES,
  MAX_SPANS_PER_BATCH,
  TRACE_INCOMPLETE_AFTER_MS,
} from "./index.js";

describe("shared constants", () => {
  it("locks approved ingestion and timeout defaults", () => {
    expect(MAX_INGEST_BODY_BYTES).toBe(240 * 1024);
    expect(MAX_SPANS_PER_BATCH).toBe(100);
    expect(TRACE_INCOMPLETE_AFTER_MS).toBe(900_000);
  });
});
```

- [ ] **Step 3: Run tests and verify RED**

Run: `rtk vitest run packages/contracts/src/span.test.ts packages/config/src/index.test.ts`
Expected: FAIL because `span.ts` and config exports do not exist.

- [ ] **Step 4: Implement the minimum contracts and constants**

Define IDs, timestamps, actor fields, span kind, outcome, usage, attributes, and payload as Zod schemas. The required outer shape is:

```ts
import { z } from "zod";

const TraceId = z.string().regex(/^[0-9a-f]{32}$/);
const SpanId = z.string().regex(/^[0-9a-f]{16}$/);

export const SpanEnvelopeSchema = z.object({
  schema_version: z.literal(1),
  trace_id: TraceId,
  span_id: SpanId,
  parent_span_id: SpanId.nullable(),
  trace_name: z.string().min(1).max(200),
  kind: z.enum(["trace", "llm", "retrieval", "tool", "action", "custom"]),
  name: z.string().min(1).max(200),
  agent_id: z.string().min(1).max(200),
  on_behalf_of: z.string().min(1).max(200).nullable(),
  started_at: z.iso.datetime(),
  ended_at: z.iso.datetime(),
  outcome: z.enum(["ok", "error"]),
  model: z.string().min(1).max(200).optional(),
  input_tokens: z.number().int().nonnegative().optional(),
  output_tokens: z.number().int().nonnegative().optional(),
  attributes: z.record(z.string(), z.unknown()),
  payload: z.unknown().optional(),
});

export const IngestSpanBatchSchema = z.object({
  spans: z.array(SpanEnvelopeSchema).min(1).max(100),
});

export type SpanEnvelope = z.infer<typeof SpanEnvelopeSchema>;
export type IngestSpanBatch = z.infer<typeof IngestSpanBatchSchema>;
export type CanonicalSpanEnvelope = SpanEnvelope & { project_id: string };
export type CanonicalSpanBatch = { spans: CanonicalSpanEnvelope[] };
```

```ts
export const TRACE_INCOMPLETE_AFTER_MS = 900_000;
export const MAX_INGEST_BODY_BYTES = 240 * 1024;
export const MAX_SPANS_PER_BATCH = 100;
```

- [ ] **Step 5: Run tests and verify GREEN**

Run: `rtk vitest run packages/contracts/src/span.test.ts packages/config/src/index.test.ts`
Expected: PASS, 3 tests and 0 failures.

- [ ] **Step 6: Commit the foundation and approved legacy replacement**

Run: `rtk git add -A`
Run: `rtk git commit -m "chore: establish AgentRail monorepo"`
Expected: the legacy ApplyMate deletion and AgentRail foundation are committed together; the prior specification commit remains separate.

---

### Task 2: Versioned Worker-Side Pricing

**Files:**
- Create: `packages/pricing/package.json`
- Create: `packages/pricing/src/catalog.ts`
- Create: `packages/pricing/src/calculate-cost.ts`
- Create: `packages/pricing/src/calculate-cost.test.ts`
- Create: `packages/pricing/src/index.ts`

**Interfaces:**
- Consumes: token usage and model strings from `@agentrail/contracts`.
- Produces: `calculateCost(input): PricingResult` and `PRICING_CATALOG_VERSION`.

- [ ] **Step 1: Write failing pricing tests**

```ts
import { describe, expect, it } from "vitest";
import { calculateCost } from "./calculate-cost.js";

describe("calculateCost", () => {
  it("calculates known-model input and output cost", () => {
    expect(calculateCost({ model: "test.known", inputTokens: 1_000, outputTokens: 500 }))
      .toEqual({ costUsd: "0.00400000", pricingUnknown: false, catalogVersion: "2026-07-21" });
  });

  it("keeps unknown pricing nullable", () => {
    expect(calculateCost({ model: "vendor.unknown", inputTokens: 50, outputTokens: 20 }))
      .toEqual({ costUsd: null, pricingUnknown: true, catalogVersion: "2026-07-21" });
  });
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `rtk vitest run packages/pricing/src/calculate-cost.test.ts`
Expected: FAIL because `calculateCost` does not exist.

- [ ] **Step 3: Implement decimal-safe pricing**

Use integer nano-dollars internally or `decimal.js`; never use binary floating point for persisted money. The public result is:

```ts
export type PricingResult = {
  costUsd: string | null;
  pricingUnknown: boolean;
  catalogVersion: string;
};

export function calculateCost(input: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}): PricingResult;
```

Seed only a deterministic `test.known` fixture in the unit catalog at `$0.001/1K` input and `$0.006/1K` output. Real provider entries must be added with a source URL and effective date in the catalog rather than guessed.

- [ ] **Step 4: Run tests and commit**

Run: `rtk vitest run packages/pricing/src/calculate-cost.test.ts`
Expected: PASS, 2 tests.
Run: `rtk git add packages/pricing && rtk git commit -m "feat: add nullable worker pricing"`

---

### Task 3: PostgreSQL Schema and Idempotent Span Repository

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/span-repository.ts`
- Create: `packages/db/src/span-repository.integration.test.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/migrations/0000_agentrail_m1.sql`
- Create: `docker-compose.yml` with the PostgreSQL service and health check

**Interfaces:**
- Consumes: `CanonicalSpanEnvelope`, `PricingResult`, and opaque payload refs.
- Produces: `SpanRepository.insertSpan(input): Promise<"inserted" | "duplicate">`, `recomputeTrace(traceId, projectId)`, and project/key lookup methods.

- [ ] **Step 1: Write the failing duplicate-delivery integration test**

```ts
it("stores one row for duplicate project_id and span_id delivery", async () => {
  const first = await repository.insertSpan(fixtureSpan());
  const second = await repository.insertSpan(fixtureSpan());
  expect(first).toBe("inserted");
  expect(second).toBe("duplicate");
  expect(await repository.countSpans(PROJECT_ID)).toBe(1);
});
```

Use a dedicated test database URL and truncate tables in `beforeEach`. Do not mock PostgreSQL for the uniqueness behavior.

- [ ] **Step 2: Start PostgreSQL and verify RED**

Run: `rtk docker compose up -d postgres`
Run: `rtk vitest run packages/db/src/span-repository.integration.test.ts`
Expected: FAIL because schema and repository are missing.

- [ ] **Step 3: Define schema with the composite unique key**

Use Drizzle `uniqueIndex("spans_project_span_unique").on(table.projectId, table.spanId)`. Store monetary columns as `numeric(20, 8)`, attributes as `jsonb`, and timestamps with timezone. The insert must use:

```ts
const inserted = await db
  .insert(spans)
  .values(values)
  .onConflictDoNothing({ target: [spans.projectId, spans.spanId] })
  .returning({ spanId: spans.spanId });

return inserted.length === 1 ? "inserted" : "duplicate";
```

Create indexes for `(project_id, started_at)`, `(project_id, trace_id)`, and `(project_id, kind, started_at)`.

The migration defines `projects`, `api_keys`, `traces`, and `spans`. `api_keys` stores `key_prefix` and `key_digest`, never the raw key. Foreign keys always include or resolve project ownership before a trace, span, or blob reference can be returned.

- [ ] **Step 4: Add trace aggregation tests**

```ts
it("sets trace total to null when any priced span is unknown", async () => {
  await repository.insertSpan(fixtureSpan({ spanId: SPAN_A, costUsd: "0.00200000" }));
  await repository.insertSpan(fixtureSpan({ spanId: SPAN_B, pricingUnknown: true, costUsd: null }));
  await repository.recomputeTrace(PROJECT_ID, TRACE_ID);
  expect(await repository.getTrace(PROJECT_ID, TRACE_ID)).toMatchObject({
    totalCostUsd: null,
    pricingUnknown: true,
  });
});
```

- [ ] **Step 5: Run migration, tests, and commit**

Run: `rtk pnpm --filter @agentrail/db db:migrate`
Run: `rtk vitest run packages/db/src/span-repository.integration.test.ts`
Expected: PASS with duplicate and unknown-total cases.
Run: `rtk git add packages/db && rtk git commit -m "feat: persist idempotent spans"`

---

### Task 4: Queue and Blob Ports with Local Adapters

**Files:**
- Create: `packages/queue/package.json`
- Create: `packages/queue/src/types.ts`
- Create: `packages/queue/src/memory.ts`
- Create: `packages/queue/src/memory.test.ts`
- Create: `packages/queue/src/redis-streams.ts`
- Create: `packages/queue/src/redis-streams.integration.test.ts`
- Create: `packages/queue/src/sqs.ts`
- Create: `packages/queue/src/index.ts`
- Create: `packages/blob/package.json`
- Create: `packages/blob/src/types.ts`
- Create: `packages/blob/src/memory.ts`
- Create: `packages/blob/src/s3.ts`
- Create: `packages/blob/src/s3.integration.test.ts`
- Create: `packages/blob/src/index.ts`
- Modify: `docker-compose.yml` with Redis, MinIO, and MinIO bucket initialization

**Interfaces:**
- Produces: `SpanQueue.enqueue`, `SpanQueue.read`, `SpanQueue.ack`, `SpanQueue.fail`, `BlobStore.put`, and `BlobStore.get`.
- Consumes: `CanonicalSpanBatch`.

- [ ] **Step 1: Write failing queue contract tests**

```ts
it("enqueues one canonical batch and returns a message id", async () => {
  const queue = new MemorySpanQueue();
  const receipt = await queue.enqueue(canonicalBatch());
  expect(receipt.messageId).toMatch(/^mem_/);
  await expect(queue.read()).resolves.toMatchObject({ body: canonicalBatch() });
});
```

Define the approved hot-path contract exactly:

```ts
export interface SpanQueue {
  enqueue(batch: CanonicalSpanBatch): Promise<{ messageId: string }>;
  read(): Promise<QueueMessage | null>;
  ack(message: QueueMessage): Promise<void>;
  fail(message: QueueMessage, reason: string): Promise<void>;
}
```

- [ ] **Step 2: Verify RED, implement memory adapter, verify GREEN**

Run: `rtk vitest run packages/queue/src/memory.test.ts`
Expected: FAIL because adapter is missing.
Implement FIFO in-memory behavior only.
Run: `rtk vitest run packages/queue/src/memory.test.ts`
Expected: PASS.

- [ ] **Step 3: Write Redis and S3-compatible integration tests**

The Redis test must assert one `XADD` per API enqueue and consumer-group acknowledgment. The S3-compatible test must put and retrieve bytes by opaque key and must not produce a public URL.

Run: `rtk docker compose up -d redis minio`
Run: `rtk vitest run packages/queue/src/redis-streams.integration.test.ts packages/blob/src/s3.integration.test.ts`
Expected: FAIL before adapters are implemented.

- [ ] **Step 4: Implement adapters and verify GREEN**

Redis uses one stream key and one worker consumer group. SQS uses `SendMessage`, `ReceiveMessage`, `DeleteMessage`, and queue redrive configuration; it does not perform worker logic. The S3 adapter returns an opaque `payload/<project>/<trace>/<span>.json` reference but never a browser URL.

Run: `rtk vitest run packages/queue packages/blob`
Expected: PASS.
Run: `rtk git add packages/queue packages/blob && rtk git commit -m "feat: add queue and evidence storage ports"`

---

### Task 5: SDK Trace API and Actor Inheritance

**Files:**
- Create: `packages/sdk/package.json`
- Create: `packages/sdk/src/ids.ts`
- Create: `packages/sdk/src/actor.ts`
- Create: `packages/sdk/src/span-builder.ts`
- Create: `packages/sdk/src/trace-context.ts`
- Create: `packages/sdk/src/agentrail.ts`
- Create: `packages/sdk/src/agentrail.test.ts`
- Create: `packages/sdk/src/index.ts`

**Interfaces:**
- Consumes: `SpanEnvelope` from contracts and a delivery sink supplied in Task 6.
- Produces: public `AgentRail`, `TraceContext`, `SpanContext`, `rail.trace()`, `trace.span()`, and `trace.action()`.

- [ ] **Step 1: Write failing inheritance and override tests**

```ts
it("inherits trace actor and allows a per-span override", async () => {
  const delivered: SpanEnvelope[] = [];
  const rail = testRail(delivered, { agentId: "planner", onBehalfOf: "user_42" });

  await rail.trace({ name: "answer" }, async (trace) => {
    await trace.span({ kind: "llm", name: "plan" }, async () => undefined);
    await trace.span(
      { kind: "tool", name: "delegate", actor: { agentId: "browser" } },
      async () => undefined,
    );
  });

  expect(delivered.find((span) => span.name === "plan")).toMatchObject({
    agent_id: "planner",
    on_behalf_of: "user_42",
  });
  expect(delivered.find((span) => span.name === "delegate")).toMatchObject({
    agent_id: "browser",
    on_behalf_of: "user_42",
  });
});
```

- [ ] **Step 2: Write failing lifecycle test**

```ts
it("records an error span and rethrows the original error", async () => {
  const failure = new Error("tool failed");
  await expect(
    rail.trace({ name: "answer" }, (trace) =>
      trace.action({ name: "filesystem.read" }, async () => { throw failure; }),
    ),
  ).rejects.toBe(failure);
  expect(delivered.at(-2)).toMatchObject({ name: "filesystem.read", outcome: "error" });
  expect(delivered.at(-1)).toMatchObject({ name: "answer", outcome: "error" });
});
```

- [ ] **Step 3: Verify RED and implement immutable close envelopes**

Run: `rtk vitest run packages/sdk/src/agentrail.test.ts`
Expected: FAIL because `AgentRail` is missing.

Implement every callback with `try/catch/finally`, emit exactly once after `ended_at` is known, inherit actor fields with nullish override semantics, and rethrow the original error object.

- [ ] **Step 4: Verify GREEN and commit**

Run: `rtk vitest run packages/sdk/src/agentrail.test.ts`
Expected: PASS.
Run: `rtk git add packages/sdk && rtk git commit -m "feat: add traced actor-aware SDK"`

---

### Task 6: SDK Buffer, Retry, and Shutdown

**Files:**
- Create: `packages/sdk/src/delivery.ts`
- Create: `packages/sdk/src/delivery.test.ts`
- Modify: `packages/sdk/src/agentrail.ts`
- Modify: `packages/sdk/src/index.ts`

**Interfaces:**
- Produces: `HttpSpanDelivery`, `DeliverySummary`, bounded buffer, retry policy, `onDrop`, and `shutdown()`.
- Consumes: immutable envelopes from Task 5 and `POST /v1/spans` from Task 7.

- [ ] **Step 1: Write failing delivery tests with fake timers**

```ts
it("flushes pending spans during shutdown", async () => {
  const transport = new RecordingTransport();
  const delivery = new BufferedDelivery({ transport, batchSize: 10, maxBuffer: 100 });
  delivery.add(spanFixture());
  await expect(delivery.shutdown({ timeoutMs: 1_000 })).resolves.toEqual({
    delivered: 1,
    dropped: 0,
    pending: 0,
  });
  expect(transport.batches).toHaveLength(1);
});

it("drops the newest span through onDrop when the bounded buffer is full", () => {
  const dropped: SpanEnvelope[] = [];
  const delivery = new BufferedDelivery({ maxBuffer: 1, onDrop: (span) => dropped.push(span) });
  delivery.add(spanFixture({ span_id: SPAN_A }));
  delivery.add(spanFixture({ span_id: SPAN_B }));
  expect(dropped.map((span) => span.span_id)).toEqual([SPAN_B]);
});
```

- [ ] **Step 2: Verify RED, implement minimal delivery, verify GREEN**

Run: `rtk vitest run packages/sdk/src/delivery.test.ts`
Expected: FAIL because `BufferedDelivery` is missing.

Retry only network errors, `429`, and `5xx`; honor `Retry-After`; use capped exponential delay plus jitter; do not retry `400`, `401`, or `413`. Never log the bearer token.

Run: `rtk vitest run packages/sdk`
Expected: PASS.
Run: `rtk git add packages/sdk && rtk git commit -m "feat: deliver spans with bounded shutdown"`

---

### Task 7: Fast Authenticated Hono Ingestion API

**Files:**
- Create: `apps/ingest/package.json`
- Create: `apps/ingest/src/api-key.ts`
- Create: `apps/ingest/src/api-key.test.ts`
- Create: `apps/ingest/src/app.ts`
- Create: `apps/ingest/src/app.test.ts`
- Create: `apps/ingest/src/benchmark.ts`
- Create: `apps/ingest/src/server.ts`
- Create: `apps/ingest/src/index.ts`

**Interfaces:**
- Consumes: `IngestSpanBatchSchema`, `MAX_INGEST_BODY_BYTES`, `SpanQueue`, and project/key repository.
- Produces: `createIngestApp(deps)` and Node server entry point.

- [ ] **Step 1: Write failing API-key digest tests**

```ts
it("derives a stable digest without storing the raw key", () => {
  const key = "ar_live_" + "a".repeat(64);
  expect(digestApiKey(key, "test-pepper")).toBe(digestApiKey(key, "test-pepper"));
  expect(digestApiKey(key, "different-pepper")).not.toBe(digestApiKey(key, "test-pepper"));
});
```

Use Node `createHmac("sha256", pepper)` and `timingSafeEqual`. Do not use Argon2 or bcrypt in this hot path.

- [ ] **Step 2: Write failing ingestion behavior tests**

```ts
it("returns 202 only after enqueue resolves", async () => {
  const gate = Promise.withResolvers<{ messageId: string }>();
  const app = createIngestApp(testDeps({ enqueue: () => gate.promise }));
  const pending = app.request("/v1/spans", validRequest());
  await expect(Promise.race([pending, Promise.resolve("still-pending")])).resolves.toBe("still-pending");
  gate.resolve({ messageId: "msg_1" });
  const response = await pending;
  expect(response.status).toBe(202);
});

it("returns 503 when enqueue fails", async () => {
  const app = createIngestApp(testDeps({ enqueue: async () => { throw new Error("redis down"); } }));
  expect((await app.request("/v1/spans", validRequest())).status).toBe(503);
});
```

- [ ] **Step 3: Verify RED and implement app factory**

Run: `rtk vitest run apps/ingest/src/app.test.ts apps/ingest/src/api-key.test.ts`
Expected: FAIL because the app factory is missing.

Use `bodyLimit` before JSON validation. Authenticate the bearer key, derive `project_id` from the key repository, parse with the shared schema, attach `project_id`, call `queue.enqueue()` exactly once, then return `{ accepted, request_id }` with status `202`. Return structured `401`, `400`, `413`, `429`, and retryable `503` responses.

- [ ] **Step 4: Verify endpoint behavior and call count**

Run: `rtk vitest run apps/ingest`
Expected: PASS, and the test dependency reports zero pricing, database-write, or blob calls because those dependencies do not exist in the app factory.

- [ ] **Step 5: Add a microbenchmark guard and commit**

Create a benchmark script that performs 100 warmups and 1,000 requests at concurrency 10 against a warm local Redis adapter with worker stopped. It must report p50, p95, p99, body bytes, and machine metadata.

Run: `rtk pnpm --filter @agentrail/ingest bench`
Expected: p95 at or below 100 ms in the recorded local environment.
Run: `rtk git add apps/ingest && rtk git commit -m "feat: accept spans after fast enqueue"`

---

### Task 8: Worker Processing, Redaction, and Reconciliation

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/src/redact.ts`
- Create: `apps/worker/src/redact.test.ts`
- Create: `apps/worker/src/process-batch.ts`
- Create: `apps/worker/src/process-batch.integration.test.ts`
- Create: `apps/worker/src/reconcile-incomplete.ts`
- Create: `apps/worker/src/reconcile-incomplete.test.ts`
- Create: `apps/worker/src/main.ts`

**Interfaces:**
- Consumes: queue messages, pricing, `SpanRepository`, `BlobStore`, and shared config.
- Produces: `processBatch`, `reconcileIncompleteTraces`, consumer loop, ack/fail behavior.

- [ ] **Step 1: Write failing redaction and truncation tests**

```ts
it("redacts secrets recursively without mutating the source", () => {
  const source = { authorization: "Bearer secret", nested: { password: "secret", query: "safe" } };
  expect(redactPayload(source, { maxBytes: 64_000 })).toMatchObject({
    value: { authorization: "[REDACTED]", nested: { password: "[REDACTED]", query: "safe" } },
    truncated: false,
  });
  expect(source.nested.password).toBe("secret");
});
```

- [ ] **Step 2: Write failing end-to-end worker integration test**

```ts
it("prices in the worker and ignores duplicate span delivery", async () => {
  await processBatch(deps, batchWithKnownAndUnknownModels());
  await processBatch(deps, batchWithKnownAndUnknownModels());
  expect(await repository.countSpans(PROJECT_ID)).toBe(2);
  expect(await repository.getSpan(PROJECT_ID, KNOWN_SPAN)).toMatchObject({
    costUsd: "0.00400000",
    pricingUnknown: false,
  });
  expect(await repository.getTrace(PROJECT_ID, TRACE_ID)).toMatchObject({
    totalCostUsd: null,
    pricingUnknown: true,
  });
});
```

- [ ] **Step 3: Verify RED and implement processing order**

Run: `rtk vitest run apps/worker/src`
Expected: FAIL because worker functions are missing.

Implement validate, redact, calculate price, store blob, insert-or-ignore span, recompute trace, then ack. If durable writes fail, call `fail` and do not ack. Never recompute or overwrite an already persisted duplicate span.

- [ ] **Step 4: Add timeout-boundary tests**

```ts
it("marks a trace incomplete at the shared 15 minute boundary", async () => {
  const now = new Date("2026-07-21T10:15:00.000Z");
  await reconcileIncompleteTraces({ now, timeoutMs: TRACE_INCOMPLETE_AFTER_MS, repository });
  expect(await repository.getTrace(PROJECT_ID, TRACE_ID)).toMatchObject({ completionState: "incomplete" });
});
```

- [ ] **Step 5: Verify GREEN and commit**

Run: `rtk vitest run apps/worker packages/db packages/pricing`
Expected: PASS.
Run: `rtk git add apps/worker && rtk git commit -m "feat: process and reconcile trace evidence"`

---

### Task 9: Local Docker Topology and Bootstrap

**Files:**
- Modify: `docker-compose.yml`
- Create: `infra/docker/postgres/init.sql`
- Create: `infra/docker/minio/create-bucket.sh`
- Create: `apps/ingest/Dockerfile`
- Create: `apps/worker/Dockerfile`
- Create: `scripts/bootstrap-local.ts`
- Create: `packages/testkit/package.json`
- Create: `packages/testkit/src/fixtures.ts`
- Create: `packages/testkit/src/index.ts`
- Create: `tests/smoke/core-pipeline.test.ts`

**Interfaces:**
- Consumes: all core applications and adapters.
- Produces: one-command local stack, one project, one raw API key printed once, and one synthetic trace.

- [ ] **Step 1: Write failing black-box smoke test**

The test must call the running ingestion endpoint with the bootstrap API key, poll PostgreSQL through a read helper, and assert that a duplicate request produces one stored span.

Run: `rtk vitest run tests/smoke/core-pipeline.test.ts`
Expected: FAIL because the Compose stack and bootstrap script are missing.

- [ ] **Step 2: Implement health checks and bootstrap**

Compose services: `postgres`, `redis`, `minio`, `minio-init`, `ingest`, and `worker`. Every stateful service has a readiness health check. The bootstrap script creates a 32-byte API key, stores only its prefix and HMAC digest, prints the raw key once, and sends deterministic synthetic spans labelled `SAMPLE DATA`.

- [ ] **Step 3: Verify the full core path**

Run: `rtk docker compose up -d --build`
Run: `rtk pnpm bootstrap:local`
Run: `rtk vitest run tests/smoke/core-pipeline.test.ts`
Expected: PASS; queue, database, and blob health checks are healthy; duplicate delivery stores one span.

- [ ] **Step 4: Run core verification and commit**

Run: `rtk pnpm typecheck`
Run: `rtk pnpm test`
Run: `rtk docker compose config --quiet`
Expected: all exit 0.
Run: `rtk git add docker-compose.yml infra apps/ingest/Dockerfile apps/worker/Dockerfile scripts packages/testkit tests/smoke && rtk git commit -m "feat: run AgentRail core locally"`

---

### Task 10: Open-Source, AWS, and Continuous Integration Baseline

**Files:**
- Create: `README.md`
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Create: `docs/architecture.md`
- Create: `docs/deployment/aws.md`
- Create: `docs/operations/api-keys.md`
- Create: `.github/workflows/ci.yml`
- Create: `tests/docs/documentation.test.ts`

**Interfaces:**
- Consumes: verified local core commands, SQS/S3 adapter configuration, and Apache-2.0 license.
- Produces: reproducible contributor onboarding, honest AWS reference mapping, security contact process, and CI gate.

- [ ] **Step 1: Write a failing documentation contract test**

```ts
import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const required = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "LICENSE",
  "docs/architecture.md",
  "docs/deployment/aws.md",
];

describe("open-source documentation", () => {
  it("contains every required public document", async () => {
    await Promise.all(required.map((path) => access(path)));
  });

  it("documents the canonical idempotency and 202 semantics", async () => {
    const architecture = await readFile("docs/architecture.md", "utf8");
    expect(architecture).toContain("(project_id, span_id)");
    expect(architecture).toContain("202 Accepted");
    expect(architecture).toContain("queue acknowledgment");
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `rtk vitest run tests/docs/documentation.test.ts`
Expected: FAIL because public documentation does not yet exist.

- [ ] **Step 3: Write exact local, security, and AWS documentation**

`README.md` includes prerequisites, `docker compose up`, bootstrap, SDK quickstart, test commands, architecture links, Apache-2.0 status, and the `SAMPLE DATA` explanation. `SECURITY.md` provides a private reporting address and explicitly says not to file secrets in public issues. `docs/deployment/aws.md` maps Next.js to Amplify or documented server runtime, Hono to API Gateway/Lambda, Redis Streams to SQS, worker to Lambda SQS consumer, PostgreSQL to RDS, MinIO to private S3, secrets to Secrets Manager/SSM, and logs to CloudWatch. It makes no funding, compliance, uptime, or production-readiness guarantee.

- [ ] **Step 4: Add CI with service containers and immutable gates**

The workflow uses Node 24 and pnpm 11, starts PostgreSQL and Redis service containers, runs install with frozen lockfile, formatting check, typecheck, unit/integration tests, and production builds. Docker and browser E2E remain a separate job with uploaded failure artifacts.

- [ ] **Step 5: Verify docs and CI configuration, then commit**

Run: `rtk vitest run tests/docs/documentation.test.ts`
Run: `rtk pnpm typecheck`
Run: `rtk pnpm test`
Expected: all exit 0.
Run: `rtk git add README.md CONTRIBUTING.md SECURITY.md docs .github tests/docs && rtk git commit -m "docs: publish AgentRail contributor baseline"`

## Core Plan Completion Gate

Before moving to the dashboard plan:

- Run `rtk pnpm format:check`, `rtk pnpm typecheck`, and `rtk pnpm test`.
- Run the ingestion benchmark with worker stopped and save the machine-readable report under `artifacts/benchmarks/` without presenting it as a universal claim.
- Run `rtk docker compose up -d --build`, bootstrap, inspect health, and run the core smoke test.
- Confirm the SDK never sends `cost_usd`.
- Confirm duplicate queue delivery leaves exactly one `(project_id, span_id)` row.
- Confirm unknown pricing remains null at both span and trace level.
- Confirm no raw API key or secret appears in logs.
