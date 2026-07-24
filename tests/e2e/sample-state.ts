import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

export const sampleTraceId = demoMode ? DEMO_TRACE_ID : root!.trace_id;
export const sampleLlmSpanId = demoMode ? DEMO_LLM_SPAN_ID : llm!.span_id;
export const sampleAgentId = demoMode ? "research-agent" : llm!.agent_id;
export const sampleActionTitle = demoMode
  ? "Write application brief"
  : humanizeSampleName(action!.name);
