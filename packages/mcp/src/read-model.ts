import {
  createDatabase,
  createSpanRepository,
  type PayloadMode,
  type SpanKind,
  type SpanOutcome,
  type TraceCompletionState,
} from "@agentrail-sdk/db";

import type {
  AgentRailPayloadStatus,
  AgentRailReadModel,
  AgentRailSpan,
  AgentRailTrace,
  AgentRailTraceDetail,
  AgentRailTraceListInput,
} from "./types";

export type AgentRailMcpConfig =
  | {
      mode: "demo";
      dashboardUrl?: string;
    }
  | {
      mode: "database";
      databaseUrl: string;
      projectId: string;
      dashboardUrl?: string;
    };

type StoredTrace = {
  traceId: string;
  rootSpanId: string | null;
  name: string;
  agentId: string;
  onBehalfOf: string | null;
  startedAt: Date;
  endedAt: Date | null;
  outcome: SpanOutcome | null;
  completionState: TraceCompletionState | null;
  totalCostUsd: string | null;
  pricingUnknown: boolean;
  spanCount: number;
};

type StoredSpan = {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  kind: SpanKind;
  name: string;
  agentId: string;
  onBehalfOf: string | null;
  startedAt: Date;
  endedAt: Date;
  outcome: SpanOutcome;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: string | null;
  pricingUnknown: boolean;
  attributes: Record<string, unknown>;
  payloadRef: string | null;
  payloadTruncated: boolean;
};

function truthy(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

function withDashboard<T extends { mode: "demo" | "database" }>(
  config: T,
  dashboardUrl: string | undefined,
): T & { dashboardUrl?: string } {
  return dashboardUrl === undefined ? config : { ...config, dashboardUrl };
}

export function createEnvironmentConfig(
  env: NodeJS.ProcessEnv,
): AgentRailMcpConfig {
  const dashboardUrl = optionalText(env.AGENTRAIL_DASHBOARD_URL);
  if (truthy(env.AGENTRAIL_DEMO_MODE)) {
    return withDashboard({ mode: "demo" }, dashboardUrl);
  }

  const databaseUrl = optionalText(env.DATABASE_URL);
  if (databaseUrl === undefined) {
    throw new Error("DATABASE_URL is required for AgentRail MCP database mode");
  }
  try {
    new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid URL");
  }

  const projectId = optionalText(env.AGENTRAIL_PROJECT_ID);
  if (projectId === undefined) {
    throw new Error(
      "AGENTRAIL_PROJECT_ID is required for AgentRail MCP database mode",
    );
  }

  return withDashboard(
    {
      mode: "database",
      databaseUrl,
      projectId,
    },
    dashboardUrl,
  );
}

function mapTrace(trace: StoredTrace): AgentRailTrace {
  return {
    traceId: trace.traceId,
    rootSpanId: trace.rootSpanId,
    name: trace.name,
    agentId: trace.agentId,
    onBehalfOf: trace.onBehalfOf,
    startedAt: trace.startedAt.toISOString(),
    endedAt: trace.endedAt?.toISOString() ?? null,
    outcome: trace.outcome,
    completionState: trace.completionState,
    totalCostUsd: trace.totalCostUsd,
    pricingUnknown: trace.pricingUnknown,
    spanCount: trace.spanCount,
  };
}

function mapSpan(span: StoredSpan): AgentRailSpan {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    kind: span.kind,
    name: span.name,
    agentId: span.agentId,
    onBehalfOf: span.onBehalfOf,
    startedAt: span.startedAt.toISOString(),
    endedAt: span.endedAt.toISOString(),
    outcome: span.outcome,
    model: span.model,
    inputTokens: span.inputTokens,
    outputTokens: span.outputTokens,
    costUsd: span.costUsd,
    pricingUnknown: span.pricingUnknown,
    attributes: span.attributes,
    hasPayload: span.payloadRef !== null,
    payloadTruncated: span.payloadTruncated,
  };
}

const demoTrace: AgentRailTrace = {
  traceId: "8044491c65f76da9f773b8369a00d889",
  rootSpanId: "0dbf4a99a87409e7",
  name: "sample.research-answer",
  agentId: "research-agent",
  onBehalfOf: "founder-review",
  startedAt: "2026-07-22T14:53:01.863Z",
  endedAt: "2026-07-22T14:53:03.113Z",
  outcome: "ok",
  completionState: "complete",
  totalCostUsd: "0.00400000",
  pricingUnknown: false,
  spanCount: 4,
};

const demoSpans: AgentRailSpan[] = [
  {
    traceId: demoTrace.traceId,
    spanId: demoTrace.rootSpanId!,
    parentSpanId: null,
    kind: "trace",
    name: "sample.research-answer",
    agentId: "research-agent",
    onBehalfOf: "founder-review",
    startedAt: "2026-07-22T14:53:01.863Z",
    endedAt: "2026-07-22T14:53:03.113Z",
    outcome: "ok",
    model: null,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    pricingUnknown: false,
    attributes: {},
    hasPayload: false,
    payloadTruncated: false,
  },
  {
    traceId: demoTrace.traceId,
    spanId: "2ea61c7f29144901",
    parentSpanId: demoTrace.rootSpanId,
    kind: "retrieval",
    name: "retrieve.founder-notes",
    agentId: "research-agent",
    onBehalfOf: "founder-review",
    startedAt: "2026-07-22T14:53:01.970Z",
    endedAt: "2026-07-22T14:53:02.184Z",
    outcome: "ok",
    model: null,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    pricingUnknown: false,
    attributes: { source_count: 3 },
    hasPayload: false,
    payloadTruncated: false,
  },
  {
    traceId: demoTrace.traceId,
    spanId: "c67f6aafecfa753f",
    parentSpanId: demoTrace.rootSpanId,
    kind: "llm",
    name: "draft.answer",
    agentId: "research-agent",
    onBehalfOf: "founder-review",
    startedAt: "2026-07-22T14:53:02.200Z",
    endedAt: "2026-07-22T14:53:03.041Z",
    outcome: "ok",
    model: "test.known",
    inputTokens: 1_000,
    outputTokens: 500,
    costUsd: "0.00400000",
    pricingUnknown: false,
    attributes: { safety: "redacted_payload" },
    hasPayload: true,
    payloadTruncated: false,
  },
  {
    traceId: demoTrace.traceId,
    spanId: "77422db049831bea",
    parentSpanId: demoTrace.rootSpanId,
    kind: "action",
    name: "write.application-brief",
    agentId: "research-agent",
    onBehalfOf: "founder-review",
    startedAt: "2026-07-22T14:53:03.005Z",
    endedAt: "2026-07-22T14:53:03.113Z",
    outcome: "ok",
    model: null,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    pricingUnknown: false,
    attributes: { path: "application-brief.md" },
    hasPayload: false,
    payloadTruncated: false,
  },
];

function createDemoReadModel(): AgentRailReadModel {
  const detail: AgentRailTraceDetail = { ...demoTrace, spans: demoSpans };
  return {
    async listTraces(input: AgentRailTraceListInput) {
      const query = input.query?.toLowerCase();
      const matchesQuery =
        query === undefined ||
        demoTrace.name.toLowerCase().includes(query) ||
        demoTrace.traceId.toLowerCase().includes(query);
      const matchesActor =
        input.actor === undefined || demoTrace.agentId === input.actor;
      const matchesOutcome =
        input.outcome === undefined || demoTrace.outcome === input.outcome;
      const items =
        matchesQuery && matchesActor && matchesOutcome ? [demoTrace] : [];
      return { items: items.slice(0, input.limit), total: items.length };
    },
    async getTrace(traceId: string) {
      return traceId === demoTrace.traceId ? detail : null;
    },
    async getPayloadStatus(traceId: string, spanId: string) {
      if (traceId !== demoTrace.traceId) {
        return {
          found: false,
          payloadMode: "redacted",
          hasPayload: false,
          truncated: false,
          reason: "span_not_found",
        };
      }
      const span = demoSpans.find((candidate) => candidate.spanId === spanId);
      if (span === undefined) {
        return {
          found: false,
          payloadMode: "redacted",
          hasPayload: false,
          truncated: false,
          reason: "span_not_found",
        };
      }
      if (!span.hasPayload) {
        return {
          found: true,
          payloadMode: "redacted",
          hasPayload: false,
          truncated: span.payloadTruncated,
          reason: "payload_absent",
        };
      }
      return {
        found: true,
        payloadMode: "redacted",
        hasPayload: true,
        truncated: span.payloadTruncated,
        reason: "available",
      };
    },
  };
}

function payloadStatus(
  payloadMode: PayloadMode | null,
  span: { payloadRef: string | null; payloadTruncated: boolean } | null,
): AgentRailPayloadStatus {
  if (payloadMode === null) {
    return {
      found: false,
      payloadMode: null,
      hasPayload: false,
      truncated: false,
      reason: "project_not_found",
    };
  }
  if (span === null) {
    return {
      found: false,
      payloadMode,
      hasPayload: false,
      truncated: false,
      reason: "span_not_found",
    };
  }
  if (payloadMode === "none") {
    return {
      found: true,
      payloadMode,
      hasPayload: false,
      truncated: span.payloadTruncated,
      reason: "payload_disabled",
    };
  }
  if (span.payloadRef === null) {
    return {
      found: true,
      payloadMode,
      hasPayload: false,
      truncated: span.payloadTruncated,
      reason: "payload_absent",
    };
  }
  return {
    found: true,
    payloadMode,
    hasPayload: true,
    truncated: span.payloadTruncated,
    reason: "available",
  };
}

export function createDatabaseReadModel(
  config: AgentRailMcpConfig,
): AgentRailReadModel {
  if (config.mode === "demo") {
    return createDemoReadModel();
  }

  const connection = createDatabase(config.databaseUrl);
  const repository = createSpanRepository(connection.db);

  return {
    async listTraces(input) {
      const result = await repository.listTraces({
        projectId: config.projectId,
        page: 1,
        pageSize: input.limit,
        ...(input.query === undefined ? {} : { query: input.query }),
        ...(input.actor === undefined ? {} : { actor: input.actor }),
        ...(input.outcome === undefined ? {} : { outcome: input.outcome }),
      });
      return { items: result.items.map(mapTrace), total: result.total };
    },
    async getTrace(traceId) {
      const trace = await repository.getTrace(config.projectId, traceId);
      if (trace === null) return null;
      const spans = await repository.listSpansForTrace(
        config.projectId,
        traceId,
      );
      return { ...mapTrace(trace), spans: spans.map(mapSpan) };
    },
    async getPayloadStatus(traceId, spanId) {
      const project = await repository.getProject(config.projectId);
      const span = await repository.getSpanForTrace(
        config.projectId,
        traceId,
        spanId,
      );
      return payloadStatus(project?.payloadMode ?? null, span);
    },
  };
}
