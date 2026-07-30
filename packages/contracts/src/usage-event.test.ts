import { describe, expect, it } from "vitest";

import {
  createUsageEventBatchSchema,
  MAX_USAGE_EVENT_BATCH_BODY_BYTES,
  UsageEventBatchSchema,
  UsageEventSchema,
} from "./usage-event.js";

const validUsageEvent = {
  schema_version: 1,
  event_id: "ev_0123456789abcdefghijklmn",
  pack_id: "cp_0123456789abcdefghijklmn",
  event_type: "context_pack_created",
  occurred_at: "2026-07-29T10:00:00.000Z",
  safe_attributes: {
    client: "codex",
    package_version: "0.1.2",
    status: "ready",
    latency_ms: 1200,
    candidate_tokens_estimate: 2000,
    returned_tokens_estimate: 1200,
    source_counts: {
      file: 2,
      memory: 1,
    },
    warning_codes: ["truncated"],
  },
};

describe("UsageEventSchema", () => {
  it("accepts an approved metrics-only usage event", () => {
    expect(UsageEventSchema.safeParse(validUsageEvent).success).toBe(true);
  });

  it("rejects forbidden nested safe attributes", () => {
    for (const forbidden of [
      "task",
      "prompt",
      "path",
      "content",
      "snippet",
      "patch",
      "environment",
      "secret",
    ]) {
      const parsed = UsageEventSchema.safeParse({
        ...validUsageEvent,
        safe_attributes: {
          ...validUsageEvent.safe_attributes,
          [forbidden]: "must-not-pass",
        },
      });

      expect(parsed.success, forbidden).toBe(false);
    }
  });

  it("rejects invalid event and pack ids", () => {
    expect(
      UsageEventSchema.safeParse({
        ...validUsageEvent,
        event_id: "0123456789abcdefghijklmn",
      }).success,
    ).toBe(false);

    expect(
      UsageEventSchema.safeParse({
        ...validUsageEvent,
        pack_id: "0123456789abcdefghijklmn",
      }).success,
    ).toBe(false);
  });

  it("rejects returned token estimates greater than candidate estimates", () => {
    expect(
      UsageEventSchema.safeParse({
        ...validUsageEvent,
        safe_attributes: {
          ...validUsageEvent.safe_attributes,
          candidate_tokens_estimate: 20,
          returned_tokens_estimate: 21,
        },
      }).success,
    ).toBe(false);
  });
});

describe("UsageEventBatchSchema", () => {
  it("accepts 1 to 100 events", () => {
    expect(
      UsageEventBatchSchema.safeParse({ events: [validUsageEvent] }).success,
    ).toBe(true);

    expect(
      UsageEventBatchSchema.safeParse({
        events: Array.from({ length: 100 }, (_, index) => ({
          ...validUsageEvent,
          event_id: `ev_${String(index).padStart(24, "0")}`,
          pack_id: `cp_${String(index).padStart(24, "1")}`,
        })),
      }).success,
    ).toBe(true);
  });

  it("rejects empty batches and batches over 100 events", () => {
    expect(UsageEventBatchSchema.safeParse({ events: [] }).success).toBe(false);

    expect(
      UsageEventBatchSchema.safeParse({
        events: Array.from({ length: 101 }, (_, index) => ({
          ...validUsageEvent,
          event_id: `ev_${String(index).padStart(24, "0")}`,
          pack_id: `cp_${String(index).padStart(24, "1")}`,
        })),
      }).success,
    ).toBe(false);
  });

  it("rejects serialized bodies over the metrics endpoint bound", () => {
    const parsed = createUsageEventBatchSchema({
      now: () => new Date("2026-07-29T10:00:00.000Z"),
    }).safeParse({
      events: [
        {
          ...validUsageEvent,
          safe_attributes: {
            ...validUsageEvent.safe_attributes,
            source_counts: {
              ["x".repeat(MAX_USAGE_EVENT_BATCH_BODY_BYTES)]: 1,
            },
          },
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects timestamps more than five minutes in the future with a testable clock", () => {
    const schema = createUsageEventBatchSchema({
      now: () => new Date("2026-07-29T10:00:00.000Z"),
    });

    expect(
      schema.safeParse({
        events: [
          {
            ...validUsageEvent,
            occurred_at: "2026-07-29T10:05:00.001Z",
          },
        ],
      }).success,
    ).toBe(false);
  });
});
