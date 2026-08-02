import { describe, expect, it } from "vitest";

import {
  ContextReceiptSchema,
  OutcomeReportSchema,
  ReceiptShareReviewSchema,
} from "./receipt.js";

const validReceipt = {
  schema_version: 1,
  receipt_id: "rcpt_0123456789abcdefghijklmn",
  pack_id: "cp_0123456789abcdefghijklmn",
  created_at: "2026-08-01T10:00:00.000Z",
  status: "ready",
  measurement: {
    candidate_tokens_estimate: 12_000,
    returned_tokens_estimate: 3_000,
    context_reduction_estimate: 75,
    method: "heuristic-v1",
    confidence: "estimated",
  },
  source_count: 3,
  warning_codes: ["budget_truncated"],
  evidence_mode: "metrics_only",
};

const validOutcome = {
  schema_version: 1,
  outcome_id: "out_0123456789abcdefghijklmn",
  receipt_id: "rcpt_0123456789abcdefghijklmn",
  pack_id: "cp_0123456789abcdefghijklmn",
  outcome: "helpful",
  reason_code: "solved_task",
  reported_at: "2026-08-01T10:05:00.000Z",
};

describe("ContextReceiptSchema", () => {
  it("accepts a metrics-only receipt", () => {
    expect(ContextReceiptSchema.safeParse(validReceipt).success).toBe(true);
  });

  it("rejects unknown receipt and measurement fields", () => {
    expect(
      ContextReceiptSchema.safeParse({
        ...validReceipt,
        prompt: "raw prompt must not be accepted",
      }).success,
    ).toBe(false);

    expect(
      ContextReceiptSchema.safeParse({
        ...validReceipt,
        measurement: {
          ...validReceipt.measurement,
          exact_savings_usd: 100,
        },
      }).success,
    ).toBe(false);
  });

  it("rejects returned token estimates greater than candidate estimates", () => {
    expect(
      ContextReceiptSchema.safeParse({
        ...validReceipt,
        measurement: {
          ...validReceipt.measurement,
          candidate_tokens_estimate: 100,
          returned_tokens_estimate: 101,
        },
      }).success,
    ).toBe(false);
  });
});

describe("OutcomeReportSchema", () => {
  it("accepts an enum-coded outcome report", () => {
    expect(OutcomeReportSchema.safeParse(validOutcome).success).toBe(true);
  });

  it("rejects free-text outcome reasons", () => {
    expect(
      OutcomeReportSchema.safeParse({
        ...validOutcome,
        reason_code: "it worked because it read the correct service file",
      }).success,
    ).toBe(false);
  });
});

describe("ReceiptShareReviewSchema", () => {
  it("accepts only explicitly reviewed fields for sharing", () => {
    expect(
      ReceiptShareReviewSchema.safeParse({
        schema_version: 1,
        receipt_id: "rcpt_0123456789abcdefghijklmn",
        reviewed_at: "2026-08-01T10:10:00.000Z",
        expires_at: "2026-08-08T10:10:00.000Z",
        fields: ["summary", "measurement", "warnings"],
      }).success,
    ).toBe(true);
  });

  it("rejects implicit, raw, or unknown share fields", () => {
    expect(
      ReceiptShareReviewSchema.safeParse({
        schema_version: 1,
        receipt_id: "rcpt_0123456789abcdefghijklmn",
        reviewed_at: "2026-08-01T10:10:00.000Z",
        expires_at: "2026-08-08T10:10:00.000Z",
        fields: ["summary", "raw_source_text"],
      }).success,
    ).toBe(false);

    expect(
      ReceiptShareReviewSchema.safeParse({
        schema_version: 1,
        receipt_id: "rcpt_0123456789abcdefghijklmn",
        reviewed_at: "2026-08-01T10:10:00.000Z",
        expires_at: "2026-08-08T10:10:00.000Z",
        fields: ["summary"],
        include_all_fields: true,
      }).success,
    ).toBe(false);
  });
});
