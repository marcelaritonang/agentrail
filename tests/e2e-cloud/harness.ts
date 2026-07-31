import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

import type { UsageEvent } from "@agentrail-sdk/contracts";
import {
  createContextRelay,
  flushUsageSpool,
  type ContextPack,
  type UsageSpool,
} from "@agentrail-sdk/context";
import {
  accounts,
  createControlRepository,
  createDatabase,
  users,
  type DatabaseConnection,
  type OwnedProject,
  type UserRole,
} from "@agentrail-sdk/db";
import {
  createHttpDeviceApi,
  runLoginCommand,
  type CommandResult,
  type CredentialStore,
  type DeviceApi,
} from "@agentrail-sdk/cli";
import {
  MemorySpanQueue,
  createRedisUsageEventQueue,
} from "@agentrail-sdk/queue";

import { createIngestApp } from "../../apps/ingest/src/app.js";
import { processUsageBatch } from "../../apps/worker/src/process-usage.js";
import { createActivationApprovalHandler } from "../../apps/web/lib/activation.js";
import {
  createAdminAnalyticsPageDataLoader,
  createAdminAnalyticsReadModel,
} from "../../apps/web/lib/admin-analytics.js";
import { createAuthzResolver } from "../../apps/web/lib/authz.js";
import { createInstallationRevokeHandler } from "../../apps/web/lib/installation-routes.js";
import { createProductReadModel } from "../../apps/web/lib/product-read-model.js";

const TEST_POSTGRES_URL =
  process.env.TEST_POSTGRES_URL ??
  "postgresql://agentrail:agentrail@localhost:5433/agentrail_test";
const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379";
const NOW = new Date("2026-07-30T08:00:00.000Z");
const DASHBOARD_NOW = new Date(NOW.getTime() + 1_000);
const BASE_URL = "https://agentrail.test";
const INSTALLATION_CREDENTIAL_PEPPER =
  "agentrail-e2e-installation-credential-pepper";

type FixtureUser = {
  userId: string;
  email: string;
  role: UserRole;
  projectId: string;
};

type CapturedRequest = {
  url: string;
  pathname: string;
  body: unknown;
  responseStatus: number;
};

type IssuedDeviceCode = {
  deviceCode: string;
  userCode: string;
};

type ApprovedDeviceToken = {
  projectId: string;
  installationId: string;
  credential: string;
};

class MemoryCredentialStore implements CredentialStore {
  readonly kind = "restricted-file" as const;
  readonly values = new Map<string, string>();
  setCount = 0;

  async get(projectKey: string): Promise<string | null> {
    return this.values.get(projectKey) ?? null;
  }

  async set(projectKey: string, credential: string): Promise<void> {
    this.setCount += 1;
    this.values.set(projectKey, credential);
  }

  async delete(projectKey: string): Promise<void> {
    this.values.delete(projectKey);
  }
}

class MemoryUsageSpool implements UsageSpool {
  readonly events = new Map<string, UsageEvent>();
  retryAt: string | null = null;
  staleReason: string | null = null;

  async append(event: UsageEvent): Promise<void> {
    this.events.set(event.event_id, event);
  }

  async readBatch(limit: number): Promise<readonly UsageEvent[]> {
    return [...this.events.values()].slice(0, limit);
  }

  async removeAccepted(eventIds: readonly string[]): Promise<void> {
    for (const eventId of eventIds) {
      this.events.delete(eventId);
    }
  }

  async setRetryAfter(retryAt: string | null): Promise<void> {
    this.retryAt = retryAt;
  }

  async markActivationStale(reason: string): Promise<void> {
    this.staleReason = reason;
  }
}

class AuthzStatusError extends Error {
  constructor(readonly status: number) {
    super(`Authz failed with HTTP ${status}`);
  }
}

export async function createCloudHarness(name: string) {
  const slug = safeSlug(name);
  const workspaceRoot = await createWorkspace(slug);
  const createdDatabase = await createIsolatedDatabase(slug);
  const database = createdDatabase.database;
  const controlRepository = createControlRepository(database.db);
  const usageQueue = await createRedisUsageEventQueue({
    url: TEST_REDIS_URL,
    stream: `agentrail:e2e:${createdDatabase.databaseName}:usage`,
    group: `agentrail-e2e-${createdDatabase.databaseName}`,
    consumer: `consumer-${process.pid}`,
    blockMs: 50,
  });
  const capturedRequests: CapturedRequest[] = [];
  let requestSequence = 0;
  let lastSpool: MemoryUsageSpool | null = null;

  const authzRepository = {
    getOrCreateDefaultProject(userId: string): Promise<OwnedProject> {
      return controlRepository.getOrCreateDefaultProject(userId);
    },
    findOwnedProject(input: {
      userId: string;
      projectId: string;
    }): Promise<OwnedProject | null> {
      return findOwnedProject(database, input);
    },
  };
  const app = createIngestApp({
    apiKeyPepper: "unused-in-cloud-e2e",
    apiKeys: { findActiveByPrefix: async () => null },
    queue: new MemorySpanQueue(),
    usageQueue,
    deviceCodes: controlRepository,
    installations: controlRepository,
    activationBaseUrl: `${BASE_URL}/activate`,
    installationCredentialPepper: INSTALLATION_CREDENTIAL_PEPPER,
    requestId: () => `req_e2e_${++requestSequence}`,
    now: () => NOW,
    deviceIssueRateLimit: async () => true,
  });

  async function fetchIngest(
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> {
    const url = requestUrl(input);
    const body = readJsonBody(init?.body);
    const response = await app.request(url, init);
    capturedRequests.push({
      url,
      pathname: new URL(url).pathname,
      body,
      responseStatus: response.status,
    });
    return response;
  }

  async function approveActivation(input: {
    user: FixtureUser;
    projectId: string;
    userCode: string;
  }): Promise<Response> {
    const handler = createActivationApprovalHandler({
      now: () => NOW,
      resolveViewer: async (projectId) =>
        resolveActivationViewer(input.user, projectId),
      repository: controlRepository,
    });
    return handler(
      jsonRequest(`${BASE_URL}/api/activation/approve`, {
        code: input.userCode,
        projectId: input.projectId,
      }),
    );
  }

  async function deviceApi(): Promise<DeviceApi> {
    return createHttpDeviceApi({
      baseUrl: BASE_URL,
      fetch: fetchIngest,
    });
  }

  function resolveActivationViewer(user: FixtureUser, projectId?: string) {
    return resolveUserProject(user, projectId).then((project) => {
      if (project === null) {
        return { status: "forbidden" as const };
      }
      return {
        status: "authenticated" as const,
        user: { userId: user.userId, role: user.role },
        project: { projectId: project.projectId },
      };
    });
  }

  async function resolveUserProject(
    user: FixtureUser,
    projectId?: string,
  ): Promise<OwnedProject | null> {
    if (projectId === undefined) {
      return controlRepository.getOrCreateDefaultProject(user.userId);
    }
    return findOwnedProject(database, { userId: user.userId, projectId });
  }

  return {
    async seedGithubUser(input: {
      userId: string;
      email: string;
      role: UserRole;
    }): Promise<FixtureUser> {
      await database.db
        .insert(users)
        .values({
          id: input.userId,
          name: input.userId,
          email: input.email,
          emailVerified: true,
          role: input.role,
        })
        .onConflictDoNothing();
      await database.db
        .insert(accounts)
        .values({
          id: `acct_${input.userId}`,
          accountId: `github_${input.userId}`,
          providerId: "github",
          userId: input.userId,
        })
        .onConflictDoNothing();
      const project = await controlRepository.getOrCreateDefaultProject(
        input.userId,
      );
      return {
        userId: input.userId,
        email: input.email,
        role: input.role,
        projectId: project.projectId,
      };
    },

    async loginViaCliAndApprove(input: { user: FixtureUser }): Promise<{
      result: CommandResult;
      installationId: string;
      credential: string;
      storeSetCount: number;
      replayedTokenStatus: string;
    }> {
      const api = await deviceApi();
      let issuedDeviceCode: string | null = null;
      let installationId: string | null = null;
      const recordingApi: DeviceApi = {
        async issue(body) {
          const issued = await api.issue(body);
          issuedDeviceCode = issued.device_code;
          return issued;
        },
        poll(deviceCode) {
          return api.poll(deviceCode);
        },
      };
      const store = new MemoryCredentialStore();
      const result = await runLoginCommand({
        api: recordingApi,
        apiUrl: BASE_URL,
        client: "codex",
        packageVersion: "0.1.2",
        projectKey: `workspace_${input.user.userId}`,
        store,
        openBrowser: async (url) => {
          const userCode = new URL(url).searchParams.get("code");
          if (userCode === null) {
            throw new Error("Activation URL did not include a user code.");
          }
          const response = await approveActivation({
            user: input.user,
            projectId: input.user.projectId,
            userCode,
          });
          if (!response.ok) {
            throw new Error(`Activation approval failed: ${response.status}`);
          }
        },
        sleep: async () => undefined,
        updateManagedClient: async (managed) => {
          installationId = managed.installationId;
        },
      });
      if (issuedDeviceCode === null) {
        throw new Error("CLI login did not issue a device code.");
      }
      const credential = await store.get(`workspace_${input.user.userId}`);
      if (credential === null || installationId === null) {
        throw new Error("CLI login did not persist an activated credential.");
      }
      const replayed = await api.poll(issuedDeviceCode);

      return {
        result,
        installationId,
        credential,
        storeSetCount: store.setCount,
        replayedTokenStatus: replayed.status,
      };
    },

    async issueDeviceCode(): Promise<IssuedDeviceCode> {
      const api = await deviceApi();
      const issued = await api.issue({
        schema_version: 1,
        client_type: "codex",
        package_version: "0.1.2",
      });
      return {
        deviceCode: issued.device_code,
        userCode: issued.user_code,
      };
    },

    async approveDeviceCode(input: {
      user: FixtureUser;
      projectId: string;
      userCode: string;
    }): Promise<number> {
      const response = await approveActivation(input);
      return response.status;
    },

    async pollApprovedDeviceCode(
      deviceCode: string,
    ): Promise<ApprovedDeviceToken> {
      const api = await deviceApi();
      const token = await api.poll(deviceCode);
      if (token.status !== "approved") {
        throw new Error(`Device code was not approved: ${token.status}`);
      }
      return {
        projectId: token.project_id,
        installationId: token.installation_id,
        credential: token.credential,
      };
    },

    async createAndFlushContextPack(input: {
      credential: string;
      installationId: string;
      task: string;
    }): Promise<ContextPack> {
      const spool = new MemoryUsageSpool();
      lastSpool = spool;
      const relay = createContextRelay({
        workspaceRoot,
        privacyMode: "metrics-only",
        client: "codex",
        packageVersion: "0.1.2",
        installationId: input.installationId,
        credential: input.credential,
        usageSpool: spool,
        now: () => NOW,
      });
      const pack = await relay.prepareContext({
        task: input.task,
        tokenBudget: 1_500,
      });
      await flushUsageSpool({
        spool,
        endpoint: new URL("/v1/events", BASE_URL),
        credential: input.credential,
        fetch: fetchIngest,
        now: () => NOW,
      });
      return pack;
    },

    async runUsageWorkerOnce() {
      const message = await usageQueue.read();
      if (message === null) {
        throw new Error("No usage event was available for the worker.");
      }
      try {
        const result = await processUsageBatch(
          { repository: controlRepository },
          message.body,
        );
        await usageQueue.ack(message);
        return result;
      } catch (error) {
        await usageQueue.fail(
          message,
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }
    },

    productOverview(projectId: string) {
      return createProductReadModel(database.db).getUserOverview({
        projectId,
        now: DASHBOARD_NOW,
      });
    },

    productIntegrations(projectId: string) {
      return createProductReadModel(database.db).listIntegrations({
        projectId,
        now: DASHBOARD_NOW,
      });
    },

    founderAnalytics() {
      return createAdminAnalyticsReadModel(database.db, {
        readNpmDownloads: async () => ({
          value: 0,
          period: "e2e",
          source: "npm",
        }),
      }).getFounderAnalytics({ now: DASHBOARD_NOW });
    },

    async canReadProject(input: {
      user: FixtureUser;
      projectId: string;
    }): Promise<boolean> {
      const resolver = createAuthzResolver({
        demoModeEnabled: () => false,
        readSession: async () => ({
          user: { id: input.user.userId, role: input.user.role },
        }),
        repository: authzRepository,
      });
      const result = await resolver.resolveViewer({
        projectId: input.projectId,
      });
      return result.status === "authenticated";
    },

    async revokeInstallation(input: {
      user: FixtureUser;
      installationId: string;
    }): Promise<number> {
      const handler = createInstallationRevokeHandler({
        resolveViewer: async () => {
          const project = await resolveUserProject(input.user);
          if (project === null) {
            return { status: "forbidden" };
          }
          return {
            status: "authenticated",
            user: { userId: input.user.userId, role: input.user.role },
            project: { projectId: project.projectId },
          };
        },
        repository: controlRepository,
      });
      const response = await handler(
        jsonRequest(`${BASE_URL}/api/installations/revoke`, {
          installationId: input.installationId,
          confirm: "revoke",
        }),
      );
      return response.status;
    },

    async postSpoofedUsageEvent(input: {
      credential: string;
      projectId: string;
    }): Promise<number> {
      const event = usageEvent({
        packId: "cp_spoofed000000000000000001",
      });
      const response = await fetchIngest(`${BASE_URL}/v1/events`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.credential}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          events: [{ ...event, project_id: input.projectId }],
        }),
      });
      return response.status;
    },

    async adminAnalyticsAs(user: FixtureUser): Promise<number> {
      const resolver = createAuthzResolver({
        demoModeEnabled: () => false,
        readSession: async () => ({
          user: { id: user.userId, role: user.role },
        }),
        repository: authzRepository,
      });
      const load = createAdminAnalyticsPageDataLoader({
        requireAdmin: async () => {
          const result = await resolver.resolveAdmin();
          if (result.status === "unauthenticated") {
            throw new AuthzStatusError(401);
          }
          if (result.status === "forbidden") {
            throw new AuthzStatusError(403);
          }
          return result.viewer;
        },
        readAnalytics: () => this.founderAnalytics(),
      });
      try {
        await load({ now: DASHBOARD_NOW });
        return 200;
      } catch (error) {
        if (error instanceof AuthzStatusError) {
          return error.status;
        }
        throw error;
      }
    },

    async writeWorkspaceFile(
      relativePath: string,
      text: string,
    ): Promise<void> {
      const destination = resolve(workspaceRoot, relativePath);
      if (!destination.startsWith(`${workspaceRoot}${sep}`)) {
        throw new Error("Workspace fixture path escaped the test root.");
      }
      await mkdir(resolve(destination, ".."), { recursive: true });
      await writeFile(destination, text);
    },

    usageResponseStatuses(): readonly number[] {
      return capturedRequests
        .filter((request) => request.pathname === "/v1/events")
        .map((request) => request.responseStatus);
    },

    lastUsageResponseStatus(): number | null {
      return this.usageResponseStatuses().at(-1) ?? null;
    },

    lastSpoolStaleReason(): string | null {
      return lastSpool?.staleReason ?? null;
    },

    usageRequestBodies(): readonly unknown[] {
      return capturedRequests
        .filter((request) => request.pathname === "/v1/events")
        .map((request) => request.body);
    },

    containsForbiddenPrivacyField(value: unknown): boolean {
      return containsForbiddenPrivacyField(value);
    },

    async dispose(): Promise<void> {
      await usageQueue.purge();
      usageQueue.close();
      await createdDatabase.drop();
      await rm(workspaceRoot, { recursive: true, force: true });
    },
  };
}

async function createWorkspace(slug: string): Promise<string> {
  const root = join(
    tmpdir(),
    `agentrail-cloud-e2e-${slug}-${process.pid}-${Date.now()}`,
  );
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(
    join(root, "README.md"),
    [
      "# AgentRail fixture",
      "This fixture describes a local Context Relay integration.",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(root, "src", "agent.ts"),
    [
      "export function buildAgent() {",
      '  return "context relay";',
      "}",
      "",
    ].join("\n"),
  );
  return root;
}

async function createIsolatedDatabase(slug: string): Promise<{
  databaseName: string;
  database: DatabaseConnection;
  drop: () => Promise<void>;
}> {
  const baseUrl = new URL(TEST_POSTGRES_URL);
  if (baseUrl.pathname !== "/agentrail_test") {
    throw new Error(
      "Cloud e2e tests require TEST_POSTGRES_URL ending in /agentrail_test.",
    );
  }
  const databaseName = `agentrail_e2e_${slug}_${process.pid}_${randomBytes(3).toString("hex")}`;
  if (!/^agentrail_e2e_[a-z0-9_]+$/.test(databaseName)) {
    throw new Error("Unsafe generated database name.");
  }

  const adminUrl = new URL(TEST_POSTGRES_URL);
  adminUrl.pathname = "/postgres";
  const admin = createDatabase(adminUrl.toString());
  await admin.sql.unsafe(`CREATE DATABASE "${databaseName}"`);

  const databaseUrl = new URL(TEST_POSTGRES_URL);
  databaseUrl.pathname = `/${databaseName}`;
  const database = createDatabase(databaseUrl.toString());
  await applyMigrations(database);

  return {
    databaseName,
    database,
    async drop() {
      await database.close();
      await admin.sql.unsafe(
        `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
      );
      await admin.close();
    },
  };
}

async function applyMigrations(database: DatabaseConnection): Promise<void> {
  const migrations = await Promise.all([
    readMigration("0000_agentrail_m1.sql"),
    readMigration("0001_context_control_plane.sql"),
    readMigration("0002_installation_usage_lifecycle.sql"),
  ]);
  for (const migration of migrations) {
    if (migration.trim().length > 0) {
      await database.sql.unsafe(migration);
    }
  }
}

async function readMigration(fileName: string): Promise<string> {
  return readFile(
    new URL(`../../packages/db/migrations/${fileName}`, import.meta.url),
    "utf8",
  );
}

async function findOwnedProject(
  database: DatabaseConnection,
  input: { userId: string; projectId: string },
): Promise<OwnedProject | null> {
  const rows = await database.sql<
    {
      project_id: string;
      owner_user_id: string | null;
      name: string;
      privacy_mode: OwnedProject["privacyMode"];
    }[]
  >`
    select project_id, owner_user_id, name, privacy_mode
    from projects
    where project_id = ${input.projectId}::uuid
      and owner_user_id = ${input.userId}
    limit 1
  `;
  const project = rows[0];

  if (!project?.owner_user_id) {
    return null;
  }
  return {
    projectId: project.project_id,
    ownerUserId: project.owner_user_id,
    name: project.name,
    privacyMode: project.privacy_mode,
  };
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function requestUrl(input: string | URL | Request): string {
  return input instanceof Request ? input.url : input.toString();
}

function readJsonBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") {
    return null;
  }
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function usageEvent(input: { packId: string }): UsageEvent {
  return {
    schema_version: 1,
    event_id: `ev_${randomBytes(16).toString("hex")}`,
    pack_id: input.packId,
    event_type: "context_pack_created",
    occurred_at: NOW.toISOString(),
    safe_attributes: {
      client: "codex",
      package_version: "0.1.2",
      status: "ready",
      latency_ms: 1,
      candidate_tokens_estimate: 100,
      returned_tokens_estimate: 50,
      source_counts: { project_source: 1 },
      warning_codes: [],
    },
  };
}

function containsForbiddenPrivacyField(value: unknown): boolean {
  const forbiddenKeys = new Set([
    "api_key",
    "completion",
    "content",
    "file_content",
    "messages",
    "password",
    "private_key",
    "prompt",
    "raw",
    "secret",
  ]);
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenPrivacyField(item));
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return Object.entries(value).some(([key, nested]) => {
    return (
      forbiddenKeys.has(key.toLowerCase()) ||
      containsForbiddenPrivacyField(nested)
    );
  });
}

function safeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
