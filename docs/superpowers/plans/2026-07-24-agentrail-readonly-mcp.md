# AgentRail Read-Only MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local read-only `@agentrail/mcp` package that lets Codex inspect AgentRail traces through MCP tools.

**Architecture:** Add a new workspace package under `packages/mcp`. Keep the package independent from Next.js by defining a small read-model interface, pure tool handlers, and a stdio MCP server entrypoint. The first milestone reads database/demo trace metadata and payload availability only; raw payload content stays behind the dashboard backend.

**Tech Stack:** TypeScript, Vitest, `@modelcontextprotocol/sdk@1.29.0`, `zod`, `@agentrail/db`, existing demo data.

## Global Constraints

- Use `@modelcontextprotocol/sdk@1.29.0`, not the beta `@modelcontextprotocol/server`.
- All MCP tools are read-only.
- Do not expose raw payload content through MCP.
- Do not add workflow mutation features: rerun, retry, export, delete, share, approve, rollback, billing, teams, or RBAC.
- Keep the MCP package local stdio only; no hosted remote MCP server.
- Use TDD: write failing tests before production code.
- Prefix commands with `rtk`.
- Do not stage `apps/web/next-env.d.ts`.

---

### Task 1: Scaffold package and tool registration contract

**Files:**

- Create: `packages/mcp/package.json`
- Create: `packages/mcp/tsconfig.json`
- Create: `packages/mcp/src/types.ts`
- Create: `packages/mcp/src/tools.test.ts`
- Create: `packages/mcp/src/tools.ts`

**Interfaces:**

- Produces `AGENTRAIL_MCP_TOOL_NAMES` as a readonly tuple of exactly:
  - `agentrail_list_traces`
  - `agentrail_get_trace`
  - `agentrail_get_actions`
  - `agentrail_get_payload_status`
  - `agentrail_open_dashboard`
- Produces `AgentRailToolDependencies` interface containing a read model and optional `dashboardUrl`.

- [ ] **Step 1: Add package manifest and tsconfig**

Create `packages/mcp/package.json` with package name `@agentrail/mcp`, `bin.agentrail-mcp = ./dist/index.js`, scripts `build`, `typecheck`, `lint`, and dependencies on `@agentrail/db`, `@modelcontextprotocol/sdk`, and `zod`.

Create `packages/mcp/tsconfig.json` extending `../../tsconfig.base.json` with `rootDir = "src"` and `outDir = "dist"`.

- [ ] **Step 2: Write failing tool name test**

In `packages/mcp/src/tools.test.ts`, assert:

```ts
import { describe, expect, it } from "vitest";

import { AGENTRAIL_MCP_TOOL_NAMES } from "./tools";

describe("AgentRail MCP tools", () => {
  it("exposes only the approved read-only tools", () => {
    expect(AGENTRAIL_MCP_TOOL_NAMES).toEqual([
      "agentrail_list_traces",
      "agentrail_get_trace",
      "agentrail_get_actions",
      "agentrail_get_payload_status",
      "agentrail_open_dashboard",
    ]);
  });
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
rtk vitest run packages/mcp/src/tools.test.ts
```

Expected: FAIL because `packages/mcp/src/tools.ts` does not exist or does not export `AGENTRAIL_MCP_TOOL_NAMES`.

- [ ] **Step 4: Implement minimal tool names and types**

Create `packages/mcp/src/tools.ts` with the tuple and stub exported types. Do not implement behavior yet.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
rtk vitest run packages/mcp/src/tools.test.ts
rtk tsc -p packages/mcp/tsconfig.json --noEmit
```

Expected: tool test passes and TypeScript has no errors.

Commit:

```bash
rtk git add packages/mcp/package.json packages/mcp/tsconfig.json packages/mcp/src/types.ts packages/mcp/src/tools.ts packages/mcp/src/tools.test.ts package.json pnpm-lock.yaml
rtk git commit -m "feat(mcp): scaffold readonly tool package"
```

### Task 2: Implement read-only tool handlers

**Files:**

- Modify: `packages/mcp/src/types.ts`
- Modify: `packages/mcp/src/tools.test.ts`
- Modify: `packages/mcp/src/tools.ts`

**Interfaces:**

- Consumes `AgentRailToolDependencies`.
- Produces:
  - `createAgentRailToolHandlers(dependencies: AgentRailToolDependencies): AgentRailToolHandlers`
  - handler methods `listTraces`, `getTrace`, `getActions`, `getPayloadStatus`, and `openDashboard`
  - `createTextResult(value: unknown): { content: [{ type: "text"; text: string }] }`

- [ ] **Step 1: Extend tests for handler behavior**

Add tests using an in-memory fake read model. Cover:

- `listTraces` clamps `limit` to `25`, returns dashboard URLs, and respects filters passed to the read model.
- `getTrace` returns ordered spans and no raw payload.
- `getActions` returns only `action` and `tool` spans.
- `getPayloadStatus` returns payload availability without content.
- `openDashboard` returns setup guidance when no dashboard URL exists.
- safe config errors do not include a full database URL.

- [ ] **Step 2: Verify RED**

Run:

```bash
rtk vitest run packages/mcp/src/tools.test.ts
```

Expected: FAIL because `createAgentRailToolHandlers` and related behavior are not implemented.

- [ ] **Step 3: Implement minimal pure handlers**

Implement bounded summaries:

- serialize dates/IDs/cost fields directly from the read model;
- compute `durationMs` from timestamps when available;
- include `payload: { hasPayload, truncated }`;
- never include `payloadRef` or raw payload object content;
- truncate large attribute JSON summaries to 500 characters.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```bash
rtk vitest run packages/mcp/src/tools.test.ts
rtk tsc -p packages/mcp/tsconfig.json --noEmit
```

Expected: tests pass and TypeScript has no errors.

Commit:

```bash
rtk git add packages/mcp/src/types.ts packages/mcp/src/tools.ts packages/mcp/src/tools.test.ts
rtk git commit -m "feat(mcp): add readonly trace handlers"
```

### Task 3: Add database/demo read model and stdio server

**Files:**

- Create: `packages/mcp/src/read-model.test.ts`
- Create: `packages/mcp/src/read-model.ts`
- Create: `packages/mcp/src/server.test.ts`
- Create: `packages/mcp/src/server.ts`
- Create: `packages/mcp/src/index.ts`
- Modify: `vitest.config.ts` only if package alias is required by tests.

**Interfaces:**

- Consumes existing `@agentrail/db` repository shape and demo-mode data.
- Produces:
  - `createEnvironmentConfig(env: NodeJS.ProcessEnv): AgentRailMcpConfig`
  - `createDatabaseReadModel(config: AgentRailMcpConfig): AgentRailReadModel`
  - `createAgentRailMcpServer(dependencies: AgentRailToolDependencies): McpServer`
  - `main(env?: NodeJS.ProcessEnv): Promise<void>`

- [ ] **Step 1: Write failing read-model config tests**

Test that:

- demo mode does not require `DATABASE_URL`;
- database mode requires `DATABASE_URL` and `AGENTRAIL_PROJECT_ID`;
- safe error messages name missing env vars but do not echo secret values.

- [ ] **Step 2: Verify RED**

Run:

```bash
rtk vitest run packages/mcp/src/read-model.test.ts
```

Expected: FAIL because `read-model.ts` does not exist.

- [ ] **Step 3: Implement environment config and read model factory**

Implement `createEnvironmentConfig`. Implement database read model using `createDatabase` and `createSpanRepository`. For demo mode, adapt `createDemoTraceReadRepository` only if importing from `apps/web` does not pull Next.js code; otherwise create a tiny synthetic read model in the MCP package with the same sample IDs and safe metadata.

- [ ] **Step 4: Write failing server registration tests**

Test `createAgentRailMcpServer` with a fake server-registration harness if direct SDK inspection is awkward. The test must prove the five approved tools are registered and tool descriptions are read-only.

- [ ] **Step 5: Verify RED**

Run:

```bash
rtk vitest run packages/mcp/src/server.test.ts
```

Expected: FAIL because `server.ts` does not exist or tools are not registered.

- [ ] **Step 6: Implement server and CLI entrypoint**

Use current stable SDK imports:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
```

Register the five tools with Zod input schemas and connect with `StdioServerTransport` from `main`.

- [ ] **Step 7: Verify GREEN and commit**

Run:

```bash
rtk vitest run packages/mcp/src/read-model.test.ts packages/mcp/src/server.test.ts packages/mcp/src/tools.test.ts
rtk tsc -p packages/mcp/tsconfig.json --noEmit
rtk pnpm --filter @agentrail/mcp build
```

Expected: tests pass, TypeScript has no errors, and package builds.

Commit:

```bash
rtk git add packages/mcp/src/read-model.ts packages/mcp/src/read-model.test.ts packages/mcp/src/server.ts packages/mcp/src/server.test.ts packages/mcp/src/index.ts vitest.config.ts
rtk git commit -m "feat(mcp): serve readonly stdio tools"
```

### Task 4: Documentation and final verification

**Files:**

- Create: `docs/operations/mcp.md`
- Modify: `README.md`
- Modify: `tests/docs/documentation.test.ts`

**Interfaces:**

- Consumes completed package commands.
- Produces user-facing instructions for Codex MCP configuration and honest product boundaries.

- [ ] **Step 1: Write failing documentation tests**

Add tests that assert:

- docs mention `@agentrail/mcp`;
- docs mention read-only MCP;
- docs include `agentrail_list_traces`;
- docs warn that MCP does not automatically record Codex or Claude activity;
- docs do not claim hosted remote MCP, funding, AWS acceptance, or raw payload access.

- [ ] **Step 2: Verify RED**

Run:

```bash
rtk vitest run tests/docs/documentation.test.ts
```

Expected: FAIL because MCP docs do not exist yet.

- [ ] **Step 3: Write docs**

Add `docs/operations/mcp.md` with:

- what MCP enables;
- Codex config snippet;
- demo-mode quickstart;
- database-mode quickstart;
- approved tools table;
- explicit exclusions.

Update README with a short link to MCP docs.

- [ ] **Step 4: Verify docs GREEN**

Run:

```bash
rtk vitest run tests/docs/documentation.test.ts
```

Expected: docs test passes.

- [ ] **Step 5: Run final gate**

Run:

```bash
rtk vitest run packages/mcp tests/docs/documentation.test.ts
rtk tsc -p packages/mcp/tsconfig.json --noEmit
rtk pnpm --filter @agentrail/mcp build
rtk vitest run apps/web
rtk pnpm --filter @agentrail/web anti-slop
rtk pnpm --filter @agentrail/web build
rtk git diff --check
```

Expected:

- MCP and docs tests pass;
- MCP package typechecks and builds;
- existing web tests, anti-slop, and build remain passing;
- Git whitespace check is clean.

- [ ] **Step 6: Commit final docs**

Commit:

```bash
rtk git add docs/operations/mcp.md README.md tests/docs/documentation.test.ts
rtk git commit -m "docs: document agentrail mcp setup"
```

## Plan self-review

- Spec coverage: all approved tools, read-only boundary, no raw payload, Codex config, demo/database mode, testing, and docs are covered.
- Placeholder scan: no TBD/TODO/implement-later instructions remain.
- Type consistency: `AgentRailReadModel`, `AgentRailToolDependencies`, `createAgentRailToolHandlers`, and `createAgentRailMcpServer` names are used consistently across tasks.
