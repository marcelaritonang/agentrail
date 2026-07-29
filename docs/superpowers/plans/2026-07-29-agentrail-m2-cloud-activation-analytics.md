# AgentRail M2 Cloud Activation and Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` task-by-task. Use
> `superpowers:systematic-debugging` for auth, queue, or integration failures.
> Use `superpowers:verification-before-completion` before the exit claim.

**Goal:** Add optional GitHub sign-in, CLI device activation, revocable
installation credentials, bounded metrics-only ingestion, authenticated user
overview/integrations, and truthful role-protected founder analytics while
keeping Context Relay fully usable offline.

**Architecture:** Better Auth runs inside the Next.js App Router with the
existing Drizzle/PostgreSQL database. The existing Hono ingestion app gains device and
usage-event endpoints but keeps fast enqueue semantics. Usage events use a
separate queue contract and worker path from trace spans. The CLI stores a
revocable project-scoped credential through a pluggable secure store with a
permission-restricted file fallback. User and founder dashboards read the same
accepted event data through server-side repositories.

**Tech Stack:** Node.js 24, pnpm 11, Next.js 16.2, React 19,
`better-auth@1.6.25` with `@better-auth/drizzle-adapter@1.6.25`, GitHub OAuth, Drizzle ORM 0.45,
PostgreSQL, Hono 4, Redis Streams locally, Amazon API Gateway/Lambda/SQS/RDS,
Vitest 4, Playwright 1.61.

## Global Constraints

- M0 and M1 must be green.
- GitHub is the only sign-in provider in M2.
- Use Better Auth's stable Next.js handler from `better-auth/next-js`.
- Server Components and route guards read sessions with
  `auth.api.getSession({ headers: await headers() })`.
- Secrets are server-only:
  `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GITHUB_CLIENT_ID`,
  `GITHUB_CLIENT_SECRET`,
  `INSTALLATION_CREDENTIAL_PEPPER`.
- Local-only operation never redirects to login and never writes a cloud event.
- Device codes expire after ten minutes, are one-time, and reveal no user or
  project data before approval.
- Installation credentials are shown once, stored only as digests server-side,
  individually revocable, and scoped to one project.
- Usage ingestion returns `202` only after fast enqueue succeeds.
- Idempotency is `(installation_id, event_id)`.
- Metrics-only allowlist excludes task text, prompt, paths, content, snippets,
  patches, environment values, and secrets.
- Synthetic demo data and live user data never share a dataset.
- Founder analytics is server-authorized by `users.role = "admin"`. Hiding a
  link is not authorization.
- Npm downloads are displayed separately from active users.
- No public counters are added in M2.
- The website may remain on Vercel; the stateful reference backend deploys to
  AWS.
- Browser code never reads RDS, queue, credential digests, or S3 directly.
- Every mutation is project-scoped and every task uses TDD.
- Every **Verify RED** command must fail on a newly added behavioral assertion
  because the named production behavior is absent. Syntax, migration setup,
  missing service, or credential errors are not acceptable RED states.

## Hosted Route Contract

| Method   | Route                       | Authentication        | Purpose                        |
| -------- | --------------------------- | --------------------- | ------------------------------ |
| POST     | `/v1/device/code`           | none, rate-limited    | issue short-lived device code  |
| POST     | `/v1/device/token`          | device secret         | poll/consume approved code     |
| POST     | `/v1/events`                | installation bearer   | enqueue bounded usage events   |
| GET/POST | `/api/auth/[...all]`        | Better Auth           | GitHub auth callback/session   |
| POST     | `/api/activation/approve`   | authenticated session | approve code for owned project |
| POST     | `/api/installations/revoke` | authenticated session | revoke owned installation      |
| POST     | `/api/installations/rotate` | authenticated session | revoke and issue replacement   |

---

### Task 1: Define Device and Usage Event Contracts

**Files:**

- Create: `packages/contracts/src/device.ts`
- Create: `packages/contracts/src/device.test.ts`
- Create: `packages/contracts/src/usage-event.ts`
- Create: `packages/contracts/src/usage-event.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**

```ts
export const PrivacyModeSchema = z.enum([
  "local-only",
  "metrics-only",
  "evidence-sync",
]);

export const DeviceCodeRequestSchema = z.object({
  schema_version: z.literal(1),
  client_type: z.enum(["codex", "claude"]),
  package_version: z.string().min(1).max(50),
});

export const DeviceTokenRequestSchema = z.object({
  schema_version: z.literal(1),
  device_code: z.string().min(32).max(200),
});

export const UsageEventSchema = z.object({
  schema_version: z.literal(1),
  event_id: z.string().regex(/^ev_[A-Za-z0-9_-]{24,}$/),
  pack_id: z.string().regex(/^cp_[A-Za-z0-9_-]{24,}$/),
  event_type: z.enum(["context_pack_created", "context_outcome_reported"]),
  occurred_at: z.iso.datetime(),
  safe_attributes: z
    .object({
      client: z.string().min(1).max(40),
      package_version: z.string().min(1).max(50),
      status: z.enum(["ready", "partial", "empty"]),
      latency_ms: z.number().int().nonnegative().max(300_000),
      candidate_tokens_estimate: z.number().int().nonnegative().max(10_000_000),
      returned_tokens_estimate: z.number().int().nonnegative().max(32_000),
      source_counts: z.record(z.string(), z.number().int().nonnegative()),
      warning_codes: z.array(z.string().max(50)).max(20),
      outcome: z.enum(["helpful", "partial", "missed", "failed"]).optional(),
      reason_code: z.string().max(50).optional(),
    })
    .strict(),
});
```

- [ ] **Step 1: Write failing allowlist tests**

Test all approved fields plus rejection of extra nested fields:

```ts
for (const forbidden of [
  "task",
  "prompt",
  "path",
  "content",
  "snippet",
  "patch",
  "environment",
  "secret",
]) {
  const parsed = UsageEventSchema.safeParse({
    ...validUsageEvent,
    safe_attributes: {
      ...validUsageEvent.safe_attributes,
      [forbidden]: "must-not-pass",
    },
  });
  expect(parsed.success, forbidden).toBe(false);
}
```

Also test batch length `1..100`, serialized body bound, invalid IDs, future
timestamps over five minutes, and returned estimate greater than candidate.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/contracts/src/device.test.ts packages/contracts/src/usage-event.test.ts
```

- [ ] **Step 3: Implement strict contracts**

Add a `superRefine` that rejects returned tokens above candidate tokens and an
`occurred_at` validator supplied with a testable clock at API canonicalization
time. Do not make Zod read the system clock during module evaluation.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/contracts/src/device.test.ts packages/contracts/src/usage-event.test.ts
rtk tsc -p packages/contracts/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add packages/contracts/src/device.ts packages/contracts/src/device.test.ts packages/contracts/src/usage-event.ts packages/contracts/src/usage-event.test.ts packages/contracts/src/index.ts
rtk git commit -m "feat(contracts): define activation and usage events"
```

---

### Task 2: Add Auth, Installation, Event, and Aggregate Tables

**Files:**

- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`
- Create: `packages/db/src/control-repository.ts`
- Create: `packages/db/src/control-repository.integration.test.ts`
- Create: `packages/db/migrations/0001_context_control_plane.sql`
- Modify: `packages/db/migrations/meta/_journal.json`

**Interfaces:**

Tables:

```text
users
accounts
sessions
verifications
projects.owner_user_id
projects.privacy_mode
device_codes
installations
usage_events
context_packs
daily_usage
```

Repository:

```ts
export const authSchema = {
  users,
  sessions,
  accounts,
  verifications,
};

export function createControlRepository(db: AgentRailDatabase): {
  getOrCreateDefaultProject(userId: string): Promise<OwnedProject>;
  issueDeviceCode(input: StoredDeviceCode): Promise<void>;
  approveDeviceCode(input: {
    userCodeDigest: string;
    userId: string;
    projectId: string;
    now: Date;
  }): Promise<"approved" | "expired" | "already_approved" | "not_found">;
  consumeApprovedDeviceCode(input: {
    deviceCodeDigest: string;
    now: Date;
    credential: NewInstallationCredential;
  }): Promise<DeviceConsumeResult>;
  findActiveInstallationByPrefix(
    prefix: string,
  ): Promise<InstallationAuthRecord | null>;
  revokeInstallation(input: {
    installationId: string;
    ownerUserId: string;
  }): Promise<boolean>;
  insertUsageEvent(
    input: CanonicalUsageEvent,
  ): Promise<"inserted" | "duplicate">;
  upsertContextPack(input: ContextPackMetricWrite): Promise<void>;
  incrementDailyUsage(input: DailyUsageDelta): Promise<void>;
};
```

- [ ] **Step 1: Write failing migration/repository tests**

Use real PostgreSQL and prove:

- existing trace project with no owner still reads;
- one user gets one default project under concurrent calls;
- another user cannot approve a code into the first user's project;
- expired and already-approved states are distinct;
- device code consumption and installation creation occur in one transaction;
- credential digest is stored, raw credential is absent;
- duplicate `(installation_id,event_id)` returns `duplicate`;
- daily aggregate update is idempotent when duplicate event is ignored;
- revoke requires project owner;
- context pack metric contains no task/path/content columns.

- [ ] **Step 2: Verify RED**

Run with PostgreSQL:

```powershell
rtk vitest run packages/db/src/control-repository.integration.test.ts
```

- [ ] **Step 3: Implement schema and forward migration**

Better Auth tables use the adapter-compatible plural schema. The core shapes
are generated from the pinned Better Auth CLI before the migration is finalized
and must include `users`, `sessions`, `accounts`, and `verifications`:

```ts
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  role: text("role").$type<"member" | "admin">().default("member").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
```

Add adapter-compatible `sessions`, `accounts`, and `verifications` with the
exact required Better Auth fields and user indexes. `accounts` stores the
GitHub provider subject; no duplicate `github_subject` column is added to
`users`. Keep existing project IDs and make
`owner_user_id` nullable for backward compatibility. New hosted projects always
have an owner and privacy mode.

Use unique indexes:

- `(accounts.provider_id, accounts.account_id)`;
- `device_codes.device_code_digest`;
- `device_codes.user_code_digest`;
- `installations.credential_prefix`;
- `(installations.project_id, installations.installation_id)`;
- `(usage_events.installation_id, usage_events.event_id)`;
- `(daily_usage.project_id, daily_usage.day)`.

- [ ] **Step 4: Verify GREEN migration and repository behavior**

Run:

```powershell
rtk pnpm --filter @agentrail-sdk/db db:migrate
rtk vitest run packages/db/src/control-repository.integration.test.ts packages/db/src/span-repository.integration.test.ts
rtk tsc -p packages/db/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add packages/db/src/schema.ts packages/db/src/index.ts packages/db/src/control-repository.ts packages/db/src/control-repository.integration.test.ts packages/db/migrations/0001_context_control_plane.sql packages/db/migrations/meta/_journal.json
rtk git commit -m "feat(db): persist hosted activation and metrics"
```

---

### Task 3: Configure GitHub Better Auth and Owned Project Sessions

**Files:**

- Create: `apps/web/auth.ts`
- Create: `apps/web/auth.test.ts`
- Create: `apps/web/lib/auth-client.ts`
- Create: `apps/web/app/api/auth/[...all]/route.ts`
- Create: `apps/web/lib/authz.ts`
- Create: `apps/web/lib/authz.test.ts`
- Create: `apps/web/lib/control-database.ts`
- Create: `apps/web/app/login/page.tsx`
- Create: `apps/web/components/auth-actions.tsx`
- Modify: `apps/web/package.json`
- Modify: `.env.example`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

```ts
export const auth: ReturnType<typeof betterAuth>;

export type AuthenticatedViewer = {
  userId: string;
  role: "member" | "admin";
  projectId: string;
};

export async function requireViewer(): Promise<AuthenticatedViewer>;
export async function requireAdmin(): Promise<AuthenticatedViewer>;
```

- [ ] **Step 1: Write failing authorization tests**

Inject session and repository dependencies into pure authorization functions.
Prove:

- no session → typed unauthenticated result;
- user with no project gets a default owned project;
- user cannot select another user's project;
- member is rejected by admin guard;
- admin passes;
- public demo mode does not fabricate an authenticated viewer.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run apps/web/auth.test.ts apps/web/lib/authz.test.ts
```

- [ ] **Step 3: Configure current stable Better Auth App Router API**

Dependencies:

```json
"@better-auth/drizzle-adapter": "1.6.25",
"better-auth": "1.6.25"
```

Before editing the lockfile, verify the pinned versions still resolve:

```powershell
rtk npm view better-auth@1.6.25 version
rtk npm view @better-auth/drizzle-adapter@1.6.25 version
```

Configuration:

```ts
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";

import { authSchema } from "@agentrail-sdk/db";
import { database } from "./lib/control-database";

export const auth = betterAuth({
  database: drizzleAdapter(database.db, {
    provider: "pg",
    schema: authSchema,
    transaction: true,
  }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "member",
        input: false,
      },
    },
  },
});
```

Route:

```ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "../../../../auth";

export const { GET, POST } = toNextJsHandler(auth);
```

Server guard:

```ts
import { headers } from "next/headers";
import { auth } from "../auth";

const session = await auth.api.getSession({ headers: await headers() });
```

Create the client with `createAuthClient` from `better-auth/react`; the login
action calls `authClient.signIn.social({ provider: "github",
callbackURL: "/dashboard" })`. Do not use client-supplied user/project IDs for
authorization.

Environment:

```env
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://agentrail.id
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
INSTALLATION_CREDENTIAL_PEPPER=
NEXT_PUBLIC_AGENTRAIL_API_URL=
```

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run apps/web/auth.test.ts apps/web/lib/authz.test.ts
rtk tsc -p apps/web/tsconfig.json --noEmit
rtk pnpm --filter @agentrail-sdk/web build
```

Commit:

```powershell
rtk git add apps/web/auth.ts apps/web/auth.test.ts apps/web/lib/auth-client.ts "apps/web/app/api/auth/[...all]/route.ts" apps/web/lib/authz.ts apps/web/lib/authz.test.ts apps/web/lib/control-database.ts apps/web/app/login/page.tsx apps/web/components/auth-actions.tsx apps/web/package.json .env.example pnpm-lock.yaml
rtk git commit -m "feat(auth): add GitHub sign-in and project guards"
```

---

### Task 4: Implement Device Issuance, Approval, Polling, and One-Time Credentials

**Files:**

- Create: `apps/ingest/src/device.ts`
- Create: `apps/ingest/src/device.test.ts`
- Modify: `apps/ingest/src/app.ts`
- Modify: `apps/ingest/src/app.test.ts`
- Modify: `apps/ingest/src/runtime.ts`
- Create: `apps/web/app/api/activation/approve/route.ts`
- Create: `apps/web/tests/activation-route.test.ts`
- Create: `apps/web/app/activate/page.tsx`
- Create: `apps/web/components/activation-form.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**

```ts
export function createDeviceCode(): {
  deviceCode: string;
  deviceCodeDigest: string;
  userCode: string;
  userCodeDigest: string;
};

export function createInstallationCredential(pepper: string): {
  raw: string;
  prefix: string;
  digest: string;
};
```

Response states:

```text
authorization_pending
slow_down
expired_token
access_denied
approved (credential returned once)
```

- [ ] **Step 1: Write failing cryptographic and route tests**

Prove:

- device secret and credential have at least 144 bits of entropy;
- user code is human-readable but stored only as a digest;
- comparisons use `timingSafeEqual`;
- issue endpoint rate-limits by bounded IP hash and client;
- issue response contains verification URI, user code, expiry, and interval;
- polling before approval returns `authorization_pending`;
- polling too quickly returns `slow_down`;
- expired returns `expired_token`;
- successful poll creates one installation and returns raw credential once;
- replay never returns the credential;
- approval requires session and owned project;
- invalid code reveals no project/user metadata.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run apps/ingest/src/device.test.ts apps/ingest/src/app.test.ts apps/web/tests/activation-route.test.ts
```

- [ ] **Step 3: Implement state machine**

Defaults:

```ts
export const DEVICE_CODE_TTL_MS = 10 * 60 * 1_000;
export const DEVICE_POLL_INTERVAL_SECONDS = 5;
```

Use `randomBytes(32)` for device and installation secrets. Device code
consumption must be transactional. Store approval timestamp, approved user and
project, consumed timestamp, and poll timestamp. The API never logs raw codes
or credentials.

Activation page covers all approved design states: waiting, invalid, expired,
login required, awaiting poll, approved, already approved, revoked, service
unavailable.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run apps/ingest/src/device.test.ts apps/ingest/src/app.test.ts apps/web/tests/activation-route.test.ts
rtk tsc -p apps/ingest/tsconfig.json --noEmit
rtk tsc -p apps/web/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add apps/ingest/src/device.ts apps/ingest/src/device.test.ts apps/ingest/src/app.ts apps/ingest/src/app.test.ts apps/ingest/src/runtime.ts apps/web/app/api/activation/approve/route.ts apps/web/tests/activation-route.test.ts apps/web/app/activate/page.tsx apps/web/components/activation-form.tsx apps/web/app/globals.css
rtk git commit -m "feat(activation): issue project-scoped device credentials"
```

---

### Task 5: Add CLI Login, Credential Storage, and Offline Degradation

**Files:**

- Create: `packages/cli/src/credentials/types.ts`
- Create: `packages/cli/src/credentials/file-store.ts`
- Create: `packages/cli/src/credentials/file-store.test.ts`
- Create: `packages/cli/src/credentials/platform-store.ts`
- Create: `packages/cli/src/credentials/platform-store.test.ts`
- Create: `packages/cli/src/commands/login.ts`
- Create: `packages/cli/src/commands/login.test.ts`
- Create: `packages/cli/src/commands/logout.ts`
- Create: `packages/cli/src/commands/logout.test.ts`
- Modify: `packages/cli/src/args.ts`
- Modify: `packages/cli/src/main.ts`
- Modify: `packages/cli/src/commands/doctor.ts`

**Interfaces:**

```ts
export interface CredentialStore {
  get(projectKey: string): Promise<string | null>;
  set(projectKey: string, credential: string): Promise<void>;
  delete(projectKey: string): Promise<void>;
  kind: "platform" | "restricted-file";
}

export type DeviceApi = {
  issue(input: DeviceCodeRequest): Promise<DeviceCodeResponse>;
  poll(deviceCode: string): Promise<DeviceTokenResponse>;
};
```

- [ ] **Step 1: Write failing login/storage tests**

Use fake API, browser opener, clock, and store. Cover:

- prints verification URL and user code;
- opens browser only after displaying code;
- polls at server interval;
- `slow_down` increases interval by five seconds;
- expiry exits actionable non-zero;
- success stores credential then updates install identity;
- no credential appears in stdout/stderr;
- file fallback is created with mode `0o600` on POSIX;
- unsafe permissions make Doctor fail;
- Windows fallback emits a clear protection warning;
- hosted logout deletes local credential but does not remove local MCP;
- hosted failure leaves local Context Relay operational.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/cli/src/credentials/file-store.test.ts packages/cli/src/credentials/platform-store.test.ts packages/cli/src/commands/login.test.ts packages/cli/src/commands/logout.test.ts
```

- [ ] **Step 3: Implement storage selection**

Use a platform store only when a tested platform command is available:

- macOS Keychain via `security`;
- Linux Secret Service via `secret-tool`;
- otherwise `.agentrail/credentials/v1.json` with restricted permissions.

Do not introduce `keytar` or another native Node dependency. Windows uses the
restricted-file fallback in M2 and Doctor explains the limitation without
printing its path publicly. A future native store is not advertised.

After login, update only the managed AgentRail client entry with:

```text
AGENTRAIL_INSTALLATION_ID
AGENTRAIL_API_URL
AGENTRAIL_PRIVACY_MODE=metrics-only
```

The credential itself is not written into Codex/Claude config. MCP retrieves it
from the credential store.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/cli/src/credentials/file-store.test.ts packages/cli/src/credentials/platform-store.test.ts packages/cli/src/commands/login.test.ts packages/cli/src/commands/logout.test.ts
rtk tsc -p packages/cli/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add packages/cli/src/credentials packages/cli/src/commands/login.ts packages/cli/src/commands/login.test.ts packages/cli/src/commands/logout.ts packages/cli/src/commands/logout.test.ts packages/cli/src/args.ts packages/cli/src/main.ts packages/cli/src/commands/doctor.ts
rtk git commit -m "feat(cli): activate optional hosted metrics"
```

---

### Task 6: Add a Separate Usage Event Queue and Fast Ingestion

**Files:**

- Create: `packages/queue/src/usage-types.ts`
- Create: `packages/queue/src/usage-memory.ts`
- Create: `packages/queue/src/usage-memory.test.ts`
- Create: `packages/queue/src/usage-redis.ts`
- Create: `packages/queue/src/usage-redis.integration.test.ts`
- Create: `packages/queue/src/usage-sqs.ts`
- Create: `packages/queue/src/usage-sqs.test.ts`
- Modify: `packages/queue/src/index.ts`
- Create: `apps/ingest/src/installation-auth.ts`
- Create: `apps/ingest/src/installation-auth.test.ts`
- Create: `apps/ingest/src/usage-events.ts`
- Create: `apps/ingest/src/usage-events.test.ts`
- Modify: `apps/ingest/src/app.ts`
- Modify: `apps/ingest/src/runtime.ts`
- Modify: `packages/config/src/index.ts`
- Modify: `.env.example`

**Interfaces:**

```ts
export type CanonicalUsageEvent = UsageEvent & {
  project_id: string;
  installation_id: string;
  received_at: string;
};

export interface UsageEventQueue {
  enqueue(batch: CanonicalUsageEventBatch): Promise<{ messageId: string }>;
  read(): Promise<UsageQueueMessage | null>;
  ack(message: UsageQueueMessage): Promise<void>;
  fail(message: UsageQueueMessage, reason: string): Promise<void>;
}
```

- [ ] **Step 1: Write failing queue/auth/API tests**

Prove:

- span and usage queues cannot consume each other's bodies;
- bearer credential lookup uses prefix then constant-time digest verification;
- revoked credential is `401`;
- body over 240 KB is `413`;
- batch over 100 is `400`;
- any forbidden/unknown safe attribute is `400`;
- server canonicalizes project/installation from credential;
- client-supplied project/installation is rejected;
- queue failure is `503 retryable`;
- 202 occurs only after enqueue;
- endpoint code performs no DB event insert;
- benchmark p95 remains within the documented local target.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/queue/src/usage-memory.test.ts packages/queue/src/usage-sqs.test.ts apps/ingest/src/installation-auth.test.ts apps/ingest/src/usage-events.test.ts
```

- [ ] **Step 3: Implement isolated queue and endpoint**

Configuration:

```env
AGENTRAIL_USAGE_STREAM=agentrail:usage-events
AGENTRAIL_USAGE_CONSUMER_GROUP=agentrail-usage-workers
AGENTRAIL_USAGE_QUEUE_URL=
```

Keep trace `SpanQueue` unchanged. Use separate Redis stream/SQS queue names and
typed bodies.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/queue/src/usage-memory.test.ts packages/queue/src/usage-sqs.test.ts apps/ingest/src/installation-auth.test.ts apps/ingest/src/usage-events.test.ts
rtk tsc -p packages/queue/tsconfig.json --noEmit
rtk tsc -p apps/ingest/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add packages/queue/src/usage-types.ts packages/queue/src/usage-memory.ts packages/queue/src/usage-memory.test.ts packages/queue/src/usage-redis.ts packages/queue/src/usage-redis.integration.test.ts packages/queue/src/usage-sqs.ts packages/queue/src/usage-sqs.test.ts packages/queue/src/index.ts apps/ingest/src/installation-auth.ts apps/ingest/src/installation-auth.test.ts apps/ingest/src/usage-events.ts apps/ingest/src/usage-events.test.ts apps/ingest/src/app.ts apps/ingest/src/runtime.ts packages/config/src/index.ts .env.example
rtk git commit -m "feat(ingest): enqueue bounded usage events"
```

---

### Task 7: Flush the Local Spool and Process Metrics Idempotently

**Files:**

- Create: `packages/context/src/spool-flush.ts`
- Create: `packages/context/src/spool-flush.test.ts`
- Modify: `packages/context/src/pack.ts`
- Create: `apps/worker/src/process-usage.ts`
- Create: `apps/worker/src/process-usage.integration.test.ts`
- Create: `apps/worker/src/usage-main.ts`
- Create: `apps/worker/src/usage-main.test.ts`
- Modify: `apps/worker/src/runtime.ts`

**Interfaces:**

```ts
export async function flushUsageSpool(input: {
  spool: UsageSpool;
  endpoint: URL;
  credential: string;
  fetch: typeof fetch;
  signal?: AbortSignal;
}): Promise<{
  accepted: number;
  retained: number;
  retryAt: string | null;
}>;
```

- [ ] **Step 1: Write failing offline/retry/worker tests**

Cover:

- Context Pack returns before a pending flush settles;
- only one flush runs per MCP process;
- 202 removes acknowledged event IDs;
- 429 honors bounded `Retry-After`;
- 401 stops retry and marks activation stale;
- 5xx/network retains events;
- partial batch acknowledgement removes only accepted IDs;
- worker duplicate writes neither duplicate event nor aggregate;
- event creates/updates safe `context_packs` metrics;
- first successful pack marks installation activated/last-seen;
- user and founder definitions can derive from the same row;
- worker failure calls queue `fail`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run packages/context/src/spool-flush.test.ts apps/worker/src/process-usage.integration.test.ts apps/worker/src/usage-main.test.ts
```

- [ ] **Step 3: Implement bounded background flush**

MCP schedules a best-effort flush after returning the tool result or at process
idle; it never awaits it on the response path. Backoff is exponential with
jitter, minimum five seconds, maximum one hour.

Worker transaction:

1. insert usage event on conflict do nothing;
2. if duplicate, exit;
3. upsert context pack metric/outcome;
4. update installation first-pack and last-seen;
5. increment daily aggregate.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run packages/context/src/spool-flush.test.ts apps/worker/src/process-usage.integration.test.ts apps/worker/src/usage-main.test.ts
rtk tsc -p packages/context/tsconfig.json --noEmit
rtk tsc -p apps/worker/tsconfig.json --noEmit
```

Commit:

```powershell
rtk git add packages/context/src/spool-flush.ts packages/context/src/spool-flush.test.ts packages/context/src/pack.ts apps/worker/src/process-usage.ts apps/worker/src/process-usage.integration.test.ts apps/worker/src/usage-main.ts apps/worker/src/usage-main.test.ts apps/worker/src/runtime.ts
rtk git commit -m "feat(worker): aggregate usage events idempotently"
```

---

### Task 8: Build Authenticated User Overview and Integrations

**Files:**

- Create: `apps/web/lib/product-read-model.ts`
- Create: `apps/web/lib/product-read-model.integration.test.ts`
- Create: `apps/web/app/(product)/layout.tsx`
- Create: `apps/web/app/(product)/dashboard/page.tsx`
- Create: `apps/web/app/(product)/dashboard/loading.tsx`
- Create: `apps/web/app/(product)/dashboard/error.tsx`
- Create: `apps/web/app/(product)/dashboard/integrations/page.tsx`
- Create: `apps/web/components/product/metric-strip.tsx`
- Create: `apps/web/components/product/onboarding-next-action.tsx`
- Create: `apps/web/components/product/integration-ledger.tsx`
- Create: `apps/web/components/product/installation-actions.tsx`
- Create: `apps/web/app/api/installations/revoke/route.ts`
- Create: `apps/web/app/api/installations/rotate/route.ts`
- Create: `apps/web/tests/installation-routes.test.ts`
- Modify: `apps/web/app/globals.css`
- Modify: `tests/e2e/dashboard-a11y.spec.ts`
- Create: `tests/e2e/product-dashboard.spec.ts`

**Interfaces:**

```ts
export type UserOverview = {
  packs7d: number;
  packs30d: number;
  contextReductionEstimate30d: number;
  reuseRate30d: number | null;
  connectedClients: number;
  staleDecisions: number;
  latestError: { code: string; occurredAt: string } | null;
  nextAction:
    "install" | "activate" | "create_first_pack" | "report_outcome" | null;
};
```

- [ ] **Step 1: Write failing scoped read and mutation tests**

Test:

- all queries require viewer project ID;
- another user's installation never appears;
- empty user receives one next action, not zero metrics alone;
- 7d/30d boundaries use UTC and injected clock;
- reduction is labeled estimated;
- reuse rate is null when denominator zero;
- revoke requires confirmation payload and owner;
- revoked credential fails ingestion immediately;
- rotate returns a new credential only once through a protected response and
  invalidates old credential;
- pages expose loading, empty, live, stale-client, queued telemetry, and error
  states.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run apps/web/lib/product-read-model.integration.test.ts apps/web/tests/installation-routes.test.ts
rtk playwright test tests/e2e/product-dashboard.spec.ts
```

- [ ] **Step 3: Implement server-first product UI**

Server Components fetch scoped data. Client Components are limited to copy,
confirmation dialogs, retry, and rotate/revoke forms. No chart library.

Integration ledger fields:

- client;
- package version;
- last seen;
- privacy mode;
- workspace count when known;
- last successful pack;
- stale version warning.

Actions:

- copy setup;
- Doctor guidance;
- reconnect;
- rotate;
- revoke;
- uninstall instructions.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run apps/web/lib/product-read-model.integration.test.ts apps/web/tests/installation-routes.test.ts apps/web/tests/design-contract.test.ts
rtk playwright test tests/e2e/product-dashboard.spec.ts tests/e2e/dashboard-a11y.spec.ts
rtk pnpm --filter @agentrail-sdk/web build
```

Commit:

```powershell
rtk git add apps/web/lib/product-read-model.ts apps/web/lib/product-read-model.integration.test.ts "apps/web/app/(product)" apps/web/components/product apps/web/app/api/installations apps/web/tests/installation-routes.test.ts apps/web/app/globals.css tests/e2e/product-dashboard.spec.ts tests/e2e/dashboard-a11y.spec.ts
rtk git commit -m "feat(web): add private usage and integration views"
```

---

### Task 9: Add Server-Authorized Founder Analytics

**Files:**

- Create: `apps/web/lib/admin-analytics.ts`
- Create: `apps/web/lib/admin-analytics.integration.test.ts`
- Create: `apps/web/app/(admin)/admin/analytics/page.tsx`
- Create: `apps/web/app/(admin)/admin/analytics/loading.tsx`
- Create: `apps/web/app/(admin)/admin/analytics/error.tsx`
- Create: `apps/web/components/admin/analytics-ledger.tsx`
- Create: `scripts/grant-admin.ts`
- Create: `tests/e2e/admin-analytics.spec.ts`
- Modify: `package.json`
- Modify: `apps/web/app/globals.css`

**Interfaces:**

```ts
export type FounderAnalytics = {
  authenticatedUsers: number;
  activatedInstallations: number;
  activeUsers7d: number;
  activeUsers30d: number;
  firstPackConversion: number | null;
  weeklyRetention: number | null;
  packsPerActiveUser30d: number | null;
  clientDistribution: readonly CountBucket[];
  versionDistribution: readonly CountBucket[];
  privacyModeDistribution: readonly CountBucket[];
  errorRate30d: number | null;
  p95LatencyMs30d: number | null;
  npmDownloads: {
    value: number | null;
    period: string;
    source: "npm" | "unavailable";
  };
};
```

- [ ] **Step 1: Write failing definition and authorization tests**

Seed fixed users/installations/events and prove exact definitions:

- authenticated user = distinct account row;
- activated installation = completed activation plus successful connection/pack;
- active user = distinct authenticated user with accepted pack event;
- first-pack conversion denominator is activated installations;
- weekly retention requires prior-week and selected-week activity;
- npm downloads do not alter active user values;
- no session → redirect/login;
- member → not found or 403;
- admin → data;
- role check occurs before analytics query.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run apps/web/lib/admin-analytics.integration.test.ts apps/web/lib/authz.test.ts
rtk playwright test tests/e2e/admin-analytics.spec.ts
```

- [ ] **Step 3: Implement stable aggregates**

Use daily aggregate rows for common totals and bounded raw-event queries for
percentile/retention until a scheduled aggregate is justified. Cache npm
download response server-side for 24 hours; on failure show unavailable. Label
all token reduction values `estimated`.

`grant-admin.ts` requires a concrete GitHub subject/email lookup and interactive
confirmation. It never grants by display name and never runs in CI.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run apps/web/lib/admin-analytics.integration.test.ts apps/web/lib/authz.test.ts
rtk playwright test tests/e2e/admin-analytics.spec.ts
rtk pnpm --filter @agentrail-sdk/web build
```

Commit:

```powershell
rtk git add apps/web/lib/admin-analytics.ts apps/web/lib/admin-analytics.integration.test.ts "apps/web/app/(admin)" apps/web/components/admin scripts/grant-admin.ts tests/e2e/admin-analytics.spec.ts package.json apps/web/app/globals.css
rtk git commit -m "feat(admin): expose truthful private usage analytics"
```

---

### Task 10: Add AWS Lambda Entrypoints, SAM Infrastructure, and Alarms

**Files:**

- Create: `apps/ingest/src/lambda.ts`
- Create: `apps/worker/src/usage-lambda.ts`
- Create: `apps/ingest/src/lambda.test.ts`
- Create: `infra/aws/template.yaml`
- Create: `infra/aws/samconfig.toml.example`
- Create: `infra/aws/parameters.example.json`
- Create: `infra/aws/tests/template.test.ts`
- Create: `docs/deployment/aws-control-plane.md`
- Modify: `docs/deployment/aws.md`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`

**Interfaces:**

- Hono Lambda entry uses:

```ts
import { handle } from "hono/aws-lambda";
export const handler = handle(app);
```

- SQS worker uses partial batch failure response and idempotent persistence.

- [ ] **Step 1: Write failing infrastructure contract tests**

Parse the SAM template and assert:

- API Gateway routes device and event endpoints;
- separate SQS queues for spans and usage events;
- DLQs and redrive policy;
- Lambda reserved concurrency;
- RDS PostgreSQL is private and encrypted;
- S3 evidence bucket is private, encrypted, public access blocked;
- secrets are references, not literals;
- CloudWatch alarms for API 5xx, latency, queue age/depth, DLQ, worker errors;
- AWS Budget notification resource or documented deployment prerequisite;
- log retention is finite;
- no wildcard data-plane IAM action where an ARN can be scoped.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run infra/aws/tests/template.test.ts apps/ingest/src/lambda.test.ts
```

- [ ] **Step 3: Implement reference infrastructure**

Use parameters for domain, VPC/subnets, database size, budget email, and secret
ARNs. Defaults must be conservative for a founding-user beta. Evidence S3
resources can remain disabled until evidence-sync M3.

Document:

- `sam validate`;
- build/deploy;
- migration execution;
- GitHub OAuth callback URL;
- Vercel server environment;
- Secrets Manager rotation;
- CloudWatch dashboard;
- budget/alarms;
- rollback;
- deletion protection before real beta.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
rtk vitest run infra/aws/tests/template.test.ts apps/ingest/src/lambda.test.ts
rtk test sam validate --lint --template-file infra/aws/template.yaml
rtk pnpm build
```

If SAM CLI is unavailable, install/use it in the documented CI container; do
not replace validation with a skipped test.

Commit:

```powershell
rtk git add apps/ingest/src/lambda.ts apps/ingest/src/lambda.test.ts apps/worker/src/usage-lambda.ts infra/aws docs/deployment/aws-control-plane.md docs/deployment/aws.md .github/workflows/ci.yml package.json
rtk git commit -m "feat(aws): define the optional hosted control plane"
```

---

### Task 11: Prove Activation-to-Dashboard End to End

**Files:**

- Create: `tests/e2e-cloud/activation-metrics.e2e.test.ts`
- Create: `tests/e2e-cloud/project-isolation.e2e.test.ts`
- Create: `tests/e2e-cloud/revocation.e2e.test.ts`
- Create: `tests/e2e-cloud/privacy.e2e.test.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/startup/evidence-register.md`

**Interfaces:**

- One test environment starts PostgreSQL, Redis/queue, ingest, usage worker, and
  web against isolated databases.

- [ ] **Step 1: Write the failing full flow**

Flow:

1. create GitHub-session fixture user;
2. CLI requests device code;
3. user approves owned project;
4. CLI receives and stores credential once;
5. Context Pack returns locally;
6. event is spooled/flushed;
7. API returns 202 after enqueue;
8. worker writes event/aggregate;
9. user dashboard shows pack;
10. founder dashboard counts the same user;
11. revoke installation;
12. next cloud event receives 401;
13. next local Context Pack still succeeds.

Isolation test creates two users/projects and attempts cross-project dashboard,
approval, revoke, event, and admin-less access.

Privacy test captures every request body and asserts the metrics-only forbidden
field list is absent recursively.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk vitest run tests/e2e-cloud
```

- [ ] **Step 3: Complete only missing integration wiring**

Do not weaken the test with direct repository writes after the initial fixtures.
The event must cross the real HTTP and queue boundaries.

Add:

```json
"test:e2e:cloud": "vitest run tests/e2e-cloud"
```

- [ ] **Step 4: Verify GREEN for M2 and commit**

Run:

```powershell
rtk pnpm format:check
rtk pnpm typecheck
rtk pnpm test
rtk pnpm build
rtk pnpm test:e2e
rtk pnpm test:e2e:cli
rtk pnpm test:e2e:cloud
rtk pnpm test:npm:tarball
```

Commit:

```powershell
rtk git add tests/e2e-cloud package.json .github/workflows/ci.yml docs/startup/evidence-register.md
rtk git commit -m "test(cloud): prove activation and analytics end to end"
```

## M2 Final Verification

Run all M2 commands with real local services, then deploy the reference backend
to a non-production AWS stack and run the same HTTP contract against it. Record
only actual stack/CloudWatch/evidence links.

Required observed outcomes:

- local-only sends zero events;
- metrics-only sends only the strict allowlist;
- device credential is returned once;
- revoked credential is rejected;
- user cannot access another project;
- member cannot access founder analytics;
- duplicate events do not inflate metrics;
- 202 is emitted only after enqueue;
- cloud outage does not block Context Pack;
- dashboard and founder analytics agree on accepted-event definitions;
- alarms and budget notifications are configured before founding-user traffic.
