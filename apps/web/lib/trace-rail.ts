import type { TraceSpan } from "./trace-read-model";
import { orderTraceSpans } from "./trace-presentation";

export type TraceRailSignal =
  "action" | "error" | "llm" | "neutral" | "retrieval";

export type TraceRailRow = {
  span: TraceSpan;
  spanId: string;
  depth: number;
  offsetPercent: number;
  widthPercent: number;
  signal: TraceRailSignal;
};

export type TraceRailBounds = {
  traceStartMs: number;
  traceEndMs: number;
};

const MINIMUM_VISIBLE_PERCENT = 0.6;

function milliseconds(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function depthOf(
  span: TraceSpan,
  byId: ReadonlyMap<string, TraceSpan>,
): number {
  const visited = new Set([span.spanId]);
  let current = span;
  let depth = 0;

  while (current.parentSpanId !== null) {
    const parent = byId.get(current.parentSpanId);
    if (parent === undefined) return depth;
    if (visited.has(parent.spanId)) return 0;
    visited.add(parent.spanId);
    depth += 1;
    current = parent;
  }

  return depth;
}

function signalFor(span: TraceSpan): TraceRailSignal {
  if (span.outcome === "error") return "error";
  if (span.kind === "llm") return "llm";
  if (span.kind === "retrieval") return "retrieval";
  if (span.kind === "action" || span.kind === "tool") return "action";
  return "neutral";
}

function rounded(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

export function buildTraceRail(
  spans: readonly TraceSpan[],
  bounds?: TraceRailBounds,
): TraceRailRow[] {
  if (spans.length === 0) return [];

  const starts = spans.map((span) => milliseconds(span.startedAt));
  const ends = spans.map((span) => milliseconds(span.endedAt));
  const traceStartMs = bounds?.traceStartMs ?? Math.min(...starts);
  const requestedEnd = bounds?.traceEndMs ?? Math.max(...ends);
  const traceEndMs = Math.max(traceStartMs + 1, requestedEnd);
  const traceDurationMs = traceEndMs - traceStartMs;
  const byId = new Map(spans.map((span) => [span.spanId, span]));

  return orderTraceSpans(spans).map((span) => {
    const start = Math.min(
      traceEndMs,
      Math.max(traceStartMs, milliseconds(span.startedAt)),
    );
    const end = Math.min(
      traceEndMs,
      Math.max(start, milliseconds(span.endedAt)),
    );
    const rawOffset = ((start - traceStartMs) / traceDurationMs) * 100;
    const rawWidth = ((end - start) / traceDurationMs) * 100;
    const offsetPercent = Math.min(
      Math.max(0, rawOffset),
      100 - MINIMUM_VISIBLE_PERCENT,
    );
    const widthPercent = Math.min(
      100 - offsetPercent,
      Math.max(MINIMUM_VISIBLE_PERCENT, rawWidth),
    );

    return {
      span,
      spanId: span.spanId,
      depth: depthOf(span, byId),
      offsetPercent: rounded(offsetPercent),
      widthPercent: rounded(widthPercent),
      signal: signalFor(span),
    };
  });
}
