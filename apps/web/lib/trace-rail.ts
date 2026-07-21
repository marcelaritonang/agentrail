import type { TraceSpan } from "./trace-read-model";

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

function compareSpans(left: TraceSpan, right: TraceSpan): number {
  return (
    milliseconds(left.startedAt) - milliseconds(right.startedAt) ||
    left.spanId.localeCompare(right.spanId)
  );
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

function orderedSpans(spans: readonly TraceSpan[]): TraceSpan[] {
  const byId = new Map(spans.map((span) => [span.spanId, span]));
  const children = new Map<string, TraceSpan[]>();
  const roots: TraceSpan[] = [];

  for (const span of spans) {
    if (
      span.parentSpanId === null ||
      span.parentSpanId === span.spanId ||
      !byId.has(span.parentSpanId)
    ) {
      roots.push(span);
      continue;
    }
    const siblings = children.get(span.parentSpanId) ?? [];
    siblings.push(span);
    children.set(span.parentSpanId, siblings);
  }

  roots.sort(compareSpans);
  for (const siblings of children.values()) siblings.sort(compareSpans);

  const result: TraceSpan[] = [];
  const visited = new Set<string>();
  const visit = (span: TraceSpan) => {
    if (visited.has(span.spanId)) return;
    visited.add(span.spanId);
    result.push(span);
    for (const child of children.get(span.spanId) ?? []) visit(child);
  };

  for (const root of roots) visit(root);
  for (const span of [...spans].sort(compareSpans)) visit(span);
  return result;
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

  return orderedSpans(spans).map((span) => {
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
