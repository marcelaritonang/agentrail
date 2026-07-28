import type { PayloadMode, SpanKind, SpanOutcome } from "@agentrail-sdk/db";

export type AgentRailTrace = {
  traceId: string;
  rootSpanId: string | null;
  name: string;
  agentId: string;
  onBehalfOf: string | null;
  startedAt: string;
  endedAt: string | null;
  outcome: SpanOutcome | null;
  completionState: "complete" | "incomplete" | null;
  totalCostUsd: string | null;
  pricingUnknown: boolean;
  spanCount: number;
};

export type AgentRailSpan = {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  kind: SpanKind;
  name: string;
  agentId: string;
  onBehalfOf: string | null;
  startedAt: string;
  endedAt: string;
  outcome: SpanOutcome;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: string | null;
  pricingUnknown: boolean;
  attributes: Record<string, unknown>;
  hasPayload: boolean;
  payloadTruncated: boolean;
};

export type AgentRailTraceDetail = AgentRailTrace & {
  spans: AgentRailSpan[];
};

export type AgentRailTraceListInput = {
  limit: number;
  query?: string;
  actor?: string;
  outcome?: SpanOutcome;
};

export type AgentRailTracePage = {
  items: AgentRailTrace[];
  total: number;
};

export type AgentRailPayloadStatus = {
  found: boolean;
  payloadMode: PayloadMode | null;
  hasPayload: boolean;
  truncated: boolean;
  reason:
    | "available"
    | "project_not_found"
    | "span_not_found"
    | "payload_disabled"
    | "payload_absent";
};

export type AgentRailReadModel = {
  listTraces(input: AgentRailTraceListInput): Promise<AgentRailTracePage>;
  getTrace(traceId: string): Promise<AgentRailTraceDetail | null>;
  getPayloadStatus(
    traceId: string,
    spanId: string,
  ): Promise<AgentRailPayloadStatus>;
};

export type AgentRailToolDependencies = {
  readModel: AgentRailReadModel;
  dashboardUrl?: string;
};

export type AgentRailToolResult = {
  content: [{ type: "text"; text: string }];
};
