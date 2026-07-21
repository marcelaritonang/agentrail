import { readFile } from "node:fs/promises";

import { afterAll, describe, expect, it } from "vitest";

import { createDatabase, createSpanRepository } from "@agentrail/db";

const runSmoke = process.env.RUN_CORE_SMOKE === "1";
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://agentrail:agentrail@localhost:5433/agentrail_test";
const ingestUrl = process.env.INGEST_URL ?? "http://localhost:3001";
const database = runSmoke ? createDatabase(databaseUrl) : null;

afterAll(async () => {
  await database?.close();
});

async function waitForSpanCount(projectId: string, expected: number) {
  const repository = createSpanRepository(database!.db);
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const count = await repository.countSpans(projectId);
    if (count === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${expected} persisted spans`);
}

describe.runIf(runSmoke)("AgentRail local core pipeline", () => {
  it("keeps one row per (project_id, span_id) after duplicate ingestion", async () => {
    const state = JSON.parse(
      await readFile(".agentrail/bootstrap-state.json", "utf8"),
    ) as {
      projectId: string;
      rawKey: string;
      batch: { spans: Array<{ span_id: string }> };
    };
    const expected = state.batch.spans.length;
    await waitForSpanCount(state.projectId, expected);

    const duplicate = await fetch(`${ingestUrl}/v1/spans`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.rawKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(state.batch),
    });
    expect(duplicate.status).toBe(202);

    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await expect(
      createSpanRepository(database!.db).countSpans(state.projectId),
    ).resolves.toBe(expected);
  });
});
