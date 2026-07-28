# AgentRail M1.1 Guided Forensics UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic plain-language investigation layer to AgentRail so first-time and technical-adjacent users can understand recorded agent runs while developers retain the complete forensic evidence.

**Architecture:** Keep the canonical ingestion, worker, database, pricing, and evidence boundaries unchanged. Expose the already-persisted root span identifier in the web read model, map trace data through a pure presentation module, compose the new hierarchy in Next.js Server Components, and keep the recorded-data drawer as the only focused client island.

**Tech Stack:** Node.js 24, pnpm 11, Next.js 16.2, React 19, TypeScript 5.9, Tailwind CSS 4 base CSS, Instrument Sans, JetBrains Mono, `@phosphor-icons/react`, Vitest 4, Testing Library, Playwright 1.61, `@axe-core/playwright` 4.12, PostgreSQL, Drizzle ORM.

## Global Constraints

- The approved specification is `docs/superpowers/specs/2026-07-23-agentrail-m1-1-guided-forensics-ux-design.md`.
- AgentRail remains an observability and forensic recorder for teams that build AI agents; it does not become a consumer workflow runner.
- Use the principle `Human-readable summary first; forensic evidence second.`
- Do not add database migrations, authentication, workflow execution, mutation APIs, hosted public ingestion, billing, teams, sharing, deletion, export, rerun, or duplication.
- Do not invent purpose, causality, final output, live state, customer traction, AWS deployment, or program acceptance.
- Summary copy is deterministic and uses persisted fields only; no LLM-generated summary is allowed.
- `stepCount` excludes the root trace span only when `rootSpanId` is present; `technicalSpanCount` remains the persisted `spanCount`.
- `completion_state = null` never renders `Running`, `Pending`, or `Live`.
- Timed-out traces render `Incomplete recording` and use `TRACE_INCOMPLETE_AFTER_MS` from `@agentrail-sdk/config`.
- Unknown model pricing renders `Price unavailable` with technical state `UNPRICED`, never `$0.00`.
- A span with `hasPayload = false` renders non-interactive `Metadata only`; it never opens the recorded-data drawer.
- Payload content continues to travel only through the project-scoped Next.js backend route; no browser object-store access is introduced.
- `NEXT_PUBLIC_AGENTRAIL_SOURCE_URL` is optional, absolute, HTTPS-only, and frozen at Next.js build time. Changing it requires a rebuild and redeploy.
- When the source URL is absent, all source controls are omitted. Neither a missing repository URL nor generic `https://github.com` is a fallback.
- Preserve the graphite, warm-white, amber, cyan, violet, and red AgentRail dashboard identity.
- Preserve Instrument Sans and JetBrains Mono, small radii, 1 px separators, nearly no shadows, and Phosphor as the only icon family.
- Body and explanatory text is at least 14 px, interactive labels at least 13 px, and metadata/technical identifiers at least 11 px.
- Base styles are mobile-first; desktop layout begins at 1024 px.
- Use visible helper text, not tooltip-only instructions.
- Do not introduce gradients, glassmorphism, glow, decorative blobs, generic card grids, hover scaling, `transition-all`, or decorative looping animation.
- Every changed behavior follows red-green TDD and every task ends with a focused verification and commit.
- Run all shell commands through `rtk` as required by `AGENTS.md`. RTK was not available during plan authoring, so execution must first make the prescribed `rtk` command available on `PATH` or report that environment blocker before running task commands.
- Use Node.js 24. The desktop shell previously defaulted to Node.js 20; execution must verify `node --version` before installing, testing, or building.
- Preserve the pre-existing unstaged ownership of `apps/web/next-env.d.ts` and the three screenshot artifacts. Do not stage `apps/web/next-env.d.ts`. Regenerate screenshot artifacts only in Task 9.

## File Structure

```text
apps/web/lib/trace-read-model.ts                     root-aware project-scoped trace reads
apps/web/lib/trace-presentation.ts                   pure plain-language run and step projection
apps/web/lib/source-url.ts                           public source URL validation and quickstart link
apps/web/components/read-only-example.tsx            persistent demo indicator and orientation banner
apps/web/components/run-orientation.tsx              three-step index guidance
apps/web/components/trace-table.tsx                  desktop/mobile agent-run ledger
apps/web/components/trace-header.tsx                 factual detail summary and at-a-glance facts
apps/web/components/what-happened.tsx                readable root boundary and operational sequence
apps/web/components/recorded-data-action.tsx         payload-aware link or Metadata only state
apps/web/components/trace-rail.tsx                   technical timeline wrapper
apps/web/components/span-row.tsx                     non-dead-end forensic span row
apps/web/components/action-ledger.tsx                 external-action projection
apps/web/components/evidence-drawer.tsx              recorded-data client island
apps/web/components/evidence-content.tsx             payload state copy
apps/web/app/(dashboard)/layout.tsx                  agent-run navigation and source control
apps/web/app/(dashboard)/traces/                     index composition and states
apps/web/app/(dashboard)/traces/[traceId]/            detail composition and states
apps/web/app/page.tsx                                 verified product landing and source-first setup
apps/web/app/globals.css                              M1.1 hierarchy, readability, and responsive rules
apps/web/tests/                                      pure and component contracts
tests/e2e/                                           desktop/mobile user flows and accessibility
tests/docs/documentation.test.ts                     public documentation consistency
README.md                                            current product status and read-only demo disclosure
.env.example                                         optional public source and demo configuration
artifacts/screenshots/                               verified final visual evidence
```

The implementation adds no new database table, migration, public API route,
client data store, or component library.

---

### Task 1: Root-Aware, Truthfully Searchable Trace Reads

**Files:**

- Modify: `apps/web/lib/trace-read-model.ts`
- Modify: `apps/web/lib/trace-read-model.integration.test.ts`
- Modify: `apps/web/lib/demo-read-model.ts`
- Modify: `apps/web/lib/demo-read-model.test.ts`
- Modify: `packages/db/src/span-repository.ts`

**Interfaces:**

- Consumes: persisted `traces.root_span_id`, trace name, trace ID, project scope, outcome, and agent filters.
- Produces: `TraceListItem.rootSpanId: string | null` and project-scoped search by trace name or trace ID.

- [ ] **Step 1: Write failing read-model tests**

Add these assertions to the existing tests:

```ts
expect(page.items[0]).toMatchObject({
  traceId: DEMO_TRACE_ID,
  rootSpanId: DEMO_ROOT_SPAN_ID,
  spanCount: 4,
});

await expect(
  model.listTraces({
    projectId: PROJECT_A,
    page: 1,
    query: TRACE_A.slice(0, 12),
  }),
).resolves.toMatchObject({
  total: 1,
  items: [expect.objectContaining({ traceId: TRACE_A })],
});

await expect(
  model.listTraces({
    projectId: PROJECT_B,
    page: 1,
    query: TRACE_A,
  }),
).resolves.toMatchObject({ total: 0, items: [] });
```

Update the demo actor-filter test so `actor` matches only `agentId`; requester
matching is not advertised because the production repository does not provide
it.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
rtk vitest run apps/web/lib/demo-read-model.test.ts apps/web/lib/trace-read-model.integration.test.ts
```

Expected: FAIL because `TraceListItem` omits `rootSpanId` and production search
does not include trace ID.

- [ ] **Step 3: Expose the persisted root identifier**

Change the public list type and mapper:

```ts
export type TraceListItem = {
  traceId: string;
  rootSpanId: string | null;
  name: string;
  agentId: string;
  onBehalfOf: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  outcome: SpanOutcome | null;
  completionState: TraceCompletionState | null;
  totalCostUsd: string | null;
  pricingUnknown: boolean;
  spanCount: number;
};

function traceItem(trace: StoredTrace): TraceListItem {
  return {
    traceId: trace.traceId,
    rootSpanId: trace.rootSpanId,
    name: trace.name,
    agentId: trace.agentId,
    onBehalfOf: trace.onBehalfOf,
    startedAt: trace.startedAt.toISOString(),
    endedAt: trace.endedAt?.toISOString() ?? null,
    durationMs:
      trace.endedAt === null
        ? null
        : trace.endedAt.getTime() - trace.startedAt.getTime(),
    outcome: trace.outcome,
    completionState: trace.completionState,
    totalCostUsd: trace.totalCostUsd,
    pricingUnknown: trace.pricingUnknown,
    spanCount: trace.spanCount,
  };
}
```

Remove the duplicate `rootSpanId` assignment from `getTraceDetail` after the
shared list mapper supplies it.

- [ ] **Step 4: Extend the existing scoped search predicate**

Import `or` from Drizzle and replace the name-only predicate:

```ts
import {
  and,
  count,
  desc,
  eq,
  ilike,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

if (input.query !== undefined) {
  predicates.push(
    or(
      ilike(traces.name, `%${input.query}%`),
      ilike(traces.traceId, `%${input.query}%`),
    )!,
  );
}
```

Keep `eq(traces.projectId, input.projectId)` as the first mandatory predicate.
Do not broaden actor matching.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
rtk vitest run apps/web/lib/demo-read-model.test.ts apps/web/lib/trace-read-model.integration.test.ts
rtk tsc -p apps/web/tsconfig.json --noEmit
```

Expected: both test files pass and TypeScript exits 0.

Commit:

```bash
rtk git add apps/web/lib/trace-read-model.ts apps/web/lib/trace-read-model.integration.test.ts apps/web/lib/demo-read-model.ts apps/web/lib/demo-read-model.test.ts packages/db/src/span-repository.ts
rtk git commit -m "feat(web): expose root-aware agent run reads"
```

---

### Task 2: Deterministic Run and Step Presentation Model

**Files:**

- Create: `apps/web/lib/trace-presentation.ts`
- Create: `apps/web/lib/trace-presentation.test.ts`
- Modify: `apps/web/lib/trace-rail.ts`
- Modify: `apps/web/lib/trace-rail.test.ts`

**Interfaces:**

- Consumes: `TraceListItem`, `TraceDetail`, `TraceSpan`,
  `TRACE_INCOMPLETE_AFTER_MS`, and existing formatters.
- Produces: the exact pure interfaces and functions below.

```ts
export type RunOutcomeLabel = "Succeeded" | "Failed";

export type RunPresentation = {
  traceId: string;
  displayTitle: string;
  technicalName: string;
  shortRunId: string;
  agentId: string;
  requestedBy: string | null;
  startedAtLabel: string;
  outcomeLabel: RunOutcomeLabel | null;
  completionLabel: "Incomplete recording" | null;
  completionExplanation: string | null;
  durationLabel: string;
  modelCostLabel: string;
  modelCostTechnicalLabel: "UNPRICED" | null;
  stepCount: number;
  technicalSpanCount: number;
  isReadOnlyExample: boolean;
};

export type StepCategoryLabel =
  | "Looked up data"
  | "Called an AI model"
  | "Performed an external action"
  | "Called a tool"
  | "Recorded the complete run"
  | "Recorded a custom step";

export type StepPresentation = {
  traceId: string;
  spanId: string;
  ordinal: number | null;
  isRootBoundary: boolean;
  displayName: string;
  technicalName: string;
  categoryLabel: StepCategoryLabel;
  technicalKind: TraceSpan["kind"];
  outcomeLabel: RunOutcomeLabel;
  durationLabel: string;
  agentId: string;
  hasPayload: boolean;
};

export type RunDetailPresentation = RunPresentation & {
  summary: string;
  externalActionCount: number;
  agentCount: number;
  rootBoundary: StepPresentation | null;
  steps: StepPresentation[];
};

export function humanizeName(value: string, fallback: string): string;
export function orderTraceSpans(spans: readonly TraceSpan[]): TraceSpan[];
export function presentRun(
  trace: TraceListItem,
  options?: { isReadOnlyExample?: boolean },
): RunPresentation;
export function presentTraceDetail(
  trace: TraceDetail,
  options?: { isReadOnlyExample?: boolean },
): RunDetailPresentation;
```

- [ ] **Step 1: Write failing presentation tests**

Cover all deterministic branches:

```ts
expect(humanizeName("research.answer-v2", "Unnamed agent run")).toBe(
  "Research answer v2",
);
expect(humanizeName("._-", "Unnamed agent run")).toBe("Unnamed agent run");

expect(
  presentRun(traceFixture({ rootSpanId: "root", spanCount: 4 }), {
    isReadOnlyExample: true,
  }),
).toMatchObject({
  displayTitle: "Research answer",
  technicalName: "sample.research-answer",
  outcomeLabel: "Succeeded",
  stepCount: 3,
  technicalSpanCount: 4,
});

expect(
  presentRun(
    traceFixture({
      rootSpanId: null,
      spanCount: 2,
      pricingUnknown: true,
      totalCostUsd: null,
    }),
  ),
).toMatchObject({
  stepCount: 2,
  modelCostLabel: "Price unavailable",
  modelCostTechnicalLabel: "UNPRICED",
});

expect(
  presentTraceDetail(
    detailFixture({
      durationMs: null,
      endedAt: null,
      completionState: "incomplete",
    }),
  ).summary,
).toBe(
  "This recording is incomplete. 3 steps were recorded. The final duration is unavailable. The agent performed 1 external action.",
);

expect(
  presentTraceDetail(detailFixture()).steps.map((step) => step.categoryLabel),
).toEqual([
  "Looked up data",
  "Called an AI model",
  "Performed an external action",
]);
```

Also assert failed outcome, null outcome, root-absent count, custom/tool kind,
unique agents, sibling ordering by start time then span ID, and absence of
words such as `result`, `purpose`, or `because` in generated summaries.

- [ ] **Step 2: Verify RED**

Run:

```bash
rtk vitest run apps/web/lib/trace-presentation.test.ts
```

Expected: FAIL because the presentation module does not exist.

- [ ] **Step 3: Implement name, status, cost, and count projection**

Use explicit mappings:

```ts
import { TRACE_INCOMPLETE_AFTER_MS } from "@agentrail-sdk/config";

import { formatCost, formatDuration, formatTimestamp, shortId } from "./format";
import type { TraceDetail, TraceListItem, TraceSpan } from "./trace-read-model";

const categoryByKind: Record<TraceSpan["kind"], StepCategoryLabel> = {
  trace: "Recorded the complete run",
  retrieval: "Looked up data",
  llm: "Called an AI model",
  action: "Performed an external action",
  tool: "Called a tool",
  custom: "Recorded a custom step",
};

export function humanizeName(value: string, fallback: string): string {
  const normalized = value
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length === 0) return fallback;
  return normalized[0]!.toUpperCase() + normalized.slice(1);
}

function stepCount(trace: TraceListItem): number {
  return Math.max(0, trace.spanCount - (trace.rootSpanId === null ? 0 : 1));
}

function outcomeLabel(trace: TraceListItem): RunOutcomeLabel | null {
  if (trace.outcome === "ok") return "Succeeded";
  if (trace.outcome === "error") return "Failed";
  return null;
}

function incompleteExplanation(): string {
  const minutes = TRACE_INCOMPLETE_AFTER_MS / 60_000;
  return `No completion envelope was recorded within ${minutes} minutes.`;
}
```

`presentRun` gives the explicit title `Research answer` only when
`isReadOnlyExample` is true. Known cost reuses `formatCost`; unknown cost uses
plain `Price unavailable` plus technical `UNPRICED`.

- [ ] **Step 4: Implement parent-aware detail projection**

Use one stable pre-order traversal with cycle and orphan protection:

```ts
export function orderTraceSpans(spans: readonly TraceSpan[]): TraceSpan[] {
  const byParent = new Map<string | null, TraceSpan[]>();
  for (const span of spans) {
    const siblings = byParent.get(span.parentSpanId) ?? [];
    siblings.push(span);
    byParent.set(span.parentSpanId, siblings);
  }
  for (const siblings of byParent.values()) {
    siblings.sort(
      (left, right) =>
        Date.parse(left.startedAt) - Date.parse(right.startedAt) ||
        left.spanId.localeCompare(right.spanId),
    );
  }

  const ordered: TraceSpan[] = [];
  const visited = new Set<string>();
  const visit = (span: TraceSpan) => {
    if (visited.has(span.spanId)) return;
    visited.add(span.spanId);
    ordered.push(span);
    for (const child of byParent.get(span.spanId) ?? []) visit(child);
  };

  for (const root of byParent.get(null) ?? []) visit(root);
  for (const span of spans) visit(span);
  return ordered;
}
```

`presentTraceDetail` separates the exact `rootSpanId`, numbers only operational
steps, counts `action` and `tool` spans as external actions, and counts unique
agents across the trace and its spans.

- [ ] **Step 5: Reuse the ordering in Trace Rail**

Replace duplicate rail ordering with `orderTraceSpans` while preserving the
existing geometry output, cycle protection, minimum bar width, and tests.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```bash
rtk vitest run apps/web/lib/trace-presentation.test.ts apps/web/lib/trace-rail.test.ts
rtk tsc -p apps/web/tsconfig.json --noEmit
```

Expected: presentation and geometry suites pass; TypeScript exits 0.

Commit:

```bash
rtk git add apps/web/lib/trace-presentation.ts apps/web/lib/trace-presentation.test.ts apps/web/lib/trace-rail.ts apps/web/lib/trace-rail.test.ts
rtk git commit -m "feat(web): add guided run presentation model"
```

---

### Task 3: Canonical Source Configuration and Read-Only Demo Shell

**Files:**

- Create: `apps/web/lib/source-url.ts`
- Create: `apps/web/lib/source-url.test.ts`
- Create: `apps/web/components/read-only-example.tsx`
- Create: `apps/web/tests/dashboard-shell.test.tsx`
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/app/(dashboard)/layout.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**

- Consumes: optional `NEXT_PUBLIC_AGENTRAIL_SOURCE_URL`,
  `AGENTRAIL_DEMO_MODE`, and `DEMO_TRACE_ID`.
- Produces:

```ts
export function configuredSourceUrl(value?: string): string | null;
export function sourceQuickstartUrl(sourceUrl: string): string;

export function ReadOnlyExampleIndicator(): React.ReactNode;
export function ReadOnlyExampleBanner(props: {
  detail?: boolean;
}): React.ReactNode;
```

- [ ] **Step 1: Write failing source configuration tests**

```ts
expect(configuredSourceUrl(undefined)).toBeNull();
expect(configuredSourceUrl("   ")).toBeNull();
expect(configuredSourceUrl("https://github.com/example/agentrail")).toBe(
  "https://github.com/example/agentrail",
);
expect(() => configuredSourceUrl("http://example.com/repo")).toThrow(
  "NEXT_PUBLIC_AGENTRAIL_SOURCE_URL must be an absolute https:// URL",
);
expect(() => configuredSourceUrl("/relative")).toThrow(
  "NEXT_PUBLIC_AGENTRAIL_SOURCE_URL must be an absolute https:// URL",
);
expect(sourceQuickstartUrl("https://github.com/example/agentrail")).toBe(
  "https://github.com/example/agentrail#local-quickstart",
);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
rtk vitest run apps/web/lib/source-url.test.ts
```

Expected: FAIL because `source-url.ts` does not exist.

- [ ] **Step 3: Implement strict source parsing**

```ts
const SOURCE_ERROR =
  "NEXT_PUBLIC_AGENTRAIL_SOURCE_URL must be an absolute https:// URL";

export function configuredSourceUrl(
  value = process.env.NEXT_PUBLIC_AGENTRAIL_SOURCE_URL,
): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error(SOURCE_ERROR);
  }
  if (
    url.protocol !== "https:" ||
    url.hostname.length === 0 ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    throw new Error(SOURCE_ERROR);
  }
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function sourceQuickstartUrl(sourceUrl: string): string {
  const url = new URL(sourceUrl);
  url.hash = "local-quickstart";
  return url.toString();
}
```

Call `configuredSourceUrl()` once from `next.config.ts` before exporting the
config so an invalid public value fails the build:

```ts
import { configuredSourceUrl } from "./lib/source-url";

configuredSourceUrl();
```

Do not place the URL under `nextConfig.env`; direct
`process.env.NEXT_PUBLIC_AGENTRAIL_SOURCE_URL` access is already inlined by
Next.js at build time.

- [ ] **Step 4: Write the failing shell tests**

Mock demo mode and source configuration, then assert:

```tsx
expect(screen.getByRole("link", { name: "AgentRail home" })).toHaveAttribute(
  "href",
  "/",
);
expect(screen.getByRole("link", { name: "Agent runs" })).toHaveAttribute(
  "href",
  "/traces",
);
expect(screen.getByText("Read-only example")).toBeInTheDocument();
expect(screen.queryByText("M1 recorder")).not.toBeInTheDocument();
expect(screen.queryByRole("link", { name: "Source" })).not.toBeInTheDocument();
```

In the configured case, `Source` must use exactly the parsed URL.

- [ ] **Step 5: Implement the demo indicator and banner**

Use Phosphor SSR icons and exact copy:

```tsx
export function ReadOnlyExampleIndicator() {
  return <span className="sample-stamp">Read-only example</span>;
}

export function ReadOnlyExampleBanner({
  detail = false,
}: {
  detail?: boolean;
}) {
  const href = `/traces/${DEMO_TRACE_ID}`;
  return (
    <aside className="read-only-example" aria-label="Read-only example">
      <div>
        <strong>Read-only example</strong>
        <p>
          {detail
            ? "This run uses synthetic data and cannot be changed."
            : "This synthetic example shows how a research agent handled one task."}
        </p>
      </div>
      {detail ? null : <Link href={href}>Explore the sample run</Link>}
    </aside>
  );
}
```

Render the small indicator in the global header only when demo mode is active.
Render the full banner from route content in Tasks 4 and 5 so it remains visible
on mobile.

- [ ] **Step 6: Verify the build-time failure and normal build**

Run:

```powershell
$env:NEXT_PUBLIC_AGENTRAIL_SOURCE_URL = "http://example.com"
rtk pnpm --filter @agentrail-sdk/web build
```

Expected: nonzero exit with
`NEXT_PUBLIC_AGENTRAIL_SOURCE_URL must be an absolute https:// URL`.

Then run:

```powershell
Remove-Item Env:NEXT_PUBLIC_AGENTRAIL_SOURCE_URL
rtk vitest run apps/web/lib/source-url.test.ts apps/web/tests/dashboard-shell.test.tsx
rtk pnpm --filter @agentrail-sdk/web build
```

Expected: tests pass and an unset-source production build exits 0 without a
Source link.

- [ ] **Step 7: Commit**

```bash
rtk git add apps/web/lib/source-url.ts apps/web/lib/source-url.test.ts apps/web/components/read-only-example.tsx apps/web/tests/dashboard-shell.test.tsx apps/web/next.config.ts "apps/web/app/(dashboard)/layout.tsx" apps/web/app/globals.css
rtk git commit -m "feat(web): orient the read-only demo shell"
```

---

### Task 4: Guided Agent-Run Index and Purpose-Specific States

**Files:**

- Create: `apps/web/components/run-orientation.tsx`
- Create: `apps/web/tests/trace-filters.test.tsx`
- Create: `apps/web/tests/trace-empty-state.test.tsx`
- Create: `apps/web/tests/traces-error.test.tsx`
- Modify: `apps/web/app/(dashboard)/traces/page.tsx`
- Modify: `apps/web/app/(dashboard)/traces/loading.tsx`
- Modify: `apps/web/app/(dashboard)/traces/error.tsx`
- Modify: `apps/web/components/trace-filters.tsx`
- Modify: `apps/web/components/trace-table.tsx`
- Modify: `apps/web/components/trace-empty-state.tsx`
- Modify: `apps/web/tests/trace-table.test.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**

- Consumes: `TracePage`, `presentRun`, demo mode, optional source URL, and
  URL search parameters.
- Produces: an accessible `/traces` index whose primary mental model is recorded
  agent runs.

- [ ] **Step 1: Update fixtures and write failing index tests**

Every `TraceListItem` fixture receives `rootSpanId`. Add assertions for:

```tsx
expect(
  screen.getByRole("heading", { level: 1, name: "Agent runs" }),
).toBeInTheDocument();
expect(
  screen.getByText(
    "Review what an AI agent did, how long it took, what it cost, and which tools it used.",
  ),
).toBeInTheDocument();
expect(screen.getByText("Research answer")).toBeInTheDocument();
expect(screen.getByText("sample.research-answer")).toBeInTheDocument();
expect(screen.getByText("Succeeded")).toBeInTheDocument();
expect(screen.getByText("3 steps")).toBeInTheDocument();
expect(screen.getAllByRole("link", { name: "Open run" })[0]).toHaveAttribute(
  "href",
  "/traces/0af7651916cd43dd8448eb211c80319c",
);
expect(screen.queryByText(/\bOK\b/)).not.toBeInTheDocument();
```

Filter tests require persistent labels `Search by run name or ID`, `Status`,
`Agent`, and button `Apply filters`. Empty/error tests cover all exact copy from
the specification and ensure the technical disclosure contains no thrown error
message.

- [ ] **Step 2: Verify RED**

Run:

```bash
rtk vitest run apps/web/tests/trace-table.test.tsx apps/web/tests/trace-filters.test.tsx apps/web/tests/trace-empty-state.test.tsx apps/web/tests/traces-error.test.tsx
```

Expected: FAIL on old labels, old columns, old empty-state install command, and
missing orientation.

- [ ] **Step 3: Implement the route hierarchy**

The server page uses:

```tsx
const isReadOnlyExample = demoModeEnabled();
const sourceUrl = configuredSourceUrl();

return (
  <>
    {isReadOnlyExample ? <ReadOnlyExampleBanner /> : null}
    <header className="page-heading">
      <div>
        <span className="page-eyebrow">Agent activity / project scope</span>
        <h1>Agent runs</h1>
        <p>
          Review what an AI agent did, how long it took, what it cost, and which
          tools it used.
        </p>
      </div>
      <dl className="archive-count">
        <dt>Recorded runs</dt>
        <dd>{page.total.toLocaleString("en-US")}</dd>
      </dl>
    </header>
    <RunOrientation />
    <TraceFilters query={query} actor={actor} outcome={outcome} />
    {page.items.length === 0 ? (
      <TraceEmptyState filtered={filtered} sourceUrl={sourceUrl} />
    ) : (
      <TraceTable
        page={page}
        queryString={activeQuery.toString()}
        isReadOnlyExample={isReadOnlyExample}
      />
    )}
  </>
);
```

`RunOrientation` is one bordered ordered rail:

```tsx
const steps = [
  ["1", "Choose a run"],
  ["2", "Open it"],
  ["3", "Inspect steps and recorded data"],
] as const;
```

- [ ] **Step 4: Implement explicit filter semantics**

Use native GET controls inside:

```tsx
<details className="run-filter-disclosure" open>
  <summary>Search and filters</summary>
  <form action="/traces" method="get" role="search">
    <label>
      <span>Search by run name or ID</span>
      <input name="q" type="search" placeholder="Run name or ID" />
    </label>
    <label>
      <span>Status</span>
      <select name="outcome">
        <option value="">All</option>
        <option value="ok">Succeeded</option>
        <option value="error">Failed</option>
      </select>
    </label>
    <label>
      <span>Agent</span>
      <input name="actor" aria-describedby="agent-filter-help" />
      <small id="agent-filter-help">Agent name or ID</small>
    </label>
    <button type="submit">Apply filters</button>
  </form>
</details>
```

The disclosure summary is visible on mobile and visually hidden at desktop
while content remains expanded.

- [ ] **Step 5: Implement the desktop and mobile run ledger**

Desktop columns are `Run`, `Agent`, `Recorded`, `Status`, and an accessible
action column. `Recorded` shows steps, duration, model cost, and start time in
one stable group. Mobile shows the same facts in a bordered ledger item.

Use one `presentRun(trace, { isReadOnlyExample })` per row. `Research answer`
is primary only in demo mode. Technical name and short ID remain visible.
Title and `Open run` share the same route and no other row action is added.

- [ ] **Step 6: Implement truthful loading, empty, and error states**

Use exact states:

```tsx
<h1>Agent runs</h1>
<p>Review recorded work from your instrumented AI agents.</p>
<strong>Loading agent runs…</strong>
```

```tsx
<h2>No agent runs recorded yet</h2>
<p>
  Runs appear here after an instrumented application sends spans and the
  worker persists them.
</p>
<code>docker compose up -d --build</code>
```

Render a quickstart link only when `sourceUrl` is non-null. Filtered empty uses
`No agent runs match these filters` and `Clear filters`.

The client error boundary uses:

```tsx
<h1>We couldn't load agent runs</h1>
<p>Try the request again. Your recorded data has not been changed.</p>
<button type="button" onClick={reset}>Try again</button>
<details>
  <summary>Technical details</summary>
  <p>The project-scoped read request failed.</p>
</details>
```

Never render `error.message`, database URLs, or credentials.

- [ ] **Step 7: Verify GREEN and commit**

Run:

```bash
rtk vitest run apps/web/tests/trace-table.test.tsx apps/web/tests/trace-filters.test.tsx apps/web/tests/trace-empty-state.test.tsx apps/web/tests/traces-error.test.tsx
rtk tsc -p apps/web/tsconfig.json --noEmit
```

Expected: all index component tests pass and TypeScript exits 0.

Commit:

```bash
rtk git add "apps/web/app/(dashboard)/traces/page.tsx" "apps/web/app/(dashboard)/traces/loading.tsx" "apps/web/app/(dashboard)/traces/error.tsx" apps/web/components/run-orientation.tsx apps/web/components/trace-filters.tsx apps/web/components/trace-table.tsx apps/web/components/trace-empty-state.tsx apps/web/tests/trace-table.test.tsx apps/web/tests/trace-filters.test.tsx apps/web/tests/trace-empty-state.test.tsx apps/web/tests/traces-error.test.tsx apps/web/app/globals.css
rtk git commit -m "feat(web): guide users through agent runs"
```

---

### Task 5: Factual Run Summary and Readable Step Sequence

**Files:**

- Create: `apps/web/components/what-happened.tsx`
- Create: `apps/web/tests/what-happened.test.tsx`
- Create: `apps/web/app/(dashboard)/traces/[traceId]/error.tsx`
- Modify: `apps/web/app/(dashboard)/traces/[traceId]/page.tsx`
- Modify: `apps/web/app/(dashboard)/traces/[traceId]/loading.tsx`
- Modify: `apps/web/app/(dashboard)/traces/[traceId]/not-found.tsx`
- Modify: `apps/web/components/trace-header.tsx`
- Modify: `apps/web/components/trace-rail.tsx`
- Modify: `apps/web/components/span-row.tsx`
- Modify: `apps/web/tests/trace-header.test.tsx`
- Modify: `apps/web/tests/trace-rail.test.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**

- Consumes: one `TraceDetail`, one `RunDetailPresentation`, and exact
  read-only-demo identity.
- Produces: detail order `summary -> What happened -> Technical timeline ->
External actions`.

- [ ] **Step 1: Write failing header and step-sequence tests**

Assert:

```tsx
expect(screen.getByRole("heading", { name: "Research answer" })).toBeVisible();
expect(screen.getByText("sample.research-answer")).toBeVisible();
expect(screen.getByText(/3 steps were recorded in 1.25 s/)).toBeVisible();
expect(screen.getByText("Succeeded")).toBeVisible();
expect(screen.getByText("Requested by")).toBeVisible();
expect(screen.getByText("3")).toBeVisible();

const list = screen.getByRole("list", { name: "What happened" });
expect(within(list).getByText("Looked up data")).toBeVisible();
expect(within(list).getByText("Called an AI model")).toBeVisible();
expect(within(list).getByText("Performed an external action")).toBeVisible();
expect(within(list).getByText("Recorded the complete run")).toBeVisible();
```

Separate tests require `No final outcome has been recorded yet.`, `Incomplete
recording`, the configured 15-minute explanation, `Price unavailable`, and
technical `UNPRICED`. No test may expect `Running`.

- [ ] **Step 2: Verify RED**

Run:

```bash
rtk vitest run apps/web/tests/trace-header.test.tsx apps/web/tests/what-happened.test.tsx apps/web/tests/trace-rail.test.tsx
```

Expected: FAIL because the detail still starts with raw trace metadata and the
readable sequence does not exist.

- [ ] **Step 3: Compose one server-side detail presentation**

In the page:

```tsx
const isReadOnlyExample = demoModeEnabled() && trace.traceId === DEMO_TRACE_ID;
const presentation = presentTraceDetail(trace, { isReadOnlyExample });

return (
  <>
    {isReadOnlyExample ? <ReadOnlyExampleBanner detail /> : null}
    <TraceHeader trace={trace} presentation={presentation} />
    <WhatHappened trace={trace} presentation={presentation} />
    <TraceRail trace={trace} />
    <ActionLedger traceId={trace.traceId} spans={trace.spans} />
    {selectedSpan?.hasPayload === true ? (
      <EvidenceDrawer traceId={trace.traceId} span={selectedSpan} />
    ) : null}
  </>
);
```

This mounts no drawer for a missing span or a span without payload.

- [ ] **Step 4: Implement the summary and at-a-glance strip**

The header renders:

```tsx
<Link href="/traces">Back to all agent runs</Link>
<span className="page-eyebrow">
  {presentation.technicalName} · Run ID {presentation.shortRunId}
</span>
<h1>{presentation.displayTitle}</h1>
<p className="run-summary">{presentation.summary}</p>
```

Fact order is exactly `Status`, `Agent`, `Requested by`, `Duration`, `Steps`,
`Model cost`. Null outcome has no badge and shows the explicit no-final-outcome
sentence. Unknown pricing displays both plain and technical labels.

- [ ] **Step 5: Implement `WhatHappened`**

Render the root boundary once and operational steps once:

```tsx
<section className="what-happened" aria-labelledby="what-happened-title">
  <header className="trace-section-heading">
    <div>
      <span>Recorded sequence</span>
      <h2 id="what-happened-title">What happened</h2>
    </div>
    <p>Plain-language view of every recorded step</p>
  </header>
  <ol aria-label="What happened">
    {presentation.rootBoundary === null ? null : (
      <li className="run-boundary">
        <span>Run boundary</span>
        <strong>{presentation.rootBoundary.categoryLabel}</strong>
      </li>
    )}
    {presentation.steps.map((step) => (
      <li key={step.spanId}>
        <span>{step.ordinal}</span>
        <div>
          <strong>{step.categoryLabel}</strong>
          <code>{step.technicalName}</code>
        </div>
        <span>{step.outcomeLabel}</span>
        <span>{step.durationLabel}</span>
      </li>
    ))}
  </ol>
</section>
```

Task 6 adds the payload-aware action to each operational row.

- [ ] **Step 6: Rename the forensic section without removing it**

Trace Rail renders:

```tsx
<span>Trace Rail</span>
<h2 id="trace-rail-title">Technical timeline</h2>
<p>Exact order, nesting, and duration of {rows.length} recorded spans</p>
```

Keep the waterfall, semantic colors, text labels, and desktop visibility.
Change `SpanRow` from a whole-row link to a semantic non-interactive row; Task 6
adds the explicit payload action.

- [ ] **Step 7: Implement detail loading, error, and not-found copy**

- Loading: `Loading run details…`.
- Error: `We couldn't load this agent run`, `Try again`, and safe technical
  disclosure.
- Not found: `Run not found` and `Back to all agent runs`.

No state tells the user to repair PostgreSQL.

- [ ] **Step 8: Verify GREEN and commit**

Run:

```bash
rtk vitest run apps/web/tests/trace-header.test.tsx apps/web/tests/what-happened.test.tsx apps/web/tests/trace-rail.test.tsx
rtk tsc -p apps/web/tsconfig.json --noEmit
```

Expected: detail component tests pass and TypeScript exits 0.

Commit:

```bash
rtk git add "apps/web/app/(dashboard)/traces/[traceId]" apps/web/components/trace-header.tsx apps/web/components/what-happened.tsx apps/web/components/trace-rail.tsx apps/web/components/span-row.tsx apps/web/tests/trace-header.test.tsx apps/web/tests/what-happened.test.tsx apps/web/tests/trace-rail.test.tsx apps/web/app/globals.css
rtk git commit -m "feat(web): explain recorded run details"
```

---

### Task 6: Payload-Aware Recorded Data and External Actions

**Files:**

- Create: `apps/web/components/recorded-data-action.tsx`
- Create: `apps/web/tests/recorded-data-action.test.tsx`
- Modify: `apps/web/components/what-happened.tsx`
- Modify: `apps/web/components/span-row.tsx`
- Modify: `apps/web/components/action-ledger.tsx`
- Modify: `apps/web/components/evidence-drawer.tsx`
- Modify: `apps/web/components/evidence-content.tsx`
- Modify: `apps/web/app/(dashboard)/traces/[traceId]/page.tsx`
- Modify: `apps/web/tests/action-ledger.test.tsx`
- Modify: `apps/web/tests/evidence-drawer.test.tsx`
- Modify: `apps/web/tests/trace-rail.test.tsx`
- Modify: `tests/e2e/evidence-drawer.spec.ts`
- Modify: `apps/web/app/globals.css`

**Interfaces:**

- Consumes: trace ID, span ID, `hasPayload`, span metadata, and the existing
  backend evidence route.
- Produces:

```ts
export function RecordedDataAction(props: {
  traceId: string;
  spanId: string;
  hasPayload: boolean;
  origin: "steps" | "timeline" | "actions";
}): React.ReactNode;
```

- [ ] **Step 1: Write failing payload-action tests**

```tsx
const { rerender } = render(
  <RecordedDataAction
    traceId="trace-a"
    spanId="span-a"
    hasPayload={false}
    origin="steps"
  />,
);
expect(screen.getByText("Metadata only")).toBeInTheDocument();
expect(screen.queryByRole("link")).not.toBeInTheDocument();

rerender(
  <RecordedDataAction
    traceId="trace-a"
    spanId="span-a"
    hasPayload
    origin="steps"
  />,
);
expect(
  screen.getByRole("link", { name: "Inspect recorded data" }),
).toHaveAttribute("href", "/traces/trace-a?span=span-a");
```

Add action-ledger and rail tests proving a non-payload action has zero recorded
data links. Add a page test proving a direct non-payload `?span=` selection
does not mount the drawer or call `fetch`.

- [ ] **Step 2: Verify RED**

Run:

```bash
rtk vitest run apps/web/tests/recorded-data-action.test.tsx apps/web/tests/action-ledger.test.tsx apps/web/tests/trace-rail.test.tsx apps/web/tests/evidence-drawer.test.tsx
```

Expected: FAIL because all rows are currently treated as inspectable evidence.

- [ ] **Step 3: Implement the single payload-aware action**

```tsx
export function RecordedDataAction({
  traceId,
  spanId,
  hasPayload,
  origin,
}: {
  traceId: string;
  spanId: string;
  hasPayload: boolean;
  origin: "steps" | "timeline" | "actions";
}) {
  if (!hasPayload) {
    return <span className="metadata-only">Metadata only</span>;
  }
  return (
    <Link
      href={`/traces/${encodeURIComponent(traceId)}?span=${encodeURIComponent(spanId)}`}
      data-span-id={spanId}
      data-evidence-origin={origin}
    >
      Inspect recorded data
    </Link>
  );
}
```

Use this same component in `WhatHappened`, Trace Rail, and External Actions.
Do not create three divergent URL builders.

- [ ] **Step 4: Convert Action Ledger into External Actions**

Keep the chronological `action | tool` projection. Render primary heading
`External actions` and secondary label
`Action Ledger · tools or systems the agent called or changed`.

Each desktop and mobile row shows humanized operation name, technical kind,
agent, outcome, timestamp, duration, and the shared payload-aware action.
No rerun, approve, rollback, retry, delete, or export control is added.

- [ ] **Step 5: Rename and expand the drawer**

Use primary terminology:

```tsx
<aside
  role="dialog"
  aria-modal="true"
  aria-label={`Recorded data for ${span.name}`}
>
  <span>Evidence · Span {shortId(span.spanId)}</span>
  <h2>{humanizeName(span.name, "Recorded step")}</h2>
  <p>Input and output captured by the project-scoped AgentRail backend.</p>
</aside>
```

Facts include plain and technical kind, agent, start, duration, model,
input tokens, output tokens, and model cost when present. Add:

```tsx
<details className="advanced-metadata">
  <summary>Advanced metadata</summary>
  <pre aria-label="Raw span attributes">
    <code>{JSON.stringify(span.attributes, null, 2)}</code>
  </pre>
</details>
```

Use exact state copy:

- `Loading recorded data…`
- `Recorded input/output`
- `Sensitive fields were removed before storage.`
- `Recorded data was shortened at the configured capture limit.`
- `No input/output was captured for this step.`
- `Recorded data couldn't be loaded.`

- [ ] **Step 6: Make focus restoration unambiguous**

Before focusing the close button, capture the active origin matching both
`data-span-id` and `data-evidence-origin`. On close:

1. navigate to the span-free trace URL;
2. focus the captured connected element when it still exists;
3. otherwise focus the first connected element with the selected span ID.

Update the close accessible name to `Close recorded data`. Preserve Escape,
Tab containment, overlay click, abort handling, and URL-stable selection.

- [ ] **Step 7: Verify the browser evidence boundary**

Update the E2E test to:

1. open the LLM step using `Inspect recorded data`;
2. assert dialog `Recorded data for draft answer`;
3. assert redaction notice and JSON;
4. assert no MinIO, S3, or object-store request;
5. close with Escape and verify exact origin focus;
6. assert the non-payload action says `Metadata only` and has no link.

Run:

```bash
rtk vitest run apps/web/tests/recorded-data-action.test.tsx apps/web/tests/action-ledger.test.tsx apps/web/tests/trace-rail.test.tsx apps/web/tests/evidence-drawer.test.tsx
rtk playwright test tests/e2e/evidence-drawer.spec.ts
```

Expected: unit/component tests and desktop/mobile evidence flows pass.

- [ ] **Step 8: Commit**

```bash
rtk git add apps/web/components/recorded-data-action.tsx apps/web/components/what-happened.tsx apps/web/components/span-row.tsx apps/web/components/action-ledger.tsx apps/web/components/evidence-drawer.tsx apps/web/components/evidence-content.tsx "apps/web/app/(dashboard)/traces/[traceId]/page.tsx" apps/web/tests/recorded-data-action.test.tsx apps/web/tests/action-ledger.test.tsx apps/web/tests/evidence-drawer.test.tsx apps/web/tests/trace-rail.test.tsx tests/e2e/evidence-drawer.spec.ts apps/web/app/globals.css
rtk git commit -m "feat(web): make recorded data disclosure payload-aware"
```

---

### Task 7: Readability, Responsive Behavior, and Accessibility Gates

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/tests/design-contract.test.ts`
- Modify: `tests/e2e/traces-index.spec.ts`
- Modify: `tests/e2e/trace-detail.spec.ts`
- Modify: `tests/e2e/dashboard-a11y.spec.ts`
- Modify: `tests/e2e/dashboard-visual.spec.ts`

**Interfaces:**

- Consumes: rendered landing, index, detail, and recorded-data drawer.
- Produces: automated WCAG A/AA, text-size, keyboard, focus, reduced-motion,
  200% zoom, and 390 px overflow gates.

- [ ] **Step 1: Install the official Axe Playwright integration**

Run:

```bash
rtk pnpm add -D -w @axe-core/playwright@^4.12.1
```

Expected: root `package.json` and `pnpm-lock.yaml` add
`@axe-core/playwright`.

- [ ] **Step 2: Write failing visual-contract tests**

Extend the CSS source tests to reject dashboard values below the approved
floors for named M1.1 selectors. Add browser assertions:

```ts
import { AxeBuilder } from "@axe-core/playwright";

const results = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
  .analyze();
expect(results.violations).toEqual([]);
```

Run Axe on index, detail, and the open drawer in both Playwright projects.

- [ ] **Step 3: Verify RED**

Run:

```bash
rtk vitest run apps/web/tests/design-contract.test.ts
rtk playwright test tests/e2e/dashboard-a11y.spec.ts
```

Expected: FAIL because existing metadata labels are 8–9 px and Axe is not yet
green on the redesigned structure.

- [ ] **Step 4: Implement the readability floors**

Update only dashboard selectors:

```css
.page-heading p,
.run-summary,
.run-orientation p,
.read-only-example p,
.trace-empty p,
.trace-error p {
  font-size: 14px;
  line-height: 1.55;
}

.trace-filters input,
.trace-filters select,
.trace-filters button,
.trace-name,
.open-run,
.recorded-data-action {
  font-size: 13px;
}

.page-eyebrow,
.trace-table th,
.trace-mobile-list dt,
.trace-facts dt,
.span-identity code,
.span-actor,
.span-duration,
.evidence-facts dt,
.evidence-facts dd {
  font-size: 11px;
}
```

Keep the landing's approved responsive type scale intact. Ensure isolated
buttons and links have a minimum 44 by 44 CSS pixel hit area on touch layout.

- [ ] **Step 5: Implement mobile and zoom behavior**

At base/mobile:

- demo banner remains visible;
- orientation stacks vertically;
- filters use the visible disclosure summary;
- run items use a bordered ledger composition;
- `Open run` uses available width;
- IDs use `overflow-wrap: anywhere`;
- What Happened precedes the waterfall;
- evidence drawer remains full screen;
- no horizontal overflow occurs.

At `min-width: 1024px`, hide only the filter summary, restore the desktop
filter grid, semantic table, multi-column facts, and desktop drawer width.

- [ ] **Step 6: Expand keyboard, reduced-motion, and zoom tests**

Test:

- logical heading order;
- every control has an accessible name;
- visible focus outline at least 2 px;
- Tab reaches primary CTA, filters, Open run, recorded-data action, and drawer
  close in order;
- Escape closes and restores the exact trigger;
- 390 px page has no horizontal overflow;
- a 640 px viewport at `document.documentElement.style.zoom = "2"` remains
  operable with no clipped action;
- reduced motion has no nonessential animation over 1 ms;
- status remains textual when color is ignored.

- [ ] **Step 7: Verify GREEN and commit**

Run:

```bash
rtk vitest run apps/web/tests/design-contract.test.ts
rtk playwright test tests/e2e/traces-index.spec.ts tests/e2e/trace-detail.spec.ts tests/e2e/dashboard-a11y.spec.ts tests/e2e/dashboard-visual.spec.ts
rtk pnpm --filter @agentrail-sdk/web anti-slop
```

Expected: desktop/mobile tests pass, Axe has zero listed violations, and the
anti-slop audit reports zero blocking findings.

Commit:

```bash
rtk git add package.json pnpm-lock.yaml apps/web/app/globals.css apps/web/tests/design-contract.test.ts tests/e2e/traces-index.spec.ts tests/e2e/trace-detail.spec.ts tests/e2e/dashboard-a11y.spec.ts tests/e2e/dashboard-visual.spec.ts
rtk git commit -m "test(web): enforce guided forensic accessibility"
```

---

### Task 8: Landing, Source, and Documentation Credibility Repair

**Files:**

- Create: `tests/docs/documentation.test.ts`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/tests/landing-page.test.tsx`
- Modify: `tests/e2e/landing.spec.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `apps/web/app/globals.css`

**Interfaces:**

- Consumes: `configuredSourceUrl`, the implemented SDK API, Docker quickstart,
  and the guided public demo.
- Produces: accurate landing copy, conditional source controls, verified
  setup instructions, and current repository status.

- [ ] **Step 1: Write failing landing and documentation tests**

Assert:

```tsx
expect(
  screen.getByRole("link", { name: "Explore the guided demo" }),
).toHaveAttribute("href", "/traces");
expect(screen.getByText("Investigate")).toBeInTheDocument();
expect(screen.queryByText("Replay")).not.toBeInTheDocument();
expect(screen.queryByText(/AWS startup application/i)).not.toBeInTheDocument();
expect(screen.queryByText(/pnpm add @agentrail\/sdk/i)).not.toBeInTheDocument();
```

With source configuration absent, assert zero source links. With a valid URL,
assert every source link uses exactly that URL.

The documentation test reads `README.md`, the landing source, and
`packages/sdk/src/agentrail.ts`. It requires current dashboard/demo statements
and rejects:

- `dashboard is the next implementation stage`;
- invalid `new AgentRail({ apiKey`;
- `trace.llm(`;
- registry installation while the package is private;
- grant-centric landing copy.

- [ ] **Step 2: Verify RED**

Run:

```bash
rtk vitest run apps/web/tests/landing-page.test.tsx tests/docs/documentation.test.ts
```

Expected: FAIL on the old CTA, `Replay`, invalid SDK snippet, stale README, and
hardcoded source links.

- [ ] **Step 3: Implement the verified landing copy**

Make these exact changes:

- `Open trace dashboard` -> `Explore the guided demo`
- `Replay` -> `Investigate`
- grant-centric paragraph ->
  `Run AgentRail locally, inspect recorded agent behavior, and keep sensitive evidence under your control.`
- source controls render only when `configuredSourceUrl()` returns a URL.

Do not assume GitHub as the provider and do not render a GitHub-specific icon
when the URL host is unknown.

- [ ] **Step 4: Replace the invalid quickstart**

The setup block begins:

```text
From an AgentRail repository checkout:

corepack enable
pnpm install
docker compose up -d --build
pnpm bootstrap:local
```

The TypeScript API example must use the implemented interfaces:

```ts
import { AgentRail, BufferedDelivery, HttpSpanTransport } from "@agentrail-sdk/sdk";

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
    async () => undefined,
  );
  await trace.action({ name: "filesystem.read" }, async () => undefined);
});

await rail.shutdown({ timeoutMs: 5_000 });
```

Label it as a source-checkout example while the package remains private.

- [ ] **Step 5: Update environment and README truthfully**

Add:

```dotenv
AGENTRAIL_DEMO_MODE=0
NEXT_PUBLIC_AGENTRAIL_SOURCE_URL=
```

Document that the public URL is optional, HTTPS-only, and build-time.

README changes:

- dashboard, guided sample, and landing move into `What works`;
- the future-dashboard sentence is removed;
- early open-source/non-production/non-funding disclaimers remain;
- local Docker quickstart remains executable;
- the Vercel deployment is described as a read-only synthetic demo;
- no AWS deployment or acceptance claim is added.

- [ ] **Step 6: Verify landing behavior**

Run:

```bash
rtk vitest run apps/web/tests/landing-page.test.tsx tests/docs/documentation.test.ts
rtk playwright test tests/e2e/landing.spec.ts
```

Expected: unit/docs tests and desktop/mobile landing flows pass with no broken
source control when the source URL is absent.

- [ ] **Step 7: Commit**

```bash
rtk git add apps/web/app/page.tsx apps/web/tests/landing-page.test.tsx tests/e2e/landing.spec.ts tests/docs/documentation.test.ts .env.example README.md apps/web/app/globals.css
rtk git commit -m "docs: align public product and quickstart"
```

---

### Task 9: State Fixtures, Screenshot Evidence, and Full Completion Gate

**Files:**

- Modify: `tests/e2e/sample-state.ts`
- Create: `tests/e2e/run-states.spec.ts`
- Modify: `tests/e2e/traces-index.spec.ts`
- Modify: `tests/e2e/trace-detail.spec.ts`
- Modify: `tests/e2e/dashboard-visual.spec.ts`
- Generate: `artifacts/screenshots/agentrail-trace-rail.png`
- Generate: `artifacts/screenshots/agentrail-landing-desktop.png`
- Generate: `artifacts/screenshots/agentrail-landing-mobile.png`
- Replace from verified capture: `apps/web/public/landing/agentrail-trace-rail.png`

**Interfaces:**

- Consumes: existing `agentrail_test` PostgreSQL, seeded sample, public demo
  data, all M1.1 routes, and repository quality scripts.
- Produces: browser evidence for supported states and a fresh full-repository
  verification record.

- [ ] **Step 1: Add database-only browser state fixtures**

Extend the E2E fixture utility with deterministic test-only setup and cleanup:

```ts
export const incompleteTraceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const unpricedTraceId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

export async function seedRunStateFixtures(): Promise<void>;
export async function removeRunStateFixtures(): Promise<void>;
```

Use `@agentrail-sdk/db` against only the configured `agentrail_test` database.
Abort unless the parsed URL pathname is exactly `/agentrail_test`. Insert one
old trace row whose completion envelope never arrived, plus one complete trace
with unknown model pricing. The incomplete trace intentionally has no root
span: that is the real state produced when operational spans arrive but the
root completion envelope does not.

Use these fixed identifiers and values:

```ts
import { TRACE_INCOMPLETE_AFTER_MS } from "@agentrail-sdk/config";
import { createDatabase } from "@agentrail-sdk/db";

const projectId =
  process.env.AGENTRAIL_PROJECT_ID ?? "00000000-0000-4000-8000-000000000101";
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://agentrail:agentrail@localhost:5433/agentrail_test";

const fixtureDatabaseUrl = new URL(databaseUrl);
if (fixtureDatabaseUrl.pathname !== "/agentrail_test") {
  throw new Error("E2E run-state fixtures require /agentrail_test");
}

const incompleteSpanId = "aaaaaaaaaaaaaaaa";
const unpricedRootSpanId = "bbbbbbbbbbbbbbbb";
const unpricedLlmSpanId = "cccccccccccccccc";
```

In `seedRunStateFixtures`, remove any prior rows with the two fixture trace IDs,
then insert:

```ts
const connection = createDatabase(databaseUrl);
const now = new Date();
const incompleteStartedAt = new Date(
  now.getTime() - TRACE_INCOMPLETE_AFTER_MS - 60_000,
);

try {
  await connection.sql`
    DELETE FROM traces
    WHERE project_id = ${projectId}
      AND trace_id IN ${connection.sql([incompleteTraceId, unpricedTraceId])}
  `;

  await connection.sql`
    INSERT INTO traces (
      project_id, trace_id, root_span_id, name, agent_id, on_behalf_of,
      started_at, ended_at, outcome, completion_state, total_cost_usd,
      pricing_unknown, span_count
    ) VALUES
      (
        ${projectId}, ${incompleteTraceId}, NULL,
        'fixture.incomplete-research', 'fixture-researcher',
        'fixture-reviewer', ${incompleteStartedAt}, NULL, NULL,
        'incomplete', NULL, FALSE, 1
      ),
      (
        ${projectId}, ${unpricedTraceId}, ${unpricedRootSpanId},
        'fixture.unpriced-answer', 'fixture-researcher',
        'fixture-reviewer', ${new Date(now.getTime() - 4_000)}, ${now},
        'ok', 'complete', NULL, TRUE, 2
      )
  `;

  await connection.sql`
    INSERT INTO spans (
      project_id, trace_id, span_id, parent_span_id, kind, name, agent_id,
      on_behalf_of, started_at, ended_at, outcome, model, cost_usd,
      pricing_unknown, attributes
    ) VALUES
      (
        ${projectId}, ${incompleteTraceId}, ${incompleteSpanId}, NULL,
        'custom', 'fixture.partial-step', 'fixture-researcher',
        'fixture-reviewer', ${incompleteStartedAt},
        ${new Date(incompleteStartedAt.getTime() + 250)}, 'ok', NULL, NULL,
        FALSE, '{}'::jsonb
      ),
      (
        ${projectId}, ${unpricedTraceId}, ${unpricedRootSpanId}, NULL,
        'trace', 'fixture.unpriced-answer', 'fixture-researcher',
        'fixture-reviewer', ${new Date(now.getTime() - 4_000)}, ${now},
        'ok', NULL, NULL, FALSE, '{}'::jsonb
      ),
      (
        ${projectId}, ${unpricedTraceId}, ${unpricedLlmSpanId},
        ${unpricedRootSpanId}, 'llm', 'model.unknown-answer',
        'fixture-researcher', 'fixture-reviewer',
        ${new Date(now.getTime() - 3_000)},
        ${new Date(now.getTime() - 500)}, 'ok',
        'fixture/model-without-price', NULL, TRUE, '{}'::jsonb
      )
  `;
} finally {
  await connection.close();
}
```

Implement `removeRunStateFixtures` with a fresh guarded connection and a
project-scoped delete:

```ts
export async function removeRunStateFixtures(): Promise<void> {
  const connection = createDatabase(databaseUrl);
  try {
    await connection.sql`
      DELETE FROM traces
      WHERE project_id = ${projectId}
        AND trace_id IN ${connection.sql([incompleteTraceId, unpricedTraceId])}
    `;
  } finally {
    await connection.close();
  }
}
```

Use direct test repository/database writes only. Do not add a product mutation
endpoint, test query parameter, or public test route.

- [ ] **Step 2: Write browser state tests**

`run-states.spec.ts` verifies:

- incomplete detail says `Incomplete recording` and contains no
  `Running|Pending|Live`;
- unpriced detail says `Price unavailable` and `UNPRICED`, never `$0.00`;
- a random unknown trace renders `Run not found`;
- impossible filters render `No agent runs match these filters`;
- evidence route interception returning 502 leaves the trace usable and shows
  `Recorded data couldn't be loaded.`;
- test fixtures are removed after the suite.

Loading and server-error boundaries remain component-tested because the app
has no safe production fault-injection seam. Do not add a public failure route
solely to satisfy a browser test.

- [ ] **Step 3: Run all browser flows**

Run:

```bash
rtk playwright test
```

Expected: every desktop and mobile test passes. Existing intentional
project-specific skips remain limited to desktop-only capture and mobile-only
composition cases.

- [ ] **Step 4: Capture and inspect final screenshots**

Capture fixed viewports after all visible data has settled. Verify manually:

- `Read-only example` is visible on index/detail desktop and mobile;
- `Agent runs`, `Research answer`, `What happened`, `Technical timeline`, and
  `External actions` are not clipped;
- no drawer loading state remains in the saved trace screenshot;
- no secret, raw API key, database URL, object-store URL, or browser chrome is
  visible;
- mobile screenshots have no horizontal overflow;
- hierarchy remains forensic and does not become a generic card grid.

Only after inspection, replace the landing public screenshot with the verified
trace capture.

- [ ] **Step 5: Run the full fresh verification gate**

Run every command separately and require exit 0:

```bash
rtk vitest run apps/web
rtk vitest run tests/docs/documentation.test.ts
rtk pnpm --filter @agentrail-sdk/web anti-slop
rtk playwright test
rtk tsc -p apps/web/tsconfig.json --noEmit
rtk pnpm --filter @agentrail-sdk/web build
rtk prettier --check .
rtk git diff --check
```

Expected:

- all web unit/component/integration tests pass;
- documentation contract passes;
- anti-slop reports zero blocking findings;
- all desktop/mobile Playwright flows pass;
- TypeScript exits 0;
- Next.js production build exits 0;
- Prettier reports all files formatted;
- Git whitespace check returns no findings.

- [ ] **Step 6: Review the specification coverage**

Check each section of
`docs/superpowers/specs/2026-07-23-agentrail-m1-1-guided-forensics-ux-design.md`
against implemented tests. Confirm:

- all supported actions map to real behavior;
- every payload-absent span is non-interactive;
- every technical evidence surface remains available;
- source controls are consistent and conditional;
- public copy is customer-first and not grant-centric;
- no excluded SaaS subsystem was introduced.

- [ ] **Step 7: Commit final browser evidence**

Do not stage `apps/web/next-env.d.ts`.

```bash
rtk git add tests/e2e/sample-state.ts tests/e2e/run-states.spec.ts tests/e2e/traces-index.spec.ts tests/e2e/trace-detail.spec.ts tests/e2e/dashboard-visual.spec.ts artifacts/screenshots/agentrail-trace-rail.png artifacts/screenshots/agentrail-landing-desktop.png artifacts/screenshots/agentrail-landing-mobile.png apps/web/public/landing/agentrail-trace-rail.png
rtk git commit -m "test(web): verify guided forensic ux"
```

## Completion Gate

- [ ] `/traces` explains what it is, where runs come from, what to click, and
      what benefit the page provides.
- [ ] The demo has exactly one primary `Explore the sample run` action.
- [ ] The sample is visibly synthetic and read-only on desktop and mobile.
- [ ] The index shows human title, technical identity, agent, three operational
      steps, duration, model cost, status, and `Open run`.
- [ ] Detail shows factual summary and at-a-glance facts before forensic tools.
- [ ] Root boundary and every operational span appear exactly once in
      `What happened`.
- [ ] Trace Rail remains available as `Technical timeline`.
- [ ] Action Ledger remains available as `External actions`.
- [ ] Only payload-bearing spans expose `Inspect recorded data`.
- [ ] Drawer focus, Escape, URL state, redaction, truncation, absence, and
      backend-error behavior are verified.
- [ ] Loading, empty, filtered-empty, error, not-found, incomplete, unpriced,
      and null-outcome states use approved language.
- [ ] No `Running`, fake result, fake capability, or false AWS claim appears.
- [ ] Invalid source configuration fails build; absent source configuration
      renders no source control.
- [ ] Landing SDK and Docker quickstart match implemented code.
- [ ] README and public product state agree.
- [ ] WCAG A/AA automation, keyboard, 200% zoom, reduced motion, mobile
      overflow, design contract, anti-slop, typecheck, build, format, and Git
      whitespace gates pass.
- [ ] No migration, auth, mutation, hosted ingestion, billing, team, share,
      delete, export, rerun, or duplication feature was added.
