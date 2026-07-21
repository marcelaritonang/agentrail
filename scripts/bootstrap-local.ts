import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createDatabase, createSpanRepository } from "@agentrail/db";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://agentrail:agentrail@localhost:5433/agentrail_test";
const ingestUrl = process.env.INGEST_URL ?? "http://localhost:3001";
const pepper =
  process.env.API_KEY_PEPPER ?? "agentrail-local-development-pepper";
const statePath = resolve(".agentrail/bootstrap-state.json");

async function waitForIngest(): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${ingestUrl}/healthz`);
      if (response.ok) return;
    } catch {
      // The local container may still be starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(
    "AgentRail ingestion did not become healthy within 30 seconds",
  );
}

async function main(): Promise<void> {
  const rawKey = `ar_local_${randomBytes(32).toString("hex")}`;
  const keyPrefix = rawKey.slice(0, 16);
  const keyDigest = createHmac("sha256", pepper).update(rawKey).digest("hex");
  const projectId =
    process.env.AGENTRAIL_PROJECT_ID ?? "00000000-0000-4000-8000-000000000101";
  const apiKeyId = randomUUID();
  const traceId = randomBytes(16).toString("hex");
  const rootSpanId = randomBytes(8).toString("hex");
  const llmSpanId = randomBytes(8).toString("hex");
  const actionSpanId = randomBytes(8).toString("hex");
  const startedAt = new Date();
  const endedAt = new Date(startedAt.getTime() + 1_250);
  const batch = {
    spans: [
      {
        schema_version: 1,
        trace_id: traceId,
        span_id: llmSpanId,
        parent_span_id: rootSpanId,
        trace_name: "sample.research-answer",
        kind: "llm",
        name: "draft answer",
        agent_id: "sample-research-agent",
        on_behalf_of: "sample-user",
        started_at: startedAt.toISOString(),
        ended_at: new Date(startedAt.getTime() + 900).toISOString(),
        outcome: "ok",
        model: "test.known",
        input_tokens: 1_000,
        output_tokens: 500,
        attributes: { sample_data: true },
        payload: {
          prompt: "SAMPLE DATA: summarize the synthetic research notes",
          authorization: "Bearer synthetic-secret-to-redact",
        },
      },
      {
        schema_version: 1,
        trace_id: traceId,
        span_id: actionSpanId,
        parent_span_id: rootSpanId,
        trace_name: "sample.research-answer",
        kind: "action",
        name: "filesystem.read",
        agent_id: "sample-research-agent",
        on_behalf_of: "sample-user",
        started_at: new Date(startedAt.getTime() + 100).toISOString(),
        ended_at: new Date(startedAt.getTime() + 350).toISOString(),
        outcome: "ok",
        attributes: { sample_data: true, path: "/synthetic/notes.md" },
      },
      {
        schema_version: 1,
        trace_id: traceId,
        span_id: rootSpanId,
        parent_span_id: null,
        trace_name: "sample.research-answer",
        kind: "trace",
        name: "sample.research-answer",
        agent_id: "sample-research-agent",
        on_behalf_of: "sample-user",
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        outcome: "ok",
        attributes: { sample_data: true },
      },
    ],
  };

  const database = createDatabase(databaseUrl);
  try {
    const repository = createSpanRepository(database.db);
    await repository.createProject({
      projectId,
      name: "AgentRail SAMPLE DATA",
      payloadMode: "redacted",
    });
    await repository.createApiKey({
      apiKeyId,
      projectId,
      keyPrefix,
      keyDigest,
    });
  } finally {
    await database.close();
  }

  await waitForIngest();
  const response = await fetch(`${ingestUrl}/v1/spans`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${rawKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(batch),
  });
  if (response.status !== 202) {
    throw new Error(`Bootstrap ingestion returned HTTP ${response.status}`);
  }

  await mkdir(resolve(".agentrail"), { recursive: true });
  await writeFile(
    statePath,
    `${JSON.stringify({ projectId, rawKey, batch }, null, 2)}\n`,
    "utf8",
  );

  process.stdout.write(`AgentRail local API key (printed once): ${rawKey}\n`);
  process.stdout.write(`SAMPLE DATA accepted; state: ${statePath}\n`);
}

void main();
