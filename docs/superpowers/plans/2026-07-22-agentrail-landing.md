# AgentRail Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved AgentRail route `/` landing page using the real Trace Rail screenshot as the hero proof.

**Architecture:** Keep the dashboard unchanged. Add a server-rendered App Router page at `apps/web/app/page.tsx`, route-scoped landing CSS in `apps/web/app/globals.css`, and a public screenshot asset served by `next/image`.

**Tech Stack:** Next.js App Router, React 19, Tailwind 4 base CSS, `next/image`, `@phosphor-icons/react/ssr`, Vitest, Playwright.

## Global Constraints

- Taste-skill applies only to route `/`; dashboard routes keep the forensic dashboard identity.
- Design read: B2B developer-tool landing for technical builders, Linear-style restrained language, graphite identity.
- Dials: `DESIGN_VARIANCE: 6`, `MOTION_INTENSITY: 4`, `VISUAL_DENSITY: 4`.
- Palette and type must match dashboard: graphite, warm white, amber accent, Instrument Sans, JetBrains Mono.
- Hero must use the real Trace Rail screenshot, not a fake div-built product preview.
- Do not use neon gradients, AI-purple, glassmorphism, blobs, robot illustrations, emojis, or three equal hero feature cards.
- Use Phosphor icons only.
- Use regular hyphens only in visible landing copy.

---

### Task 1: Landing Contract Tests

**Files:**

- Create: `apps/web/tests/landing-page.test.tsx`

**Interfaces:**

- Consumes: `apps/web/app/page.tsx` default export.
- Produces: unit coverage for landing copy, CTAs, image asset, and anti-slop copy constraints.

- [ ] **Step 1: Write the failing test**

```tsx
render(<LandingPage />);
expect(screen.getByRole("heading", { name: "AgentRail" })).toBeInTheDocument();
expect(
  screen.getByRole("img", { name: /real Trace Rail screenshot/i }),
).toHaveAttribute("src", expect.stringContaining("agentrail-trace-rail"));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @agentrail-sdk/web test -- apps/web/tests/landing-page.test.tsx`
Expected: FAIL because `apps/web/app/page.tsx` does not exist.

### Task 2: Landing Route and Asset

**Files:**

- Create: `apps/web/app/page.tsx`
- Create: `apps/web/public/landing/agentrail-trace-rail.png`
- Modify: `apps/web/app/globals.css`

**Interfaces:**

- Consumes: dashboard semantic CSS variables and public screenshot path.
- Produces: route `/` with hero, how it works, quickstart snippet, and GitHub CTA.

- [ ] **Step 1: Copy the screenshot asset**

Use the existing verified screenshot from `artifacts/screenshots/agentrail-trace-rail.png`.

- [ ] **Step 2: Implement the page**

Use `next/image` with explicit width and height, metadata export, restrained copy, real CTA links, and Phosphor SSR icons.

- [ ] **Step 3: Add scoped CSS**

Prefix landing selectors with `.landing-page` or `.landing-` and avoid changing dashboard selectors.

### Task 3: Browser Verification

**Files:**

- Create: `tests/e2e/landing.spec.ts`

**Interfaces:**

- Consumes: route `/`.
- Produces: desktop and mobile checks for visible hero, screenshot, CTA, no horizontal overflow, and screenshot artifacts.

- [ ] **Step 1: Add e2e checks**

Check brand headline, Trace Rail image, CTAs, and page overflow.

- [ ] **Step 2: Run Playwright**

Run: `pnpm test:e2e -- tests/e2e/landing.spec.ts`
Expected: PASS on desktop and mobile.

### Task 4: Final Verification

**Files:**

- No new files.

**Interfaces:**

- Consumes: full repo scripts.
- Produces: clean verification evidence and commit.

- [ ] **Step 1: Run focused checks**

Run the landing unit test and landing Playwright spec.

- [ ] **Step 2: Run project checks**

Run `pnpm test`, `pnpm --filter @agentrail-sdk/web anti-slop`, `pnpm typecheck`, `pnpm build`, and `pnpm format:check`.

- [ ] **Step 3: Commit**

Commit the landing implementation after verification passes.
