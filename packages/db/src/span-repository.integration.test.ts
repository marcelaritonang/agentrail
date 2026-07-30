import { readFile } from "node:fs/promises";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createSpanRepository,
  type DatabaseConnection,
  type SpanWrite,
} from "./index.js";

const PROJECT_ID = "00000000-0000-4000-8000-000000000001";
const TRACE_ID = "0af7651916cd43dd8448eb211c80319c";
const SPAN_A = "b7ad6b7169203331";
const SPAN_B = "b7ad6b7169203332";
const TEST_POSTGRES_URL =
  process.env.TEST_POSTGRES_URL ??
  "postgresql://agentrail:agentrail@localhost:5433/agentrail_test";

let database: DatabaseConnection;
let repository: ReturnType<typeof createSpanRepository>;

function fixtureSpan(overrides: Partial<SpanWrite> = {}): SpanWrite {
  return {
    projectId: PROJECT_ID,
    traceId: TRACE_ID,
    spanId: SPAN_A,
    parentSpanId: null,
    traceName: "research.answer",
    kind: "llm",
    name: "plan",
    agentId: "research-agent",
    onBehalfOf: "user_42",
    startedAt: new Date("2026-07-21T10:00:00.000Z"),
    endedAt: new Date("2026-07-21T10:00:01.000Z"),
    outcome: "ok",
    model: "test.known",
    inputTokens: 1_000,
    outputTokens: 500,
    costUsd: "0.00400000",
    pricingUnknown: false,
    pricingCatalogVersion: "2026-07-21",
    attributes: {},
    payloadRef: null,
    payloadTruncated: false,
    ...overrides,
  };
}

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
  repository = createSpanRepository(database.db);
});

beforeEach(async () => {
  await database.sql`
    TRUNCATE TABLE
      daily_usage,
      context_packs,
      usage_events,
      installations,
      device_codes,
      sessions,
      accounts,
      verifications,
      users,
      spans,
      traces,
      api_keys,
      projects
    CASCADE
  `;
  await repository.createProject({
    projectId: PROJECT_ID,
    name: "AgentRail test",
    payloadMode: "redacted",
  });
});

afterAll(async () => {
  await database.close();
});

describe("SpanRepository", () => {
  it("stores one row for duplicate project_id and span_id delivery", async () => {
    const first = await repository.insertSpan(fixtureSpan());
    const second = await repository.insertSpan(fixtureSpan());

    expect(first).toBe("inserted");
    expect(second).toBe("duplicate");
    expect(await repository.countSpans(PROJECT_ID)).toBe(1);
  });

  it("sets trace total to null when any priced span is unknown", async () => {
    await repository.insertSpan(fixtureSpan());
    await repository.insertSpan(
      fixtureSpan({
        spanId: SPAN_B,
        costUsd: null,
        pricingUnknown: true,
      }),
    );

    await repository.recomputeTrace(PROJECT_ID, TRACE_ID);

    expect(await repository.getTrace(PROJECT_ID, TRACE_ID)).toMatchObject({
      totalCostUsd: null,
      pricingUnknown: true,
    });
  });

  it("reads project policy and persisted spans within project scope", async () => {
    await repository.insertSpan(fixtureSpan());

    await expect(repository.getProject(PROJECT_ID)).resolves.toMatchObject({
      projectId: PROJECT_ID,
      payloadMode: "redacted",
    });
    await expect(repository.getSpan(PROJECT_ID, SPAN_A)).resolves.toMatchObject(
      {
        projectId: PROJECT_ID,
        spanId: SPAN_A,
      },
    );
  });

  it("resolves evidence only by the complete project, trace, and span scope", async () => {
    await repository.insertSpan(
      fixtureSpan({
        payloadRef: `payload/${PROJECT_ID}/${TRACE_ID}/${SPAN_A}.json`,
        payloadTruncated: true,
      }),
    );

    await expect(
      repository.getSpanForTrace(PROJECT_ID, "f".repeat(32), SPAN_A),
    ).resolves.toBeNull();
    await expect(
      repository.getSpanForTrace(PROJECT_ID, TRACE_ID, SPAN_A),
    ).resolves.toMatchObject({
      projectId: PROJECT_ID,
      traceId: TRACE_ID,
      spanId: SPAN_A,
      payloadTruncated: true,
    });
  });

  it("marks an open trace incomplete at an inclusive cutoff", async () => {
    await repository.insertSpan(
      fixtureSpan({ kind: "llm", startedAt: new Date("2026-07-21T10:00:00Z") }),
    );

    await expect(
      repository.markIncompleteBefore(new Date("2026-07-21T10:00:00Z")),
    ).resolves.toBe(1);
    await expect(
      repository.getTrace(PROJECT_ID, TRACE_ID),
    ).resolves.toMatchObject({
      completionState: "incomplete",
    });
  });

  it("resolves only active API keys by their non-secret prefix", async () => {
    const apiKeyId = "00000000-0000-4000-8000-000000000002";
    await repository.createApiKey({
      apiKeyId,
      projectId: PROJECT_ID,
      keyPrefix: "ar_local_abcdefg",
      keyDigest: "a".repeat(64),
    });

    await expect(
      repository.findActiveByPrefix("ar_local_abcdefg"),
    ).resolves.toMatchObject({
      projectId: PROJECT_ID,
      keyDigest: "a".repeat(64),
    });
    await repository.revokeApiKey(apiKeyId);
    await expect(
      repository.findActiveByPrefix("ar_local_abcdefg"),
    ).resolves.toBeNull();
  });
});
