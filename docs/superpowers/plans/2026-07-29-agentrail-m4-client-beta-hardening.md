# AgentRail M4 Client and Beta Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` task-by-task. Use
> `design-taste-frontend` only for public landing/docs changes in Task 10.
> Use `superpowers:systematic-debugging` for compatibility failures and
> `superpowers:verification-before-completion` at the final gate.

**Goal:** Expand tested support to Cursor, VS Code, and Gemini CLI; prove
context quality and performance across a fixed benchmark; add privacy export,
retention, and deletion; harden accessibility/mobile/operations; and run a
measurable founding-user beta without fabricating traction.

**Architecture:** New clients are adapters over the same local stdio MCP and
Context Relay contracts. Each adapter owns one documented project config shape,
backup, merge, conflict detection, Doctor check, and uninstall path. Benchmark
and product SLOs gate advertising. Privacy operations are asynchronous,
project-scoped jobs. Beta operations reuse private analytics definitions and
keep public counters disabled.

**Tech Stack:** Existing M0–M3 stack plus official Cursor `.cursor/mcp.json`,
VS Code `.vscode/mcp.json`, Gemini CLI `.gemini/settings.json`, Node benchmark
harness, PostgreSQL job state, SQS/worker cleanup jobs, Playwright, axe, and
production Web Vitals/Lighthouse checks.

## Global Constraints

- M0–M3 must be green.
- Client configuration references are verified against official docs and
  recorded with a verification date before implementation.
- Advertising requires passing clean, merge, duplicate, malformed, rollback,
  uninstall, Windows-path, and POSIX-path fixtures.
- Do not change the four default Context Relay tool names or semantics.
- Do not enable client auto-approval/trust. The user reviews and approves the
  local MCP server according to the client.
- Do not write credentials into client config.
- Do not advertise VS Code sandboxing on Windows; official docs state it is not
  available there.
- Gemini server alias is `agentrail`, with no underscore.
- Context quality claims require fixed benchmark evidence and explicit
  estimated/measured labels.
- Export and deletion require authentication, recent confirmation, project
  ownership, audit events, and bounded jobs.
- Deletion revokes credentials immediately, provides a seven-day cancellation
  window, then removes project-scoped rows and blobs.
- Public usage counters remain disabled unless real data is sufficient,
  verified, and explicitly approved.
- Do not commit tester identity, repository contents, interview recordings,
  credentials, or private analytics exports.
- Every task uses TDD and a focused commit.
- Every **Verify RED** command must fail on a newly added behavioral assertion
  because the named production behavior is absent. Client installation,
  environment, dependency, or service failures are not acceptable RED states.

## Official Client Configuration Baseline

| Client     | Project file            | Server map key | M4 behavior                                             |
| ---------- | ----------------------- | -------------- | ------------------------------------------------------- |
| Cursor     | `.cursor/mcp.json`      | `mcpServers`   | Merge owned `agentrail` stdio entry                     |
| VS Code    | `.vscode/mcp.json`      | `servers`      | Merge owned `agentrail` stdio entry; user trust remains |
| Gemini CLI | `.gemini/settings.json` | `mcpServers`   | Merge entry and allowlist four Context Relay tools      |

The compatibility document records the official source URL, page title, last
verified date, tested client version, and fixture result for every row.

---

### Task 1: Add Versioned Client Adapter Contracts and Compatibility Evidence

**Files:**

- Create: `packages/cli/src/clients/types.ts`
- Create: `packages/cli/src/clients/json-adapter.ts`
- Create: `packages/cli/src/clients/json-adapter.test.ts`
- Create: `docs/compatibility/client-matrix.md`
- Create: `docs/compatibility/verification-log.md`
- Modify: `packages/cli/src/types.ts`
- Modify: `packages/cli/src/commands/doctor.ts`
- Modify: `tests/docs/documentation.test.ts`

**Interfaces:**

```ts
export type SupportedClient =
  "codex" | "claude" | "cursor" | "vscode" | "gemini";

export type ClientCompatibilityRecord = {
  client: SupportedClient;
  testedVersion: string;
  configPath: string;
  officialSource: string;
  verifiedAt: string;
  fixtureStatus: "passing" | "failing" | "not_run";
};

export function mergeOwnedJsonServer(input: {
  source: string | null;
  mapKey: "mcpServers" | "servers";
  ownedEntry: Record<string, unknown>;
}): {
  status: "installed" | "already_configured";
  output: string;
  previousOwnedEntry: unknown | null;
};
```

- [ ] **Step 1: Write failing generic JSON adapter tests**

Test:

- absent file;
- unrelated top-level data;
- unrelated servers;
- managed AgentRail exact entry;
- unmanaged conflict;
- malformed JSON;
- map is array/string/null;
- setup twice;
- stable formatting/trailing newline;
- uninstall removes only owned entry;
- JSON values containing Windows/POSIX paths and spaces;
- prototype-pollution keys are rejected.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/cli/src/clients/json-adapter.test.ts tests/docs/documentation.test.ts
```

- [ ] **Step 3: Implement shared safe merge**

Never merge `__proto__`, `prototype`, or `constructor`. Parse into plain data,
validate the map as a plain object, compare the owned entry structurally, and
use the existing atomic backup/replace boundary.

Compatibility evidence uses exact official URLs:

- `https://docs.cursor.com/context/model-context-protocol`;
- `https://code.visualstudio.com/docs/agent-customization/mcp-servers`;
- `https://code.visualstudio.com/docs/agents/reference/mcp-configuration`;
- `https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md`.

Do not mark a fixture `passing` until the relevant later task is green.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/cli/src/clients/json-adapter.test.ts tests/docs/documentation.test.ts
rtk tsc -p packages/cli/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add packages/cli/src/clients/types.ts packages/cli/src/clients/json-adapter.ts packages/cli/src/clients/json-adapter.test.ts packages/cli/src/types.ts packages/cli/src/commands/doctor.ts docs/compatibility/client-matrix.md docs/compatibility/verification-log.md tests/docs/documentation.test.ts
rtk git commit -m "feat(cli): version client compatibility contracts"
```

---

### Task 2: Implement and Prove the Cursor Adapter

**Files:**

- Create: `packages/cli/src/clients/cursor.ts`
- Create: `packages/cli/src/clients/cursor.test.ts`
- Create: `tests/fixtures/client-configs/cursor/empty.json`
- Create: `tests/fixtures/client-configs/cursor/existing.json`
- Create: `tests/fixtures/client-configs/cursor/malformed.json`
- Modify: `packages/cli/src/commands/setup.ts`
- Modify: `packages/cli/src/commands/uninstall.ts`
- Modify: `packages/cli/src/args.ts`
- Modify: `docs/compatibility/client-matrix.md`

**Interfaces:**

```json
{
  "mcpServers": {
    "agentrail": {
      "command": "npx",
      "args": ["-y", "@agentrail-sdk/mcp", "--profile", "context"],
      "env": {
        "AGENTRAIL_WORKSPACE_ROOT": "/absolute/local/root",
        "AGENTRAIL_PRIVACY_MODE": "local-only",
        "AGENTRAIL_CLIENT": "cursor"
      }
    }
  }
}
```

- [ ] **Step 1: Write failing adapter matrix**

Reuse all generic cases and add:

- default project path `.cursor/mcp.json`;
- exact `mcpServers` key;
- no `autoApprove`, `trust`, or credential field;
- Context Relay tools discoverable through real MCP initialize;
- uninstall keeps other Cursor servers;
- Doctor tells user to review/enable the server in Cursor.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/cli/src/clients/cursor.test.ts
```

- [ ] **Step 3: Implement, verify, and record version**

Run the installed Cursor version command when available and record actual
version/date. If Cursor cannot run in CI, the config fixture and MCP protocol
test run in CI and one manual client-start verification is required before
changing matrix status to `passing`.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/cli/src/clients/cursor.test.ts tests/e2e-cli/context-relay.e2e.test.ts
rtk tsc -p packages/cli/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add packages/cli/src/clients/cursor.ts packages/cli/src/clients/cursor.test.ts tests/fixtures/client-configs/cursor packages/cli/src/commands/setup.ts packages/cli/src/commands/uninstall.ts packages/cli/src/args.ts docs/compatibility/client-matrix.md
rtk git commit -m "feat(cli): install Context Relay in Cursor"
```

---

### Task 3: Implement and Prove the VS Code Adapter

**Files:**

- Create: `packages/cli/src/clients/vscode.ts`
- Create: `packages/cli/src/clients/vscode.test.ts`
- Create: `tests/fixtures/client-configs/vscode/empty.json`
- Create: `tests/fixtures/client-configs/vscode/existing.json`
- Create: `tests/fixtures/client-configs/vscode/with-inputs-and-sandbox.json`
- Modify: `packages/cli/src/commands/setup.ts`
- Modify: `packages/cli/src/commands/uninstall.ts`
- Modify: `packages/cli/src/args.ts`
- Modify: `docs/compatibility/client-matrix.md`

**Interfaces:**

```json
{
  "servers": {
    "agentrail": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@agentrail-sdk/mcp", "--profile", "context"],
      "env": {
        "AGENTRAIL_WORKSPACE_ROOT": "${workspaceFolder}",
        "AGENTRAIL_PRIVACY_MODE": "local-only",
        "AGENTRAIL_CLIENT": "vscode"
      }
    }
  }
}
```

- [ ] **Step 1: Write failing VS Code-specific tests**

Prove:

- default `.vscode/mcp.json`;
- exact `servers` key;
- preserves `inputs` and `sandbox`;
- no secret value in config;
- no `sandboxEnabled` is silently added;
- Windows docs do not claim sandbox availability;
- user trust/approval remains required;
- unrelated servers remain after uninstall;
- `${workspaceFolder}` remains literal and is not shell-expanded during setup.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/cli/src/clients/vscode.test.ts
```

- [ ] **Step 3: Implement and manually validate trust flow**

Doctor checks file shape and MCP process directly, then instructs the user to
open MCP Servers in VS Code and approve the local server. It never claims that
the trust prompt was accepted.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/cli/src/clients/vscode.test.ts tests/e2e-cli/context-relay.e2e.test.ts
rtk tsc -p packages/cli/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add packages/cli/src/clients/vscode.ts packages/cli/src/clients/vscode.test.ts tests/fixtures/client-configs/vscode packages/cli/src/commands/setup.ts packages/cli/src/commands/uninstall.ts packages/cli/src/args.ts docs/compatibility/client-matrix.md
rtk git commit -m "feat(cli): install Context Relay in VS Code"
```

---

### Task 4: Implement and Prove the Gemini CLI Adapter

**Files:**

- Create: `packages/cli/src/clients/gemini.ts`
- Create: `packages/cli/src/clients/gemini.test.ts`
- Create: `tests/fixtures/client-configs/gemini/empty.json`
- Create: `tests/fixtures/client-configs/gemini/existing.json`
- Create: `tests/fixtures/client-configs/gemini/policy.json`
- Modify: `packages/cli/src/commands/setup.ts`
- Modify: `packages/cli/src/commands/uninstall.ts`
- Modify: `packages/cli/src/args.ts`
- Modify: `docs/compatibility/client-matrix.md`

**Interfaces:**

```json
{
  "mcpServers": {
    "agentrail": {
      "command": "npx",
      "args": ["-y", "@agentrail-sdk/mcp", "--profile", "context"],
      "cwd": "/absolute/local/root",
      "env": {
        "AGENTRAIL_WORKSPACE_ROOT": "/absolute/local/root",
        "AGENTRAIL_PRIVACY_MODE": "local-only",
        "AGENTRAIL_CLIENT": "gemini"
      },
      "includeTools": [
        "agentrail_prepare_context",
        "agentrail_recall",
        "agentrail_remember",
        "agentrail_report_outcome"
      ]
    }
  }
}
```

- [ ] **Step 1: Write failing Gemini-specific tests**

Prove:

- default `.gemini/settings.json`;
- exact `mcpServers` key;
- alias contains no underscore;
- exact four-tool allowlist;
- no `trust: true`;
- existing admin MCP policy is preserved;
- Doctor detects admin policy disabling MCP and reports it without mutation;
- unrelated settings remain;
- uninstall removes only owned entry.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/cli/src/clients/gemini.test.ts
```

- [ ] **Step 3: Implement and validate actual CLI discovery**

Where Gemini CLI is installed, use its noninteractive diagnostics or logs to
prove the `agentrail` server initializes and four tools are visible. CI still
runs direct MCP protocol and config fixtures. Record the exact tested Gemini
version.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/cli/src/clients/gemini.test.ts tests/e2e-cli/context-relay.e2e.test.ts
rtk tsc -p packages/cli/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add packages/cli/src/clients/gemini.ts packages/cli/src/clients/gemini.test.ts tests/fixtures/client-configs/gemini packages/cli/src/commands/setup.ts packages/cli/src/commands/uninstall.ts packages/cli/src/args.ts docs/compatibility/client-matrix.md
rtk git commit -m "feat(cli): install Context Relay in Gemini CLI"
```

---

### Task 5: Run the Full Five-Client Setup, Upgrade, and Rollback Matrix

**Files:**

- Create: `tests/e2e-cli/client-matrix.e2e.test.ts`
- Create: `tests/e2e-cli/upgrade-rollback.e2e.test.ts`
- Modify: `packages/cli/src/commands/setup.ts`
- Modify: `packages/cli/src/commands/uninstall.ts`
- Modify: `packages/cli/src/commands/doctor.ts`
- Modify: `docs/compatibility/client-matrix.md`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Matrix: Codex, Claude, Cursor, VS Code, Gemini × Windows/POSIX path fixtures ×
  clean/existing/managed/conflict/malformed/setup-twice/uninstall.

- [ ] **Step 1: Write failing table-driven E2E**

For each client:

1. start with unrelated config;
2. setup;
3. parse/validate final config;
4. initialize real packed MCP;
5. list expected context tools;
6. run setup again;
7. simulate prior AgentRail version and upgrade;
8. simulate failure after backup and prove rollback;
9. uninstall;
10. compare unrelated configuration semantically and owned block absence.

No case may read or mutate the real user home.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run tests/e2e-cli/client-matrix.e2e.test.ts tests/e2e-cli/upgrade-rollback.e2e.test.ts
```

- [ ] **Step 3: Fix adapters, not expectations**

If a client format differs, update its isolated adapter and official evidence.
Do not weaken shared backup, conflict, or uninstall requirements.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run tests/e2e-cli
rtk pnpm test:npm:tarball
```

Commit:

```powershell
rtk git add tests/e2e-cli/client-matrix.e2e.test.ts tests/e2e-cli/upgrade-rollback.e2e.test.ts packages/cli/src/commands/setup.ts packages/cli/src/commands/uninstall.ts packages/cli/src/commands/doctor.ts docs/compatibility/client-matrix.md .github/workflows/ci.yml
rtk git commit -m "test(cli): prove five-client lifecycle"
```

---

### Task 6: Build a Reproducible 30-Task Context Quality Benchmark

**Files:**

- Create: `benchmarks/context/manifest.schema.ts`
- Create: `benchmarks/context/tasks.json`
- Create: `benchmarks/context/run.ts`
- Create: `benchmarks/context/report.ts`
- Create: `benchmarks/context/run.test.ts`
- Create: `benchmarks/context/fixtures/typescript-auth/`
- Create: `benchmarks/context/fixtures/api-worker/`
- Create: `benchmarks/context/fixtures/frontend-dashboard/`
- Create: `benchmarks/context/fixtures/mixed-monorepo/`
- Create: `docs/benchmarks/context-relay.md`
- Modify: `packages/context/package.json`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

```ts
export type BenchmarkTask = {
  id: string;
  fixture: string;
  task: string;
  tokenBudget: number;
  requiredPaths: readonly string[];
  relevantPaths: readonly string[];
  forbiddenPaths: readonly string[];
};

export type BenchmarkResult = {
  requiredFileRecall: number;
  returnedTokensEstimate: number;
  candidateTokensEstimate: number;
  secretLeaks: readonly string[];
  latencyMs: number;
  status: "ready" | "partial" | "empty";
};
```

- [ ] **Step 1: Write failing manifest and metric tests**

Require:

- exactly 30 unique task IDs;
- at least four fixtures;
- at least one required path per task;
- no required path is forbidden;
- fixture paths exist;
- deterministic result across repeated warm runs;
- required-file recall formula is exact;
- secret fixture values are detected;
- p50/p95 calculation is correct;
- output labels token reduction as estimated;
- report cannot print a public pass claim if any release gate fails.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run benchmarks/context/run.test.ts
```

- [ ] **Step 3: Implement offline benchmark**

Default benchmark never calls an LLM. It measures source recall, context size,
leakage, and latency. A separate optional fixed-model evaluation accepts a
provider command through explicit configuration, stores model/settings, and
compares task success; it is not required for local CI and never uploads fixture
content without operator approval.

Release gates:

- required-file recall ≥ 90%;
- zero fixture-secret leakage;
- median returned estimate below candidate estimate;
- warm p95 < 1.5 seconds;
- cold full/labeled-partial within 5 seconds.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run benchmarks/context/run.test.ts
rtk pnpm benchmark:context
```

Commit:

```powershell
rtk git add benchmarks/context docs/benchmarks/context-relay.md packages/context/package.json package.json .github/workflows/ci.yml
rtk git commit -m "bench(context): gate Context Relay quality"
```

---

### Task 7: Add Authenticated Export, Retention, and Deletion Jobs

**Files:**

- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/migrations/0003_privacy_jobs.sql`
- Modify: `packages/db/migrations/meta/_journal.json`
- Create: `packages/db/src/privacy-repository.ts`
- Create: `packages/db/src/privacy-repository.integration.test.ts`
- Create: `apps/web/app/api/privacy/export/route.ts`
- Create: `apps/web/app/api/privacy/deletion/route.ts`
- Create: `apps/web/app/api/privacy/deletion/cancel/route.ts`
- Create: `apps/web/app/api/privacy/retention/route.ts`
- Create: `apps/web/tests/privacy-routes.test.ts`
- Create: `apps/worker/src/process-privacy-job.ts`
- Create: `apps/worker/src/process-privacy-job.integration.test.ts`
- Modify: `apps/web/app/(product)/dashboard/settings/privacy/page.tsx`
- Modify: `apps/web/components/product/privacy-inventory.tsx`
- Create: `tests/e2e/privacy-operations.spec.ts`

**Interfaces:**

```ts
export type PrivacyJob =
  | { type: "export"; projectId: string; requestedBy: string }
  | {
      type: "delete_project";
      projectId: string;
      requestedBy: string;
      executeAfter: string;
    }
  | { type: "enforce_retention"; projectId: string; cutoff: string };
```

- [ ] **Step 1: Write failing high-risk operation tests**

Prove:

- recent authenticated session and exact project confirmation required;
- cross-project request is generic 404;
- export contains manifest, safe project settings, installations without
  digests, memories, receipts, outcomes, traces, and evidence files;
- export contains no auth secret, credential digest, share digest, API key
  digest, or object-store credentials;
- export download is short-lived and project-scoped;
- deletion immediately revokes installation/API credentials;
- deletion enters seven-day pending state;
- cancellation before deadline restores hosted access only through a new
  credential, never old credentials;
- worker hard-deletes project rows and object prefixes after deadline;
- retry is idempotent;
- failure records bounded state and resumes;
- retention choices are exactly 30, 90, or 365 days;
- audit event records every request/cancel/complete.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/db/src/privacy-repository.integration.test.ts apps/web/tests/privacy-routes.test.ts apps/worker/src/process-privacy-job.integration.test.ts
rtk playwright test tests/e2e/privacy-operations.spec.ts
```

- [ ] **Step 3: Implement queued privacy operations**

Exports are encrypted private objects with a 24-hour backend-mediated download.
Deletion never runs inside the web request. The worker enumerates and deletes
only the exact project prefix after DB ownership checks. Auth user deletion is
separate from project deletion and is allowed only after all owned projects are
deleted.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/db/src/privacy-repository.integration.test.ts apps/web/tests/privacy-routes.test.ts apps/worker/src/process-privacy-job.integration.test.ts
rtk playwright test tests/e2e/privacy-operations.spec.ts
```

Commit:

```powershell
rtk git add packages/db/src/schema.ts packages/db/migrations/0003_privacy_jobs.sql packages/db/migrations/meta/_journal.json packages/db/src/privacy-repository.ts packages/db/src/privacy-repository.integration.test.ts apps/web/app/api/privacy apps/web/tests/privacy-routes.test.ts apps/worker/src/process-privacy-job.ts apps/worker/src/process-privacy-job.integration.test.ts "apps/web/app/(product)/dashboard/settings/privacy/page.tsx" apps/web/components/product/privacy-inventory.tsx tests/e2e/privacy-operations.spec.ts
rtk git commit -m "feat(privacy): export retain and delete project data"
```

---

### Task 8: Harden Accessibility, Mobile, Performance, and Failure States

**Files:**

- Modify: `apps/web/tests/design-contract.test.ts`
- Modify: `tests/e2e/dashboard-a11y.spec.ts`
- Create: `tests/e2e/product-a11y.spec.ts`
- Create: `tests/e2e/product-mobile.spec.ts`
- Create: `tests/e2e/product-failure-states.spec.ts`
- Create: `scripts/audit-web-vitals.ts`
- Create: `tests/smoke/web-vitals-contract.test.ts`
- Modify: `apps/web/app/globals.css`
- Modify only failing route/components identified by tests
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`

**Interfaces:**

- All data surfaces: loading, actionable empty, permission denied, offline or
  queued telemetry, partial index, stale client, service error, retry,
  read-only demo, authenticated live.

- [ ] **Step 1: Write failing cross-route tests**

Routes:

```text
/
/docs/quickstart
/activate
/dashboard
/dashboard/context-packs
/dashboard/memory
/dashboard/integrations
/dashboard/settings/privacy
/receipts/[fixture]
/traces
/traces/[fixture]
/admin/analytics
```

Checks:

- no serious/critical axe finding;
- one H1;
- named regions/navigation;
- logical tab order;
- visible focus;
- 44 px touch targets;
- 390 px and 768 px no horizontal overflow;
- tables have usable mobile representation;
- dialogs trap/restore focus and close on Escape;
- reduced motion;
- status not color-only;
- source content absent from initial receipt HTML;
- no large chart dependency;
- retry action changes state;
- error copy contains no secret/internal URL.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk playwright test tests/e2e/product-a11y.spec.ts tests/e2e/product-mobile.spec.ts tests/e2e/product-failure-states.spec.ts
rtk vitest run tests/smoke/web-vitals-contract.test.ts
```

- [ ] **Step 3: Fix only evidenced failures**

Preserve landing/dashboard design boundaries. Do not globally increase motion,
radius, shadow, or card count. Use server pagination and defer source content.

Production performance gate:

- LCP < 2.5 s;
- INP < 200 ms;
- CLS < 0.1.

The audit script records observed values and exits non-zero when the configured
production URL exceeds thresholds. It does not invent local measurements.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run apps/web/tests/design-contract.test.ts tests/smoke/web-vitals-contract.test.ts
rtk playwright test tests/e2e/dashboard-a11y.spec.ts tests/e2e/product-a11y.spec.ts tests/e2e/product-mobile.spec.ts tests/e2e/product-failure-states.spec.ts
rtk pnpm --filter @agentrail-sdk/web build
```

Stage only files changed to fix a proven failure:

```powershell
rtk git add apps/web tests/e2e scripts/audit-web-vitals.ts tests/smoke/web-vitals-contract.test.ts .github/workflows/ci.yml package.json
rtk git commit -m "fix(web): harden product accessibility and performance"
```

---

### Task 9: Add Beta Operations, Status, and Measurable Funnel

**Files:**

- Create: `apps/web/app/status/page.tsx`
- Create: `apps/web/lib/service-status.ts`
- Create: `apps/web/lib/service-status.test.ts`
- Create: `docs/operations/founding-beta.md`
- Create: `docs/operations/incident-response.md`
- Create: `docs/operations/support-triage.md`
- Create: `docs/operations/release-rollback.md`
- Create: `docs/community/beta-interview-scorecard.md`
- Modify: `apps/web/app/sitemap.ts`
- Modify: `docs/startup/evidence-register.md`
- Modify: `tests/docs/documentation.test.ts`
- Create: `tests/e2e/status.spec.ts`

**Interfaces:**

- Status page reports website, ingestion, queue freshness, worker freshness,
  and database health without exposing topology/secrets.
- Private funnel uses M2 definitions.

- [ ] **Step 1: Write failing status and operations tests**

Prove:

- public status uses bounded health response and timeout;
- degraded dependency yields `degraded`, not false `operational`;
- status reveals no host, database name, queue URL, stack trace, or secret;
- beta runbook targets 10 invited, 5 installed, 3 with >3 packs, 2 returning
  within 7 days, and 3 interviews;
- interview scorecard records context misses/uninstall reason;
- evidence register distinguishes invited, activated, active, and interviewed;
- public website does not display these counts.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run apps/web/lib/service-status.test.ts tests/docs/documentation.test.ts
rtk playwright test tests/e2e/status.spec.ts
```

- [ ] **Step 3: Implement operational loop**

Runbooks define:

- invite and consent;
- support response;
- privacy incident;
- queue backlog;
- credential compromise;
- package rollback;
- hosted outage with local-only guidance;
- interview schedule;
- weekly evidence review.

Do not store participant details in Git.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run apps/web/lib/service-status.test.ts tests/docs/documentation.test.ts
rtk playwright test tests/e2e/status.spec.ts
```

Commit:

```powershell
rtk git add apps/web/app/status/page.tsx apps/web/lib/service-status.ts apps/web/lib/service-status.test.ts docs/operations docs/community/beta-interview-scorecard.md apps/web/app/sitemap.ts docs/startup/evidence-register.md tests/docs/documentation.test.ts tests/e2e/status.spec.ts
rtk git commit -m "docs(beta): operationalize founding user validation"
```

---

### Task 10: Publish Only Verified Client Support and Final Release Evidence

**Files:**

- Create: `apps/web/app/docs/clients/cursor/page.tsx`
- Create: `apps/web/app/docs/clients/vscode/page.tsx`
- Create: `apps/web/app/docs/clients/gemini/page.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/docs/page.tsx`
- Modify: `apps/web/app/sitemap.ts`
- Modify: `apps/web/components/context-receipt-preview.tsx`
- Modify: `README.md`
- Modify: `docs/operations/mcp.md`
- Create: `docs/releases/context-relay-general-beta.md`
- Modify: `tests/docs/documentation.test.ts`
- Modify: `tests/e2e/landing.spec.ts`
- Modify: `scripts/verify-npm-release.ts`
- Modify: `.github/workflows/registry-smoke.yml`

**Interfaces:**

- Support matrix is generated from verified compatibility records.
- Primary setup can select clients:

```text
npx -y @agentrail-sdk/cli setup --client codex --client claude
npx -y @agentrail-sdk/cli setup --client cursor
npx -y @agentrail-sdk/cli setup --client vscode
npx -y @agentrail-sdk/cli setup --client gemini
```

- [ ] **Step 1: Invoke landing skill and write failing truth tests**

Use `design-taste-frontend` for landing/docs only with existing approved dials.

Tests reject a client page when its compatibility record is not `passing`.
They also reject:

- fake user/customer/logo counts;
- unverified savings;
- AWS acceptance/credit claim;
- public active-user counter;
- stale package version;
- command not covered by registry smoke;
- Cursor/VS Code/Gemini support without a passing fixture.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run tests/docs/documentation.test.ts
rtk playwright test tests/e2e/landing.spec.ts
```

- [ ] **Step 3: Implement restrained verified support**

Landing remains Context Relay first and shows a compact tested-client ledger,
not five logo cards. Quickstarts show exact config ownership, Doctor, privacy
mode, and uninstall. The real receipt preview remains synthetic-labeled unless
an explicitly approved anonymized real receipt is supplied.

- [ ] **Step 4: Verify GREEN with the complete release gate**

```powershell
rtk pnpm format:check
rtk pnpm typecheck
rtk pnpm test
rtk pnpm build
rtk pnpm test:e2e
rtk pnpm test:e2e:cli
rtk pnpm test:e2e:cloud
rtk pnpm benchmark:context
rtk pnpm test:npm:tarball
rtk pnpm test:npm:registry
rtk pnpm test:production
rtk pnpm audit:web-vitals
```

Expected: all commands exit `0`; benchmark meets gates; production performance
meets thresholds; every advertised client is passing.

- [ ] **Step 5: Publish, verify clean consumers, and commit**

Publish only reviewed versions through the existing secure npm authentication
process. Registry smoke installs the published CLI/MCP/context packages and
runs setup/initialize/tools/context/uninstall in a clean temporary home.

Commit:

```powershell
rtk git add apps/web/app/docs/clients apps/web/app/page.tsx apps/web/app/docs/page.tsx apps/web/app/sitemap.ts apps/web/components/context-receipt-preview.tsx README.md docs/operations/mcp.md docs/releases/context-relay-general-beta.md tests/docs/documentation.test.ts tests/e2e/landing.spec.ts scripts/verify-npm-release.ts .github/workflows/registry-smoke.yml
rtk git commit -m "chore(release): publish verified general beta support"
```

## M4 Final Verification and Beta Gate

Required evidence:

- five client fixture matrices green;
- at least one manual real-client start verification per advertised client;
- 30-task benchmark gates green;
- zero fixture-secret leakage;
- privacy export/deletion/retention integration green;
- cross-project/security tests green;
- accessibility/mobile/failure states green;
- production Web Vitals within thresholds;
- npm tarball and registry clean-user tests green;
- at least five real founding-user installations before describing a beta as
  active;
- no public counter or quote without explicit approval.

Use private founder analytics and structured interviews to decide whether to
continue deterministic ranking, tune weights, or design a separately
benchmarked semantic reranker. Do not add embeddings based only on anecdotal
requests.
