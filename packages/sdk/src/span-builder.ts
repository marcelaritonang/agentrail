import type { SpanEnvelope } from "@agentrail-sdk/contracts";
import type { ResolvedActor } from "./actor.js";

export type SpanKind = Exclude<SpanEnvelope["kind"], "trace">;

export type SpanOptions = {
  kind: SpanKind;
  name: string;
  actor?: {
    agentId?: string;
    onBehalfOf?: string | null;
  };
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  attributes?: Record<string, unknown>;
  payload?: unknown;
};

export type TraceOptions = {
  name: string;
  actor?: {
    agentId?: string;
    onBehalfOf?: string | null;
  };
  attributes?: Record<string, unknown>;
  payload?: unknown;
};

export type CompletedSpanInput = {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  traceName: string;
  kind: SpanEnvelope["kind"];
  name: string;
  actor: ResolvedActor;
  startedAt: Date;
  endedAt: Date;
  outcome: SpanEnvelope["outcome"];
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  attributes?: Record<string, unknown>;
  payload?: unknown;
};

export function completedSpan(input: CompletedSpanInput): SpanEnvelope {
  const span: SpanEnvelope = {
    schema_version: 1,
    trace_id: input.traceId,
    span_id: input.spanId,
    parent_span_id: input.parentSpanId,
    trace_name: input.traceName,
    kind: input.kind,
    name: input.name,
    agent_id: input.actor.agentId,
    on_behalf_of: input.actor.onBehalfOf,
    started_at: input.startedAt.toISOString(),
    ended_at: input.endedAt.toISOString(),
    outcome: input.outcome,
    attributes: Object.freeze({ ...(input.attributes ?? {}) }),
  };

  if (input.model !== undefined) span.model = input.model;
  if (input.inputTokens !== undefined) span.input_tokens = input.inputTokens;
  if (input.outputTokens !== undefined) span.output_tokens = input.outputTokens;
  if (input.payload !== undefined) span.payload = input.payload;

  return Object.freeze(span);
}
