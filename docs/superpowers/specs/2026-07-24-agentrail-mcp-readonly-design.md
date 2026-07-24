# AgentRail Read-Only MCP Design

## Goal

Add a read-only MCP server package so Codex and other MCP-capable developer tools can inspect AgentRail traces from inside the coding workflow without adding workflow mutation, hosted ingestion, billing, teams, share links, or a Codex recorder.

This is the next mature step after M1.1 because it turns AgentRail from only a web dashboard into a developer workflow tool: builders can ask Codex what happened in an agent run, then open the dashboard for forensic detail.

## Product boundary

AgentRail MCP is a query surface over existing AgentRail data. It does not record Codex activity by itself.

Supported in this milestone:

- local stdio MCP server;
- project-scoped database reads using `DATABASE_URL` and `AGENTRAIL_PROJECT_ID`;
- demo-mode reads using the same public synthetic sample as the dashboard;
- read-only trace, action, payload-status, and dashboard-link tools;
- concise text/JSON tool results suitable for Codex chat.

Explicitly excluded:

- mutation tools, rerun, retry, export, delete, share, approve, rollback, or workflow execution;
- OAuth, hosted remote MCP, public multi-tenant auth, billing, team management, or RBAC;
- automatic instrumentation of Codex or Claude activity;
- direct browser or blob-storage access from the MCP client.

## Approach options

### Option A: `@agentrail/mcp` reads the database directly

The package owns its MCP server entrypoint and uses existing database repositories. It formats read-only tool results with small presenter functions.

Trade-off: local users must provide `DATABASE_URL`, but this is the smallest reliable implementation for an open-source self-hosted milestone.

### Option B: MCP calls the Next.js dashboard API

The package would call HTTP routes from the web app.

Trade-off: easier to point at Vercel, but the current dashboard only exposes payload retrieval, not a full trace query API. Adding public query routes would expand the product surface and auth story too early.

### Option C: MCP wraps the SDK

The package would reuse the TypeScript SDK.

Trade-off: the SDK records spans and sends ingestion events; it is the wrong abstraction for reading historical traces.

Chosen approach: Option A.

## Architecture

Create `packages/mcp` with three layers:

1. `src/read-model.ts`: project-scoped read-only functions over `@agentrail/db`.
2. `src/tools.ts`: pure tool handlers that transform traces into MCP-safe text/JSON results.
3. `src/server.ts` and `src/index.ts`: MCP server registration and stdio entrypoint using the official Model Context Protocol TypeScript SDK.

The web dashboard remains independent. Shared behavior should move only if needed; do not import Next.js components or route files into the MCP package.

## MCP tools

### `agentrail_list_traces`

Inputs:

- `limit?: number`, default `10`, min `1`, max `25`;
- `query?: string`;
- `actor?: string`;
- `outcome?: "ok" | "error"`.

Returns:

- latest matching traces;
- trace ID, technical name, agent, requested-by, outcome, completion state, span count, cost label, started timestamp;
- dashboard URL when `AGENTRAIL_DASHBOARD_URL` is configured.

### `agentrail_get_trace`

Inputs:

- `traceId: string`.

Returns:

- trace summary;
- ordered spans;
- kind, name, actor, outcome, duration, model, pricing flag, payload availability;
- no raw payload content.

### `agentrail_get_actions`

Inputs:

- `traceId: string`.

Returns only spans where `kind` is `action` or `tool`, with span ID, name, actor, outcome, duration, and attributes summary.

### `agentrail_get_payload_status`

Inputs:

- `traceId: string`;
- `spanId: string`.

Returns whether recorded data exists and whether it is unavailable because project payload mode is `none`, span has no payload, or project/span cannot be found.

This milestone does not expose raw payload through MCP. Raw evidence remains behind the dashboard backend/API route to avoid accidental leakage into Codex chats.

### `agentrail_open_dashboard`

Inputs:

- `traceId?: string`.

Returns a dashboard URL for `/traces` or `/traces/{traceId}` when `AGENTRAIL_DASHBOARD_URL` is configured. If not configured, returns setup guidance instead of inventing a URL.

## Configuration

Environment variables:

- `DATABASE_URL`: required unless demo mode is enabled;
- `AGENTRAIL_PROJECT_ID`: required unless demo mode is enabled;
- `AGENTRAIL_DEMO_MODE`: when `1` or `true`, uses synthetic public sample data;
- `AGENTRAIL_DASHBOARD_URL`: optional base URL used by `agentrail_open_dashboard` and trace list links.

Codex config example:

```toml
[mcp_servers.agentrail]
command = "pnpm"
args = ["--dir", "/absolute/path/to/agentrail", "--filter", "@agentrail/mcp", "start"]
env = {
  DATABASE_URL = "postgresql://agentrail:agentrail@localhost:5433/agentrail_test",
  AGENTRAIL_PROJECT_ID = "00000000-0000-4000-8000-000000000101",
  AGENTRAIL_DASHBOARD_URL = "http://127.0.0.1:3000"
}
```

The final documentation must state that exact Codex config keys can vary by Codex surface and version; users should keep the server local unless they have a reviewed remote deployment and auth model.

## Error handling

- Missing required environment variables return a clear startup error.
- Unknown trace returns a normal tool result saying the trace was not found.
- Unknown payload status returns a normal tool result, not raw storage errors.
- Database connection failure returns a tool error that names the missing dependency without printing secrets.
- Tool handlers must never print full `DATABASE_URL`, API keys, S3 credentials, or payload object-store paths.

## Security and privacy

The MCP package is read-only and local-first. It must not expose raw payload content in this milestone. It may expose `hasPayload`, `payloadTruncated`, and payload-mode status so Codex can guide the user to the web Evidence Drawer.

Tool result text should prefer summaries and IDs over full attributes. Attribute summaries must be bounded by length to avoid dumping large evidence blobs into chat.

## Testing

Use TDD for implementation.

Required tests:

- tool registration includes exactly the approved tool names;
- list traces respects limit bounds and filters;
- get trace orders spans consistently;
- get actions excludes non-action spans;
- payload status does not return raw payload;
- dashboard URL joins `/traces` and `/traces/{traceId}` correctly;
- missing configuration produces a safe error message with no secret values;
- package builds with TypeScript.

Integration tests can use the existing `agentrail_test` database pattern, but pure handler tests should use in-memory repositories so the MCP package stays fast to test.

## Documentation

Update README or add `docs/operations/mcp.md` with:

- what MCP enables;
- what it does not do;
- Codex config snippet;
- demo-mode quickstart;
- local database quickstart;
- warning that this is read-only inspection, not Codex/Claude instrumentation.

## Success criteria

- A developer can run a local AgentRail MCP server over stdio.
- Codex can call tools that list traces, inspect one trace, inspect actions, check payload availability, and return dashboard links.
- No mutation capability is introduced.
- No raw evidence payload is returned through MCP.
- The dashboard and landing continue to represent AgentRail as a forensic recorder, not a generic chat or automation platform.
- The implementation remains suitable for an AWS Activate-style review because it demonstrates a real developer workflow integration without making false traction or funding claims.
