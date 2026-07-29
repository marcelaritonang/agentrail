# AgentRail M1 Local Context Relay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Use
> `design-taste-frontend` only for the landing and documentation surfaces in
> Task 12. Use `superpowers:verification-before-completion` at the exit gate.

**Goal:** Let an individual developer install AgentRail into Codex or Claude,
request a task-specific Context Pack from a real local repository under a token
budget, retain reviewable local project memory and receipts, and uninstall
without damaging unrelated client configuration.

**Architecture:** Add a dependency-light `@agentrail-sdk/context` engine for
safe scanning, deterministic indexing/ranking, budgeting, memory, receipts, and
a bounded telemetry spool. Extend `@agentrail-sdk/mcp` with profile-aware local
Context Relay tools. Add a public `@agentrail-sdk/cli` that owns setup, doctor,
direct context generation, and uninstall. Context generation never waits for
the network and never requires the existing AgentRail database.

**Tech Stack:** Node.js 24, pnpm 11, TypeScript 5.9, MCP TypeScript SDK 1.x,
Zod 4, `ignore` 7, Vitest 4, Next.js 16.2, Playwright 1.61. No native
dependency, embedding service, tokenizer download, graph database, Docker
requirement, or always-on watcher.

## Global Constraints

- Approved design:
  `docs/superpowers/specs/2026-07-29-agentrail-context-relay-design.md`.
- M0 must be green before this plan begins.
- The context engine accepts one validated workspace root and never reads
  outside it.
- Respect `.gitignore`, `.agentrailignore`, dependency/build directories,
  binary detection, secret patterns, and explicit excludes.
- Reject symlinks resolving outside the workspace.
- Initial limits: 10,000 files, 1 MB per file, 200 MB cache, 5-second cold
  deadline, 150 MB memory target.
- Do not scan during MCP startup. Build lazily on first context request.
- A deadline returns a labeled partial result, not a hidden omission.
- Returned sources include relative path, line locator, hash, trust class,
  relevance reasons, score, freshness, estimated tokens, and truncation.
- Absolute paths may exist in local client config but never enter telemetry or
  hosted receipt fields.
- Token counts are labeled estimates unless a configured compatible tokenizer
  actually measures them.
- `context_reduction_estimate` compares the considered candidate set with the
  returned pack. It is not repository size, money saved, or guaranteed model
  input reduction.
- `local-only` writes local cache/memory/receipts only and creates no cloud
  usage event.
- The local spool is capped at 10 MB and seven days; overflow drops oldest
  metrics-only events and records a warning.
- Arbitrary URL fetching is disabled.
- Setup is idempotent, writes a timestamped backup before mutation, detects an
  unmanaged AgentRail conflict, and supports uninstall restoration.
- Codex and Claude are the only advertised M1 clients.
- Repository development and full CI remain on Node.js 24, but the public
  context/MCP/CLI runtime compiles to ES2022 and declares
  `node >=22.13 <25`. Release smoke runs on Node 22.13+ and Node 24.
- Existing forensics tools remain available through `forensics` and
  `context+forensics` profiles.
- The final default `context` profile registers exactly:
  `agentrail_prepare_context`, `agentrail_recall`, `agentrail_remember`, and
  `agentrail_report_outcome`.
- All changes use TDD, focused verification, and small commits.
- Every **Verify RED** command must fail on a newly added behavioral assertion
  because the named production behavior is missing. Syntax, dependency, or
  environment failures do not count; repair the harness before implementation.

## Package and Storage Layout

```text
packages/context/
  src/types.ts                 public engine contracts
  src/workspace.ts             root and path security
  src/ignore.ts                gitignore/agentrailignore/default rules
  src/scanner.ts               bounded file discovery
  src/chunker.ts               line/symbol-aware chunks
  src/tokens.ts                deterministic heuristic measurement
  src/cache.ts                 atomic incremental cache
  src/rank.ts                  deterministic candidate score
  src/pack.ts                  budgeted Context Pack assembly
  src/memory.ts                local structured decision store
  src/receipts.ts              local receipt and outcome store
  src/spool.ts                 bounded optional cloud-event spool
  src/index.ts                 public exports
packages/cli/
  src/main.ts                  executable entry
  src/commands/*.ts            setup, doctor, context, uninstall
  src/clients/codex.ts         managed TOML block
  src/clients/claude.ts        project .mcp.json merge
  src/config-backup.ts         atomic backup/restore
packages/mcp/
  src/profile.ts               exact tool lists
  src/context-tools.ts         Context Relay handlers
  src/forensics-tools.ts       existing read-only handlers
tests/fixtures/
  context-repositories/        deterministic source fixtures
  client-configs/              Windows/POSIX merge and rollback fixtures
.agentrail/
  cache/v1/index.json          ignored derived data
  memory/v1.jsonl              reviewable local decisions
  receipts/v1/*.json           local Context Pack receipts
  spool/v1/events.jsonl        bounded optional metrics events
```

---

### Task 1: Scaffold the Context Engine and Stable Contracts

**Files:**

- Create: `packages/context/package.json`
- Create: `packages/context/tsconfig.json`
- Create: `packages/context/src/types.ts`
- Create: `packages/context/src/contracts.test.ts`
- Create: `packages/context/src/index.ts`
- Modify: `vitest.config.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

```ts
export type SourceTrust =
  | "trusted_instruction"
  | "project_source"
  | "project_documentation"
  | "project_memory"
  | "untrusted_content";

export type ContextWarningCode =
  | "partial_index"
  | "file_limit"
  | "file_too_large"
  | "binary_excluded"
  | "secret_excluded"
  | "symlink_escape"
  | "cache_rebuilt"
  | "budget_too_small"
  | "spool_overflow";

export type ContextPackRequest = {
  task: string;
  tokenBudget: number;
  focus?: readonly string[];
  exclude?: readonly string[];
};

export type ContextItem = {
  sourceId: string;
  path: string;
  locator: { startLine: number; endLine: number; symbol: string | null };
  content: string;
  contentHash: string;
  trust: SourceTrust;
  reasons: readonly string[];
  score: number;
  freshness: string;
  estimatedTokens: number;
  truncated: boolean;
};

export type ContextMeasurement = {
  candidateTokensEstimate: number;
  returnedTokensEstimate: number;
  contextReductionEstimate: number;
  method: "heuristic-v1";
  confidence: "estimated";
};

export type ContextPack = {
  packId: string;
  status: "ready" | "partial" | "empty";
  context: readonly ContextItem[];
  decisions: readonly ProjectMemoryRecord[];
  warnings: readonly { code: ContextWarningCode; detail: string }[];
  measurement: ContextMeasurement;
  receiptUrl: string | null;
};
```

- [ ] **Step 1: Write failing schema-invariant tests**

```ts
import { describe, expect, it } from "vitest";
import { ContextPackRequestSchema, relativeContextPath } from "./types";

describe("Context Relay contracts", () => {
  it("bounds a context request", () => {
    expect(
      ContextPackRequestSchema.parse({
        task: "Add OAuth without changing session semantics",
        tokenBudget: 4_000,
        focus: ["auth", "tests"],
      }),
    ).toMatchObject({ tokenBudget: 4_000 });

    expect(() =>
      ContextPackRequestSchema.parse({ task: "", tokenBudget: 4_000 }),
    ).toThrow();
    expect(() =>
      ContextPackRequestSchema.parse({ task: "x", tokenBudget: 64 }),
    ).toThrow();
  });

  it("accepts only normalized relative context paths", () => {
    expect(relativeContextPath("src/auth.ts")).toBe("src/auth.ts");
    expect(() => relativeContextPath("../secret")).toThrow();
    expect(() => relativeContextPath("C:\\secret.txt")).toThrow();
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/context/src/contracts.test.ts
```

Expected: FAIL because the package and contracts do not exist.

- [ ] **Step 3: Implement minimal contracts**

Use Zod schemas with:

- task length `1..2,000`;
- token budget `256..32,000`;
- at most 20 focus/exclude strings;
- each focus/exclude string `1..100`;
- normalized forward-slash paths with no drive, leading slash, NUL, `.` or
  `..` segment.

Package dependencies:

```json
{
  "dependencies": {
    "ignore": "^7.0.0",
    "zod": "^4.1.0"
  }
}
```

`packages/context/tsconfig.json` overrides `target` and `lib` to `ES2022`.
Its manifest declares:

```json
"engines": { "node": ">=22.13 <25" }
```

Add the `@agentrail-sdk/context` source alias to `vitest.config.ts`.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/context/src/contracts.test.ts
rtk tsc -p packages/context/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add packages/context/package.json packages/context/tsconfig.json packages/context/src/types.ts packages/context/src/contracts.test.ts packages/context/src/index.ts vitest.config.ts pnpm-lock.yaml
rtk git commit -m "feat(context): define Context Relay contracts"
```

---

### Task 2: Implement Workspace Containment, Ignore Rules, and Safe Scanning

**Files:**

- Create: `packages/context/src/workspace.ts`
- Create: `packages/context/src/workspace.test.ts`
- Create: `packages/context/src/ignore.ts`
- Create: `packages/context/src/ignore.test.ts`
- Create: `packages/context/src/scanner.ts`
- Create: `packages/context/src/scanner.test.ts`
- Create: `tests/fixtures/context-repositories/scanner/.gitignore`
- Create: `tests/fixtures/context-repositories/scanner/.agentrailignore`
- Create: `tests/fixtures/context-repositories/scanner/src/app.ts`
- Create: `tests/fixtures/context-repositories/scanner/docs/guide.md`
- Create: `tests/fixtures/context-repositories/scanner/.env`

**Interfaces:**

```ts
export type ScanLimits = {
  maxFiles: number;
  maxFileBytes: number;
  deadlineMs: number;
};

export type ScannedFile = {
  relativePath: string;
  absolutePath: string;
  bytes: number;
  modifiedAt: string;
  trust: SourceTrust;
};

export async function resolveWorkspaceRoot(input: string): Promise<string>;
export async function scanWorkspace(input: {
  root: string;
  include?: readonly string[];
  exclude?: readonly string[];
  limits?: Partial<ScanLimits>;
  now?: () => number;
}): Promise<{
  files: readonly ScannedFile[];
  warnings: readonly ContextWarning[];
  complete: boolean;
}>;
```

- [ ] **Step 1: Write failing security tests**

Cover:

```ts
expect(paths).toContain("src/app.ts");
expect(paths).toContain("docs/guide.md");
expect(paths).not.toContain(".env");
expect(paths).not.toContain("node_modules/pkg/index.js");
expect(paths).not.toContain("dist/generated.js");
expect(paths).not.toContain("ignored.tmp");
```

Create a test-time symlink whose target is outside the fixture. On Windows,
skip only when the OS explicitly rejects symlink creation; the POSIX CI case
must run. Assert warning `symlink_escape` and no external file.

Also cover:

- nonexistent root;
- root is a file;
- file count boundary;
- file size boundary;
- NUL-containing binary;
- `.pem`, `id_rsa`, `credentials`, `.npmrc`, and `.env.*`;
- deadline returns `complete: false` and `partial_index`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/context/src/workspace.test.ts packages/context/src/ignore.test.ts packages/context/src/scanner.test.ts
```

- [ ] **Step 3: Implement safe traversal**

Use `fs.realpath`, `fs.opendir`, and `lstat`. Before reading a candidate:

1. obtain real workspace root;
2. normalize candidate to repository-relative POSIX path;
3. reject default dependency/build/secret rules;
4. apply `.gitignore`, then `.agentrailignore`, then explicit excludes;
5. resolve symlinks and require the result to equal root or start with
   `${root}${sep}`;
6. reject files over the byte limit;
7. read at most the allowed bytes and reject NUL-containing content.

Use `ignore().add(fileContents)` only with repository-relative paths. Directory
checks include a trailing slash, matching the library contract.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/context/src/workspace.test.ts packages/context/src/ignore.test.ts packages/context/src/scanner.test.ts
rtk tsc -p packages/context/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add packages/context/src/workspace.ts packages/context/src/workspace.test.ts packages/context/src/ignore.ts packages/context/src/ignore.test.ts packages/context/src/scanner.ts packages/context/src/scanner.test.ts tests/fixtures/context-repositories/scanner
rtk git commit -m "feat(context): scan workspaces within safe bounds"
```

---

### Task 3: Add Deterministic Chunking and Token Estimation

**Files:**

- Create: `packages/context/src/chunker.ts`
- Create: `packages/context/src/chunker.test.ts`
- Create: `packages/context/src/tokens.ts`
- Create: `packages/context/src/tokens.test.ts`
- Create: `tests/fixtures/context-repositories/quality/src/auth.ts`
- Create: `tests/fixtures/context-repositories/quality/src/auth.test.ts`
- Create: `tests/fixtures/context-repositories/quality/docs/session.md`
- Create: `tests/fixtures/context-repositories/quality/AGENTS.md`

**Interfaces:**

```ts
export type SourceChunk = {
  sourceId: string;
  relativePath: string;
  startLine: number;
  endLine: number;
  symbol: string | null;
  text: string;
  contentHash: string;
  trust: SourceTrust;
  modifiedAt: string;
  estimatedTokens: number;
};

export function estimateTokens(text: string): number;
export function chunkTextFile(input: {
  relativePath: string;
  text: string;
  trust: SourceTrust;
  modifiedAt: string;
  maxEstimatedTokens?: number;
}): readonly SourceChunk[];
```

- [ ] **Step 1: Write failing chunk and measurement tests**

Required assertions:

```ts
expect(estimateTokens("")).toBe(0);
expect(estimateTokens("abcd")).toBe(1);
expect(estimateTokens("é")).toBe(1);

expect(chunks.map((chunk) => chunk.symbol)).toEqual(
  expect.arrayContaining(["createSession", "revokeSession"]),
);
expect(chunks.every((chunk) => chunk.startLine <= chunk.endLine)).toBe(true);
expect(chunks.every((chunk) => chunk.estimatedTokens <= 1_024)).toBe(true);
expect(new Set(chunks.map((chunk) => chunk.sourceId)).size).toBe(chunks.length);
```

Also test Markdown headings, long unbroken text, CRLF input, and stable IDs
across repeated runs.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/context/src/chunker.test.ts packages/context/src/tokens.test.ts
```

- [ ] **Step 3: Implement minimal deterministic logic**

Heuristic:

```ts
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.max(1, Math.ceil(Buffer.byteLength(text, "utf8") / 4));
}
```

Chunk boundaries:

- trusted instruction file: headings or 1,024-estimated-token windows;
- Markdown: headings;
- TypeScript/JavaScript: exported/function/class/interface/type/enum declaration
  starts;
- other text: paragraph boundaries;
- oversize unit: line-bounded windows;
- at most 1,024 estimated tokens per source chunk.

`sourceId` is a SHA-256 digest of normalized path, line range, and content hash.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/context/src/chunker.test.ts packages/context/src/tokens.test.ts
rtk tsc -p packages/context/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add packages/context/src/chunker.ts packages/context/src/chunker.test.ts packages/context/src/tokens.ts packages/context/src/tokens.test.ts tests/fixtures/context-repositories/quality
rtk git commit -m "feat(context): chunk and estimate local sources"
```

---

### Task 4: Build an Atomic Incremental Local Index

**Files:**

- Create: `packages/context/src/cache.ts`
- Create: `packages/context/src/cache.test.ts`
- Create: `packages/context/src/indexer.ts`
- Create: `packages/context/src/indexer.test.ts`
- Modify: `packages/context/src/index.ts`

**Interfaces:**

```ts
export type ContextIndexManifest = {
  schemaVersion: 1;
  rootDigest: string;
  generatedAt: string;
  files: Record<
    string,
    {
      bytes: number;
      modifiedAt: string;
      contentHash: string;
      chunks: readonly SourceChunk[];
    }
  >;
};

export async function buildContextIndex(input: {
  root: string;
  cacheDir?: string;
  deadlineMs?: number;
  now?: () => number;
}): Promise<{
  chunks: readonly SourceChunk[];
  warnings: readonly ContextWarning[];
  complete: boolean;
  reusedFiles: number;
  indexedFiles: number;
}>;
```

- [ ] **Step 1: Write failing cache lifecycle tests**

Test:

- first build indexes fixture files;
- second build reuses unchanged entries;
- one modified file reindexes only that file;
- deleted file disappears;
- corrupt JSON returns `cache_rebuilt` and a usable result;
- temp-write failure leaves the previous manifest readable;
- root digest mismatch does not reuse another repository;
- a fake clock crossing deadline returns `partial_index`;
- MCP/server construction does not call `buildContextIndex`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/context/src/cache.test.ts packages/context/src/indexer.test.ts
```

- [ ] **Step 3: Implement cache semantics**

Default cache path is `.agentrail/cache/v1/index.json`. Write:

1. JSON to a unique `index.json.${process.pid}.${nonce}.tmp` path;
2. `fsync` file;
3. rename over the final manifest;
4. best-effort cleanup in `finally`.

Use metadata as a fast unchanged signal and SHA-256 content as the definitive
signal before reusing chunks. Enforce serialized cache size below 200 MB.
Corruption is never fatal to a Context Pack.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/context/src/cache.test.ts packages/context/src/indexer.test.ts
rtk tsc -p packages/context/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add packages/context/src/cache.ts packages/context/src/cache.test.ts packages/context/src/indexer.ts packages/context/src/indexer.test.ts packages/context/src/index.ts
rtk git commit -m "feat(context): cache an incremental local index"
```

---

### Task 5: Rank, Deduplicate, Diversify, and Enforce the Budget

**Files:**

- Create: `packages/context/src/rank.ts`
- Create: `packages/context/src/rank.test.ts`
- Create: `packages/context/src/budget.ts`
- Create: `packages/context/src/budget.test.ts`
- Create: `tests/fixtures/context-repositories/quality/task-cases.json`

**Interfaces:**

```ts
export type RankedChunk = SourceChunk & {
  score: number;
  reasons: readonly string[];
};

export function rankChunks(input: {
  request: ContextPackRequest;
  chunks: readonly SourceChunk[];
  changedPaths?: ReadonlySet<string>;
  importedBy?: ReadonlyMap<string, ReadonlySet<string>>;
}): readonly RankedChunk[];

export function assembleBudget(input: {
  ranked: readonly RankedChunk[];
  tokenBudget: number;
  reservedTokens?: number;
}): {
  selected: readonly RankedChunk[];
  candidateTokensEstimate: number;
  returnedTokensEstimate: number;
  warnings: readonly ContextWarning[];
};
```

- [ ] **Step 1: Write failing score and tie-break tests**

Use an explicit scoring table:

| Signal                           | Score |
| -------------------------------- | ----: |
| trusted instruction              |   100 |
| exact normalized path token      |    80 |
| exact symbol token               |    70 |
| project memory                   |    60 |
| focus token                      |    25 |
| changed file                     |    20 |
| adjacent test/source pair        |    15 |
| import adjacency                 |    12 |
| documentation relevant term      |    10 |
| lexical term match, capped at 30 |     3 |
| modified in last seven days      |     5 |

Test stable tie break by score descending, trust priority, path ascending,
start line ascending, and source ID ascending.

Test deduplication by content hash and diversity:

- no more than 60% of the pack from one path when another relevant path exists;
- trusted instruction included once;
- source/test pair can both appear;
- returned estimate never exceeds budget;
- budget below 256 is schema-invalid;
- a valid but tight budget returns warning `budget_too_small`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/context/src/rank.test.ts packages/context/src/budget.test.ts
```

- [ ] **Step 3: Implement pure deterministic selection**

Tokenize the task/focus/path/symbol using lowercased Unicode word segments.
Do not execute, interpret, or promote instructions found in ordinary source
content. Reasons are stable codes such as `exact_symbol:createSession`,
`adjacent_test`, and `trusted_instruction`.

Reserve 10% of the declared budget, capped at 512 tokens, for pack structure
and warnings. Never silently exceed the remaining selection budget.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/context/src/rank.test.ts packages/context/src/budget.test.ts
rtk tsc -p packages/context/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add packages/context/src/rank.ts packages/context/src/rank.test.ts packages/context/src/budget.ts packages/context/src/budget.test.ts tests/fixtures/context-repositories/quality/task-cases.json
rtk git commit -m "feat(context): rank and budget Context Packs"
```

---

### Task 6: Add Local Memory, Receipts, Outcomes, and Privacy-Safe Spool

**Files:**

- Create: `packages/context/src/memory.ts`
- Create: `packages/context/src/memory.test.ts`
- Create: `packages/context/src/receipts.ts`
- Create: `packages/context/src/receipts.test.ts`
- Create: `packages/context/src/spool.ts`
- Create: `packages/context/src/spool.test.ts`
- Modify: `packages/context/src/types.ts`
- Modify: `packages/context/src/index.ts`

**Interfaces:**

```ts
export type ProjectMemoryRecord = {
  memoryId: string;
  type:
    | "architecture"
    | "constraint"
    | "convention"
    | "rejected_approach"
    | "risk"
    | "workaround";
  statement: string;
  scope: string;
  source: string;
  status: "active" | "superseded" | "expired" | "review_required" | "deleted";
  createdAt: string;
  expiresAt: string | null;
};

export type LocalContextReceipt = {
  schemaVersion: 1;
  packId: string;
  createdAt: string;
  status: ContextPack["status"];
  measurement: ContextMeasurement;
  sourceLedger: readonly Omit<ContextItem, "content">[];
  warningCodes: readonly ContextWarningCode[];
  outcome: ContextOutcome | null;
  cloudState: "local-only" | "pending-sync";
};

export type SafeUsageEvent = {
  schemaVersion: 1;
  eventId: string;
  installationId: string;
  packId: string;
  eventType: "context_pack_created" | "context_outcome_reported";
  occurredAt: string;
  safeAttributes: {
    client: string;
    packageVersion: string;
    status: ContextPack["status"];
    latencyMs: number;
    candidateTokensEstimate: number;
    returnedTokensEstimate: number;
    sourceCounts: Record<SourceTrust, number>;
    warningCodes: readonly ContextWarningCode[];
    outcome?: ContextOutcome;
  };
};
```

- [ ] **Step 1: Write failing persistence and privacy tests**

Cover:

- explicit remember creates one structured record;
- repeated identical command with same `memoryId` is idempotent;
- recall excludes deleted/expired by default and ranks scope/query;
- invalid JSONL line is skipped with warning, not a crash;
- pack IDs match `^cp_[A-Za-z0-9_-]{24}$` or stronger entropy;
- local receipt contains relative provenance but no absolute path;
- `local-only` appends no spool event;
- `metrics-only` serialized event contains no task, prompt, path, content,
  snippet, patch, environment, or secret key;
- spool drops records older than seven days;
- spool over 10 MB drops oldest metrics-only events and reports
  `spool_overflow`;
- outcome updates the matching receipt and rejects an unknown pack.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/context/src/memory.test.ts packages/context/src/receipts.test.ts packages/context/src/spool.test.ts
```

- [ ] **Step 3: Implement atomic local stores**

- IDs use `randomBytes(18).toString("base64url")`.
- JSONL writes append one bounded line and `fsync`.
- Receipt JSON uses temp-file plus rename.
- Statements are at most 2,000 characters; scope/source at most 200.
- Outcome reason codes are enum values, not free-form prompt text.
- The spool serializer constructs `safeAttributes` field by field. It never
  spreads arbitrary objects.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/context/src/memory.test.ts packages/context/src/receipts.test.ts packages/context/src/spool.test.ts
rtk tsc -p packages/context/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add packages/context/src/memory.ts packages/context/src/memory.test.ts packages/context/src/receipts.ts packages/context/src/receipts.test.ts packages/context/src/spool.ts packages/context/src/spool.test.ts packages/context/src/types.ts packages/context/src/index.ts
rtk git commit -m "feat(context): persist local memory and receipts"
```

---

### Task 7: Compose the End-to-End Context Pack Service

**Files:**

- Create: `packages/context/src/pack.ts`
- Create: `packages/context/src/pack.integration.test.ts`
- Create: `packages/context/src/git-signals.ts`
- Create: `packages/context/src/git-signals.test.ts`
- Modify: `packages/context/src/index.ts`

**Interfaces:**

```ts
export type ContextRelayOptions = {
  workspaceRoot: string;
  privacyMode: "local-only" | "metrics-only" | "evidence-sync";
  client: string;
  packageVersion: string;
  installationId?: string;
  dashboardUrl?: string;
  now?: () => Date;
};

export function createContextRelay(options: ContextRelayOptions): {
  prepareContext(request: ContextPackRequest): Promise<ContextPack>;
  recall(input: RecallRequest): Promise<readonly ProjectMemoryRecord[]>;
  remember(input: RememberRequest): Promise<ProjectMemoryRecord>;
  reportOutcome(input: OutcomeRequest): Promise<LocalContextReceipt>;
};
```

- [ ] **Step 1: Write failing fixture-repository E2E**

For task `Add OAuth login without changing current session semantics` and
budget `1_500`, assert:

```ts
expect(pack.status).toBe("ready");
expect(pack.measurement.returnedTokensEstimate).toBeLessThanOrEqual(1_500);
expect(pack.context.map((item) => item.path)).toEqual(
  expect.arrayContaining(["AGENTS.md", "src/auth.ts", "src/auth.test.ts"]),
);
expect(pack.context.every((item) => item.reasons.length > 0)).toBe(true);
expect(pack.context.every((item) => !isAbsolute(item.path))).toBe(true);
expect(pack.receiptUrl).toBeNull();
```

Also test:

- empty relevant result is explicit;
- cold deadline returns `partial`;
- cache warm call reuses files;
- local-only makes zero network calls by injecting a fetch function that
  throws if called;
- metrics-only creates a pending spool event but returns before any flush;
- memory relevant to `auth` appears in `decisions`;
- `git diff --name-only` failure is a warning-free optional signal, not fatal.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/context/src/pack.integration.test.ts packages/context/src/git-signals.test.ts
```

- [ ] **Step 3: Implement orchestration**

Order:

1. validate request/root;
2. lazily build/reuse index;
3. read bounded Git changed-path signal with a 500 ms timeout;
4. read active relevant memory;
5. rank;
6. deduplicate/diversify;
7. budget;
8. create local receipt;
9. append safe event only for non-local privacy mode;
10. return pack without network activity.

`receiptUrl` remains `null` until M2 provides a configured hosted project.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/context/src/pack.integration.test.ts packages/context/src/git-signals.test.ts
rtk tsc -p packages/context/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add packages/context/src/pack.ts packages/context/src/pack.integration.test.ts packages/context/src/git-signals.ts packages/context/src/git-signals.test.ts packages/context/src/index.ts
rtk git commit -m "feat(context): assemble local Context Packs"
```

---

### Task 8: Make MCP Profiles and Four Context Tools Real

**Files:**

- Create: `packages/mcp/src/profile.ts`
- Create: `packages/mcp/src/profile.test.ts`
- Create: `packages/mcp/src/context-tools.ts`
- Create: `packages/mcp/src/context-tools.test.ts`
- Rename: `packages/mcp/src/tools.ts` to
  `packages/mcp/src/forensics-tools.ts`
- Rename: `packages/mcp/src/tools.test.ts` to
  `packages/mcp/src/forensics-tools.test.ts`
- Modify: `packages/mcp/src/server.ts`
- Modify: `packages/mcp/src/server.test.ts`
- Modify: `packages/mcp/src/read-model.ts`
- Modify: `packages/mcp/src/types.ts`
- Modify: `packages/mcp/src/index.ts`
- Modify: `packages/mcp/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

```ts
export type AgentRailMcpProfile = "context" | "forensics" | "context+forensics";

export const CONTEXT_TOOL_NAMES = [
  "agentrail_prepare_context",
  "agentrail_recall",
  "agentrail_remember",
  "agentrail_report_outcome",
] as const;

export function toolNamesForProfile(
  profile: AgentRailMcpProfile,
): readonly string[];
```

- [ ] **Step 1: Write failing exact-profile tests**

```ts
expect(toolNamesForProfile("context")).toEqual(CONTEXT_TOOL_NAMES);
expect(toolNamesForProfile("forensics")).toEqual(
  AGENTRAIL_FORENSICS_TOOL_NAMES,
);
expect(toolNamesForProfile("context+forensics")).toEqual([
  ...CONTEXT_TOOL_NAMES,
  ...AGENTRAIL_FORENSICS_TOOL_NAMES,
]);
```

Handler tests prove:

- prepare maps the exact approved input/output;
- recall never returns deleted records;
- remember validates and persists structured fields;
- report outcome accepts only bounded outcome/reason enums;
- context profile does not require `DATABASE_URL`;
- forensics database profile still requires existing DB/project config;
- tool responses never expose absolute paths;
- write tools have non-read-only, non-destructive annotations;
- recall is read-only;
- server construction performs no scan.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/mcp/src/profile.test.ts packages/mcp/src/context-tools.test.ts packages/mcp/src/server.test.ts
```

- [ ] **Step 3: Implement profile-aware server**

CLI arguments:

```text
agentrail-mcp --profile context
agentrail-mcp --profile forensics
agentrail-mcp --profile context+forensics
```

Default is `context`. Context environment:

```text
AGENTRAIL_WORKSPACE_ROOT
AGENTRAIL_PRIVACY_MODE=local-only|metrics-only|evidence-sync
AGENTRAIL_CLIENT
AGENTRAIL_INSTALLATION_ID (optional in local-only)
AGENTRAIL_DASHBOARD_URL (optional)
```

Set `packages/mcp/package.json.engines.node` to `>=22.13 <25` and override its
TypeScript target/lib to ES2022. The forensics profile must also pass the Node
22.13 tarball smoke; if a transitive database dependency prevents that, keep
the context profile in a database-free entry chunk rather than raising the
public CLI minimum to Node 24.

Use current MCP SDK `McpServer.registerTool` with Zod schemas and stdio
transport. Register annotations in the tool config. Keep raw forensic payload
prohibited.

- [ ] **Step 4: Add in-memory protocol proof**

Use MCP SDK `Client` and `InMemoryTransport.createLinkedPair()`. Connect both
sides, call `listTools`, call `agentrail_prepare_context` against the quality
fixture, and assert the response stays within budget.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/mcp/src/profile.test.ts packages/mcp/src/context-tools.test.ts packages/mcp/src/forensics-tools.test.ts packages/mcp/src/server.test.ts
rtk tsc -p packages/mcp/tsconfig.json --noEmit
rtk pnpm --filter @agentrail-sdk/mcp build
```

Commit:

```powershell
rtk git add packages/mcp packages/context/package.json pnpm-lock.yaml
rtk git commit -m "feat(mcp): serve local Context Relay profiles"
```

---

### Task 9: Scaffold the Public CLI and Configuration Backup Boundary

**Files:**

- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/types.ts`
- Create: `packages/cli/src/args.ts`
- Create: `packages/cli/src/args.test.ts`
- Create: `packages/cli/src/config-backup.ts`
- Create: `packages/cli/src/config-backup.test.ts`
- Create: `packages/cli/src/main.ts`
- Create: `packages/cli/src/index.ts`
- Modify: `vitest.config.ts`
- Modify: `tests/npm/package-readiness.test.ts`
- Modify: `scripts/verify-npm-release.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

```ts
export type AgentRailCommand =
  | { name: "setup"; clients: readonly ("codex" | "claude")[]; root: string }
  | { name: "doctor"; root: string; json: boolean }
  | {
      name: "context";
      root: string;
      task: string;
      tokenBudget: number;
      json: boolean;
    }
  | {
      name: "uninstall";
      clients: readonly ("codex" | "claude")[];
      root: string;
    };

export async function createTimestampedBackup(path: string): Promise<{
  sourcePath: string;
  backupPath: string | null;
  sourceExisted: boolean;
}>;

export async function atomicReplace(
  path: string,
  contents: string,
): Promise<void>;
```

- [ ] **Step 1: Write failing argument and backup tests**

Cover:

- `setup --client codex --client claude --root "D:\work\agent-app"`;
- `doctor --json`;
- `context --task "Add OAuth" --token-budget 4000 --json`;
- `uninstall`;
- unknown flags fail with usage and exit code `2`;
- missing command prints help without mutation;
- backup bytes exactly match source;
- backup is created before replacement;
- replacement failure leaves original source intact;
- no backup is created for a nonexistent source.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/cli/src/args.test.ts packages/cli/src/config-backup.test.ts
```

- [ ] **Step 3: Implement CLI shell**

Manifest:

```json
{
  "name": "@agentrail-sdk/cli",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "engines": { "node": ">=22.13 <25" },
  "bin": { "agentrail": "./dist/main.js" },
  "publishConfig": { "access": "public" }
}
```

Dependencies are exact workspace ranges for context and MCP. No argument parser
framework is required. Parse a bounded, documented flag set. The CLI and MCP
tsconfigs compile public runtime code to ES2022.

The npm smoke verifier must now run:

```text
npx -y @agentrail-sdk/cli --help
npx -y @agentrail-sdk/cli doctor --root tests/fixtures/context-repositories/quality --json
```

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/cli/src/args.test.ts packages/cli/src/config-backup.test.ts tests/npm/package-readiness.test.ts
rtk tsc -p packages/cli/tsconfig.json --noEmit
rtk pnpm --filter @agentrail-sdk/cli build
```

Commit:

```powershell
rtk git add packages/cli vitest.config.ts tests/npm/package-readiness.test.ts scripts/verify-npm-release.ts pnpm-lock.yaml
rtk git commit -m "feat(cli): scaffold safe AgentRail commands"
```

---

### Task 10: Implement Idempotent Codex and Claude Client Adapters

**Files:**

- Create: `packages/cli/src/clients/codex.ts`
- Create: `packages/cli/src/clients/codex.test.ts`
- Create: `packages/cli/src/clients/claude.ts`
- Create: `packages/cli/src/clients/claude.test.ts`
- Create: `packages/cli/src/commands/setup.ts`
- Create: `packages/cli/src/commands/setup.test.ts`
- Create: `packages/cli/src/commands/uninstall.ts`
- Create: `packages/cli/src/commands/uninstall.test.ts`
- Create: `tests/fixtures/client-configs/codex/windows-existing.toml`
- Create: `tests/fixtures/client-configs/codex/posix-existing.toml`
- Create: `tests/fixtures/client-configs/claude/existing.mcp.json`
- Modify: `packages/cli/src/main.ts`

**Interfaces:**

```ts
export type ClientMutationResult = {
  client: "codex" | "claude";
  configPath: string;
  backupPath: string | null;
  status: "installed" | "already_configured" | "removed" | "not_configured";
};

export interface ClientAdapter {
  inspect(): Promise<
    "not_configured" | "managed" | "unmanaged_conflict" | "malformed"
  >;
  install(): Promise<ClientMutationResult>;
  uninstall(): Promise<ClientMutationResult>;
}
```

- [ ] **Step 1: Write failing fixture matrix**

Every adapter covers:

- empty config;
- existing unrelated server;
- existing AgentRail managed entry;
- existing AgentRail unmanaged conflict;
- malformed config;
- setup twice;
- uninstall;
- unrelated entries byte-equivalent after uninstall;
- Windows drive/escaping;
- POSIX paths;
- path containing spaces.

Codex managed block:

```toml
# BEGIN AGENTRAIL MANAGED BLOCK
[mcp_servers.agentrail]
command = "npx"
args = ["-y", "@agentrail-sdk/mcp", "--profile", "context"]
env = { AGENTRAIL_WORKSPACE_ROOT = "D:\\repo", AGENTRAIL_PRIVACY_MODE = "local-only", AGENTRAIL_CLIENT = "codex" }
# END AGENTRAIL MANAGED BLOCK
```

Claude project config entry:

```json
{
  "mcpServers": {
    "agentrail": {
      "command": "npx",
      "args": ["-y", "@agentrail-sdk/mcp", "--profile", "context"],
      "env": {
        "AGENTRAIL_WORKSPACE_ROOT": "/repo",
        "AGENTRAIL_PRIVACY_MODE": "local-only",
        "AGENTRAIL_CLIENT": "claude"
      }
    }
  }
}
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/cli/src/clients/codex.test.ts packages/cli/src/clients/claude.test.ts packages/cli/src/commands/setup.test.ts packages/cli/src/commands/uninstall.test.ts
```

- [ ] **Step 3: Implement guarded mutations**

Codex:

- default path `~/.codex/config.toml`;
- own only text between exact managed markers;
- reject an unmanaged `[mcp_servers.agentrail]`;
- escape TOML strings for backslash, quote, newline, carriage return, and tab;
- validate exactly one begin/end marker.

Claude:

- default project path is `.mcp.json` under the selected workspace root;
- parse JSON;
- preserve unrelated top-level fields and servers;
- reject a non-object `mcpServers`;
- reject an unmanaged `agentrail` entry;
- write formatted JSON with trailing newline.

Setup creates backup first and writes an `.agentrail/install/v1.json` ownership
record containing config path, backup path, client, and a digest of the managed
entry. Uninstall removes only the owned entry and retains unrelated changes
made after setup.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/cli/src/clients/codex.test.ts packages/cli/src/clients/claude.test.ts packages/cli/src/commands/setup.test.ts packages/cli/src/commands/uninstall.test.ts
rtk tsc -p packages/cli/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add packages/cli/src/clients packages/cli/src/commands/setup.ts packages/cli/src/commands/setup.test.ts packages/cli/src/commands/uninstall.ts packages/cli/src/commands/uninstall.test.ts packages/cli/src/main.ts tests/fixtures/client-configs
rtk git commit -m "feat(cli): install Codex and Claude safely"
```

---

### Task 11: Add Doctor, Direct Context, and True Client E2E

**Files:**

- Create: `packages/cli/src/commands/doctor.ts`
- Create: `packages/cli/src/commands/doctor.test.ts`
- Create: `packages/cli/src/commands/context.ts`
- Create: `packages/cli/src/commands/context.test.ts`
- Create: `tests/e2e-cli/context-relay.e2e.test.ts`
- Modify: `packages/cli/src/main.ts`
- Modify: `package.json`

**Interfaces:**

```ts
export type DoctorCheck = {
  id:
    | "node"
    | "workspace"
    | "client_config"
    | "mcp_initialize"
    | "cache_write"
    | "privacy_mode"
    | "telemetry_spool"
    | "package_version";
  status: "pass" | "warn" | "fail";
  detail: string;
  remediation: string | null;
};
```

- [ ] **Step 1: Write failing doctor and context tests**

Doctor proves:

- Node outside supported range fails;
- workspace/root containment is checked;
- malformed client config fails with remediation;
- local-only requires no login;
- unwritable cache fails;
- stale package version warns only when registry check is available;
- registry/network failure does not fail local operation;
- JSON output is machine-readable and contains no secret/env values.

Direct context command asserts valid Context Pack JSON and a non-zero exit for
invalid budget/root.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/cli/src/commands/doctor.test.ts packages/cli/src/commands/context.test.ts tests/e2e-cli/context-relay.e2e.test.ts
```

- [ ] **Step 3: Implement commands and protocol E2E**

The E2E creates a temporary home and fixture workspace, then:

1. runs CLI setup for Codex;
2. verifies the managed block;
3. runs setup again and verifies no duplicate;
4. spawns packed MCP over stdio;
5. sends initialize and tools/list;
6. calls `agentrail_prepare_context`;
7. asserts budget/provenance;
8. calls remember then recall;
9. reports an outcome;
10. runs uninstall;
11. verifies unrelated config remains.

Repeat the config mutation portion for Claude `.mcp.json`.

Add:

```json
"test:e2e:cli": "vitest run tests/e2e-cli"
```

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/cli/src/commands/doctor.test.ts packages/cli/src/commands/context.test.ts tests/e2e-cli/context-relay.e2e.test.ts
rtk pnpm --filter @agentrail-sdk/cli build
rtk pnpm --filter @agentrail-sdk/mcp build
```

Commit:

```powershell
rtk git add packages/cli/src/commands/doctor.ts packages/cli/src/commands/doctor.test.ts packages/cli/src/commands/context.ts packages/cli/src/commands/context.test.ts packages/cli/src/main.ts tests/e2e-cli/context-relay.e2e.test.ts package.json
rtk git commit -m "feat(cli): verify Context Relay end to end"
```

---

### Task 12: Reposition the Landing and Publish Tested Quickstarts

**Files:**

- Create: `apps/web/app/docs/page.tsx`
- Create: `apps/web/app/docs/quickstart/page.tsx`
- Create: `apps/web/app/docs/clients/codex/page.tsx`
- Create: `apps/web/app/docs/clients/claude/page.tsx`
- Create: `apps/web/app/docs/privacy/page.tsx`
- Create: `apps/web/app/docs/troubleshooting/page.tsx`
- Create: `apps/web/components/context-receipt-preview.tsx`
- Create: `apps/web/tests/context-relay-docs.test.ts`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/about/page.tsx`
- Modify: `apps/web/app/sitemap.ts`
- Modify: `apps/web/app/globals.css`
- Modify: `README.md`
- Modify: `docs/operations/mcp.md`
- Modify: `tests/docs/documentation.test.ts`
- Modify: `tests/e2e/landing.spec.ts`

**Interfaces:**

- Primary command:
  `npx -y @agentrail-sdk/cli setup`.
- Landing shows only Codex and Claude as tested.
- Receipt preview uses the exact fixture output from Task 11, with synthetic
  labeling and no invented user metric.

- [ ] **Step 1: Invoke the landing design skill and record the read**

Use `design-taste-frontend` only for `/` and public docs. Preserve the approved
read:

> B2B developer-tool landing for individual AI builders, restrained
> Linear-style language, forensic graphite identity, Context Relay value first,
> real product evidence rather than abstract illustration.

Dials: variance 6, motion 4, density 4.

- [ ] **Step 2: Write failing copy, support, and CTA tests**

Assert:

```ts
expect(landing).toContain("npx -y @agentrail-sdk/cli setup");
expect(landing).toMatch(/Context Pack/i);
expect(landing).toMatch(/local-first/i);
expect(landing).toContain("Codex");
expect(landing).toContain("Claude");
expect(landing).not.toMatch(/Cursor|VS Code|Gemini/i);
```

E2E:

- primary setup command copies with visible feedback;
- Codex and Claude docs links work;
- demo receipt is explicitly synthetic;
- source ledger has path, line locator, reason, and estimate labels;
- reduced motion disables nonessential motion;
- mobile 390 px has no horizontal overflow;
- active buttons have tested targets.

- [ ] **Step 3: Verify RED**

Run:

```powershell
rtk vitest run apps/web/tests/context-relay-docs.test.ts tests/docs/documentation.test.ts
rtk playwright test tests/e2e/landing.spec.ts
```

- [ ] **Step 4: Implement the approved section order**

Landing sections:

1. hero: prepare relevant project context before the model guesses;
2. real synthetic Context Receipt preview;
3. three-step operation: install, prepare, inspect;
4. local-first privacy boundary;
5. tested client support;
6. verified quickstart snippet;
7. GitHub/source CTA and founding-tester CTA.

Do not use neon/AI-purple gradients, glassmorphism, blobs, robot art, three
equal hero cards, looping decoration, fake logos, or fake counters.

Dashboard trace routes keep their existing identity and are not redesigned in
this task.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```powershell
rtk vitest run apps/web/tests/context-relay-docs.test.ts tests/docs/documentation.test.ts apps/web/tests/design-contract.test.ts
rtk pnpm --filter @agentrail-sdk/web anti-slop
rtk playwright test tests/e2e/landing.spec.ts
rtk pnpm --filter @agentrail-sdk/web build
```

Commit:

```powershell
rtk git add apps/web/app/docs apps/web/components/context-receipt-preview.tsx apps/web/tests/context-relay-docs.test.ts apps/web/app/page.tsx apps/web/app/about/page.tsx apps/web/app/sitemap.ts apps/web/app/globals.css README.md docs/operations/mcp.md tests/docs/documentation.test.ts tests/e2e/landing.spec.ts
rtk git commit -m "feat(web): launch the local Context Relay"
```

---

### Task 13: Publish M1 Packages With Provenance and Verify a Clean User

**Files:**

- Modify: `packages/context/package.json`
- Modify: `packages/cli/package.json`
- Modify: `packages/mcp/package.json`
- Modify: `packages/sdk/package.json` only if shared release alignment requires
  it
- Modify: `tests/npm/package-readiness.test.ts`
- Modify: `scripts/verify-npm-release.ts`
- Create: `docs/releases/0.2.0-context-relay.md`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Public versions and internal exact ranges are decided once at release time.
- CLI and MCP migration notes describe profile changes and rollback.
- Public runtime smoke covers Node 22.13+ and Node 24.

- [ ] **Step 1: Write failing release assertions**

Extend package readiness to include `context` and `cli`, exact internal ranges,
public metadata, files, exports, and bins:

```ts
expect(readPackageJson("cli").bin).toEqual({
  agentrail: "./dist/main.js",
});
expect(readPackageJson("mcp").bin).toEqual({
  "agentrail-mcp": "./dist/index.js",
});
```

Registry mode must verify exact versions supplied through environment:

```text
AGENTRAIL_RELEASE_VERSION
AGENTRAIL_CONTRACTS_VERSION
```

Do not hardcode a version that has not been published.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run tests/npm/package-readiness.test.ts tests/npm/release-smoke.test.ts
```

- [ ] **Step 3: Prepare release metadata**

Release notes include:

- exact four default context tools;
- forensics profile command;
- Codex and Claude support evidence;
- local-only default;
- metrics-only spool not uploaded until M2;
- backup/uninstall behavior;
- known limits and no arbitrary URL fetch;
- migration from the old default forensic profile;
- rollback command.

Publish order:

1. contracts if changed;
2. context;
3. db if changed;
4. SDK if changed;
5. MCP;
6. CLI.

Use npm web authentication or a short-lived granular token according to account
policy. Never store the token in repository files or shell history.

- [ ] **Step 4: Verify GREEN with the prepublish gate and publish intentionally**

Run:

```powershell
rtk pnpm format:check
rtk pnpm typecheck
rtk pnpm test
rtk pnpm build
rtk pnpm test:e2e:cli
rtk pnpm test:npm:tarball
```

CI repeats tarball installation and CLI/MCP execution in a Node matrix with
`22.13.0` and `24.x`; build and typecheck remain on Node 24.

Inspect every `pnpm pack --dry-run` file list. Only after review, publish each
new version with public access and npm-required interactive authentication.

- [ ] **Step 5: Verify from a clean directory**

Run registry smoke with the newly published version, then a manual clean-user
proof:

```powershell
$agentRailCliVersion = rtk npm view @agentrail-sdk/cli version
rtk npx -y "@agentrail-sdk/cli@$agentRailCliVersion" doctor --root tests/fixtures/context-repositories/quality --json
rtk npx -y "@agentrail-sdk/cli@$agentRailCliVersion" context --root tests/fixtures/context-repositories/quality --task "Add OAuth without changing session semantics" --token-budget 1500 --json
```

Expected: the version variable is non-empty and both commands exit `0`.

- [ ] **Step 6: Commit release truth**

```powershell
rtk git add packages/context/package.json packages/cli/package.json packages/mcp/package.json packages/sdk/package.json tests/npm/package-readiness.test.ts scripts/verify-npm-release.ts docs/releases/0.2.0-context-relay.md pnpm-lock.yaml
rtk git commit -m "chore(release): publish Context Relay packages"
```

## M1 Final Verification

Run:

```powershell
rtk pnpm format:check
rtk pnpm typecheck
rtk pnpm test
rtk pnpm build
rtk pnpm test:e2e
rtk pnpm test:e2e:cli
rtk pnpm test:npm:tarball
rtk pnpm test:npm:registry
rtk pnpm test:production
```

Benchmark the quality fixture:

```powershell
rtk pnpm --filter @agentrail-sdk/context bench
```

Expected:

- MCP startup does not scan and meets the 250 ms target on the benchmark host;
- warm Context Pack p95 is below 1.5 s;
- cold result is full or labeled partial within 5 s;
- returned estimate never exceeds budget;
- required fixture files are recalled;
- fixture secrets never appear;
- local-only performs zero network calls;
- setup twice is idempotent;
- uninstall preserves unrelated client configuration;
- existing trace/forensics tests remain green.

Invite one real founding tester only after this gate. Record consent and
observed results in the M0 evidence register. Do not convert a local fixture or
the founder's own test into a customer claim.
