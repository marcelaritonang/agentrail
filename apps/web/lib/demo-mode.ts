export const DEMO_PROJECT_ID = "00000000-0000-4000-8000-000000000101";
export const DEMO_TRACE_ID = "8044491c65f76da9f773b8369a00d889";
export const DEMO_ROOT_SPAN_ID = "0dbf4a99a87409e7";
export const DEMO_RETRIEVAL_SPAN_ID = "2ea61c7f29144901";
export const DEMO_LLM_SPAN_ID = "c67f6aafecfa753f";
export const DEMO_ACTION_SPAN_ID = "77422db049831bea";
export const SEEDED_SAMPLE_TRACE_NAME = "sample.research-answer";

export function demoModeEnabled(): boolean {
  const value = process.env.AGENTRAIL_DEMO_MODE?.trim().toLowerCase();
  return value === "1" || value === "true";
}

export function isReadOnlySampleTrace(trace: {
  traceId: string;
  name: string;
}): boolean {
  return (
    trace.traceId === DEMO_TRACE_ID || trace.name === SEEDED_SAMPLE_TRACE_NAME
  );
}
