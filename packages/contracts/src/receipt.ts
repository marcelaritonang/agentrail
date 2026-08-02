import { z } from "zod";

const contractIdSchema = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9_-]{24,}$`));

export const ReceiptMeasurementSchema = z
  .object({
    candidate_tokens_estimate: z.number().int().nonnegative().max(10_000_000),
    returned_tokens_estimate: z.number().int().nonnegative().max(32_000),
    context_reduction_estimate: z.number().int().min(0).max(100),
    method: z.literal("heuristic-v1"),
    confidence: z.literal("estimated"),
  })
  .strict()
  .superRefine((measurement, context) => {
    if (
      measurement.returned_tokens_estimate >
      measurement.candidate_tokens_estimate
    ) {
      context.addIssue({
        code: "custom",
        path: ["returned_tokens_estimate"],
        message:
          "returned_tokens_estimate cannot exceed candidate_tokens_estimate",
      });
    }
  });

export const ContextReceiptSchema = z
  .object({
    schema_version: z.literal(1),
    receipt_id: contractIdSchema("rcpt"),
    pack_id: contractIdSchema("cp"),
    created_at: z.iso.datetime(),
    status: z.enum(["ready", "partial", "empty", "failed"]),
    measurement: ReceiptMeasurementSchema,
    source_count: z.number().int().nonnegative().max(100),
    warning_codes: z.array(z.string().max(50)).max(20),
    evidence_mode: z.enum(["metrics_only", "redacted_evidence"]),
  })
  .strict();

export const OutcomeReasonCodeSchema = z.enum([
  "solved_task",
  "missing_context",
  "wrong_file",
  "too_broad",
  "tool_failure",
  "unsafe",
  "other",
]);

export const OutcomeReportSchema = z
  .object({
    schema_version: z.literal(1),
    outcome_id: contractIdSchema("out"),
    receipt_id: contractIdSchema("rcpt"),
    pack_id: contractIdSchema("cp"),
    outcome: z.enum(["helpful", "partial", "missed", "failed"]),
    reason_code: OutcomeReasonCodeSchema,
    reported_at: z.iso.datetime(),
  })
  .strict();

export const ShareReviewFieldSchema = z.enum([
  "summary",
  "measurement",
  "warnings",
  "source_metadata",
  "outcome",
]);

export const ReceiptShareReviewSchema = z
  .object({
    schema_version: z.literal(1),
    receipt_id: contractIdSchema("rcpt"),
    reviewed_at: z.iso.datetime(),
    expires_at: z.iso.datetime(),
    fields: z.array(ShareReviewFieldSchema).min(1).max(10),
  })
  .strict();

export type ContextReceipt = z.infer<typeof ContextReceiptSchema>;
export type OutcomeReport = z.infer<typeof OutcomeReportSchema>;
export type ReceiptShareReview = z.infer<typeof ReceiptShareReviewSchema>;
