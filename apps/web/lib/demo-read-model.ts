import type { BlobStore } from "@agentrail/blob";

import {
  DEMO_ACTION_SPAN_ID,
  DEMO_LLM_SPAN_ID,
  DEMO_PROJECT_ID,
  DEMO_RETRIEVAL_SPAN_ID,
  DEMO_ROOT_SPAN_ID,
  DEMO_TRACE_ID,
} from "./demo-mode";
import type { EvidenceRepository, EvidenceSpan } from "./evidence";
import type { TraceReadRepository } from "./trace-read-model";

const DEMO_PAYLOAD_REF = "demo://payload/research-answer-draft";
const STARTED_AT = new Date("2026-07-22T14:53:01.863Z");
const RETRIEVAL_STARTED_AT = new Date("2026-07-22T14:53:01.902Z");
const RETRIEVAL_ENDED_AT = new Date("2026-07-22T14:53:02.116Z");
const LLM_STARTED_AT = new Date("2026-07-22T14:53:02.141Z");
const LLM_ENDED_AT = new Date("2026-07-22T14:53:02.982Z");
const ACTION_STARTED_AT = new Date("2026-07-22T14:53:03.005Z");
const ENDED_AT = new Date("2026-07-22T14:53:03.113Z");
const CREATED_AT = new Date("2026-07-22T14:53:03.200Z");

const DEMO_TRACE = {
  projectId: DEMO_PROJECT_ID,
  traceId: DEMO_TRACE_ID,
  rootSpanId: DEMO_ROOT_SPAN_ID,
  name: "sample.research-answer",
  agentId: "research-agent",
  onBehalfOf: "founder-review",
  startedAt: STARTED_AT,
  endedAt: ENDED_AT,
  outcome: "ok" as const,
  completionState: "complete" as const,
  totalCostUsd: "0.00400000",
  pricingUnknown: false,
  spanCount: 4,
};

const DEMO_SPANS = [
  {
    id: 1,
    projectId: DEMO_PROJECT_ID,
    traceId: DEMO_TRACE_ID,
    spanId: DEMO_ROOT_SPAN_ID,
    parentSpanId: null,
    kind: "trace" as const,
    name: "sample.research-answer",
    agentId: "research-agent",
    onBehalfOf: "founder-review",
    startedAt: STARTED_AT,
    endedAt: ENDED_AT,
    outcome: "ok" as const,
    model: null,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    pricingUnknown: false,
    pricingCatalogVersion: null,
    attributes: {
      environment: "public-demo",
      pipeline: "agentrail.m1",
    },
    payloadRef: null,
    payloadTruncated: false,
    createdAt: CREATED_AT,
  },
  {
    id: 2,
    projectId: DEMO_PROJECT_ID,
    traceId: DEMO_TRACE_ID,
    spanId: DEMO_RETRIEVAL_SPAN_ID,
    parentSpanId: DEMO_ROOT_SPAN_ID,
    kind: "retrieval" as const,
    name: "retrieve founder notes",
    agentId: "research-agent",
    onBehalfOf: "founder-review",
    startedAt: RETRIEVAL_STARTED_AT,
    endedAt: RETRIEVAL_ENDED_AT,
    outcome: "ok" as const,
    model: null,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    pricingUnknown: false,
    pricingCatalogVersion: null,
    attributes: {
      source_count: 3,
      redaction_policy: "metadata-only",
    },
    payloadRef: null,
    payloadTruncated: false,
    createdAt: CREATED_AT,
  },
  {
    id: 3,
    projectId: DEMO_PROJECT_ID,
    traceId: DEMO_TRACE_ID,
    spanId: DEMO_LLM_SPAN_ID,
    parentSpanId: DEMO_ROOT_SPAN_ID,
    kind: "llm" as const,
    name: "draft answer",
    agentId: "research-agent",
    onBehalfOf: "founder-review",
    startedAt: LLM_STARTED_AT,
    endedAt: LLM_ENDED_AT,
    outcome: "ok" as const,
    model: "test.known",
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: "0.00375000",
    pricingUnknown: false,
    pricingCatalogVersion: "2026-07-01",
    attributes: {
      temperature: 0.2,
      safety: "redacted_payload",
    },
    payloadRef: DEMO_PAYLOAD_REF,
    payloadTruncated: false,
    createdAt: CREATED_AT,
  },
  {
    id: 4,
    projectId: DEMO_PROJECT_ID,
    traceId: DEMO_TRACE_ID,
    spanId: DEMO_ACTION_SPAN_ID,
    parentSpanId: DEMO_ROOT_SPAN_ID,
    kind: "action" as const,
    name: "write application brief",
    agentId: "research-agent",
    onBehalfOf: "founder-review",
    startedAt: ACTION_STARTED_AT,
    endedAt: ENDED_AT,
    outcome: "ok" as const,
    model: null,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    pricingUnknown: false,
    pricingCatalogVersion: null,
    attributes: {
      destination: "local-markdown",
      requires_human_review: true,
    },
    payloadRef: null,
    payloadTruncated: false,
    createdAt: CREATED_AT,
  },
];

const DEMO_PAYLOAD = {
  prompt: "[REDACTED]",
  answer:
    "AgentRail records AI-agent traces, costs, action audit logs, and redacted evidence for engineering review.",
  model: "test.known",
  notes: [
    "Synthetic public payload for Vercel review.",
    "No user secrets, API keys, or private object-store locations are exposed.",
  ],
};

function matchesQuery(query: string | undefined): boolean {
  if (query === undefined) return true;
  const normalized = query.toLowerCase();
  return (
    DEMO_TRACE.name.toLowerCase().includes(normalized) ||
    DEMO_TRACE.traceId.includes(normalized) ||
    DEMO_TRACE.agentId.toLowerCase().includes(normalized)
  );
}

function matchesActor(actor: string | undefined): boolean {
  if (actor === undefined) return true;
  const normalized = actor.toLowerCase();
  return (
    DEMO_TRACE.agentId.toLowerCase().includes(normalized) ||
    (DEMO_TRACE.onBehalfOf?.toLowerCase().includes(normalized) ?? false)
  );
}

function demoSpan(spanId: string): (typeof DEMO_SPANS)[number] | null {
  return DEMO_SPANS.find((span) => span.spanId === spanId) ?? null;
}

export function createDemoTraceReadRepository(): TraceReadRepository {
  return {
    async listTraces(input) {
      if (
        input.projectId !== DEMO_PROJECT_ID ||
        !matchesQuery(input.query) ||
        !matchesActor(input.actor) ||
        (input.outcome !== undefined && input.outcome !== DEMO_TRACE.outcome)
      ) {
        return { items: [], total: 0 };
      }

      return input.page === 1
        ? { items: [DEMO_TRACE], total: 1 }
        : { items: [], total: 1 };
    },
    async getTrace(projectId, traceId) {
      if (projectId !== DEMO_PROJECT_ID || traceId !== DEMO_TRACE_ID) {
        return null;
      }
      return DEMO_TRACE;
    },
    async listSpansForTrace(projectId, traceId) {
      if (projectId !== DEMO_PROJECT_ID || traceId !== DEMO_TRACE_ID) {
        return [];
      }
      return DEMO_SPANS;
    },
    async getProject(projectId) {
      if (projectId !== DEMO_PROJECT_ID) return null;
      return { projectId: DEMO_PROJECT_ID, payloadMode: "redacted" };
    },
  };
}

export function createDemoEvidenceRepository(): EvidenceRepository {
  return {
    async getSpanForTrace(
      projectId,
      traceId,
      spanId,
    ): Promise<EvidenceSpan | null> {
      if (projectId !== DEMO_PROJECT_ID || traceId !== DEMO_TRACE_ID) {
        return null;
      }
      const span = demoSpan(spanId);
      if (span === null) return null;
      return {
        payloadRef: span.payloadRef,
        payloadTruncated: span.payloadTruncated,
      };
    },
    async getProject(projectId) {
      if (projectId !== DEMO_PROJECT_ID) return null;
      return { projectId: DEMO_PROJECT_ID, payloadMode: "redacted" };
    },
  };
}

export function createDemoBlobStore(): BlobStore {
  return {
    async put(input) {
      return { ref: input.ref };
    },
    async get(ref) {
      if (ref !== DEMO_PAYLOAD_REF) return null;
      return new TextEncoder().encode(JSON.stringify(DEMO_PAYLOAD));
    },
  };
}
