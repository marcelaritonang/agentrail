import { and, count, eq, sql } from "drizzle-orm";

import type { AgentRailDatabase } from "./client.js";
import {
  projects,
  spans,
  traces,
  type PayloadMode,
  type SpanKind,
  type SpanOutcome,
} from "./schema.js";

export type SpanWrite = {
  projectId: string;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  traceName: string;
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
};

export function createSpanRepository(db: AgentRailDatabase) {
  return {
    async createProject(input: {
      projectId: string;
      name: string;
      payloadMode: PayloadMode;
    }): Promise<void> {
      await db.insert(projects).values(input).onConflictDoNothing();
    },

    async insertSpan(input: SpanWrite): Promise<"inserted" | "duplicate"> {
      await db
        .insert(traces)
        .values({
          projectId: input.projectId,
          traceId: input.traceId,
          rootSpanId: input.kind === "trace" ? input.spanId : null,
          name: input.traceName,
          agentId: input.agentId,
          onBehalfOf: input.onBehalfOf,
          startedAt: input.startedAt,
          endedAt: input.kind === "trace" ? input.endedAt : null,
          outcome: input.kind === "trace" ? input.outcome : null,
          completionState: input.kind === "trace" ? "complete" : null,
        })
        .onConflictDoNothing({ target: [traces.projectId, traces.traceId] });

      const inserted = await db
        .insert(spans)
        .values({
          projectId: input.projectId,
          traceId: input.traceId,
          spanId: input.spanId,
          parentSpanId: input.parentSpanId,
          kind: input.kind,
          name: input.name,
          agentId: input.agentId,
          onBehalfOf: input.onBehalfOf,
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          outcome: input.outcome,
          model: input.model,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          costUsd: input.costUsd,
          pricingUnknown: input.pricingUnknown,
          pricingCatalogVersion: input.pricingCatalogVersion,
          attributes: input.attributes,
          payloadRef: input.payloadRef,
          payloadTruncated: input.payloadTruncated,
        })
        .onConflictDoNothing({ target: [spans.projectId, spans.spanId] })
        .returning({ spanId: spans.spanId });

      if (inserted.length === 0) {
        return "duplicate";
      }

      if (input.kind === "trace") {
        await db
          .update(traces)
          .set({
            rootSpanId: input.spanId,
            name: input.traceName,
            agentId: input.agentId,
            onBehalfOf: input.onBehalfOf,
            startedAt: input.startedAt,
            endedAt: input.endedAt,
            outcome: input.outcome,
            completionState: "complete",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(traces.projectId, input.projectId),
              eq(traces.traceId, input.traceId),
            ),
          );
      }

      return "inserted";
    },

    async countSpans(projectId: string): Promise<number> {
      const [result] = await db
        .select({ value: count() })
        .from(spans)
        .where(eq(spans.projectId, projectId));

      return result?.value ?? 0;
    },

    async recomputeTrace(projectId: string, traceId: string): Promise<void> {
      const [aggregate] = await db
        .select({
          spanCount: count(),
          pricingUnknown: sql<boolean>`coalesce(bool_or(${spans.pricingUnknown}), false)`,
          knownTotal: sql<string>`coalesce(sum(${spans.costUsd}), 0)::numeric(20, 8)`,
        })
        .from(spans)
        .where(and(eq(spans.projectId, projectId), eq(spans.traceId, traceId)));

      if (aggregate === undefined) {
        return;
      }

      await db
        .update(traces)
        .set({
          spanCount: aggregate.spanCount,
          pricingUnknown: aggregate.pricingUnknown,
          totalCostUsd: aggregate.pricingUnknown ? null : aggregate.knownTotal,
          updatedAt: new Date(),
        })
        .where(
          and(eq(traces.projectId, projectId), eq(traces.traceId, traceId)),
        );
    },

    async getTrace(projectId: string, traceId: string) {
      const [trace] = await db
        .select()
        .from(traces)
        .where(
          and(eq(traces.projectId, projectId), eq(traces.traceId, traceId)),
        )
        .limit(1);

      return trace ?? null;
    },
  };
}
