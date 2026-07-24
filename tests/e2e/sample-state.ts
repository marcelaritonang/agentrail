import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TRACE_INCOMPLETE_AFTER_MS } from "@agentrail/config";
import { createDatabase } from "@agentrail/db";
import { DEMO_LLM_SPAN_ID, DEMO_TRACE_ID } from "../../apps/web/lib/demo-mode";

type SampleSpan = {
  trace_id: string;
  span_id: string;
  kind: "trace" | "llm" | "retrieval" | "tool" | "action" | "custom";
  name: string;
};

type BootstrapState = {
  batch: { spans: SampleSpan[] };
};

function e2eDemoModeEnabled() {
  const value = process.env.AGENTRAIL_DEMO_MODE?.trim().toLowerCase();
  return value === undefined || value === "1" || value === "true";
}

const demoMode = e2eDemoModeEnabled();

const state = JSON.parse(
  demoMode
    ? JSON.stringify({ batch: { spans: [] } })
    : readFileSync(resolve(".agentrail/bootstrap-state.json"), "utf8"),
) as BootstrapState;

const root = state.batch.spans.find((span) => span.kind === "trace");
const llm = state.batch.spans.find((span) => span.kind === "llm");
const action = state.batch.spans.find(
  (span) => span.kind === "action" || span.kind === "tool",
);
if (
  !demoMode &&
  (root === undefined || llm === undefined || action === undefined)
) {
  throw new Error(
    "Run pnpm bootstrap:local before the dashboard browser suite",
  );
}

function humanizeSampleName(value: string) {
  const normalized = value
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized[0]!.toUpperCase() + normalized.slice(1);
}

function timestamp(value: Date) {
  return value.toISOString();
}

export const sampleTraceId = demoMode ? DEMO_TRACE_ID : root!.trace_id;
export const sampleLlmSpanId = demoMode ? DEMO_LLM_SPAN_ID : llm!.span_id;
export const sampleAgentId = demoMode ? "research-agent" : llm!.agent_id;
export const sampleActionTitle = demoMode
  ? "Write application brief"
  : humanizeSampleName(action!.name);

export const incompleteTraceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const unpricedTraceId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const projectId =
  process.env.AGENTRAIL_PROJECT_ID ?? "00000000-0000-4000-8000-000000000101";
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://agentrail:agentrail@localhost:5433/agentrail_test";
const fixtureDatabaseUrl = new URL(databaseUrl);

if (fixtureDatabaseUrl.pathname !== "/agentrail_test") {
  throw new Error("E2E run-state fixtures require /agentrail_test");
}

const incompleteSpanId = "aaaaaaaaaaaaaaaa";
const unpricedRootSpanId = "bbbbbbbbbbbbbbbb";
export const unpricedLlmSpanId = "cccccccccccccccc";

export async function removeRunStateFixtures(): Promise<void> {
  const connection = createDatabase(databaseUrl);
  try {
    await connection.sql`
      DELETE FROM traces
      WHERE project_id = ${projectId}
        AND trace_id IN ${connection.sql([incompleteTraceId, unpricedTraceId])}
    `;
  } finally {
    await connection.close();
  }
}

export async function seedRunStateFixtures(): Promise<void> {
  const connection = createDatabase(databaseUrl);
  const now = new Date();
  const incompleteStartedAt = new Date(
    now.getTime() - TRACE_INCOMPLETE_AFTER_MS - 60_000,
  );
  const unpricedStartedAt = new Date(now.getTime() - 4_000);
  const unpricedLlmStartedAt = new Date(now.getTime() - 3_000);
  const unpricedLlmEndedAt = new Date(now.getTime() - 500);

  try {
    await connection.sql`
      DELETE FROM traces
      WHERE project_id = ${projectId}
        AND trace_id IN ${connection.sql([incompleteTraceId, unpricedTraceId])}
    `;

    await connection.sql`
      INSERT INTO traces (
        project_id, trace_id, root_span_id, name, agent_id, on_behalf_of,
        started_at, ended_at, outcome, completion_state, total_cost_usd,
        pricing_unknown, span_count
      ) VALUES
        (
          ${projectId}, ${incompleteTraceId}, NULL,
          'fixture.incomplete-research', 'fixture-researcher',
          'fixture-reviewer', ${timestamp(incompleteStartedAt)}, NULL, NULL,
          'incomplete', NULL, FALSE, 1
        ),
        (
          ${projectId}, ${unpricedTraceId}, ${unpricedRootSpanId},
          'fixture.unpriced-answer', 'fixture-researcher',
          'fixture-reviewer', ${timestamp(unpricedStartedAt)}, ${timestamp(now)},
          'ok', 'complete', NULL, TRUE, 2
        )
    `;

    await connection.sql`
      INSERT INTO spans (
        project_id, trace_id, span_id, parent_span_id, kind, name, agent_id,
        on_behalf_of, started_at, ended_at, outcome, model, cost_usd,
        pricing_unknown, attributes, payload_ref
      ) VALUES
        (
          ${projectId}, ${incompleteTraceId}, ${incompleteSpanId}, NULL,
          'custom', 'fixture.partial-step', 'fixture-researcher',
          'fixture-reviewer', ${timestamp(incompleteStartedAt)},
          ${timestamp(new Date(incompleteStartedAt.getTime() + 250))}, 'ok', NULL, NULL,
          FALSE, '{}'::jsonb, NULL
        ),
        (
          ${projectId}, ${unpricedTraceId}, ${unpricedRootSpanId}, NULL,
          'trace', 'fixture.unpriced-answer', 'fixture-researcher',
          'fixture-reviewer', ${timestamp(unpricedStartedAt)}, ${timestamp(now)},
          'ok', NULL, NULL, FALSE, '{}'::jsonb, NULL
        ),
        (
          ${projectId}, ${unpricedTraceId}, ${unpricedLlmSpanId},
          ${unpricedRootSpanId}, 'llm', 'model.unknown-answer',
          'fixture-researcher', 'fixture-reviewer',
          ${timestamp(unpricedLlmStartedAt)},
          ${timestamp(unpricedLlmEndedAt)}, 'ok',
          'fixture/model-without-price', NULL, TRUE, '{}'::jsonb,
          'fixtures/unpriced-payload.json'
        )
    `;
  } finally {
    await connection.close();
  }
}
