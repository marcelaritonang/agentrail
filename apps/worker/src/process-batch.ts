import type { BlobStore } from "@agentrail-sdk/blob";
import {
  CanonicalSpanBatchSchema,
  type CanonicalSpanEnvelope,
} from "@agentrail-sdk/contracts";
import type { PayloadMode, SpanWrite } from "@agentrail-sdk/db";
import {
  calculateCost,
  PRICING_CATALOG_VERSION,
  type PricingResult,
} from "@agentrail-sdk/pricing";
import { redactPayload } from "./redact.js";

export type WorkerRepository = {
  getProject(
    projectId: string,
  ): Promise<{ projectId: string; payloadMode: PayloadMode } | null>;
  getSpan(projectId: string, spanId: string): Promise<unknown | null>;
  insertSpan(input: SpanWrite): Promise<"inserted" | "duplicate">;
  recomputeTrace(projectId: string, traceId: string): Promise<void>;
  markIncompleteBefore(cutoff: Date): Promise<number>;
};

export type ProcessBatchDependencies = {
  repository: WorkerRepository;
  blob: BlobStore;
  maxPayloadBytes?: number;
};

export type ProcessBatchResult = {
  inserted: number;
  duplicates: number;
};

function pricingFor(span: CanonicalSpanEnvelope): PricingResult | null {
  if (span.model === undefined) return null;
  if (span.input_tokens === undefined || span.output_tokens === undefined) {
    return {
      costUsd: null,
      pricingUnknown: true,
      catalogVersion: PRICING_CATALOG_VERSION,
    };
  }
  return calculateCost({
    model: span.model,
    inputTokens: span.input_tokens,
    outputTokens: span.output_tokens,
  });
}

async function payloadFor(
  blob: BlobStore,
  span: CanonicalSpanEnvelope,
  payloadMode: PayloadMode,
  maxBytes: number,
): Promise<{ ref: string | null; truncated: boolean }> {
  if (payloadMode === "none" || span.payload === undefined) {
    return { ref: null, truncated: false };
  }

  const result = redactPayload(span.payload, {
    maxBytes,
    redactSecrets: payloadMode === "redacted",
  });
  const ref = `payload/${span.project_id}/${span.trace_id}/${span.span_id}.json`;
  await blob.put({
    ref,
    content: new TextEncoder().encode(JSON.stringify(result.value) ?? "null"),
    contentType: "application/json",
  });
  return { ref, truncated: result.truncated };
}

export async function processBatch(
  dependencies: ProcessBatchDependencies,
  input: unknown,
): Promise<ProcessBatchResult> {
  const batch = CanonicalSpanBatchSchema.parse(input);
  const projects = new Map<string, { payloadMode: PayloadMode }>();
  const affectedTraces = new Set<string>();
  let inserted = 0;
  let duplicates = 0;

  for (const span of batch.spans) {
    if (
      (await dependencies.repository.getSpan(span.project_id, span.span_id)) !==
      null
    ) {
      duplicates += 1;
      continue;
    }

    let project = projects.get(span.project_id);
    if (project === undefined) {
      const stored = await dependencies.repository.getProject(span.project_id);
      if (stored === null) throw new Error("Span project does not exist");
      project = { payloadMode: stored.payloadMode };
      projects.set(span.project_id, project);
    }

    const pricing = pricingFor(span);
    const payload = await payloadFor(
      dependencies.blob,
      span,
      project.payloadMode,
      dependencies.maxPayloadBytes ?? 64_000,
    );
    const outcome = await dependencies.repository.insertSpan({
      projectId: span.project_id,
      traceId: span.trace_id,
      spanId: span.span_id,
      parentSpanId: span.parent_span_id,
      traceName: span.trace_name,
      kind: span.kind,
      name: span.name,
      agentId: span.agent_id,
      onBehalfOf: span.on_behalf_of,
      startedAt: new Date(span.started_at),
      endedAt: new Date(span.ended_at),
      outcome: span.outcome,
      model: span.model ?? null,
      inputTokens: span.input_tokens ?? null,
      outputTokens: span.output_tokens ?? null,
      costUsd: pricing?.costUsd ?? null,
      pricingUnknown: pricing?.pricingUnknown ?? false,
      pricingCatalogVersion: pricing?.catalogVersion ?? null,
      attributes: span.attributes,
      payloadRef: payload.ref,
      payloadTruncated: payload.truncated,
    });

    if (outcome === "duplicate") {
      duplicates += 1;
      continue;
    }
    inserted += 1;
    affectedTraces.add(`${span.project_id}:${span.trace_id}`);
  }

  for (const key of affectedTraces) {
    const separator = key.indexOf(":");
    await dependencies.repository.recomputeTrace(
      key.slice(0, separator),
      key.slice(separator + 1),
    );
  }

  return { inserted, duplicates };
}
