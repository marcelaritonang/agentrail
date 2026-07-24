import type {
  AgentRailSpan,
  AgentRailToolDependencies,
  AgentRailToolResult,
  AgentRailTrace,
  AgentRailTraceListInput,
} from "./types";

export const AGENTRAIL_MCP_TOOL_NAMES = [
  "agentrail_list_traces",
  "agentrail_get_trace",
  "agentrail_get_actions",
  "agentrail_get_payload_status",
  "agentrail_open_dashboard",
] as const;

export type AgentRailMcpToolName = (typeof AGENTRAIL_MCP_TOOL_NAMES)[number];

export type AgentRailToolHandlers = Record<
  AgentRailMcpToolName,
  (input: Record<string, unknown>) => Promise<AgentRailToolResult>
>;

const DEFAULT_TRACE_LIMIT = 10;
const MAX_TRACE_LIMIT = 25;
const ATTRIBUTE_SUMMARY_LIMIT = 500;

export function createTextResult(value: unknown): AgentRailToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

export function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(
    /\b(postgres(?:ql)?:\/\/)[^\s]+/gi,
    (_match, scheme: string) => `${scheme}[redacted]`,
  );
}

function textValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function outcomeValue(value: unknown): "ok" | "error" | undefined {
  return value === "ok" || value === "error" ? value : undefined;
}

function traceLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_TRACE_LIMIT;
  }
  return Math.min(MAX_TRACE_LIMIT, Math.max(1, Math.floor(value)));
}

function durationMs(startedAt: string, endedAt: string | null): number | null {
  if (endedAt === null) return null;
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, end - start);
}

function dashboardTraceUrl(
  dashboardUrl: string | undefined,
  traceId: string,
): string | undefined {
  if (dashboardUrl === undefined) return undefined;
  return new URL(`/traces/${encodeURIComponent(traceId)}`, dashboardUrl)
    .toString()
    .replace(/\/$/, "");
}

function dashboardIndexUrl(dashboardUrl: string | undefined): string | null {
  if (dashboardUrl === undefined) return null;
  return new URL("/traces", dashboardUrl).toString().replace(/\/$/, "");
}

function presentTrace(
  trace: AgentRailTrace,
  dashboardUrl: string | undefined,
) {
  return {
    traceId: trace.traceId,
    rootSpanId: trace.rootSpanId,
    name: trace.name,
    agentId: trace.agentId,
    requestedBy: trace.onBehalfOf,
    startedAt: trace.startedAt,
    endedAt: trace.endedAt,
    durationMs: durationMs(trace.startedAt, trace.endedAt),
    outcome: trace.outcome,
    completionState: trace.completionState,
    spanCount: trace.spanCount,
    cost: trace.pricingUnknown ? null : trace.totalCostUsd,
    pricingUnknown: trace.pricingUnknown,
    ...(dashboardUrl === undefined
      ? {}
      : { dashboardUrl: dashboardTraceUrl(dashboardUrl, trace.traceId) }),
  };
}

function orderedSpans(spans: readonly AgentRailSpan[]): AgentRailSpan[] {
  return [...spans].sort(
    (left, right) =>
      Date.parse(left.startedAt) - Date.parse(right.startedAt) ||
      left.spanId.localeCompare(right.spanId),
  );
}

function attributesSummary(attributes: Record<string, unknown>): string | null {
  const serialized = JSON.stringify(attributes);
  if (serialized === "{}") return null;
  if (serialized.length <= ATTRIBUTE_SUMMARY_LIMIT) return serialized;
  return `${serialized.slice(0, ATTRIBUTE_SUMMARY_LIMIT)}…`;
}

function presentSpan(span: AgentRailSpan) {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    kind: span.kind,
    name: span.name,
    agentId: span.agentId,
    requestedBy: span.onBehalfOf,
    startedAt: span.startedAt,
    endedAt: span.endedAt,
    durationMs: durationMs(span.startedAt, span.endedAt),
    outcome: span.outcome,
    model: span.model,
    inputTokens: span.inputTokens,
    outputTokens: span.outputTokens,
    cost: span.pricingUnknown ? null : span.costUsd,
    pricingUnknown: span.pricingUnknown,
    payload: {
      hasPayload: span.hasPayload,
      truncated: span.payloadTruncated,
    },
    attributesSummary: attributesSummary(span.attributes),
  };
}

export function createAgentRailToolHandlers(
  dependencies: AgentRailToolDependencies,
): AgentRailToolHandlers {
  return {
    async agentrail_list_traces(input) {
      const limit = traceLimit(input.limit);
      const query = textValue(input.query);
      const actor = textValue(input.actor);
      const outcome = outcomeValue(input.outcome);
      const listInput: AgentRailTraceListInput = { limit };
      if (query !== undefined) listInput.query = query;
      if (actor !== undefined) listInput.actor = actor;
      if (outcome !== undefined) listInput.outcome = outcome;
      const page = await dependencies.readModel.listTraces(listInput);
      return createTextResult({
        total: page.total,
        limit,
        traces: page.items.map((trace) =>
          presentTrace(trace, dependencies.dashboardUrl),
        ),
      });
    },
    async agentrail_get_trace(input) {
      const traceId = textValue(input.traceId);
      if (traceId === undefined) {
        return createTextResult({ error: "traceId is required" });
      }
      const trace = await dependencies.readModel.getTrace(traceId);
      if (trace === null) {
        return createTextResult({ found: false, traceId });
      }
      return createTextResult({
        found: true,
        trace: presentTrace(trace, dependencies.dashboardUrl),
        spans: orderedSpans(trace.spans).map(presentSpan),
      });
    },
    async agentrail_get_actions(input) {
      const traceId = textValue(input.traceId);
      if (traceId === undefined) {
        return createTextResult({ error: "traceId is required" });
      }
      const trace = await dependencies.readModel.getTrace(traceId);
      if (trace === null) {
        return createTextResult({ found: false, traceId, actions: [] });
      }
      return createTextResult({
        found: true,
        traceId,
        actions: orderedSpans(trace.spans)
          .filter((span) => span.kind === "action" || span.kind === "tool")
          .map(presentSpan),
      });
    },
    async agentrail_get_payload_status(input) {
      const traceId = textValue(input.traceId);
      const spanId = textValue(input.spanId);
      if (traceId === undefined || spanId === undefined) {
        return createTextResult({ error: "traceId and spanId are required" });
      }
      const status = await dependencies.readModel.getPayloadStatus(
        traceId,
        spanId,
      );
      return createTextResult({
        traceId,
        spanId,
        found: status.found,
        payloadMode: status.payloadMode,
        hasPayload: status.hasPayload,
        truncated: status.truncated,
        reason: status.reason,
        rawPayloadReturned: false,
      });
    },
    async agentrail_open_dashboard(input) {
      const traceId = textValue(input.traceId);
      if (dependencies.dashboardUrl === undefined) {
        return createTextResult({
          configured: false,
          message:
            "Set AGENTRAIL_DASHBOARD_URL to let this MCP server return dashboard links.",
        });
      }
      return createTextResult({
        configured: true,
        url:
          traceId === undefined
            ? dashboardIndexUrl(dependencies.dashboardUrl)
            : dashboardTraceUrl(dependencies.dashboardUrl, traceId),
      });
    },
  };
}
