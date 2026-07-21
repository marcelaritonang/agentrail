import { describe, expect, it } from "vitest";

import {
  MAX_INGEST_BODY_BYTES,
  MAX_SPANS_PER_BATCH,
  TRACE_INCOMPLETE_AFTER_MS,
} from "./index.js";

describe("shared constants", () => {
  it("locks approved ingestion and timeout defaults", () => {
    expect(MAX_INGEST_BODY_BYTES).toBe(240 * 1024);
    expect(MAX_SPANS_PER_BATCH).toBe(100);
    expect(TRACE_INCOMPLETE_AFTER_MS).toBe(900_000);
  });
});
