import { readFile } from "node:fs/promises";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  accounts,
  contextPacks,
  dailyUsage,
  installations,
  projects,
  usageEvents,
  users,
  type DatabaseConnection,
} from "@agentrail-sdk/db";

import { createProductReadModel } from "./product-read-model";

const TEST_POSTGRES_URL =
  process.env.TEST_POSTGRES_URL ??
  "postgresql://agentrail:agentrail@localhost:5433/agentrail_test";

const USER_A = "user_a";
const USER_B = "user_b";
const PROJECT_A = "00000000-0000-4000-8000-000000000801";
const PROJECT_B = "00000000-0000-4000-8000-000000000802";
const NOW = new Date("2026-07-30T12:00:00.000Z");

let database: DatabaseConnection;
let readModel: ReturnType<typeof createProductReadModel>;

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

  readModel = createProductReadModel(database.db);
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

describe("product read model", () => {
  it("returns an install next action for an empty owned project", async () => {
    await seedUserProject(USER_A, PROJECT_A);

    await expect(
      readModel.getUserOverview({ projectId: PROJECT_A, now: NOW }),
    ).resolves.toMatchObject({
      packs7d: 0,
      packs30d: 0,
      contextReductionEstimate30d: 0,
      reuseRate30d: null,
      connectedClients: 0,
      staleDecisions: 0,
      latestError: null,
      nextAction: "install",
    });
  });

  it("scopes metrics and installation ledger to the viewer project", async () => {
    await seedUserProject(USER_A, PROJECT_A);
    await seedUserProject(USER_B, PROJECT_B);
    await seedInstallation(PROJECT_A, "inst_a", {
      activatedAt: new Date("2026-07-29T10:00:00.000Z"),
      lastSeenAt: new Date("2026-07-30T10:00:00.000Z"),
      packageVersion: "0.1.1",
    });
    await seedInstallation(PROJECT_B, "inst_b", {
      activatedAt: new Date("2026-07-29T10:00:00.000Z"),
      lastSeenAt: new Date("2026-07-30T10:00:00.000Z"),
      packageVersion: "0.1.1",
    });

    await seedUsage(PROJECT_A, "inst_a", "ev_a1", "cp_a1", {
      occurredAt: new Date("2026-07-30T09:00:00.000Z"),
      candidate: 1000,
      returned: 250,
    });
    await seedUsage(PROJECT_A, "inst_a", "ev_a2", "cp_a1", {
      eventType: "context_outcome_reported",
      outcome: "helpful",
      occurredAt: new Date("2026-07-30T09:05:00.000Z"),
      candidate: 0,
      returned: 0,
    });
    await seedUsage(PROJECT_B, "inst_b", "ev_b1", "cp_b1", {
      occurredAt: new Date("2026-07-30T09:00:00.000Z"),
      candidate: 5000,
      returned: 500,
    });

    const overview = await readModel.getUserOverview({
      projectId: PROJECT_A,
      now: NOW,
    });
    const ledger = await readModel.listIntegrations({
      projectId: PROJECT_A,
      now: NOW,
    });

    expect(overview).toMatchObject({
      packs7d: 1,
      packs30d: 1,
      contextReductionEstimate30d: 75,
      reuseRate30d: 1,
      connectedClients: 1,
      nextAction: null,
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      installationId: "inst_a",
      client: "codex",
      packageVersion: "0.1.1",
      privacyMode: "metrics-only",
      status: "connected",
      workspaceCount: null,
      lastSuccessfulPackAt: "2026-07-30T09:00:00.000Z",
      staleVersionWarning: null,
    });
    expect(JSON.stringify(ledger)).not.toContain("inst_b");
  });

  it("uses UTC 7d and 30d boundaries with an injected clock", async () => {
    await seedUserProject(USER_A, PROJECT_A);
    await seedInstallation(PROJECT_A, "inst_a", {
      activatedAt: new Date("2026-07-01T00:00:00.000Z"),
      lastSeenAt: new Date("2026-07-30T10:00:00.000Z"),
      packageVersion: "0.1.1",
    });
    await seedUsage(PROJECT_A, "inst_a", "ev_7_in", "cp_7_in", {
      occurredAt: new Date("2026-07-23T12:00:00.000Z"),
    });
    await seedUsage(PROJECT_A, "inst_a", "ev_7_out", "cp_7_out", {
      occurredAt: new Date("2026-07-23T11:59:59.999Z"),
    });
    await seedUsage(PROJECT_A, "inst_a", "ev_30_in", "cp_30_in", {
      occurredAt: new Date("2026-06-30T12:00:00.000Z"),
    });
    await seedUsage(PROJECT_A, "inst_a", "ev_30_out", "cp_30_out", {
      occurredAt: new Date("2026-06-30T11:59:59.999Z"),
    });

    await expect(
      readModel.getUserOverview({ projectId: PROJECT_A, now: NOW }),
    ).resolves.toMatchObject({
      packs7d: 1,
      packs30d: 3,
    });
  });

  it("walks the onboarding next action from activate to first pack to outcome", async () => {
    await seedUserProject(USER_A, PROJECT_A);
    await seedInstallation(PROJECT_A, "inst_a", {
      activatedAt: null,
      lastSeenAt: null,
      packageVersion: "0.1.1",
    });

    await expect(
      readModel.getUserOverview({ projectId: PROJECT_A, now: NOW }),
    ).resolves.toMatchObject({ nextAction: "activate" });

    await database.db.update(installations).set({
      activatedAt: new Date("2026-07-30T09:00:00.000Z"),
      lastSeenAt: new Date("2026-07-30T09:00:00.000Z"),
    });

    await expect(
      readModel.getUserOverview({ projectId: PROJECT_A, now: NOW }),
    ).resolves.toMatchObject({ nextAction: "create_first_pack" });

    await seedUsage(PROJECT_A, "inst_a", "ev_pack", "cp_pack", {
      occurredAt: new Date("2026-07-30T10:00:00.000Z"),
    });

    await expect(
      readModel.getUserOverview({ projectId: PROJECT_A, now: NOW }),
    ).resolves.toMatchObject({ nextAction: "report_outcome" });
  });

  it("surfaces stale clients and the latest safe error", async () => {
    await seedUserProject(USER_A, PROJECT_A);
    await seedInstallation(PROJECT_A, "inst_old", {
      activatedAt: new Date("2026-07-01T10:00:00.000Z"),
      lastSeenAt: new Date("2026-07-01T10:00:00.000Z"),
      packageVersion: "0.1.0",
    });
    await seedUsage(PROJECT_A, "inst_old", "ev_failed", "cp_failed", {
      eventType: "context_outcome_reported",
      outcome: "failed",
      reasonCode: "timeout",
      occurredAt: new Date("2026-07-29T11:00:00.000Z"),
    });

    const overview = await readModel.getUserOverview({
      projectId: PROJECT_A,
      now: NOW,
    });
    const ledger = await readModel.listIntegrations({
      projectId: PROJECT_A,
      now: NOW,
    });

    expect(overview.staleDecisions).toBe(1);
    expect(overview.latestError).toEqual({
      code: "timeout",
      occurredAt: "2026-07-29T11:00:00.000Z",
    });
    expect(ledger[0]).toMatchObject({
      status: "stale",
      staleVersionWarning: "Upgrade to the latest AgentRail package.",
    });
  });
});

async function seedUserProject(userId: string, projectId: string) {
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
    privacyMode: "metrics-only",
  });
}

async function seedInstallation(
  projectId: string,
  installationId: string,
  input: {
    activatedAt: Date | null;
    lastSeenAt: Date | null;
    packageVersion: string;
  },
) {
  await database.db.insert(installations).values({
    projectId,
    installationId,
    credentialPrefix: `prefix_${installationId}`,
    credentialDigest: `digest_${installationId}`,
    clientType: "codex",
    packageVersion: input.packageVersion,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    activatedAt: input.activatedAt,
    lastSeenAt: input.lastSeenAt,
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
    reasonCode?: string;
    occurredAt: Date;
    candidate?: number;
    returned?: number;
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
    latencyMs: 120,
    candidateTokensEstimate: input.candidate ?? 100,
    returnedTokensEstimate: input.returned ?? 50,
    sourceCounts: { high: 2 },
    warningCodes: [],
    outcome: input.outcome ?? null,
    reasonCode: input.reasonCode ?? null,
  });

  await database.db
    .insert(contextPacks)
    .values({
      projectId,
      packId,
      status: "ready",
      candidateTokensEstimate: input.candidate ?? 100,
      returnedTokensEstimate: input.returned ?? 50,
      sourceCounts: { high: 2 },
      warningCodes: [],
      outcome: input.outcome ?? null,
      reasonCode: input.reasonCode ?? null,
      firstSeenAt: input.occurredAt,
      lastSeenAt: input.occurredAt,
    })
    .onConflictDoNothing();
}
