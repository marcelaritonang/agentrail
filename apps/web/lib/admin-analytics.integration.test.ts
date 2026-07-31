import { readFile } from "node:fs/promises";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  accounts,
  contextPacks,
  createDatabase,
  dailyUsage,
  installations,
  projects,
  usageEvents,
  users,
  type DatabaseConnection,
} from "@agentrail-sdk/db";

import {
  createAdminAnalyticsPageDataLoader,
  createAdminAnalyticsReadModel,
} from "./admin-analytics";

const TEST_POSTGRES_URL =
  process.env.TEST_POSTGRES_URL ??
  "postgresql://agentrail:agentrail@localhost:5433/agentrail_test";

const NOW = new Date("2026-07-30T12:00:00.000Z");

const USER_A = "admin_user_a";
const USER_B = "admin_user_b";
const USER_C = "admin_user_c";
const USER_D = "admin_user_d";

const PROJECT_A = "00000000-0000-4000-8000-000000000901";
const PROJECT_B = "00000000-0000-4000-8000-000000000902";
const PROJECT_C = "00000000-0000-4000-8000-000000000903";
const PROJECT_D = "00000000-0000-4000-8000-000000000904";

let database: DatabaseConnection;
let readModel: ReturnType<typeof createAdminAnalyticsReadModel>;

beforeAll(async () => {
  if (!TEST_POSTGRES_URL.endsWith("/agentrail_test")) {
    throw new Error("Integration tests require the agentrail_test database");
  }

  database = createDatabase(TEST_POSTGRES_URL);
  const migrations = await Promise.all([
    readFile(
      new URL(
        "../../../packages/db/migrations/0000_agentrail_m1.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../../packages/db/migrations/0001_context_control_plane.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../../packages/db/migrations/0002_installation_usage_lifecycle.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  await database.sql.unsafe(
    "DROP SCHEMA public CASCADE; CREATE SCHEMA public;",
  );
  for (const migration of migrations) {
    if (migration.trim()) {
      await database.sql.unsafe(migration);
    }
  }

  readModel = createAdminAnalyticsReadModel(database.db, {
    readNpmDownloads: async () => ({
      value: 1234,
      period: "last-week",
      source: "npm",
    }),
  });
});

beforeEach(async () => {
  await database.db.delete(dailyUsage);
  await database.db.delete(contextPacks);
  await database.db.delete(usageEvents);
  await database.db.delete(installations);
  await database.db.delete(projects);
  await database.db.delete(accounts);
  await database.db.delete(users);
});

afterAll(async () => {
  await database.close();
});

describe("admin analytics read model", () => {
  it("derives founder metrics from authenticated accounts, activations, daily usage, and bounded raw events", async () => {
    await seedFixture();

    await expect(readModel.getFounderAnalytics({ now: NOW })).resolves.toEqual({
      authenticatedUsers: 4,
      activatedInstallations: 3,
      activeUsers7d: 2,
      activeUsers30d: 3,
      firstPackConversion: 0.67,
      weeklyRetention: 0.5,
      packsPerActiveUser30d: 2,
      clientDistribution: [
        { label: "codex", count: 3 },
        { label: "claude", count: 1 },
      ],
      versionDistribution: [
        { label: "0.1.1", count: 2 },
        { label: "0.1.0", count: 1 },
        { label: "0.0.9", count: 1 },
      ],
      privacyModeDistribution: [
        { label: "metrics-only", count: 2 },
        { label: "evidence-sync", count: 1 },
        { label: "local-only", count: 1 },
      ],
      errorRate30d: 0.5,
      p95LatencyMs30d: 800,
      npmDownloads: {
        value: 1234,
        period: "last-week",
        source: "npm",
      },
    });
  });

  it("keeps external npm download data out of active-user and retention calculations", async () => {
    await seedUserProject(USER_A, PROJECT_A, "metrics-only");
    const model = createAdminAnalyticsReadModel(database.db, {
      readNpmDownloads: async () => ({
        value: 999999,
        period: "last-week",
        source: "npm",
      }),
    });

    await expect(model.getFounderAnalytics({ now: NOW })).resolves.toMatchObject(
      {
        activeUsers7d: 0,
        activeUsers30d: 0,
        weeklyRetention: null,
        npmDownloads: {
          value: 999999,
          period: "last-week",
          source: "npm",
        },
      },
    );
  });

  it("checks admin authorization before analytics queries are executed", async () => {
    let analyticsQueried = false;
    const load = createAdminAnalyticsPageDataLoader({
      requireAdmin: async () => {
        throw new Error("forbidden");
      },
      readAnalytics: async () => {
        analyticsQueried = true;
        throw new Error("analytics should not run");
      },
    });

    await expect(load({ now: NOW })).rejects.toThrow("forbidden");
    expect(analyticsQueried).toBe(false);
  });

  it("returns data for an authorized admin", async () => {
    const load = createAdminAnalyticsPageDataLoader({
      requireAdmin: async () => ({
        userId: "admin",
        role: "admin",
        projectId: PROJECT_A,
      }),
      readAnalytics: async () => ({
        authenticatedUsers: 1,
        activatedInstallations: 0,
        activeUsers7d: 0,
        activeUsers30d: 0,
        firstPackConversion: null,
        weeklyRetention: null,
        packsPerActiveUser30d: null,
        clientDistribution: [],
        versionDistribution: [],
        privacyModeDistribution: [],
        errorRate30d: null,
        p95LatencyMs30d: null,
        npmDownloads: {
          value: null,
          period: "last-week",
          source: "unavailable",
        },
      }),
    });

    await expect(load({ now: NOW })).resolves.toMatchObject({
      authenticatedUsers: 1,
      npmDownloads: { source: "unavailable" },
    });
  });
});

async function seedFixture() {
  await seedUserProject(USER_A, PROJECT_A, "metrics-only");
  await seedUserProject(USER_B, PROJECT_B, "evidence-sync");
  await seedUserProject(USER_C, PROJECT_C, "local-only");
  await seedUserProject(USER_D, PROJECT_D, "metrics-only");

  await seedInstallation(PROJECT_A, "inst_a", {
    client: "codex",
    packageVersion: "0.1.1",
    activatedAt: new Date("2026-07-20T00:00:00.000Z"),
  });
  await seedInstallation(PROJECT_B, "inst_b", {
    client: "claude",
    packageVersion: "0.1.0",
    activatedAt: new Date("2026-07-22T00:00:00.000Z"),
  });
  await seedInstallation(PROJECT_C, "inst_c", {
    client: "codex",
    packageVersion: "0.1.1",
    activatedAt: new Date("2026-07-24T00:00:00.000Z"),
  });
  await seedInstallation(PROJECT_D, "inst_pending", {
    client: "codex",
    packageVersion: "0.0.9",
    activatedAt: null,
  });

  await seedDailyUsage(PROJECT_A, "2026-07-20", 1);
  await seedDailyUsage(PROJECT_A, "2026-07-29", 2);
  await seedDailyUsage(PROJECT_B, "2026-07-29", 3);

  await seedUsage(PROJECT_A, "inst_a", "ev_a_prior", "pack_a_prior", {
    occurredAt: new Date("2026-07-20T12:00:00.000Z"),
    latencyMs: 200,
  });
  await seedUsage(PROJECT_A, "inst_a", "ev_a_current", "pack_a_current", {
    occurredAt: new Date("2026-07-29T12:00:00.000Z"),
    latencyMs: 100,
  });
  await seedUsage(PROJECT_B, "inst_b", "ev_b_current", "pack_b_current", {
    occurredAt: new Date("2026-07-29T13:00:00.000Z"),
    latencyMs: 800,
  });
  await seedUsage(PROJECT_D, "inst_orphan", "ev_d_prior", "pack_d_prior", {
    occurredAt: new Date("2026-07-19T12:00:00.000Z"),
    latencyMs: 300,
  });
  await seedUsage(PROJECT_A, "inst_a", "ev_a_outcome", "pack_a_current", {
    eventType: "context_outcome_reported",
    outcome: "helpful",
    occurredAt: new Date("2026-07-29T12:05:00.000Z"),
  });
  await seedUsage(PROJECT_B, "inst_b", "ev_b_outcome", "pack_b_current", {
    eventType: "context_outcome_reported",
    outcome: "failed",
    occurredAt: new Date("2026-07-29T13:05:00.000Z"),
  });
}

async function seedUserProject(
  userId: string,
  projectId: string,
  privacyMode: "local-only" | "metrics-only" | "evidence-sync",
) {
  await database.db.insert(users).values({
    id: userId,
    name: userId,
    email: `${userId}@example.com`,
    emailVerified: true,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  });
  await database.db.insert(accounts).values({
    id: `acct_${userId}`,
    accountId: `github_${userId}`,
    providerId: "github",
    userId,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  });
  await database.db.insert(projects).values({
    projectId,
    name: `Project ${userId}`,
    payloadMode: "redacted",
    ownerUserId: userId,
    privacyMode,
  });
}

async function seedInstallation(
  projectId: string,
  installationId: string,
  input: {
    client: "codex" | "claude";
    packageVersion: string;
    activatedAt: Date | null;
  },
) {
  await database.db.insert(installations).values({
    projectId,
    installationId,
    credentialPrefix: `prefix_${installationId}`,
    credentialDigest: `digest_${installationId}`,
    clientType: input.client,
    packageVersion: input.packageVersion,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    activatedAt: input.activatedAt,
    lastSeenAt: input.activatedAt,
  });
}

async function seedDailyUsage(projectId: string, day: string, count: number) {
  await database.db.insert(dailyUsage).values({
    projectId,
    day,
    contextPackCreatedCount: count,
    contextOutcomeReportedCount: 0,
    candidateTokensEstimate: count * 1000,
    returnedTokensEstimate: count * 500,
    updatedAt: NOW,
  });
}

async function seedUsage(
  projectId: string,
  installationId: string,
  eventId: string,
  packId: string,
  input: {
    eventType?: "context_pack_created" | "context_outcome_reported";
    outcome?: "helpful" | "partial" | "missed" | "failed";
    occurredAt: Date;
    latencyMs?: number;
  },
) {
  await database.db.insert(usageEvents).values({
    projectId,
    installationId,
    eventId,
    packId,
    eventType: input.eventType ?? "context_pack_created",
    occurredAt: input.occurredAt,
    client: "codex",
    packageVersion: "0.1.1",
    status: "ready",
    latencyMs: input.latencyMs ?? 100,
    candidateTokensEstimate: 1000,
    returnedTokensEstimate: 500,
    sourceCounts: { high: 2 },
    warningCodes: [],
    outcome: input.outcome ?? null,
    reasonCode: input.outcome === "failed" ? "failed_test" : null,
  });

  await database.db
    .insert(contextPacks)
    .values({
      projectId,
      packId,
      status: "ready",
      candidateTokensEstimate: 1000,
      returnedTokensEstimate: 500,
      sourceCounts: { high: 2 },
      warningCodes: [],
      outcome: input.outcome ?? null,
      reasonCode: input.outcome === "failed" ? "failed_test" : null,
      firstSeenAt: input.occurredAt,
      lastSeenAt: input.occurredAt,
    })
    .onConflictDoNothing();
}
