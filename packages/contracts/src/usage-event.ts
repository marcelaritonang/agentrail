import { z } from "zod";

export const MAX_USAGE_EVENT_BATCH_BODY_BYTES = 64 * 1024;
export const MAX_USAGE_EVENT_FUTURE_SKEW_MS = 5 * 60 * 1000;

export type UsageEventValidationOptions = {
  now?: () => Date;
  maxFutureSkewMs?: number;
  maxBodyBytes?: number;
};

export const UsageEventSchema = z
  .object({
    schema_version: z.literal(1),
    event_id: z.string().regex(/^ev_[A-Za-z0-9_-]{24,}$/),
    pack_id: z.string().regex(/^cp_[A-Za-z0-9_-]{24,}$/),
    event_type: z.enum(["context_pack_created", "context_outcome_reported"]),
    occurred_at: z.iso.datetime(),
    safe_attributes: z
      .object({
        client: z.string().min(1).max(40),
        package_version: z.string().min(1).max(50),
        status: z.enum(["ready", "partial", "empty"]),
        latency_ms: z.number().int().nonnegative().max(300_000),
        candidate_tokens_estimate: z
          .number()
          .int()
          .nonnegative()
          .max(10_000_000),
        returned_tokens_estimate: z.number().int().nonnegative().max(32_000),
        source_counts: z.record(z.string(), z.number().int().nonnegative()),
        warning_codes: z.array(z.string().max(50)).max(20),
        outcome: z.enum(["helpful", "partial", "missed", "failed"]).optional(),
        reason_code: z.string().max(50).optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((event, context) => {
    if (
      event.safe_attributes.returned_tokens_estimate >
      event.safe_attributes.candidate_tokens_estimate
    ) {
      context.addIssue({
        code: "custom",
        path: ["safe_attributes", "returned_tokens_estimate"],
        message:
          "returned_tokens_estimate cannot exceed candidate_tokens_estimate",
      });
    }
  });

export const UsageEventBatchSchema = z
  .object({
    events: z.array(UsageEventSchema).min(1).max(100),
  })
  .strict();

export function createUsageEventSchema(
  options: UsageEventValidationOptions = {},
) {
  return UsageEventSchema.superRefine((event, context) => {
    const now = options.now?.();
    if (!now) {
      return;
    }

    const maxFutureSkewMs =
      options.maxFutureSkewMs ?? MAX_USAGE_EVENT_FUTURE_SKEW_MS;
    const occurredAt = new Date(event.occurred_at);

    if (occurredAt.getTime() > now.getTime() + maxFutureSkewMs) {
      context.addIssue({
        code: "custom",
        path: ["occurred_at"],
        message: "occurred_at cannot be more than five minutes in the future",
      });
    }
  });
}

export function createUsageEventBatchSchema(
  options: UsageEventValidationOptions = {},
) {
  const eventSchema =
    options.now || options.maxFutureSkewMs
      ? createUsageEventSchema(options)
      : UsageEventSchema;

  return z
    .object({
      events: z.array(eventSchema).min(1).max(100),
    })
    .strict()
    .superRefine((batch, context) => {
      const maxBodyBytes =
        options.maxBodyBytes ?? MAX_USAGE_EVENT_BATCH_BODY_BYTES;
      const bodyBytes = utf8ByteLength(JSON.stringify(batch));

      if (bodyBytes > maxBodyBytes) {
        context.addIssue({
          code: "custom",
          path: ["events"],
          message: `serialized usage event batch exceeds ${maxBodyBytes} bytes`,
        });
      }
    });
}

export type UsageEvent = z.infer<typeof UsageEventSchema>;
export type UsageEventBatch = z.infer<typeof UsageEventBatchSchema>;

function utf8ByteLength(value: string): number {
  let bytes = 0;

  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint <= 0x7ff) {
      bytes += 2;
    } else if (codePoint <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }

  return bytes;
}
