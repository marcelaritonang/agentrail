import { describe, expect, it } from "vitest";

import { IngestSpanBatchSchema } from "./span.js";

describe("IngestSpanBatchSchema", () => {
  it("accepts one immutable completed span", () => {
    const result = IngestSpanBatchSchema.safeParse({
      spans: [
        {
          schema_version: 1,
          trace_id: "0af7651916cd43dd8448eb211c80319c",
          span_id: "b7ad6b7169203331",
          parent_span_id: null,
          trace_name: "research.answer",
          kind: "llm",
          name: "plan",
          agent_id: "research-agent",
          on_behalf_of: "user_42",
          started_at: "2026-07-21T10:00:00.000Z",
          ended_at: "2026-07-21T10:00:01.000Z",
          outcome: "ok",
          attributes: {},
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects more than 100 spans", () => {
    const result = IngestSpanBatchSchema.safeParse({
      spans: Array.from({ length: 101 }, () => ({})),
    });

    expect(result.success).toBe(false);
  });
});
