# AgentRail

AgentRail is an open-source flight recorder for AI agents: immutable traces, model cost, actor attribution, tool/action audit, and redacted evidence in one forensic timeline.

This repository is in **Milestone 1.1**. The core ingestion pipeline, TypeScript SDK, worker, PostgreSQL model, Redis/SQS queue ports, MinIO/S3 evidence ports, local Docker topology, forensic dashboard, guided sample, and landing page are implemented. This is an early open-source build, not a production-readiness or funding claim.

## What works

- `rail.trace()`, child spans, action spans, automatic actor inheritance, and per-span actor overrides
- bounded SDK delivery with retry policy and `shutdown()` flush summaries
- HMAC API-key authentication; raw keys are never stored in PostgreSQL
- `202 Accepted` only after one fast queue enqueue succeeds
- worker-side pricing with a versioned catalog
- `cost_usd = null` plus `pricing_unknown = true` for unknown models
- idempotency on exactly `(project_id, span_id)`
- recursive secret redaction, bounded payloads, and private blob storage
- local PostgreSQL, Redis, MinIO, ingestion, and worker services through Docker Compose
- forensic dashboard routes for `/traces` and `/traces/[traceId]`
- guided sample mode for explaining the trace archive, Trace Rail, Evidence Drawer, and Action Ledger
- landing page with optional source controls for public deployments

## Local quickstart

Prerequisites: Node.js 24, pnpm 11 through Corepack, and Docker Desktop or Docker Engine with Compose.

```bash
corepack enable
pnpm install
docker compose up -d --build
pnpm bootstrap:local
```

The bootstrap command creates a local project, prints its raw API key once, stores only the key prefix and HMAC digest in PostgreSQL, and submits one trace marked `SAMPLE DATA`. Local bootstrap state is written under `.agentrail/`, which is ignored by Git and must still be treated as a secret.

Inspect service state:

```bash
docker compose ps
```

Run the duplicate-delivery smoke test after bootstrap:

```bash
RUN_CORE_SMOKE=1 pnpm vitest run tests/smoke/core-pipeline.test.ts
```

In PowerShell, set `$env:RUN_CORE_SMOKE='1'` before the Vitest command.

## SDK example

```ts
import { AgentRail, BufferedDelivery, HttpSpanTransport } from "@agentrail/sdk";

const delivery = new BufferedDelivery({
  transport: new HttpSpanTransport({
    endpoint: "http://localhost:3001/v1/spans",
    apiKey: process.env.AGENTRAIL_API_KEY!,
  }),
});

const rail = new AgentRail({
  actor: { agentId: "research-agent", onBehalfOf: "user_42" },
  sink: delivery,
});

await rail.trace({ name: "research.answer" }, async (trace) => {
  await trace.span(
    {
      kind: "llm",
      name: "draft",
      model: "test.known",
      inputTokens: 1_000,
      outputTokens: 500,
    },
    async () => {
      // Call the model here. AgentRail does not calculate authoritative cost in the SDK.
    },
  );

  await trace.action({ name: "filesystem.read" }, async () => {
    // Record a consequential agent action.
  });
});

await rail.shutdown({ timeoutMs: 5_000 });
```

Only the synthetic `test.known` model is priced today. Provider prices must be added with a source and effective date; they are never guessed.

## Web demo and source URL

The web app can run as a read-only synthetic demo by setting:

```bash
AGENTRAIL_DEMO_MODE=1
```

Demo mode is for product explanation only. It uses seeded sample data and should not be presented as live customer usage.

Public source links are optional and must be configured explicitly:

```bash
NEXT_PUBLIC_AGENTRAIL_SOURCE_URL=https://example.com/your-org/agentrail
```

`NEXT_PUBLIC_AGENTRAIL_SOURCE_URL` is HTTPS-only and read at build-time by the Next.js app. If it is unset or empty, the landing page omits source buttons instead of falling back to a hardcoded repository.

## Quality gates

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
docker compose config --quiet
```

The local ingestion benchmark runs 100 warmups and 1,000 measured requests at concurrency 10 against warm Redis with the worker stopped:

```bash
pnpm --filter @agentrail/ingest bench
```

Benchmark results describe only the recorded machine and profile; they are not a universal latency guarantee.

## Documentation

- [Architecture](docs/architecture.md)
- [AWS reference mapping](docs/deployment/aws.md)
- [API-key operations](docs/operations/api-keys.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Approved M1 specification](docs/superpowers/specs/2026-07-21-agentrail-m1-design.md)

## License

Apache License 2.0. See [LICENSE](LICENSE).
