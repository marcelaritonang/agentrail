import { TRACE_INCOMPLETE_AFTER_MS } from "@agentrail-sdk/config";

import { formatCost, formatDuration, formatTimestamp, shortId } from "./format";
import type { TraceDetail, TraceListItem, TraceSpan } from "./trace-read-model";

export type RunOutcomeLabel = "Succeeded" | "Failed";

export type RunPresentation = {
  traceId: string;
  displayTitle: string;
  technicalName: string;
  shortRunId: string;
  agentId: string;
  requestedBy: string | null;
  startedAtLabel: string;
  outcomeLabel: RunOutcomeLabel | null;
  completionLabel: "Incomplete recording" | null;
  completionExplanation: string | null;
  durationLabel: string;
  modelCostLabel: string;
  modelCostTechnicalLabel: "UNPRICED" | null;
  stepCount: number;
  technicalSpanCount: number;
  isReadOnlyExample: boolean;
};

export type StepCategoryLabel =
  | "Looked up data"
  | "Called an AI model"
  | "Performed an external action"
  | "Called a tool"
  | "Recorded the complete run"
  | "Recorded a custom step";

export type StepPresentation = {
  traceId: string;
  spanId: string;
  ordinal: number | null;
  isRootBoundary: boolean;
  displayName: string;
  technicalName: string;
  categoryLabel: StepCategoryLabel;
  technicalKind: TraceSpan["kind"];
  outcomeLabel: RunOutcomeLabel;
  durationLabel: string;
  agentId: string;
  hasPayload: boolean;
};

export type RunDetailPresentation = RunPresentation & {
  summary: string;
  externalActionCount: number;
  agentCount: number;
  rootBoundary: StepPresentation | null;
  steps: StepPresentation[];
};

const categoryByKind: Record<TraceSpan["kind"], StepCategoryLabel> = {
  trace: "Recorded the complete run",
  retrieval: "Looked up data",
  llm: "Called an AI model",
  action: "Performed an external action",
  tool: "Called a tool",
  custom: "Recorded a custom step",
};

export function humanizeName(value: string, fallback: string): string {
  const normalized = value
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length === 0) return fallback;
  return normalized[0]!.toUpperCase() + normalized.slice(1);
}

function stepCount(trace: TraceListItem): number {
  return Math.max(0, trace.spanCount - (trace.rootSpanId === null ? 0 : 1));
}

function outcomeLabel(trace: TraceListItem): RunOutcomeLabel | null {
  if (trace.outcome === "ok") return "Succeeded";
  if (trace.outcome === "error") return "Failed";
  return null;
}

function incompleteExplanation(): string {
  const minutes = TRACE_INCOMPLETE_AFTER_MS / 60_000;
  return `No completion envelope was recorded within ${minutes} minutes.`;
}

function presentationCost(
  trace: TraceListItem,
): Pick<RunPresentation, "modelCostLabel" | "modelCostTechnicalLabel"> {
  if (trace.pricingUnknown) {
    return {
      modelCostLabel: "Price unavailable",
      modelCostTechnicalLabel: "UNPRICED",
    };
  }
  return {
    modelCostLabel: formatCost(trace),
    modelCostTechnicalLabel: null,
  };
}

export function presentRun(
  trace: TraceListItem,
  options: { isReadOnlyExample?: boolean } = {},
): RunPresentation {
  const isIncomplete = trace.completionState === "incomplete";
  return {
    traceId: trace.traceId,
    displayTitle: options.isReadOnlyExample
      ? "Research answer"
      : humanizeName(trace.name, "Unnamed agent run"),
    technicalName: trace.name,
    shortRunId: shortId(trace.traceId),
    agentId: trace.agentId,
    requestedBy: trace.onBehalfOf,
    startedAtLabel: formatTimestamp(trace.startedAt),
    outcomeLabel: outcomeLabel(trace),
    completionLabel: isIncomplete ? "Incomplete recording" : null,
    completionExplanation: isIncomplete ? incompleteExplanation() : null,
    durationLabel: formatDuration(trace.durationMs ?? Number.NaN),
    ...presentationCost(trace),
    stepCount: stepCount(trace),
    technicalSpanCount: trace.spanCount,
    isReadOnlyExample: options.isReadOnlyExample === true,
  };
}

export function orderTraceSpans(spans: readonly TraceSpan[]): TraceSpan[] {
  const byParent = new Map<string | null, TraceSpan[]>();
  for (const span of spans) {
    const siblings = byParent.get(span.parentSpanId) ?? [];
    siblings.push(span);
    byParent.set(span.parentSpanId, siblings);
  }
  for (const siblings of byParent.values()) {
    siblings.sort(
      (left, right) =>
        Date.parse(left.startedAt) - Date.parse(right.startedAt) ||
        left.spanId.localeCompare(right.spanId),
    );
  }

  const ordered: TraceSpan[] = [];
  const visited = new Set<string>();
  const visit = (span: TraceSpan) => {
    if (visited.has(span.spanId)) return;
    visited.add(span.spanId);
    ordered.push(span);
    for (const child of byParent.get(span.spanId) ?? []) visit(child);
  };

  for (const root of byParent.get(null) ?? []) visit(root);
  for (const span of spans) visit(span);
  return ordered;
}

function spanDuration(span: TraceSpan): string {
  return formatDuration(Date.parse(span.endedAt) - Date.parse(span.startedAt));
}

function presentStep(
  span: TraceSpan,
  ordinal: number | null,
  isRootBoundary: boolean,
): StepPresentation {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    ordinal,
    isRootBoundary,
    displayName: humanizeName(span.name, "Recorded step"),
    technicalName: span.name,
    categoryLabel: categoryByKind[span.kind],
    technicalKind: span.kind,
    outcomeLabel: span.outcome === "ok" ? "Succeeded" : "Failed",
    durationLabel: spanDuration(span),
    agentId: span.agentId,
    hasPayload: span.hasPayload,
  };
}

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function summary(
  trace: TraceDetail,
  steps: readonly StepPresentation[],
  externalActionCount: number,
): string {
  const sentences: string[] = [];
  if (trace.completionState === "incomplete") {
    sentences.push("This recording is incomplete.");
  }
  if (trace.durationMs === null) {
    sentences.push(`${pluralize(steps.length, "step")} were recorded.`);
    sentences.push("The final duration is unavailable.");
  } else {
    sentences.push(
      `${pluralize(steps.length, "step")} were recorded in ${formatDuration(trace.durationMs)}.`,
    );
  }
  sentences.push(
    `The agent performed ${pluralize(externalActionCount, "external action")}.`,
  );
  return sentences.join(" ");
}

export function presentTraceDetail(
  trace: TraceDetail,
  options: { isReadOnlyExample?: boolean } = {},
): RunDetailPresentation {
  const orderedSpans = orderTraceSpans(trace.spans);
  const rootSpan = orderedSpans.find(
    (span) => span.spanId === trace.rootSpanId,
  );
  const steps = orderedSpans
    .filter((span) => span.spanId !== trace.rootSpanId)
    .map((span, index) => presentStep(span, index + 1, false));
  const externalActionCount = trace.spans.filter(
    (span) => span.kind === "action" || span.kind === "tool",
  ).length;
  const agentCount = new Set([
    trace.agentId,
    ...trace.spans.map((span) => span.agentId),
  ]).size;

  return {
    ...presentRun(trace, options),
    summary: summary(trace, steps, externalActionCount),
    externalActionCount,
    agentCount,
    rootBoundary:
      rootSpan === undefined ? null : presentStep(rootSpan, null, true),
    steps,
  };
}
