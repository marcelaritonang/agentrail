# AgentRail

AgentRail is an open-source flight recorder for AI agents: immutable traces, model cost, actor attribution, tool/action audit, and redacted evidence in one forensic timeline.

This repository is in **Milestone 1.1**. The core ingestion pipeline, TypeScript SDK, worker, PostgreSQL model, Redis/SQS queue ports, MinIO/S3 evidence ports, local Docker topology, forensic dashboard, guided sample, and landing page are implemented. This is an early open-source build, not a production-readiness or funding claim.

## Why AgentRail exists

AI agents are becoming harder to explain after they act. A chat transcript usually does not show the full execution path: which tool ran, who the agent acted for, what it cost, whether evidence exists, and which payloads were intentionally kept out of chat. AgentRail records those facts as a forensic timeline for developers building agentic software.

## Who it is for

- AI agent application developers debugging multi-step tool workflows
- internal automation teams that need action evidence before trusting agents with operations
- open-source maintainers testing Codex, Claude-style tools, MCP clients, or custom agent runtimes

## Built for AWS

The current local stack is intentionally small, but the production path maps to AWS services:

- API Gateway and Lambda for authenticated span ingestion
- SQS for fast enqueue and worker decoupling
- RDS/PostgreSQL for trace and span metadata
- S3 for redacted evidence payload storage
- CloudWatch for queue, worker, and ingestion observability
- Amazon Bedrock cost and audit metadata as a future catalog integration

This is a reference mapping, not a claim that the public demo currently runs on AWS.

## Founding tester plan

AgentRail is seeking three founding testers before the next milestone: one AI agent application developer, one internal automation team, and one open-source maintainer using Codex, Claude-style tools, or an MCP-capable workflow. See [Founding tester plan](docs/community/founding-testers.md).

## Startup pitch

AgentRail is an open-source flight recorder for AI agents. It records traces, tool actions, model cost metadata, actor attribution, and evidence payload status so developers can debug and audit autonomous AI workflows after they act. AWS credits would be used to move the local Docker demo toward an AWS-native reference deployment with API Gateway, Lambda, SQS, RDS/PostgreSQL, S3, CloudWatch, and future Amazon Bedrock cost and audit integrations.

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
- `@agentrail-sdk/mcp` read-only MCP server for inspecting traces from Codex-style developer workflows
- `@agentrail-sdk/context` local Context Relay engine for bounded source packs
- `@agentrail-sdk/cli` commands for `doctor`, `context`, local MCP setup, and uninstall

## Local quickstart

Prerequisites for repository development: Node.js 24, pnpm 11 through Corepack, and Docker Desktop or Docker Engine with Compose. Published CLI packages support Node.js `>=20.16`.

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
import {
  AgentRail,
  BufferedDelivery,
  HttpSpanTransport,
} from "@agentrail-sdk/sdk";

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

## NPM target status

AgentRail is published on npm under the scoped `@agentrail-sdk` namespace. Use these scoped packages; the unscoped npm command `npm install agentrail` is not this project and belongs to another maintainer.

| Package                    | Version | Purpose                                              |
| -------------------------- | ------- | ---------------------------------------------------- |
| `@agentrail-sdk/contracts` | `0.1.1` | Shared span and trace contracts.                     |
| `@agentrail-sdk/db`        | `0.1.0` | Database schema and repository helpers.              |
| `@agentrail-sdk/sdk`       | `0.1.0` | TypeScript SDK for recording agent traces.           |
| `@agentrail-sdk/context`   | `0.1.1` | Local Context Relay engine for bounded source packs. |
| `@agentrail-sdk/cli`       | `0.1.1` | Local CLI for context, doctor, setup, and uninstall. |
| `@agentrail-sdk/mcp`       | `0.1.2` | Read-only local MCP server and Context profile.      |

Live install commands:

```bash
npm install @agentrail-sdk/sdk

npm install -D @agentrail-sdk/cli
npx -y @agentrail-sdk/cli context --root . --task "Audit this change" --token-budget 4000 --json

npx -y @agentrail-sdk/mcp
npx -y @agentrail-sdk/mcp --profile context
```

The MCP Context profile is live in `@agentrail-sdk/mcp@0.1.2` and exposes local Context Relay tools to MCP-capable agent clients.

Local source checkout remains the recommended path for running the full ingestion API, worker, PostgreSQL, Redis, MinIO, and dashboard stack. See [NPM release checklist](docs/operations/npm-release.md) for the release verification process.

## MCP integration

`@agentrail-sdk/mcp` lets MCP-capable developer tools inspect AgentRail traces without adding mutation features or exposing raw evidence payloads. See [AgentRail MCP operations](docs/operations/mcp.md) for Codex config, demo mode, and local database setup.

## Context Relay CLI

`@agentrail-sdk/cli` can create a local Context Pack without sending source code to a hosted service:

```bash
npx -y @agentrail-sdk/cli context --root . --task "Audit this change" --token-budget 4000 --json
```

The command writes a local receipt under `.agentrail/receipts/v1/` and keeps source snippets on the developer machine. This is the first daily-use path for developers who want tighter AI coding context before the hosted product exists.

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
pnpm --filter @agentrail-sdk/ingest bench
```

Benchmark results describe only the recorded machine and profile; they are not a universal latency guarantee.

## Documentation

- [Architecture](docs/architecture.md)
- [AWS reference mapping](docs/deployment/aws.md)
- [API-key operations](docs/operations/api-keys.md)
- [MCP operations](docs/operations/mcp.md)
- [NPM release checklist](docs/operations/npm-release.md)
- [Startup pitch](docs/startup/pitch.md)
- [Founding tester plan](docs/community/founding-testers.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Approved M1 specification](docs/superpowers/specs/2026-07-21-agentrail-m1-design.md)

## License

Apache License 2.0. See [LICENSE](LICENSE).
