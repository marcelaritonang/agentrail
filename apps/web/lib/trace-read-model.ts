import {
  createDatabase,
  createSpanRepository,
  type PayloadMode,
  type SpanKind,
  type SpanOutcome,
  type TraceCompletionState,
} from "@agentrail-sdk/db";
import { createDemoTraceReadRepository } from "./demo-read-model";
import { demoModeEnabled } from "./demo-mode";

type StoredTrace = {
  projectId: string;
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

export type TraceListItem = {
  traceId: string;
  rootSpanId: string | null;
  name: string;
  agentId: string;
  onBehalfOf: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  outcome: SpanOutcome | null;
  completionState: TraceCompletionState | null;
  totalCostUsd: string | null;
  pricingUnknown: boolean;
  spanCount: number;
};

export type TraceSpan = {
  projectId: string;
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
  pricingCatalogVersion: string | null;
  attributes: Record<string, unknown>;
  payloadTruncated: boolean;
  hasPayload: boolean;
};

export type TraceDetail = TraceListItem & {
  spans: TraceSpan[];
};

export type TracePage = {
  items: TraceListItem[];
  page: number;
  pageSize: number;
  total: number;
};

export type TraceListInput = {
  projectId: string;
  page: number;
  pageSize?: number;
  query?: string;
  outcome?: SpanOutcome;
  actor?: string;
};

export type TraceReadRepository = {
  listTraces(input: {
    projectId: string;
    page: number;
    pageSize: number;
    query?: string;
    outcome?: SpanOutcome;
    actor?: string;
  }): Promise<{ items: StoredTrace[]; total: number }>;
  getTrace(projectId: string, traceId: string): Promise<StoredTrace | null>;
  listSpansForTrace(projectId: string, traceId: string): Promise<StoredSpan[]>;
  getProject(
    projectId: string,
  ): Promise<{ projectId: string; payloadMode: PayloadMode } | null>;
};

type StoredSpan = {
  id: number;
  projectId: string;
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
  pricingCatalogVersion: string | null;
  attributes: Record<string, unknown>;
  payloadRef: string | null;
  payloadTruncated: boolean;
  createdAt: Date;
};

function traceItem(trace: StoredTrace): TraceListItem {
  return {
    traceId: trace.traceId,
    rootSpanId: trace.rootSpanId,
    name: trace.name,
    agentId: trace.agentId,
    onBehalfOf: trace.onBehalfOf,
    startedAt: trace.startedAt.toISOString(),
    endedAt: trace.endedAt?.toISOString() ?? null,
    durationMs:
      trace.endedAt === null
        ? null
        : trace.endedAt.getTime() - trace.startedAt.getTime(),
    outcome: trace.outcome,
    completionState: trace.completionState,
    totalCostUsd: trace.totalCostUsd,
    pricingUnknown: trace.pricingUnknown,
    spanCount: trace.spanCount,
  };
}

export function createTraceReadModel(repository: TraceReadRepository) {
  return {
    async listTraces(input: TraceListInput): Promise<TracePage> {
      const page = Math.max(1, Math.floor(input.page));
      const pageSize = 25;
      const query = input.query?.trim() || undefined;
      const actor = input.actor?.trim() || undefined;
      const result = await repository.listTraces({
        projectId: input.projectId,
        page,
        pageSize,
        ...(query === undefined ? {} : { query }),
        ...(input.outcome === undefined ? {} : { outcome: input.outcome }),
        ...(actor === undefined ? {} : { actor }),
      });
      return {
        items: result.items.map(traceItem),
        page,
        pageSize,
        total: result.total,
      };
    },

    async getTraceDetail(
      projectId: string,
      traceId: string,
    ): Promise<TraceDetail | null> {
      const trace = await repository.getTrace(projectId, traceId);
      if (trace === null) return null;
      const spans = await repository.listSpansForTrace(projectId, traceId);
      return {
        ...traceItem(trace),
        spans: spans.map((span) => ({
          projectId: span.projectId,
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
          pricingCatalogVersion: span.pricingCatalogVersion,
          attributes: span.attributes,
          payloadTruncated: span.payloadTruncated,
          hasPayload: span.payloadRef !== null,
        })),
      };
    },
  };
}

let productionModel: ReturnType<typeof createTraceReadModel> | undefined;
let productionModelMode: "database" | "demo" | undefined;

function model() {
  const mode = demoModeEnabled() ? "demo" : "database";
  if (productionModel !== undefined && productionModelMode === mode) {
    return productionModel;
  }

  productionModelMode = mode;
  if (mode === "demo") {
    productionModel = createTraceReadModel(createDemoTraceReadRepository());
    return productionModel;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required");
  const database = createDatabase(databaseUrl);
  productionModel = createTraceReadModel(createSpanRepository(database.db));
  return productionModel;
}

export function listTraces(input: TraceListInput): Promise<TracePage> {
  return model().listTraces(input);
}

export function getTraceDetail(
  projectId: string,
  traceId: string,
): Promise<TraceDetail | null> {
  return model().getTraceDetail(projectId, traceId);
}
