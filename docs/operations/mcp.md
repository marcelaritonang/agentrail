# AgentRail MCP

`@agentrail-sdk/mcp` connects AgentRail to MCP-capable developer tools such as Codex and Claude. The default profile is context-first: your AI should call `agentrail_prepare_context` before a coding task so it receives a bounded local Context Pack instead of reading the whole repository blindly.

Login is optional. The Context profile works offline, writes memory and receipts under `.agentrail/`, and does not upload source text, prompts, file paths, patches, environment values, or secrets by default. The forensic trace reader remains available as an additional profile when you want Codex to inspect AgentRail trace metadata.

## NPM status

The MCP Context profile 0.1.3 is published on npm as `@agentrail-sdk/mcp@0.1.3`. The unscoped npm command `npm install agentrail` is not this project.

Use this command for the default local Context profile:

```bash
npx -y @agentrail-sdk/mcp
```

This default exposes the Context Relay tools. You can also make the profile explicit:

```bash
npx -y @agentrail-sdk/mcp --profile context
```

Use the read-only MCP forensic trace reader only when you want trace inspection:

```bash
npx -y @agentrail-sdk/mcp --profile forensics
```

Use the source-checkout quickstarts below when you are developing AgentRail itself or running the full local stack.

## What it enables

### Default Context profile

| Tool                        | Purpose                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| `agentrail_prepare_context` | Create a bounded local Context Pack before a coding task.        |
| `agentrail_recall`          | Recall local project memory records.                             |
| `agentrail_remember`        | Save a local project memory record.                              |
| `agentrail_report_outcome`  | Record whether a Context Pack helped, missed, or needed changes. |

`agentrail_prepare_context` returns:

- `packId`
- selected local context chunks with relative paths only
- `decisions` from local project memory
- `warnings`
- `measurement` with estimated token counts
- `localEvidence.memory.path`, normally `.agentrail/memory/v1.jsonl`
- `localEvidence.receipt.path`, normally `.agentrail/receipts/v1/<packId>.json`
- `receiptUrl: null` unless a future explicit evidence-sync mode is enabled

The token fields are estimates, not billing records:

```json
{
  "candidateTokensEstimate": 12000,
  "returnedTokensEstimate": 3000,
  "contextReductionEstimate": 75,
  "method": "heuristic-v1",
  "confidence": "estimated"
}
```

### Optional Forensics profile

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
```

For read-only forensic trace inspection, use:

```toml
[mcp_servers.agentrail_forensics]
command = "npx"
args = ["-y", "@agentrail-sdk/mcp", "--profile", "forensics"]
env = { AGENTRAIL_DEMO_MODE = "1", AGENTRAIL_DASHBOARD_URL = "http://127.0.0.1:3000" }
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

| Tool                        | Purpose                                         |
| --------------------------- | ----------------------------------------------- |
| `agentrail_prepare_context` | Create a bounded local Context Pack for a task. |
| `agentrail_recall`          | Recall local project memory records.            |
| `agentrail_remember`        | Save a local project memory record.             |
| `agentrail_report_outcome`  | Record whether a Context Pack helped or missed. |

## Privacy notes

The MCP server returns trace metadata, span metadata, cost status, and payload availability. It intentionally does not send recorded input/output content into Codex chat. Use `agentrail_open_dashboard` to inspect evidence through the dashboard backend when needed.

Do not paste production database URLs, API keys, S3 credentials, or object-store URLs into public prompts or shared Codex tasks.
