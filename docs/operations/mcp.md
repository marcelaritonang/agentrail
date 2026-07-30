# AgentRail MCP

`@agentrail-sdk/mcp` exposes AgentRail traces to MCP-capable developer tools such as Codex. It is a local, read-only MCP server over stdio.

The goal is simple: while working in Codex, a developer can ask for recent AgentRail runs, inspect one run, review action/tool spans, check whether recorded data exists, and get a dashboard link for deeper forensic review.

## NPM status

The scoped MCP package is published on npm as `@agentrail-sdk/mcp@0.1.2`. The unscoped npm command `npm install agentrail` is not this project.

Use this command for the local read-only MCP server:

```bash
npx -y @agentrail-sdk/mcp
```

MCP Context profile 0.1.2 is published on npm and wired to the local Context Relay tools. Start it with:

```bash
npx -y @agentrail-sdk/mcp --profile context
```

Use the source-checkout quickstarts below when you are developing AgentRail itself or running the full local stack.

## What it enables

| Tool                           | Purpose                                                                  |
| ------------------------------ | ------------------------------------------------------------------------ |
| `agentrail_list_traces`        | List recent traces for the configured project.                           |
| `agentrail_get_trace`          | Inspect one trace with ordered spans and payload availability metadata.  |
| `agentrail_get_actions`        | Show only action and tool spans for one trace.                           |
| `agentrail_get_payload_status` | Check whether a span has recorded data without returning the payload.    |
| `agentrail_open_dashboard`     | Return `/traces` or `/traces/{traceId}` dashboard links when configured. |

## What it does not do

- It does not automatically record Codex or Claude activity.
- It does not instrument third-party chat apps.
- It does not return raw evidence payloads to MCP clients.
- It does not rerun, retry, delete, export, share, approve, roll back, or mutate workflows.
- It does not add accounts, teams, billing, RBAC, OAuth, or a public multi-tenant service.

Raw evidence remains behind the AgentRail dashboard backend and Evidence Drawer.

## Demo-mode quickstart

Build the package:

```bash
pnpm --filter @agentrail-sdk/mcp build
```

Run the MCP server against the synthetic sample:

```bash
AGENTRAIL_DEMO_MODE=1 \
AGENTRAIL_DASHBOARD_URL=http://127.0.0.1:3000 \
pnpm --filter @agentrail-sdk/mcp start
```

In PowerShell:

```powershell
$env:AGENTRAIL_DEMO_MODE = "1"
$env:AGENTRAIL_DASHBOARD_URL = "http://127.0.0.1:3000"
pnpm --filter @agentrail-sdk/mcp start
```

## Database-mode quickstart

Start local AgentRail services and seed the sample:

```bash
docker compose up -d --build
pnpm bootstrap:local
pnpm --filter @agentrail-sdk/mcp build
```

Run the MCP server against PostgreSQL:

```bash
DATABASE_URL=postgresql://agentrail:agentrail@localhost:5433/agentrail_test \
AGENTRAIL_PROJECT_ID=00000000-0000-4000-8000-000000000101 \
AGENTRAIL_DASHBOARD_URL=http://127.0.0.1:3000 \
pnpm --filter @agentrail-sdk/mcp start
```

## Codex config example

Add a local MCP server entry to your Codex configuration:

```toml
[mcp_servers.agentrail]
command = "npx"
args = ["-y", "@agentrail-sdk/mcp"]
env = {
  DATABASE_URL = "postgresql://agentrail:agentrail@localhost:5433/agentrail_test",
  AGENTRAIL_PROJECT_ID = "00000000-0000-4000-8000-000000000101",
  AGENTRAIL_DASHBOARD_URL = "http://127.0.0.1:3000"
}
```

For demo mode, replace the database variables with:

```toml
env = {
  AGENTRAIL_DEMO_MODE = "1",
  AGENTRAIL_DASHBOARD_URL = "http://127.0.0.1:3000"
}
```

Keep this server local unless you have reviewed authentication, network exposure, and data-handling requirements for your own environment.

## Context profile development from source

When developing AgentRail itself, build the context and MCP packages and start the context profile locally:

```bash
pnpm --filter @agentrail-sdk/context build
pnpm --filter @agentrail-sdk/mcp build
pnpm --filter @agentrail-sdk/mcp start -- --profile context
```

The default Context Relay profile exposes four tools:

| Tool                           | Purpose                                               |
| ------------------------------ | ----------------------------------------------------- |
| `agentrail_prepare_context`    | Create a bounded local Context Pack for a task.       |
| `agentrail_recall`             | Recall local project memory records.                  |
| `agentrail_remember`           | Save a local project memory record.                   |
| `agentrail_report_outcome`     | Record whether a Context Pack helped or missed.       |

## Privacy notes

The MCP server returns trace metadata, span metadata, cost status, and payload availability. It intentionally does not send recorded input/output content into Codex chat. Use `agentrail_open_dashboard` to inspect evidence through the dashboard backend when needed.

Do not paste production database URLs, API keys, S3 credentials, or object-store URLs into public prompts or shared Codex tasks.
