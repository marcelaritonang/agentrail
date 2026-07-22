import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type SampleSpan = {
  trace_id: string;
  span_id: string;
  kind: "trace" | "llm" | "retrieval" | "tool" | "action" | "custom";
  name: string;
};

type BootstrapState = {
  batch: { spans: SampleSpan[] };
};

const state = JSON.parse(
  readFileSync(resolve(".agentrail/bootstrap-state.json"), "utf8"),
) as BootstrapState;

const root = state.batch.spans.find((span) => span.kind === "trace");
const llm = state.batch.spans.find((span) => span.kind === "llm");
if (root === undefined || llm === undefined) {
  throw new Error(
    "Run pnpm bootstrap:local before the dashboard browser suite",
  );
}

export const sampleTraceId = root.trace_id;
export const sampleLlmSpanId = llm.span_id;
