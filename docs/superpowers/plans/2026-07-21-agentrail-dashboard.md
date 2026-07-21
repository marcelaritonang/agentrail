# AgentRail Forensic Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the production-backed `/traces` and `/traces/[traceId]` forensic dashboard, including Trace Rail, server-proxied Evidence Drawer, Action Ledger, complete UI states, anti-slop checks, and the real screenshot required by the later landing page.

**Architecture:** Next.js 16 App Router Server Components read project-scoped trace models from PostgreSQL. Small client islands handle the Evidence Drawer and focused interactions. Payload content travels only through a project-scoped Route Handler; the dashboard never receives blob credentials or direct object URLs.

**Tech Stack:** Next.js 16.2, React 19, Tailwind CSS 4, Instrument Sans, JetBrains Mono, `@phosphor-icons/react`, Vitest, Testing Library, Playwright, PostgreSQL read repositories.

## Global Constraints

- This plan starts only after the core pipeline completion gate passes and seeded synthetic traces exist.
- `design-taste-frontend` does not apply to `/traces` or `/traces/[traceId]`.
- Dashboard identity is graphite, warm white, amber actions, cyan LLM, violet retrieval, and red failures.
- Use Instrument Sans for interface copy and JetBrains Mono for identifiers, timestamps, durations, tokens, and cost.
- Use one small-radius system, 1 px separators, nearly no shadow, and no generic card-in-card containers.
- No gradient, glassmorphism, neon glow, decorative blob, robot, fake metric, fake testimonial, or looping decorative animation.
- Do not use `transition-all`, repeated hover scale, layout-property animation, or multiple icon families.
- Use only `@phosphor-icons/react`. Server Components import from `@phosphor-icons/react/ssr` with explicit `weight="regular"`; client components inherit `weight="regular"` from `IconContext`.
- Unknown model cost renders `UNPRICED`, never `$0.00`.
- There is no `running` badge. `completion_state = null` renders no completion badge; timed-out traces render `INCOMPLETE`.
- The browser accesses payload evidence only through the Next.js backend route.
- Base styles are mobile-first; desktop composition begins at `lg` (1024 px).
- New behavior follows red-green-refactor TDD and every delivered view has loading, empty, error, and keyboard states where applicable.

## File Structure

```text
apps/web/app/layout.tsx                              fonts, metadata, root shell
apps/web/app/globals.css                             semantic tokens and base rules
apps/web/app/(dashboard)/layout.tsx                  forensic navigation shell
apps/web/app/(dashboard)/traces/page.tsx             server trace index
apps/web/app/(dashboard)/traces/loading.tsx          table-shaped skeleton
apps/web/app/(dashboard)/traces/error.tsx            contextual failure state
apps/web/app/(dashboard)/traces/[traceId]/page.tsx   trace detail composition
apps/web/app/api/traces/[traceId]/payload/[spanId]/route.ts
apps/web/components/                                 focused visual units
apps/web/lib/trace-read-model.ts                     project-scoped view queries
apps/web/lib/trace-rail.ts                           deterministic waterfall geometry
apps/web/lib/format.ts                               identifier, duration, time, money
apps/web/scripts/anti-slop.ts                        AgentRail-specific static gate
apps/web/tests/                                      component and route tests
tests/e2e/                                           browser flows and screenshots
artifacts/screenshots/agentrail-trace-rail.png        real landing hero source
```

The trace table remains semantic HTML with server-side pagination. TanStack Table is not added in M1 because sorting and pagination are controlled by URL search parameters and no client-side column engine is required.

---

### Task 1: Web Application, Tokens, Fonts, and Icon Contract

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/Dockerfile`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/app/(dashboard)/layout.tsx`
- Create: `apps/web/components/icon-provider.tsx`
- Create: `apps/web/components/product-mark.tsx`
- Create: `apps/web/tests/design-contract.test.ts`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: root workspace tooling.
- Produces: semantic CSS tokens, font variables, dashboard shell, and one-icon-family contract.

- [ ] **Step 1: Write failing static design-contract tests**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("dashboard design contract", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  it("defines semantic forensic tokens", () => {
    expect(css).toContain("--surface-canvas:");
    expect(css).toContain("--signal-action:");
    expect(css).toContain("--signal-llm:");
    expect(css).toContain("--signal-retrieval:");
    expect(css).toContain("--signal-error:");
  });

  it("does not use pure black or white token values", () => {
    expect(css).not.toMatch(/#(?:000000|000|ffffff|fff)\b/i);
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `rtk vitest run apps/web/tests/design-contract.test.ts`
Expected: FAIL because the web app and token file do not exist.

- [ ] **Step 3: Implement the foundation**

Use `next/font/google` for `Instrument_Sans` and `JetBrains_Mono`, assigning `--font-sans` and `--font-mono`. Define all color values once in `globals.css` as semantic OKLCH variables; components may reference tokens but may not contain raw hex or OKLCH literals.

Create a client provider:

```tsx
"use client";

import { IconContext } from "@phosphor-icons/react";

export function IconProvider({ children }: { children: React.ReactNode }) {
  return (
    <IconContext.Provider value={{ color: "currentColor", weight: "regular", mirrored: false }}>
      {children}
    </IconContext.Provider>
  );
}
```

Static Server Components import icons from `/ssr` and always pass `weight="regular"` because the SSR submodule does not consume context.

- [ ] **Step 4: Add the web service to the local topology**

Create a multi-stage Node 24 Dockerfile for the Next.js standalone output. Add `web` to `docker-compose.yml` with project ID, database, and server-side blob configuration; expose only the documented web port. The web container depends on healthy PostgreSQL and MinIO but contains no browser-visible object-store credential.

- [ ] **Step 5: Verify GREEN, build, and commit**

Run: `rtk vitest run apps/web/tests/design-contract.test.ts`
Run: `rtk next build`
Expected: tests pass and Next production build exits 0.
Run: `rtk docker compose config --quiet`
Expected: Compose validates with the new web service.
Run: `rtk git add apps/web docker-compose.yml && rtk git commit -m "feat: establish forensic dashboard system"`

---

### Task 2: Project-Scoped Trace Read Models and Formatting

**Files:**
- Create: `apps/web/lib/project-context.ts`
- Create: `apps/web/lib/trace-read-model.ts`
- Create: `apps/web/lib/trace-read-model.integration.test.ts`
- Create: `apps/web/lib/format.ts`
- Create: `apps/web/lib/format.test.ts`
- Modify: `packages/db/src/span-repository.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: Drizzle schema and configured demo/local project ID.
- Produces: `listTraces(input): TracePage`, `getTraceDetail(projectId, traceId): TraceDetail | null`, `formatCost`, `formatDuration`, and `shortId`.

- [ ] **Step 1: Write failing read-model tests**

```ts
it("never returns traces from another project", async () => {
  await seedTrace({ projectId: PROJECT_A, traceId: TRACE_A });
  await seedTrace({ projectId: PROJECT_B, traceId: TRACE_B });
  const result = await listTraces({ projectId: PROJECT_A, page: 1, pageSize: 25 });
  expect(result.items.map((item) => item.traceId)).toEqual([TRACE_A]);
});

it("formats unknown cost as UNPRICED", () => {
  expect(formatCost({ totalCostUsd: null, pricingUnknown: true })).toBe("UNPRICED");
});
```

- [ ] **Step 2: Verify RED**

Run: `rtk vitest run apps/web/lib/trace-read-model.integration.test.ts apps/web/lib/format.test.ts`
Expected: FAIL because the read model and formatters are missing.

- [ ] **Step 3: Implement bounded project-scoped queries**

`listTraces` accepts page `>=1`, page size fixed at 25, optional `query`, `outcome`, and `actor`. It orders by `started_at DESC, trace_id DESC` and returns `{ items, page, pageSize, total }`. `getTraceDetail` fetches trace and spans with both `project_id` and `trace_id` in every predicate.

- [ ] **Step 4: Verify GREEN and commit**

Run: `rtk vitest run apps/web/lib`
Expected: PASS.
Run: `rtk git add apps/web/lib packages/db && rtk git commit -m "feat: expose scoped trace read models"`

---

### Task 3: Dense Trace Index

**Files:**
- Create: `apps/web/app/(dashboard)/traces/page.tsx`
- Create: `apps/web/app/(dashboard)/traces/loading.tsx`
- Create: `apps/web/app/(dashboard)/traces/error.tsx`
- Create: `apps/web/components/trace-filters.tsx`
- Create: `apps/web/components/trace-table.tsx`
- Create: `apps/web/components/trace-empty-state.tsx`
- Create: `apps/web/tests/trace-table.test.tsx`
- Create: `tests/e2e/traces-index.spec.ts`

**Interfaces:**
- Consumes: `TracePage` from Task 2 and URL search params.
- Produces: accessible `/traces` index with search, filters, pagination, and complete states.

- [ ] **Step 1: Write failing semantic table tests**

```tsx
it("renders an accessible trace table with UNPRICED state", () => {
  render(<TraceTable page={tracePageFixture({ pricingUnknown: true })} />);
  expect(screen.getByRole("table", { name: /agent traces/i })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: /actor/i })).toBeInTheDocument();
  expect(screen.getByText("UNPRICED")).toBeInTheDocument();
  expect(screen.queryByText(/running/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

Run: `rtk vitest run apps/web/tests/trace-table.test.tsx`
Expected: FAIL because `TraceTable` is missing.

- [ ] **Step 3: Implement server-fed table and URL controls**

Use native `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`, and link each trace name to `/traces/[traceId]`. Columns are Trace, Actor, Duration, Spans, Outcome, Cost, and Started. Mobile uses a deliberate compact row composition below `lg`, not horizontal clipping of the desktop table.

The page receives `searchParams` as a Promise in Next.js 16 and awaits it before calling `listTraces`. Filters submit GET parameters and pagination preserves active filters.

- [ ] **Step 4: Implement layout-shaped states**

`loading.tsx` mirrors column widths using inert rows. Empty first-run state shows the SDK install command. No-result state keeps filters visible and offers “Clear filters”. `error.tsx` is a client error boundary with one “Try again” action.

- [ ] **Step 5: Verify component and browser behavior**

Run: `rtk vitest run apps/web/tests/trace-table.test.tsx`
Run: `rtk playwright test tests/e2e/traces-index.spec.ts`
Expected: PASS for desktop and 390 px mobile projects.
Run: `rtk git add apps/web tests/e2e/traces-index.spec.ts && rtk git commit -m "feat: add dense trace index"`

---

### Task 4: Deterministic Trace Rail Geometry

**Files:**
- Create: `apps/web/lib/trace-rail.ts`
- Create: `apps/web/lib/trace-rail.test.ts`
- Create: `apps/web/components/trace-rail.tsx`
- Create: `apps/web/components/span-row.tsx`
- Create: `apps/web/tests/trace-rail.test.tsx`

**Interfaces:**
- Consumes: persisted `TraceDetail.spans`.
- Produces: `buildTraceRail(spans): TraceRailRow[]` with `offsetPercent`, `widthPercent`, `depth`, and semantic signal.

- [ ] **Step 1: Write failing geometry tests**

```ts
it("maps child timing into stable bounded percentages", () => {
  const rows = buildTraceRail([
    span({ spanId: ROOT, parentSpanId: null, startMs: 0, endMs: 1_000 }),
    span({ spanId: CHILD, parentSpanId: ROOT, startMs: 250, endMs: 500 }),
  ]);
  expect(rows.find((row) => row.spanId === CHILD)).toMatchObject({
    offsetPercent: 25,
    widthPercent: 25,
    depth: 1,
  });
});

it("uses a visible minimum width without exceeding the rail", () => {
  const [row] = buildTraceRail([span({ startMs: 999, endMs: 1_000 })], { traceStartMs: 0, traceEndMs: 1_000 });
  expect(row.widthPercent).toBeGreaterThanOrEqual(0.6);
  expect(row.offsetPercent + row.widthPercent).toBeLessThanOrEqual(100);
});
```

- [ ] **Step 2: Verify RED, implement pure geometry, verify GREEN**

Run: `rtk vitest run apps/web/lib/trace-rail.test.ts`
Expected: FAIL because the geometry builder is missing.

Sort siblings by start time then span ID. Compute depth from parent links with cycle protection. Clamp rows to `[0,100]`. Map `llm`, `retrieval`, `action/tool`, `error`, and neutral custom spans to semantic CSS variables.

Run: `rtk vitest run apps/web/lib/trace-rail.test.ts`
Expected: PASS.

- [ ] **Step 3: Render the accessible rail**

Each span row is a link or button with a textual name, kind, duration, actor, and a separate visual bar marked `aria-hidden="true"`. Keyboard focus is always visible. The component must remain usable when color is removed.

- [ ] **Step 4: Commit**

Run: `rtk vitest run apps/web/tests/trace-rail.test.tsx`
Expected: PASS.
Run: `rtk git add apps/web/lib/trace-rail* apps/web/components/trace-rail.tsx apps/web/components/span-row.tsx apps/web/tests/trace-rail.test.tsx && rtk git commit -m "feat: render deterministic Trace Rail"`

---

### Task 5: Trace Detail Header and Route Composition

**Files:**
- Create: `apps/web/app/(dashboard)/traces/[traceId]/page.tsx`
- Create: `apps/web/app/(dashboard)/traces/[traceId]/loading.tsx`
- Create: `apps/web/app/(dashboard)/traces/[traceId]/not-found.tsx`
- Create: `apps/web/components/trace-header.tsx`
- Create: `apps/web/tests/trace-header.test.tsx`
- Create: `tests/e2e/trace-detail.spec.ts`

**Interfaces:**
- Consumes: `getTraceDetail`, `TraceRail`, and async Next.js route params.
- Produces: `/traces/[traceId]` with compact trace header and rail.

- [ ] **Step 1: Write failing header-state tests**

```tsx
it("renders no running synonym before the incomplete timeout", () => {
  render(<TraceHeader trace={traceFixture({ completionState: null })} />);
  expect(screen.queryByText(/running|pending|live/i)).not.toBeInTheDocument();
});

it("renders INCOMPLETE only for timed-out traces", () => {
  render(<TraceHeader trace={traceFixture({ completionState: "incomplete" })} />);
  expect(screen.getByText("INCOMPLETE")).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED and implement the route**

Run: `rtk vitest run apps/web/tests/trace-header.test.tsx`
Expected: FAIL because the header is missing.

Await `params: Promise<{ traceId: string }>` in the page. Call `notFound()` when the project-scoped read model returns null. Header fields are trace name, short ID, actor, on-behalf-of, start time, duration, outcome, completion state, and total cost.

- [ ] **Step 3: Verify detail flow and commit**

Run: `rtk vitest run apps/web/tests/trace-header.test.tsx`
Run: `rtk playwright test tests/e2e/trace-detail.spec.ts`
Expected: PASS.
Run: `rtk git add apps/web tests/e2e/trace-detail.spec.ts && rtk git commit -m "feat: compose forensic trace detail"`

---

### Task 6: Project-Scoped Evidence Backend Route

**Files:**
- Create: `apps/web/lib/evidence.ts`
- Create: `apps/web/app/api/traces/[traceId]/payload/[spanId]/route.ts`
- Create: `apps/web/tests/evidence-route.test.ts`

**Interfaces:**
- Consumes: configured project ID, `SpanRepository`, and `BlobStore` on the server.
- Produces: `createEvidenceHandler(deps)` and an authorized JSON Route Handler with no storage URL leakage.

- [ ] **Step 1: Write failing authorization tests**

```ts
it("returns 404 for a span owned by another project", async () => {
  const handler = createEvidenceHandler(testDeps({ configuredProjectId: PROJECT_A }));
  const response = await handler(request, {
    params: Promise.resolve({ traceId: TRACE_B, spanId: SPAN_B }),
  });
  expect(response.status).toBe(404);
});

it("never exposes object-store location", async () => {
  const response = await authorizedEvidenceResponse();
  const body = await response.text();
  expect(body).not.toContain("s3://");
  expect(body).not.toContain("minio");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
```

- [ ] **Step 2: Verify RED and implement server-only route**

Run: `rtk vitest run apps/web/tests/evidence-route.test.ts`
Expected: FAIL because the route is missing.

Await both dynamic params. Query the span with `project_id`, `trace_id`, and `span_id`. Resolve the opaque reference only after scope verification. Return `404` for missing/cross-project resources, `204` for intentionally uncaptured payload, `200` JSON for available evidence, and `502` with a safe code for storage failure. Never redirect to blob storage.

- [ ] **Step 3: Verify GREEN and commit**

Run: `rtk vitest run apps/web/tests/evidence-route.test.ts`
Expected: PASS.
Run: `rtk git add apps/web/lib/evidence.ts apps/web/app/api apps/web/tests/evidence-route.test.ts && rtk git commit -m "feat: proxy scoped trace evidence"`

---

### Task 7: Evidence Drawer and Action Ledger

**Files:**
- Create: `apps/web/components/evidence-drawer.tsx`
- Create: `apps/web/components/evidence-content.tsx`
- Create: `apps/web/components/action-ledger.tsx`
- Create: `apps/web/tests/evidence-drawer.test.tsx`
- Create: `apps/web/tests/action-ledger.test.tsx`
- Modify: `apps/web/app/(dashboard)/traces/[traceId]/page.tsx`
- Modify: `apps/web/components/trace-rail.tsx`
- Create: `tests/e2e/evidence-drawer.spec.ts`

**Interfaces:**
- Consumes: selected span from `?span=<spanId>`, backend payload route, and action/tool projection.
- Produces: URL-stable drawer, keyboard close/focus behavior, evidence states, and chronological ledger.

- [ ] **Step 1: Write failing drawer state tests**

```tsx
it.each([
  ["redacted", /sensitive fields were redacted/i],
  ["truncated", /payload was truncated/i],
  ["none", /payload capture is disabled/i],
  ["error", /evidence could not be loaded/i],
])("renders the %s evidence state", async (state, text) => {
  render(<EvidenceDrawer {...drawerFixture(state)} />);
  expect(await screen.findByText(text)).toBeInTheDocument();
});
```

- [ ] **Step 2: Write failing ledger projection test**

```tsx
it("shows only action and tool spans in chronological order", () => {
  render(<ActionLedger spans={mixedSpanFixture()} />);
  expect(screen.getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual([
    expect.stringContaining("web.search"),
    expect.stringContaining("filesystem.read"),
  ]);
  expect(screen.queryByText("model.plan")).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Verify RED and implement focused client island**

Run: `rtk vitest run apps/web/tests/evidence-drawer.test.tsx apps/web/tests/action-ledger.test.tsx`
Expected: FAIL because components are missing.

The drawer owns only focus trap, Escape, close navigation, and payload fetch state. Static trace metadata stays server-rendered. Preserve the selected span in the URL. On close, restore focus to the originating rail row. The drawer is the only dashboard surface allowed a restrained elevation shadow because it overlays the rail.

- [ ] **Step 4: Verify UI and keyboard behavior**

Run: `rtk vitest run apps/web/tests/evidence-drawer.test.tsx apps/web/tests/action-ledger.test.tsx`
Run: `rtk playwright test tests/e2e/evidence-drawer.spec.ts`
Expected: PASS, including Tab containment, Escape close, restored focus, and no direct object-store request.

- [ ] **Step 5: Commit**

Run: `rtk git add apps/web tests/e2e/evidence-drawer.spec.ts && rtk git commit -m "feat: inspect evidence and action ledger"`

---

### Task 8: AgentRail Anti-Slop and Accessibility Gates

**Files:**
- Create: `apps/web/scripts/anti-slop.ts`
- Create: `apps/web/scripts/anti-slop.test.ts`
- Create: `apps/web/scripts/rules.ts`
- Modify: `apps/web/package.json`
- Create: `docs/engineering/dashboard-design-contract.md`

**Interfaces:**
- Consumes: AgentRail TSX and CSS files.
- Produces: `pnpm --filter @agentrail/web anti-slop` with advisory findings and blocking brand/accessibility findings.

- [ ] **Step 1: Write failing scanner fixture tests**

```ts
it.each([
  ["transition-all", '<button className="transition-all">Open</button>'],
  ["gradient text", '<h1 className="bg-clip-text text-transparent bg-gradient-to-r">A</h1>'],
  ["raw component color", '<div className="bg-[#000000]" />'],
  ["second icon family", 'import { Search } from "lucide-react"'],
])("flags %s", (_, source) => {
  expect(scanSource("fixture.tsx", source)).not.toHaveLength(0);
});
```

- [ ] **Step 2: Verify RED and implement project-owned rules**

Run: `rtk vitest run apps/web/scripts/anti-slop.test.ts`
Expected: FAIL because scanner is missing.

Port only universal concepts from the audited ZIP with attribution. Do not copy its hardcoded Soleur paths, gold contrast rule, zero-radius rule, hook configuration, network connector, or auto-filing behavior. Static blocking rules are raw colors outside `globals.css`, non-Phosphor icon imports, `transition-all`, and inaccessible amber token combinations. Missing focus visibility remains a blocking Playwright accessibility check because source regex cannot judge inherited or composed focus behavior reliably.

- [ ] **Step 3: Run scanner over dashboard and commit**

Run: `rtk pnpm --filter @agentrail/web anti-slop`
Expected: zero blocking findings; advisory findings reviewed and either fixed or documented with a reason.
Run: `rtk git add apps/web/scripts apps/web/package.json docs/engineering && rtk git commit -m "test: enforce dashboard design contract"`

---

### Task 9: Dashboard Verification and Real Trace Rail Capture

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/dashboard-visual.spec.ts`
- Create: `tests/e2e/dashboard-a11y.spec.ts`
- Create: `artifacts/screenshots/.gitkeep`
- Generate: `artifacts/screenshots/agentrail-trace-rail.png`

**Interfaces:**
- Consumes: running seeded AgentRail stack.
- Produces: verified desktop/mobile dashboard and real product screenshot for the later landing plan.

- [ ] **Step 1: Write failing visual assertions**

The Playwright test opens the seeded trace, verifies Trace Rail and Action Ledger are visible, selects an LLM span, verifies the drawer, then captures a fixed 1440 by 1000 viewport screenshot. A separate 390 by 844 test confirms deliberate mobile stacking and no horizontal page overflow.

Run: `rtk playwright test tests/e2e/dashboard-visual.spec.ts`
Expected: FAIL before the baseline and capture exist.

- [ ] **Step 2: Add keyboard and reduced-motion checks**

The accessibility test traverses every interactive control with the keyboard, checks a visible focus indicator, verifies drawer focus restoration, emulates `prefers-reduced-motion: reduce`, and asserts no animation duration above 1 ms for nonessential effects.

- [ ] **Step 3: Run the complete dashboard gate**

Run: `rtk pnpm --filter @agentrail/web test`
Run: `rtk pnpm --filter @agentrail/web anti-slop`
Run: `rtk next build`
Run: `rtk playwright test tests/e2e/traces-index.spec.ts tests/e2e/trace-detail.spec.ts tests/e2e/evidence-drawer.spec.ts tests/e2e/dashboard-visual.spec.ts tests/e2e/dashboard-a11y.spec.ts`
Expected: all commands exit 0 on desktop and mobile projects.

- [ ] **Step 4: Inspect and commit the real screenshot**

Open `artifacts/screenshots/agentrail-trace-rail.png` and verify that it contains real seeded data, the `SAMPLE DATA` label, no clipped rail rows, no open secret values, no loading state, and no browser chrome drawn inside the application.

Run: `rtk git add playwright.config.ts tests/e2e artifacts/screenshots && rtk git commit -m "test: verify and capture forensic dashboard"`

## Dashboard Plan Completion Gate

- All read queries contain explicit project scope.
- Evidence requests pass only through the Next.js Route Handler.
- Trace Rail is time-scaled, keyboard-accessible, and useful without color.
- Actor inheritance and overrides are visible from persisted data.
- `UNPRICED`, redacted, truncated, absent, failed, incomplete, loading, empty, and no-result states are verified.
- No `running` synonym, generic card grid, decorative animation, raw component color, Lucide import, or direct blob URL remains.
- Production Next.js build, anti-slop scanner, unit, integration, E2E, mobile, and accessibility gates pass.
- The approved real dashboard screenshot exists for the separate landing-page implementation plan.
