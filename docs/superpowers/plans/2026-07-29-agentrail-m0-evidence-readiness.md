# AgentRail M0 Evidence Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Use
> `superpowers:systematic-debugging` for any unexpected failure and
> `superpowers:verification-before-completion` before declaring the milestone
> green.

**Goal:** Make AgentRail's public website, npm artifacts, repository, CI,
security/legal surfaces, founding-tester intake, and AWS application evidence
consistent with the product that actually exists.

**Architecture:** Do not change the core ingestion or trace architecture in
M0. Repair repository truth at its sources: package manifests and tarballs,
public docs and pages, tested CTAs, Next.js metadata routes, GitHub intake, and
CI workflows. Store AWS application claims as an evidence-linked internal
application pack rather than marketing copy.

**Tech Stack:** Node.js 24, pnpm 11, TypeScript 5.9, Next.js 16.2, React 19,
Vitest 4, Playwright 1.61, `@axe-core/playwright`, GitHub Actions, npm public
registry.

## Global Constraints

- Approved design:
  `docs/superpowers/specs/2026-07-29-agentrail-context-relay-design.md`.
- This milestone does not add Context Relay behavior, hosted authentication,
  cloud telemetry, receipts, or database tables.
- Do not claim AWS deployment, AWS acceptance, credits, customers, traction,
  exact savings, or production readiness unless the linked evidence exists.
- The npm packages are already public. Replace stale `publish-ready` copy with
  verified live commands only after clean-install smoke passes.
- The unrelated unscoped `agentrail` npm package must never be presented as
  this project.
- `NEXT_PUBLIC_AGENTRAIL_SOURCE_URL`,
  `NEXT_PUBLIC_AGENTRAIL_TESTER_INTAKE_URL`, and
  `NEXT_PUBLIC_AGENTRAIL_CONTACT_URL` are optional, absolute, HTTPS-only,
  build-time values. Hide corresponding actions when absent.
- Do not invent an `@agentrail.id` mailbox.
- Existing `/traces` and `/traces/[traceId]` behavior and visual identity stay
  unchanged except for the verified keyboard-order correction.
- Use TDD and focused commits.
- Every **Verify RED** command must fail on at least one newly added behavioral
  assertion for the reason described by that task. A syntax, dependency,
  credential, or unavailable-service error is not an acceptable RED state; fix
  the harness first. If the new test already passes, stop and inspect existing
  behavior before implementing.
- All commands use `rtk`; verify Node 24 before pnpm commands.

## M0 Exit Gate

- `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and local
  Playwright pass.
- Clean tarball and clean registry installs import the public SDK and initialize
  the public MCP executable.
- Website, README, npm, and GitHub agree on package names and availability.
- Legal/trust routes, robots, sitemap, canonical metadata, intake, and working
  contact path exist.
- The application pack cites evidence and contains no unsupported statement.
- Production smoke passes on `https://agentrail.id`.

---

### Task 1: Normalize the Baseline and Repair Published Package Truth

**Files:**

- Modify mechanically: all tracked files reported by `pnpm format:check`
- Modify: `packages/sdk/package.json`
- Modify: `tests/npm/package-readiness.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Package versions are validated per manifest rather than assuming every
  package is `0.1.0`.
- `@agentrail-sdk/sdk` consumes the actually published contracts version
  `0.1.1`.
- Registry tarballs contain no unresolved `workspace:` protocol.

- [ ] **Step 1: Capture the baseline without changing files**

Run:

```powershell
rtk git status --short
rtk pnpm format:check
rtk vitest run tests/npm/package-readiness.test.ts
```

Expected: formatting fails on the current tracked set and the npm test fails
because contracts is `0.1.1` while the test assumes `0.1.0`.

- [ ] **Step 2: Apply and commit the mechanical formatting baseline**

Run:

```powershell
rtk pnpm exec prettier --write .
rtk git diff --check
rtk pnpm format:check
rtk git diff --stat
```

Review a representative `rtk git diff`. If any semantic change appears, stop
and revert only that accidental hunk. Then commit all and only the files
reported by Prettier:

```powershell
rtk git add -u
rtk git commit -m "style: normalize repository formatting"
```

- [ ] **Step 3: Write the failing per-package version contract**

Replace the single expected version assertion with:

```ts
const expectedPackageVersions = {
  contracts: "0.1.1",
  db: "0.1.0",
  sdk: "0.1.0",
  mcp: "0.1.0",
} as const;

expect(manifest.version).toBe(expectedPackageVersions[packageName]);
```

Update the internal dependency contract:

```ts
const expectedInternalWorkspaceDependencies = {
  "@agentrail-sdk/sdk": {
    "@agentrail-sdk/contracts": "workspace:0.1.1",
  },
  "@agentrail-sdk/mcp": {
    "@agentrail-sdk/db": "workspace:0.1.0",
  },
} satisfies Record<string, Record<string, string>>;
```

- [ ] **Step 4: Verify RED for the dependency mismatch**

Run:

```powershell
rtk vitest run tests/npm/package-readiness.test.ts
```

Expected: FAIL because `packages/sdk/package.json` still uses
`workspace:0.1.0`.

- [ ] **Step 5: Align the SDK manifest and lockfile**

Change:

```json
"@agentrail-sdk/contracts": "workspace:0.1.1"
```

Then run:

```powershell
rtk pnpm install --lockfile-only
```

- [ ] **Step 6: Verify GREEN and commit**

Run:

```powershell
rtk vitest run tests/npm/package-readiness.test.ts
rtk pnpm --filter @agentrail-sdk/sdk build
rtk git diff --check
```

Expected: npm readiness passes, SDK builds, and whitespace check exits `0`.

Commit package truth:

```powershell
rtk git add packages/sdk/package.json tests/npm/package-readiness.test.ts pnpm-lock.yaml
rtk git commit -m "fix(npm): align published package metadata"
```

---

### Task 2: Add Repeatable Npm Tarball and Registry Smoke Proof

**Files:**

- Create: `scripts/verify-npm-release.ts`
- Create: `tests/npm/release-smoke.test.ts`
- Modify: `package.json`
- Modify: `tests/npm/package-readiness.test.ts`
- Modify: `.gitignore`

**Interfaces:**

```ts
export type ReleaseSmokeMode = "tarball" | "registry";

export type ReleaseSmokeResult = {
  mode: ReleaseSmokeMode;
  sdkImport: true;
  mcpInitialize: true;
  toolNames: readonly string[];
  unresolvedWorkspaceDependencies: readonly string[];
};

export async function verifyNpmRelease(input: {
  mode: ReleaseSmokeMode;
  registry?: string;
  tempRoot?: string;
}): Promise<ReleaseSmokeResult>;
```

- [ ] **Step 1: Write failing process-level tests**

Create `tests/npm/release-smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { verifyNpmRelease } from "../../scripts/verify-npm-release";

describe("npm release smoke", () => {
  it("installs local tarballs without workspace protocols", async () => {
    const result = await verifyNpmRelease({ mode: "tarball" });

    expect(result.sdkImport).toBe(true);
    expect(result.mcpInitialize).toBe(true);
    expect(result.unresolvedWorkspaceDependencies).toEqual([]);
    expect(result.toolNames).toEqual([
      "agentrail_list_traces",
      "agentrail_get_trace",
      "agentrail_get_actions",
      "agentrail_get_payload_status",
      "agentrail_open_dashboard",
    ]);
  }, 120_000);
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run tests/npm/release-smoke.test.ts
```

Expected: FAIL because the release verifier does not exist.

- [ ] **Step 3: Implement an isolated verifier**

Implement with `node:child_process`, `node:fs/promises`, `node:os`, and
`node:path`. Requirements:

- use `mkdtemp(join(tmpdir(), "agentrail-release-"))` unless `tempRoot` is
  supplied;
- run `pnpm pack --pack-destination $smokeRoot/packs` for contracts, db, SDK,
  and MCP, where `smokeRoot` is the directory created by `mkdtemp`;
- create a clean consumer `package.json` with `"type": "module"`;
- install tarball paths with `npm install`;
- run an SDK dynamic import;
- spawn MCP in `AGENTRAIL_DEMO_MODE=1`;
- perform MCP `initialize`, `notifications/initialized`, and `tools/list` over
  newline-delimited stdio JSON-RPC;
- parse every packed `package.json` and report any dependency value beginning
  with `workspace:`;
- terminate the MCP child in `finally`;
- delete the temp directory unless `AGENTRAIL_KEEP_SMOKE_TEMP=1`;
- never print npm credentials or environment secrets.

Registry mode installs:

```text
@agentrail-sdk/contracts@0.1.1
@agentrail-sdk/db@0.1.0
@agentrail-sdk/sdk@0.1.0
@agentrail-sdk/mcp@0.1.0
```

Add root scripts:

```json
"test:npm:tarball": "tsx scripts/verify-npm-release.ts --mode tarball",
"test:npm:registry": "tsx scripts/verify-npm-release.ts --mode registry"
```

The CLI entrypoint must parse only `--mode tarball|registry` and exit non-zero
on any failed assertion.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run tests/npm/package-readiness.test.ts tests/npm/release-smoke.test.ts
rtk pnpm test:npm:registry
```

Expected: tarball and real-registry consumers import SDK, initialize MCP, list
the expected current forensic tools, and find no workspace protocols.

Commit:

```powershell
rtk git add scripts/verify-npm-release.ts tests/npm/release-smoke.test.ts tests/npm/package-readiness.test.ts package.json .gitignore
rtk git commit -m "test(npm): prove clean public installs"
```

---

### Task 3: Replace Stale Public Package and Product Copy

**Files:**

- Modify: `README.md`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/about/page.tsx`
- Modify: `apps/web/components/install-agentrail-card.tsx`
- Modify: `docs/operations/mcp.md`
- Modify: `docs/community/founding-testers.md`
- Modify: `tests/docs/documentation.test.ts`
- Modify: `tests/e2e/landing.spec.ts`

**Interfaces:**

- The primary live install is `npm install @agentrail-sdk/sdk`.
- The live local MCP command is `npx -y @agentrail-sdk/mcp`.
- The current MCP boundary is described as a read-only forensic profile until
  M1 ships Context Relay.
- Source-link behavior follows validated build-time configuration.

- [ ] **Step 1: Rewrite documentation assertions first**

Replace stale assertions:

```ts
expect(readme).toContain("npm install @agentrail-sdk/sdk");
expect(readme).toContain("npx -y @agentrail-sdk/mcp");
expect(readme).toMatch(/published on npm/i);
expect(readme).not.toMatch(/npm authentication/i);
expect(readme).not.toMatch(/publish-ready/i);
expect(readme).not.toMatch(/pnpm pack is the public install path/i);
expect(readme).toContain("npm install agentrail");
expect(readme).toContain("is not this project");
```

Add a package status table assertion containing all four scoped package names
and their current versions.

In the landing E2E, replace a hard-coded zero Source-link count with:

```ts
const sourceUrl = process.env.NEXT_PUBLIC_AGENTRAIL_SOURCE_URL?.trim();
const sourceLinks = page.getByRole("link", { name: /source/i });

if (sourceUrl) {
  await expect(sourceLinks.first()).toHaveAttribute("href", sourceUrl);
} else {
  await expect(sourceLinks).toHaveCount(0);
}
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run tests/docs/documentation.test.ts
rtk playwright test tests/e2e/landing.spec.ts --project=desktop
```

Expected: FAIL because public copy still describes a pre-publish state.

- [ ] **Step 3: Update public copy without changing the product boundary**

Required page hierarchy:

1. live npm install section;
2. two paths: SDK recording and MCP forensic inspection;
3. current limitations;
4. source and guided demo;
5. Context Relay labeled as the next verified milestone, not an active feature.

Do not advertise auto-injection, token reduction, accounts, analytics, or
receipts in M0.

The install card must use a real `<button>` for copy actions and provide a
polite live region with `Copied` feedback. Links remain links. Do not add a link
to npm's unscoped `agentrail` package.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run tests/docs/documentation.test.ts apps/web/tests/design-contract.test.ts
rtk playwright test tests/e2e/landing.spec.ts --project=desktop
```

Expected: docs, design contract, and landing E2E pass.

Commit:

```powershell
rtk git add README.md apps/web/app/page.tsx apps/web/app/about/page.tsx apps/web/components/install-agentrail-card.tsx docs/operations/mcp.md docs/community/founding-testers.md tests/docs/documentation.test.ts tests/e2e/landing.spec.ts
rtk git commit -m "docs: publish verified AgentRail install paths"
```

---

### Task 4: Repair Dashboard Keyboard Order Without Weakening Accessibility

**Files:**

- Modify: `apps/web/components/install-agentrail-card.tsx`
- Modify: `apps/web/app/(dashboard)/traces/page.tsx`
- Modify: `tests/e2e/dashboard-a11y.spec.ts`
- Modify: `apps/web/tests/design-contract.test.ts`

**Interfaces:**

- Desktop order:
  home → dashboard navigation → sample CTA → filter controls → first run.
- Mobile order:
  home → dashboard navigation → disclosure → filter controls → first run.
- Copy controls inside secondary installation guidance must not appear before the
  primary archive controls.

- [ ] **Step 1: Capture actual focus order**

Add a temporary assertion helper that collects accessible names after repeated
`page.keyboard.press("Tab")`. Keep the final helper but remove debugging output.

The final test must assert:

```ts
expect(await tabSequence(page, 8)).toEqual([
  "AgentRail home",
  "Agent runs",
  "Open guided sample",
  "Search runs",
  "Status",
  "Agent",
  "Apply filters",
  "Open Research answer",
]);
```

Use the mobile-specific expected sequence from the rendered mobile disclosure;
do not force desktop controls into the mobile DOM.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk playwright test tests/e2e/dashboard-a11y.spec.ts
```

Expected: current install guidance inserts unexpected focus targets.

- [ ] **Step 3: Correct composition, not tabindex**

Move secondary install guidance after the archive table or place its commands
inside a native `<details>` whose summary follows the archive controls.

Do not use positive `tabIndex`. Do not remove keyboard access from an otherwise
interactive control. Do not update the test to accept a confusing order.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk playwright test tests/e2e/dashboard-a11y.spec.ts
rtk vitest run apps/web/tests/design-contract.test.ts
```

Expected: desktop and mobile focus sequences pass; touch target and semantic
control checks remain green.

Commit:

```powershell
rtk git add apps/web/components/install-agentrail-card.tsx "apps/web/app/(dashboard)/traces/page.tsx" tests/e2e/dashboard-a11y.spec.ts apps/web/tests/design-contract.test.ts
rtk git commit -m "fix(web): restore logical archive focus order"
```

---

### Task 5: Add Public Configuration, Contact, Legal, and Trust Routes

**Files:**

- Create: `apps/web/lib/public-config.ts`
- Create: `apps/web/lib/public-config.test.ts`
- Create: `apps/web/components/public-site-shell.tsx`
- Create: `apps/web/app/privacy/page.tsx`
- Create: `apps/web/app/terms/page.tsx`
- Create: `apps/web/app/security/page.tsx`
- Create: `apps/web/app/architecture/page.tsx`
- Modify: `apps/web/app/about/page.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `.env.example`
- Modify: `tests/e2e/landing.spec.ts`
- Modify: `tests/docs/documentation.test.ts`

**Interfaces:**

```ts
export type PublicAgentRailConfig = {
  siteUrl: URL;
  sourceUrl: URL | null;
  contactUrl: URL | null;
  testerIntakeUrl: URL | null;
};

export function readPublicAgentRailConfig(
  env?: NodeJS.ProcessEnv,
): PublicAgentRailConfig;
```

- [ ] **Step 1: Write failing config tests**

```ts
it("defaults the canonical site to agentrail.id", () => {
  expect(readPublicAgentRailConfig({}).siteUrl.href).toBe(
    "https://agentrail.id/",
  );
});

it.each([
  "http://example.com",
  "javascript:alert(1)",
  "/relative",
  "not a url",
])("rejects unsafe optional public URL %s", (value) => {
  expect(
    readPublicAgentRailConfig({
      NEXT_PUBLIC_AGENTRAIL_CONTACT_URL: value,
    }).contactUrl,
  ).toBeNull();
});
```

Also prove an `https://` URL survives unchanged.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run apps/web/lib/public-config.test.ts
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the helper and trust pages**

`readPublicAgentRailConfig` must read only the four documented public env vars,
normalize the site URL to an origin, and return `null` for invalid optional
URLs.

Required trust content:

- `/privacy`: local-only, metrics-only, evidence-sync distinctions; exact
  metrics-only exclusions; retention status; user controls that are current
  versus roadmap.
- `/terms`: Apache-2.0 software boundary, service availability, acceptable use,
  no warranty, and a neutral governing-law placeholder is **not allowed**.
  State that hosted service terms will be updated before hosted beta instead of
  inventing a jurisdiction.
- `/security`: link to `SECURITY.md` through configured source URL when
  available; responsible disclosure uses configured contact URL; no fake email.
- `/architecture`: factual local/AWS component boundary, current versus planned
  status, privacy modes, and a direct link to the full repository architecture
  document when source is configured.
- `/about`: founder/product statement and factual current stage.

Each page exports unique `Metadata`. `PublicSiteShell` provides consistent home,
about, architecture, privacy, terms, security, and optional contact navigation.
It must not link `/docs` until M1 creates that route.

Add:

```env
NEXT_PUBLIC_AGENTRAIL_SITE_URL=https://agentrail.id
NEXT_PUBLIC_AGENTRAIL_CONTACT_URL=
NEXT_PUBLIC_AGENTRAIL_TESTER_INTAKE_URL=
```

- [ ] **Step 4: Add route and link E2E coverage**

For each route, assert status `200`, one `<h1>`, unique page title, home
navigation, and no `mailto:` link unless a real mail URL is explicitly
configured.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```powershell
rtk vitest run apps/web/lib/public-config.test.ts tests/docs/documentation.test.ts apps/web/tests/design-contract.test.ts
rtk playwright test tests/e2e/landing.spec.ts
```

Expected: config, public route, design, and navigation tests pass.

Commit:

```powershell
rtk git add apps/web/lib/public-config.ts apps/web/lib/public-config.test.ts apps/web/components/public-site-shell.tsx apps/web/app/privacy/page.tsx apps/web/app/terms/page.tsx apps/web/app/security/page.tsx apps/web/app/architecture/page.tsx apps/web/app/about/page.tsx apps/web/app/page.tsx apps/web/app/globals.css .env.example tests/e2e/landing.spec.ts tests/docs/documentation.test.ts
rtk git commit -m "feat(web): add public trust and legal surfaces"
```

---

### Task 6: Add Canonical Metadata, Robots, Sitemap, and Social Evidence

**Files:**

- Create: `apps/web/app/robots.ts`
- Create: `apps/web/app/sitemap.ts`
- Create: `apps/web/app/opengraph-image.tsx`
- Create: `apps/web/tests/metadata-routes.test.ts`
- Modify: `apps/web/app/layout.tsx`
- Modify: `tests/e2e/landing.spec.ts`

**Interfaces:**

- Canonical origin comes from `readPublicAgentRailConfig`.
- Public sitemap includes `/`, `/about`, `/architecture`, `/privacy`, `/terms`,
  `/security`, and `/traces`.
- Authenticated/private routes introduced later are never indexed.

- [ ] **Step 1: Write failing metadata route tests**

```ts
import robots from "../app/robots";
import sitemap from "../app/sitemap";

it("allows public pages and points at the canonical sitemap", () => {
  expect(robots()).toMatchObject({
    rules: expect.arrayContaining([
      expect.objectContaining({ userAgent: "*", allow: "/" }),
    ]),
    sitemap: "https://agentrail.id/sitemap.xml",
  });
});

it("lists only current public routes", () => {
  expect(sitemap().map((entry) => new URL(entry.url).pathname)).toEqual([
    "/",
    "/about",
    "/architecture",
    "/privacy",
    "/security",
    "/terms",
    "/traces",
  ]);
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run apps/web/tests/metadata-routes.test.ts
```

Expected: FAIL because metadata routes do not exist.

- [ ] **Step 3: Implement metadata**

Set root metadata:

```ts
export const metadata: Metadata = {
  metadataBase: readPublicAgentRailConfig().siteUrl,
  title: { default: "AgentRail", template: "%s · AgentRail" },
  description:
    "Local-first context and forensic evidence for developers building with AI agents.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "AgentRail",
    title: "AgentRail",
    description:
      "Local-first context and forensic evidence for developers building with AI agents.",
  },
  twitter: { card: "summary_large_image" },
};
```

The generated Open Graph image uses only the AgentRail wordmark, restrained
graphite/warm-white/amber palette, and factual positioning. No customer logos,
AWS badge, funding claim, robot art, gradient, or fake metric.

- [ ] **Step 4: Verify GREEN endpoints and commit**

Run:

```powershell
rtk vitest run apps/web/tests/metadata-routes.test.ts
rtk pnpm --filter @agentrail-sdk/web build
rtk playwright test tests/e2e/landing.spec.ts --project=desktop
```

Expected: build exposes `/robots.txt`, `/sitemap.xml`, and generated Open Graph
image; tests pass.

Commit:

```powershell
rtk git add apps/web/app/robots.ts apps/web/app/sitemap.ts apps/web/app/opengraph-image.tsx apps/web/app/layout.tsx apps/web/tests/metadata-routes.test.ts tests/e2e/landing.spec.ts
rtk git commit -m "feat(web): publish canonical discovery metadata"
```

---

### Task 7: Create a Real Founding-Tester Intake and Interview Loop

**Files:**

- Create: `.github/ISSUE_TEMPLATE/founding-tester.yml`
- Create: `apps/web/app/founding-testers/page.tsx`
- Create: `docs/community/founding-tester-interview.md`
- Modify: `docs/community/founding-testers.md`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/sitemap.ts`
- Modify: `apps/web/tests/metadata-routes.test.ts`
- Modify: `tests/docs/documentation.test.ts`
- Modify: `tests/e2e/landing.spec.ts`

**Interfaces:**

- Public intake uses only
  `NEXT_PUBLIC_AGENTRAIL_TESTER_INTAKE_URL` after HTTPS validation.
- Fallback is a clear “intake is being prepared” state, not a dead button or
  fake form.
- GitHub issue template forbids secrets, proprietary source, prompt content,
  and credentials.

- [ ] **Step 1: Add failing intake contract tests**

Assert:

```ts
expect(testers).toContain("installation completed");
expect(testers).toContain("first Context Pack created");
expect(testers).toContain("returned within seven days");
expect(testers).toContain("uninstall reason");
expect(testers).not.toMatch(/already used by|customers|active users/i);
```

Add E2E states for configured and unconfigured intake URLs.
Update the sitemap contract to include `/founding-testers` in sorted route
order.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run tests/docs/documentation.test.ts
rtk playwright test tests/e2e/landing.spec.ts --project=desktop
```

Expected: FAIL because current intake has no tested public state.

- [ ] **Step 3: Implement intake and structured interview**

The issue form asks:

- client: Codex or Claude;
- operating system;
- repository language;
- installation outcome;
- first Context Pack outcome;
- willingness for a 20-minute interview;
- consent for anonymized aggregate use.

It must include:

```yaml
body:
  - type: markdown
    attributes:
      value: "Do not paste source code, prompts, API keys, credentials, or proprietary data."
```

The interview guide records task category, context miss, useful sources,
irrelevant sources, latency perception, privacy concern, uninstall reason, and
permission for an anonymized quote. Empty traction fields remain empty.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run tests/docs/documentation.test.ts
rtk playwright test tests/e2e/landing.spec.ts
```

Expected: landing and tester page expose only working configured actions or an
honest unavailable state.

Commit:

```powershell
rtk git add .github/ISSUE_TEMPLATE/founding-tester.yml apps/web/app/founding-testers/page.tsx docs/community/founding-tester-interview.md docs/community/founding-testers.md apps/web/app/page.tsx apps/web/app/sitemap.ts apps/web/tests/metadata-routes.test.ts tests/docs/documentation.test.ts tests/e2e/landing.spec.ts
rtk git commit -m "feat(community): add founding tester intake"
```

---

### Task 8: Build the Evidence-Linked AWS Application Pack

**Files:**

- Create: `docs/startup/aws-activate-application.md`
- Create: `docs/startup/aws-90-day-credit-plan.md`
- Create: `docs/startup/evidence-register.md`
- Create: `docs/startup/application-readiness-checklist.md`
- Modify: `docs/deployment/aws.md`
- Modify: `docs/startup/pitch.md`
- Modify: `tests/docs/documentation.test.ts`

**Interfaces:**

- Every application answer has `Claim`, `Evidence`, `Status`, and `Owner`.
- Status is one of `verified`, `pending`, or `not-applicable`.
- Pending evidence is never rendered as completed traction.

- [ ] **Step 1: Write failing evidence tests**

Add:

```ts
const application = readFileSync(
  "docs/startup/aws-activate-application.md",
  "utf8",
);
const evidence = readFileSync("docs/startup/evidence-register.md", "utf8");

expect(application).toContain("Problem");
expect(application).toContain("Solution");
expect(application).toContain("Target user");
expect(application).toContain("Why AWS");
expect(application).toContain("90-day plan");
expect(application).toMatch(/does not guarantee acceptance/i);
expect(evidence).toContain("| Claim | Evidence | Status | Owner |");
expect(application).not.toMatch(
  /guaranteed|already funded|thousands of users/i,
);
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run tests/docs/documentation.test.ts
```

Expected: FAIL because the application pack is absent.

- [ ] **Step 3: Write evidence-first content**

Required application sections:

1. one-sentence company/product description;
2. problem for individual AI developers;
3. current verified product;
4. Context Relay milestone with explicit implementation status;
5. target user and initial distribution;
6. open-source and npm evidence;
7. founding-tester validation plan;
8. why AWS is technically required;
9. 90-day AWS service and spend plan;
10. risks and mitigations;
11. truthful traction fields;
12. checklist of account/company consistency.

The 90-day plan maps:

- API Gateway/Lambda for bounded ingestion and activation;
- SQS/Lambda worker for async processing;
- RDS PostgreSQL for private scoped state;
- S3 only for opt-in evidence;
- Secrets Manager for credentials;
- CloudWatch and AWS Budgets before beta traffic.

Use ranges and assumptions, not fabricated invoices.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run tests/docs/documentation.test.ts
rtk pnpm exec prettier --check docs/startup docs/deployment/aws.md
```

Expected: docs tests and formatting pass.

Commit:

```powershell
rtk git add docs/startup/aws-activate-application.md docs/startup/aws-90-day-credit-plan.md docs/startup/evidence-register.md docs/startup/application-readiness-checklist.md docs/deployment/aws.md docs/startup/pitch.md tests/docs/documentation.test.ts
rtk git commit -m "docs(startup): add evidence-linked AWS application pack"
```

---

### Task 9: Make CI and Production Verification Enforce M0

**Files:**

- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/registry-smoke.yml`
- Create: `scripts/verify-production.ts`
- Create: `tests/smoke/production-contract.test.ts`
- Modify: `package.json`
- Modify: `docs/startup/evidence-register.md`

**Interfaces:**

```ts
export type ProductionCheck = {
  name: string;
  url: string;
  ok: boolean;
  status: number | null;
  detail: string;
};

export async function verifyProduction(
  origin: URL,
): Promise<readonly ProductionCheck[]>;
```

- [ ] **Step 1: Write failing production contract tests**

Use a local fake HTTP server and prove the verifier checks:

- `/`;
- `/traces`;
- `/about`;
- `/architecture`;
- `/privacy`;
- `/terms`;
- `/security`;
- `/founding-testers`;
- `/robots.txt`;
- `/sitemap.xml`;
- canonical URL;
- no active CTA with an empty `href`;
- synthetic demo labeling.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run tests/smoke/production-contract.test.ts
```

Expected: FAIL because the production verifier does not exist.

- [ ] **Step 3: Implement verification and CI jobs**

Add:

```json
"test:production": "tsx scripts/verify-production.ts"
```

`AGENTRAIL_WEB_URL` defaults to `https://agentrail.id`. The script uses a
10-second timeout per request, follows at most five redirects, prints no
cookies, and exits non-zero if any check fails.

CI order after service readiness:

```yaml
- run: pnpm format:check
- run: pnpm typecheck
- run: pnpm test
- run: pnpm build
- run: pnpm test:e2e
- run: pnpm test:npm:tarball
```

The separate `registry-smoke.yml` runs on `workflow_dispatch` and a weekly
schedule. It performs only public registry smoke and production HTTP checks. It
has no publish token and cannot release packages.

- [ ] **Step 4: Verify GREEN with the full local gate**

Run:

```powershell
rtk pnpm format:check
rtk pnpm typecheck
rtk pnpm test
rtk pnpm build
rtk pnpm test:e2e
rtk pnpm test:npm:tarball
rtk pnpm test:npm:registry
rtk pnpm test:production
```

Expected: every command exits `0`. If infrastructure integration tests require
PostgreSQL/Redis/MinIO, start the repository's documented Docker Compose
services and rerun; do not mark those tests skipped as proof.

- [ ] **Step 5: Update evidence with actual run URLs and commit**

Add only real workflow/deployment URLs and observed dates to the evidence
register. Pending fields remain `pending`.

Commit:

```powershell
rtk git add .github/workflows/ci.yml .github/workflows/registry-smoke.yml scripts/verify-production.ts tests/smoke/production-contract.test.ts package.json docs/startup/evidence-register.md
rtk git commit -m "ci: enforce public readiness evidence"
```

## M0 Final Verification

Run:

```powershell
rtk git status --short
rtk git diff --check origin/main...HEAD
rtk pnpm format:check
rtk pnpm typecheck
rtk pnpm test
rtk pnpm build
rtk pnpm test:e2e
rtk pnpm test:npm:tarball
rtk pnpm test:npm:registry
rtk pnpm test:production
```

Then verify public responses:

```powershell
rtk curl https://agentrail.id/
rtk curl https://agentrail.id/robots.txt
rtk curl https://agentrail.id/sitemap.xml
rtk npm view @agentrail-sdk/sdk version
rtk npm view @agentrail-sdk/mcp version
```

Expected:

- worktree contains only intended milestone changes;
- all test/build/smoke commands exit `0`;
- public pages and metadata return successful responses;
- registry reports the documented versions;
- evidence register includes real URLs/dates and no invented result.

Request code review, resolve findings, then use
`superpowers:verification-before-completion` before calling M0 complete.
