import { z } from "zod";

export const TraceIdSchema = z.string().regex(/^[0-9a-f]{32}$/);
export const SpanIdSchema = z.string().regex(/^[0-9a-f]{16}$/);

export const SpanEnvelopeSchema = z.object({
  schema_version: z.literal(1),
  trace_id: TraceIdSchema,
  span_id: SpanIdSchema,
  parent_span_id: SpanIdSchema.nullable(),
  trace_name: z.string().min(1).max(200),
  kind: z.enum(["trace", "llm", "retrieval", "tool", "action", "custom"]),
  name: z.string().min(1).max(200),
  agent_id: z.string().min(1).max(200),
  on_behalf_of: z.string().min(1).max(200).nullable(),
  started_at: z.iso.datetime(),
  ended_at: z.iso.datetime(),
  outcome: z.enum(["ok", "error"]),
  model: z.string().min(1).max(200).optional(),
  input_tokens: z.number().int().nonnegative().optional(),
  output_tokens: z.number().int().nonnegative().optional(),
  attributes: z.record(z.string(), z.unknown()),
  payload: z.unknown().optional(),
});

export const IngestSpanBatchSchema = z.object({
  spans: z.array(SpanEnvelopeSchema).min(1).max(100),
});

export type SpanEnvelope = z.infer<typeof SpanEnvelopeSchema>;
export type IngestSpanBatch = z.infer<typeof IngestSpanBatchSchema>;
export type CanonicalSpanEnvelope = SpanEnvelope & { project_id: string };
export type CanonicalSpanBatch = { spans: CanonicalSpanEnvelope[] };
