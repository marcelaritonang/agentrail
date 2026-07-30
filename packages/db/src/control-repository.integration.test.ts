import { readFile } from "node:fs/promises";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createControlRepository,
  createDatabase,
  createSpanRepository,
  type CanonicalUsageEvent,
  type DatabaseConnection,
  type NewInstallationCredential,
  type StoredDeviceCode,
} from "./index.js";

const TEST_POSTGRES_URL =
  process.env.TEST_POSTGRES_URL ??
  "postgresql://agentrail:agentrail@localhost:5433/agentrail_test";

const LEGACY_PROJECT_ID = "00000000-0000-4000-8000-000000000101";
const PROJECT_A = "00000000-0000-4000-8000-000000000201";
const PROJECT_B = "00000000-0000-4000-8000-000000000202";
const USER_A = "user_a";
const USER_B = "user_b";
const NOW = new Date("2026-07-29T10:00:00.000Z");

let database: DatabaseConnection;
let controlRepository: ReturnType<typeof createControlRepository>;
let spanRepository: ReturnType<typeof createSpanRepository>;

beforeAll(async () => {
  if (!TEST_POSTGRES_URL.endsWith("/agentrail_test")) {
    throw new Error("Integration tests require the agentrail_test database");
  }

  database = createDatabase(TEST_POSTGRES_URL);
  const migrations = await Promise.all([
    readFile(
      new URL("../migrations/0000_agentrail_m1.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../migrations/0001_context_control_plane.sql", import.meta.url),
      "utf8",
    ),
  ]);

  await database.sql.unsafe(
    "DROP SCHEMA public CASCADE; CREATE SCHEMA public;",
  );
  for (const migration of migrations) {
    if (migration.trim().length > 0) {
      await database.sql.unsafe(migration);
    }
  }

  controlRepository = createControlRepository(database.db);
  spanRepository = createSpanRepository(database.db);
});

beforeEach(async () => {
  await truncateExistingTables([
    "daily_usage",
    "context_packs",
    "usage_events",
    "installations",
    "device_codes",
    "sessions",
    "accounts",
    "verifications",
    "users",
    "spans",
    "traces",
    "api_keys",
    "projects",
  ]);
});

afterAll(async () => {
  await database.close();
});

describe("ControlRepository", () => {
  it("keeps existing trace projects readable without an owner", async () => {
    await spanRepository.createProject({
      projectId: LEGACY_PROJECT_ID,
      name: "Legacy M1 project",
      payloadMode: "redacted",
    });

    await expect(
      spanRepository.getProject(LEGACY_PROJECT_ID),
    ).resolves.toMatchObject({
      projectId: LEGACY_PROJECT_ID,
      ownerUserId: null,
      privacyMode: "local-only",
    });
  });

  it("creates one default hosted project for concurrent calls by one user", async () => {
    await insertUser(USER_A, "a@example.com");

    const [first, second] = await Promise.all([
      controlRepository.getOrCreateDefaultProject(USER_A),
      controlRepository.getOrCreateDefaultProject(USER_A),
    ]);

    expect(first.projectId).toBe(second.projectId);
    expect(first).toMatchObject({
      ownerUserId: USER_A,
      privacyMode: "metrics-only",
    });

    const rows = await database.sql<{ count: number }[]>`
      select count(*)::int
      from projects
      where owner_user_id = ${USER_A}
    `;
    expect(rows[0]?.count).toBe(1);
  });

  it("does not let another user approve a device code into the first user's project", async () => {
    await insertUser(USER_A, "a@example.com");
    await insertUser(USER_B, "b@example.com");
    await insertOwnedProject(PROJECT_A, USER_A);
    await controlRepository.issueDeviceCode(fixtureDeviceCode());

    await expect(
      controlRepository.approveDeviceCode({
        userCodeDigest: "uc_valid",
        userId: USER_B,
        projectId: PROJECT_A,
        now: NOW,
      }),
    ).resolves.toBe("not_found");

    await expect(
      controlRepository.approveDeviceCode({
        userCodeDigest: "uc_valid",
        userId: USER_A,
        projectId: PROJECT_A,
        now: NOW,
      }),
    ).resolves.toBe("approved");
  });

  it("returns distinct expired and already-approved approval states", async () => {
    await insertUser(USER_A, "a@example.com");
    await insertOwnedProject(PROJECT_A, USER_A);

    await controlRepository.issueDeviceCode(
      fixtureDeviceCode({
        deviceCodeId: "00000000-0000-4000-8000-000000000302",
        deviceCodeDigest: "dc_expired",
        userCodeDigest: "uc_expired",
        expiresAt: new Date("2026-07-29T09:59:59.000Z"),
      }),
    );
    await expect(
      controlRepository.approveDeviceCode({
        userCodeDigest: "uc_expired",
        userId: USER_A,
        projectId: PROJECT_A,
        now: NOW,
      }),
    ).resolves.toBe("expired");

    await controlRepository.issueDeviceCode(fixtureDeviceCode());
    await controlRepository.approveDeviceCode({
      userCodeDigest: "uc_valid",
      userId: USER_A,
      projectId: PROJECT_A,
      now: NOW,
    });
    await expect(
      controlRepository.approveDeviceCode({
        userCodeDigest: "uc_valid",
        userId: USER_A,
        projectId: PROJECT_A,
        now: NOW,
      }),
    ).resolves.toBe("already_approved");
  });

  it("consumes an approved device code and stores only credential digest material", async () => {
    await insertUser(USER_A, "a@example.com");
    await insertOwnedProject(PROJECT_A, USER_A);
    await controlRepository.issueDeviceCode(fixtureDeviceCode());
    await controlRepository.approveDeviceCode({
      userCodeDigest: "uc_valid",
      userId: USER_A,
      projectId: PROJECT_A,
      now: NOW,
    });

    const credential = fixtureCredential();
    await expect(
      controlRepository.consumeApprovedDeviceCode({
        deviceCodeDigest: "dc_valid",
        now: NOW,
        credential,
        minimumPollIntervalSeconds: 5,
      }),
    ).resolves.toMatchObject({
      status: "approved",
      projectId: PROJECT_A,
      installationId: credential.installationId,
      credential: { raw: credential.raw },
    });

    const rows = await database.sql<
      { credential_prefix: string; credential_digest: string; stored: string }[]
    >`
      select credential_prefix, credential_digest, row_to_json(installations)::text as stored
      from installations
      where installation_id = ${credential.installationId}
    `;
    expect(rows[0]).toMatchObject({
      credential_prefix: credential.prefix,
      credential_digest: credential.digest,
    });
    expect(rows[0]?.stored).not.toContain(credential.raw);

    await expect(
      controlRepository.consumeApprovedDeviceCode({
        deviceCodeDigest: "dc_valid",
        now: NOW,
        credential: fixtureCredential({ raw: "ar_should_not_return" }),
        minimumPollIntervalSeconds: 5,
      }),
    ).resolves.toMatchObject({ status: "access_denied" });
  });

  it("stores device poll timestamps and returns slow_down before the interval elapses", async () => {
    await insertUser(USER_A, "a@example.com");
    await insertOwnedProject(PROJECT_A, USER_A);
    await controlRepository.issueDeviceCode(fixtureDeviceCode());

    await expect(
      controlRepository.consumeApprovedDeviceCode({
        deviceCodeDigest: "dc_valid",
        now: NOW,
        credential: fixtureCredential(),
        minimumPollIntervalSeconds: 5,
      }),
    ).resolves.toMatchObject({ status: "authorization_pending" });

    await expect(
      controlRepository.consumeApprovedDeviceCode({
        deviceCodeDigest: "dc_valid",
        now: new Date("2026-07-29T10:00:02.000Z"),
        credential: fixtureCredential(),
        minimumPollIntervalSeconds: 5,
      }),
    ).resolves.toMatchObject({ status: "slow_down" });

    await controlRepository.approveDeviceCode({
      userCodeDigest: "uc_valid",
      userId: USER_A,
      projectId: PROJECT_A,
      now: new Date("2026-07-29T10:00:06.000Z"),
    });

    await expect(
      controlRepository.consumeApprovedDeviceCode({
        deviceCodeDigest: "dc_valid",
        now: new Date("2026-07-29T10:00:06.000Z"),
        credential: fixtureCredential(),
        minimumPollIntervalSeconds: 5,
      }),
    ).resolves.toMatchObject({ status: "approved", projectId: PROJECT_A });
  });

  it("keeps usage event idempotency from inflating daily aggregates", async () => {
    await insertUser(USER_A, "a@example.com");
    await insertOwnedProject(PROJECT_A, USER_A);
    await insertInstallation(PROJECT_A, fixtureCredential());
    const event = fixtureUsageEvent();

    const first = await controlRepository.insertUsageEvent(event);
    if (first === "inserted") {
      await controlRepository.upsertContextPack(metricFromEvent(event));
      await controlRepository.incrementDailyUsage(deltaFromEvent(event));
    }
    const duplicate = await controlRepository.insertUsageEvent(event);
    if (duplicate === "inserted") {
      await controlRepository.upsertContextPack(metricFromEvent(event));
      await controlRepository.incrementDailyUsage(deltaFromEvent(event));
    }

    expect(first).toBe("inserted");
    expect(duplicate).toBe("duplicate");

    const daily = await database.sql<
      {
        context_pack_created_count: number;
        candidate_tokens_estimate: number;
        returned_tokens_estimate: number;
      }[]
    >`
      select context_pack_created_count, candidate_tokens_estimate, returned_tokens_estimate
      from daily_usage
      where project_id = ${PROJECT_A} and day = '2026-07-29'
    `;
    expect(daily[0]).toMatchObject({
      context_pack_created_count: 1,
      candidate_tokens_estimate: 2000,
      returned_tokens_estimate: 1200,
    });
  });

  it("only lets the owning user revoke an installation", async () => {
    await insertUser(USER_A, "a@example.com");
    await insertUser(USER_B, "b@example.com");
    await insertOwnedProject(PROJECT_A, USER_A);
    const credential = fixtureCredential();
    await insertInstallation(PROJECT_A, credential);

    await expect(
      controlRepository.revokeInstallation({
        installationId: credential.installationId,
        ownerUserId: USER_B,
      }),
    ).resolves.toBe(false);
    await expect(
      controlRepository.findActiveInstallationByPrefix(credential.prefix),
    ).resolves.toMatchObject({ installationId: credential.installationId });

    await expect(
      controlRepository.revokeInstallation({
        installationId: credential.installationId,
        ownerUserId: USER_A,
      }),
    ).resolves.toBe(true);
    await expect(
      controlRepository.findActiveInstallationByPrefix(credential.prefix),
    ).resolves.toBeNull();
  });

  it("stores context pack metrics without task, path, content, or prompt columns", async () => {
    const rows = await database.sql<{ column_name: string }[]>`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'context_packs'
    `;
    const columns = new Set(rows.map((row) => row.column_name));

    expect(columns).toContain("source_counts");
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
      expect(columns.has(forbidden), forbidden).toBe(false);
    }
  });
});

async function truncateExistingTables(tableNames: readonly string[]) {
  const rows = await database.sql<{ table_name: string }[]>`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
  `;
  const existing = new Set(rows.map((row) => row.table_name));
  const quoted = tableNames
    .filter((tableName) => existing.has(tableName))
    .map((tableName) => `"${tableName}"`);

  if (quoted.length > 0) {
    await database.sql.unsafe(`TRUNCATE TABLE ${quoted.join(", ")} CASCADE`);
  }
}

async function insertUser(userId: string, email: string) {
  await database.sql`
    insert into users (id, name, email, role)
    values (${userId}, ${userId}, ${email}, 'member')
  `;
}

async function insertOwnedProject(projectId: string, userId: string) {
  await database.sql`
    insert into projects (project_id, name, payload_mode, owner_user_id, privacy_mode)
    values (${projectId}, 'AgentRail hosted', 'redacted', ${userId}, 'metrics-only')
  `;
}

async function insertInstallation(
  projectId: string,
  credential: NewInstallationCredential,
) {
  await database.sql`
    insert into installations (
      project_id,
      installation_id,
      credential_prefix,
      credential_digest,
      client_type,
      package_version
    )
    values (
      ${projectId},
      ${credential.installationId},
      ${credential.prefix},
      ${credential.digest},
      'codex',
      '0.1.2'
    )
  `;
}

function fixtureDeviceCode(
  overrides: Partial<StoredDeviceCode> = {},
): StoredDeviceCode {
  return {
    deviceCodeId: "00000000-0000-4000-8000-000000000301",
    deviceCodeDigest: "dc_valid",
    userCodeDigest: "uc_valid",
    clientType: "codex",
    packageVersion: "0.1.2",
    createdAt: new Date("2026-07-29T09:55:00.000Z"),
    expiresAt: new Date("2026-07-29T10:05:00.000Z"),
    ...overrides,
  };
}

function fixtureCredential(
  overrides: Partial<NewInstallationCredential> = {},
): NewInstallationCredential {
  return {
    installationId: "inst_01",
    raw: "ar_installation_raw_secret",
    prefix: "ar_inst_01",
    digest: "a".repeat(64),
    ...overrides,
  };
}

function fixtureUsageEvent(
  overrides: Partial<CanonicalUsageEvent> = {},
): CanonicalUsageEvent {
  return {
    projectId: PROJECT_A,
    installationId: "inst_01",
    eventId: "ev_0123456789abcdefghijklmn",
    packId: "cp_0123456789abcdefghijklmn",
    eventType: "context_pack_created",
    occurredAt: NOW,
    safeAttributes: {
      client: "codex",
      packageVersion: "0.1.2",
      status: "ready",
      latencyMs: 1200,
      candidateTokensEstimate: 2000,
      returnedTokensEstimate: 1200,
      sourceCounts: { file: 2 },
      warningCodes: ["truncated"],
    },
    ...overrides,
  };
}

function metricFromEvent(event: CanonicalUsageEvent) {
  return {
    projectId: event.projectId,
    packId: event.packId,
    status: event.safeAttributes.status,
    candidateTokensEstimate: event.safeAttributes.candidateTokensEstimate,
    returnedTokensEstimate: event.safeAttributes.returnedTokensEstimate,
    sourceCounts: event.safeAttributes.sourceCounts,
    warningCodes: event.safeAttributes.warningCodes,
    occurredAt: event.occurredAt,
    ...(event.safeAttributes.outcome === undefined
      ? {}
      : { outcome: event.safeAttributes.outcome }),
    ...(event.safeAttributes.reasonCode === undefined
      ? {}
      : { reasonCode: event.safeAttributes.reasonCode }),
  };
}

function deltaFromEvent(event: CanonicalUsageEvent) {
  return {
    projectId: event.projectId,
    day: "2026-07-29",
    eventType: event.eventType,
    candidateTokensEstimate: event.safeAttributes.candidateTokensEstimate,
    returnedTokensEstimate: event.safeAttributes.returnedTokensEstimate,
  };
}
