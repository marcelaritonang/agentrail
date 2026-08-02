import { readFile } from "node:fs/promises";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createReceiptRepository,
  createSpanRepository,
  type DatabaseConnection,
} from "./index.js";

const TEST_POSTGRES_URL =
  process.env.TEST_POSTGRES_URL ??
  "postgresql://agentrail:agentrail@localhost:5433/agentrail_test";

const PROJECT_A = "00000000-0000-4000-8000-000000000601";
const PROJECT_B = "00000000-0000-4000-8000-000000000602";
const NOW = new Date("2026-08-01T10:00:00.000Z");

let database: DatabaseConnection;
let receiptRepository: ReturnType<typeof createReceiptRepository>;
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
    readFile(
      new URL(
        "../migrations/0002_installation_usage_lifecycle.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../migrations/0003_memory_receipts.sql", import.meta.url),
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

  receiptRepository = createReceiptRepository(database.db);
  spanRepository = createSpanRepository(database.db);
});

beforeEach(async () => {
  await truncateExistingTables([
    "shared_receipts",
    "outcome_reports",
    "context_sources",
    "receipts",
    "project_memories",
    "spans",
    "traces",
    "api_keys",
    "projects",
  ]);

  await spanRepository.createProject({
    projectId: PROJECT_A,
    name: "Project A",
    payloadMode: "redacted",
  });
  await spanRepository.createProject({
    projectId: PROJECT_B,
    name: "Project B",
    payloadMode: "redacted",
  });
});

afterAll(async () => {
  await database.close();
});

describe("ReceiptRepository", () => {
  it("migrates old trace rows with null pack_id", async () => {
    await spanRepository.insertSpan({
      projectId: PROJECT_A,
      traceId: "0af7651916cd43dd8448eb211c80319c",
      spanId: "b7ad6b7169203331",
      parentSpanId: null,
      traceName: "research.answer",
      kind: "trace",
      name: "research.answer",
      agentId: "agent",
      onBehalfOf: null,
      startedAt: NOW,
      endedAt: NOW,
      outcome: "ok",
      model: null,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      pricingUnknown: false,
      pricingCatalogVersion: null,
      attributes: {},
      payloadRef: null,
      payloadTruncated: false,
    });

    const rows = await database.sql<{ pack_id: string | null }[]>`
      select pack_id
      from traces
      where project_id = ${PROJECT_A}
    `;

    expect(rows).toEqual([{ pack_id: null }]);
  });

  it("stores memories with optimistic revisions", async () => {
    await expect(
      receiptRepository.upsertMemory({
        projectId: PROJECT_A,
        memoryId: "mem_0123456789abcdefghijklmn",
        revision: 1,
        type: "constraint",
        status: "active",
        statementRedacted: "Do not upload source by default.",
        scope: "repo",
        sourceKind: "explicit_tool",
        expiresAt: null,
        updatedAt: NOW,
        tombstone: null,
      }),
    ).resolves.toEqual({ status: "stored", revision: 1 });

    await expect(
      receiptRepository.upsertMemory({
        projectId: PROJECT_A,
        memoryId: "mem_0123456789abcdefghijklmn",
        revision: 1,
        type: "constraint",
        status: "active",
        statementRedacted: "Conflicting stale write.",
        scope: "repo",
        sourceKind: "explicit_tool",
        expiresAt: null,
        updatedAt: NOW,
        tombstone: null,
      }),
    ).resolves.toEqual({ status: "conflict", currentRevision: 1 });
  });

  it("stores metrics-only receipts without context sources", async () => {
    await receiptRepository.upsertReceipt(fixtureReceipt(PROJECT_A));

    await expect(
      receiptRepository.getReceipt({
        projectId: PROJECT_A,
        receiptId: "rcpt_0123456789abcdefghijklmn",
      }),
    ).resolves.toMatchObject({
      receiptId: "rcpt_0123456789abcdefghijklmn",
      evidenceMode: "metrics_only",
      sources: [],
    });
  });

  it("stores redacted evidence sources and isolates projects", async () => {
    await receiptRepository.upsertReceipt({
      ...fixtureReceipt(PROJECT_A),
      evidenceMode: "redacted_evidence",
      sourceCount: 1,
    });
    await receiptRepository.replaceContextSources({
      projectId: PROJECT_A,
      receiptId: "rcpt_0123456789abcdefghijklmn",
      sources: [
        {
          sourceId: "src_0123456789abcdefghijklmn",
          trustClass: "project_source",
          relativePath: "packages/context/src/pack.ts",
          locator: { startLine: 1, endLine: 4, symbol: "prepare" },
          contentHash:
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          selectionReasons: ["matches-task"],
          excerptRedacted: "redacted excerpt",
        },
      ],
    });

    await expect(
      receiptRepository.getReceipt({
        projectId: PROJECT_A,
        receiptId: "rcpt_0123456789abcdefghijklmn",
      }),
    ).resolves.toMatchObject({
      sources: [{ relativePath: "packages/context/src/pack.ts" }],
    });

    await expect(
      receiptRepository.getReceipt({
        projectId: PROJECT_B,
        receiptId: "rcpt_0123456789abcdefghijklmn",
      }),
    ).resolves.toBeNull();
  });

  it("deduplicates outcomes and supports revocable shares by digest", async () => {
    await receiptRepository.upsertReceipt(fixtureReceipt(PROJECT_A));

    const outcome = {
      projectId: PROJECT_A,
      outcomeId: "out_0123456789abcdefghijklmn",
      receiptId: "rcpt_0123456789abcdefghijklmn",
      packId: "cp_0123456789abcdefghijklmn",
      outcome: "helpful" as const,
      reasonCode: "solved_task" as const,
      reportedAt: NOW,
    };

    await expect(receiptRepository.insertOutcome(outcome)).resolves.toBe(
      "inserted",
    );
    await expect(receiptRepository.insertOutcome(outcome)).resolves.toBe(
      "duplicate",
    );

    await receiptRepository.createShare({
      projectId: PROJECT_A,
      receiptId: "rcpt_0123456789abcdefghijklmn",
      shareTokenDigest: "digest_0123456789abcdefghijklmn",
      fields: ["summary", "measurement"],
      reviewedAt: NOW,
      expiresAt: new Date("2026-08-08T10:00:00.000Z"),
    });

    await expect(
      receiptRepository.getSharedReceiptByDigest(
        "digest_0123456789abcdefghijklmn",
      ),
    ).resolves.toMatchObject({
      projectId: PROJECT_A,
      receiptId: "rcpt_0123456789abcdefghijklmn",
      revokedAt: null,
    });

    await expect(
      receiptRepository.revokeShare({
        projectId: PROJECT_A,
        receiptId: "rcpt_0123456789abcdefghijklmn",
      }),
    ).resolves.toBe(true);

    await expect(
      receiptRepository.getSharedReceiptByDigest(
        "digest_0123456789abcdefghijklmn",
      ),
    ).resolves.toBeNull();
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

function fixtureReceipt(projectId: string) {
  return {
    projectId,
    receiptId: "rcpt_0123456789abcdefghijklmn",
    packId: "cp_0123456789abcdefghijklmn",
    createdAt: NOW,
    status: "ready" as const,
    candidateTokensEstimate: 12_000,
    returnedTokensEstimate: 3_000,
    contextReductionEstimate: 75,
    measurementMethod: "heuristic-v1" as const,
    measurementConfidence: "estimated" as const,
    sourceCount: 0,
    warningCodes: ["budget_truncated"],
    evidenceMode: "metrics_only" as const,
  };
}
