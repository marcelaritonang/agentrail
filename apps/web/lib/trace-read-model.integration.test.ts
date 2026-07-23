import { readFile } from "node:fs/promises";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createSpanRepository,
  type DatabaseConnection,
  type SpanWrite,
} from "@agentrail/db";
import { createTraceReadModel } from "./trace-read-model";

const PROJECT_A = "00000000-0000-4000-8000-000000000101";
const PROJECT_B = "00000000-0000-4000-8000-000000000102";
const TRACE_A = "0af7651916cd43dd8448eb211c80319c";
const TRACE_B = "1af7651916cd43dd8448eb211c80319c";
const TEST_POSTGRES_URL =
  process.env.TEST_POSTGRES_URL ??
  "postgresql://agentrail:agentrail@localhost:5433/agentrail_test";

let database: DatabaseConnection;

function traceSpan(
  projectId: string,
  traceId: string,
  spanId: string,
): SpanWrite {
  return {
    projectId,
    traceId,
    spanId,
    parentSpanId: null,
    traceName: projectId === PROJECT_A ? "research.answer" : "private.other",
    kind: "trace",
    name: projectId === PROJECT_A ? "research.answer" : "private.other",
    agentId: projectId === PROJECT_A ? "research-agent" : "other-agent",
    onBehalfOf: "sample-user",
    startedAt: new Date("2026-07-21T10:00:00.000Z"),
    endedAt: new Date("2026-07-21T10:00:01.250Z"),
    outcome: "ok",
    model: null,
    inputTokens: null,
    outputTokens: null,
    costUsd: projectId === PROJECT_A ? "0.00400000" : null,
    pricingUnknown: projectId !== PROJECT_A,
    pricingCatalogVersion: null,
    attributes: { sample_data: true },
    payloadRef: null,
    payloadTruncated: false,
  };
}

beforeAll(async () => {
  if (!TEST_POSTGRES_URL.endsWith("/agentrail_test")) {
    throw new Error("Integration tests require the agentrail_test database");
  }
  database = createDatabase(TEST_POSTGRES_URL);
  const migration = await readFile(
    new URL(
      "../../../packages/db/migrations/0000_agentrail_m1.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await database.sql.unsafe(
    "DROP SCHEMA public CASCADE; CREATE SCHEMA public;",
  );
  await database.sql.unsafe(migration);
});

beforeEach(async () => {
  await database.sql`TRUNCATE TABLE spans, traces, api_keys, projects CASCADE`;
  const repository = createSpanRepository(database.db);
  await repository.createProject({
    projectId: PROJECT_A,
    name: "Project A",
    payloadMode: "redacted",
  });
  await repository.createProject({
    projectId: PROJECT_B,
    name: "Project B",
    payloadMode: "redacted",
  });
  await repository.insertSpan(
    traceSpan(PROJECT_A, TRACE_A, "0000000000000001"),
  );
  await repository.insertSpan(
    traceSpan(PROJECT_B, TRACE_B, "0000000000000002"),
  );
});

afterAll(async () => {
  await database.close();
});

describe("trace read model", () => {
  it("never returns traces from another project", async () => {
    const model = createTraceReadModel(createSpanRepository(database.db));
    const result = await model.listTraces({
      projectId: PROJECT_A,
      page: 1,
      pageSize: 25,
    });

    expect(result.items.map((item) => item.traceId)).toEqual([TRACE_A]);
    expect(result.total).toBe(1);
  });

  it("searches trace names and IDs within the requested project", async () => {
    const model = createTraceReadModel(createSpanRepository(database.db));

    await expect(
      model.listTraces({
        projectId: PROJECT_A,
        page: 1,
        query: TRACE_A.slice(0, 12),
      }),
    ).resolves.toMatchObject({
      total: 1,
      items: [expect.objectContaining({ traceId: TRACE_A })],
    });

    await expect(
      model.listTraces({
        projectId: PROJECT_B,
        page: 1,
        query: TRACE_A,
      }),
    ).resolves.toMatchObject({ total: 0, items: [] });
  });

  it("scopes detail spans by both project and trace", async () => {
    const model = createTraceReadModel(createSpanRepository(database.db));

    await expect(
      model.getTraceDetail(PROJECT_A, TRACE_A),
    ).resolves.toMatchObject({
      traceId: TRACE_A,
      spans: [expect.objectContaining({ projectId: PROJECT_A })],
    });
    await expect(model.getTraceDetail(PROJECT_A, TRACE_B)).resolves.toBeNull();
  });
});
