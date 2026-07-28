# AgentRail MCP

`@agentrail-sdk/mcp` exposes AgentRail traces to MCP-capable developer tools such as Codex. It is a local, read-only MCP server over stdio.

The goal is simple: while working in Codex, a developer can ask for recent AgentRail runs, inspect one run, review action/tool spans, check whether recorded data exists, and get a dashboard link for deeper forensic review.

## NPM status

The unscoped npm command `npm install agentrail` is not this project. The scoped MCP package is publish-ready, but not live on the public registry until npm authentication and scope ownership are configured.

The intended npm command for the published MCP server is:

```bash
npx @agentrail-sdk/mcp
```

Treat this as a release target until `npm view @agentrail-sdk/mcp` resolves to this repository. Use the source-checkout quickstarts below until then.

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
command = "pnpm"
args = ["--dir", "/absolute/path/to/agentrail", "--filter", "@agentrail-sdk/mcp", "start"]
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

## Privacy notes

The MCP server returns trace metadata, span metadata, cost status, and payload availability. It intentionally does not send recorded input/output content into Codex chat. Use `agentrail_open_dashboard` to inspect evidence through the dashboard backend when needed.

Do not paste production database URLs, API keys, S3 credentials, or object-store URLs into public prompts or shared Codex tasks.
