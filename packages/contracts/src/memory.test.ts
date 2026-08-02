import { describe, expect, it } from "vitest";

import { ProjectMemorySyncSchema } from "./memory.js";

const validMemory = {
  schema_version: 1,
  memory_id: "mem_0123456789abcdefghijklmn",
  revision: 1,
  type: "constraint",
  status: "active",
  statement_redacted: "Use server routes for browser access to private blobs.",
  scope: "apps/web",
  source_kind: "explicit_tool",
  expires_at: null,
  updated_at: "2026-08-01T10:00:00.000Z",
};

describe("ProjectMemorySyncSchema", () => {
  it("accepts a structured redacted memory record", () => {
    expect(ProjectMemorySyncSchema.safeParse(validMemory).success).toBe(true);
  });

  it("rejects unknown fields at the top level and nested tombstone level", () => {
    expect(
      ProjectMemorySyncSchema.safeParse({
        ...validMemory,
        project_id: "client-supplied-project",
      }).success,
    ).toBe(false);

    expect(
      ProjectMemorySyncSchema.safeParse({
        ...validMemory,
        status: "deleted",
        statement_redacted: undefined,
        tombstone: {
          deleted_at: "2026-08-01T10:00:00.000Z",
          reason_code: "user_deleted",
          raw_reason: "do not accept free text",
        },
      }).success,
    ).toBe(false);
  });

  it("allows deleted memories to carry a tombstone but not a statement body", () => {
    expect(
      ProjectMemorySyncSchema.safeParse({
        ...validMemory,
        status: "deleted",
        statement_redacted: undefined,
        tombstone: {
          deleted_at: "2026-08-01T10:00:00.000Z",
          reason_code: "user_deleted",
        },
      }).success,
    ).toBe(true);

    expect(
      ProjectMemorySyncSchema.safeParse({
        ...validMemory,
        status: "deleted",
        tombstone: {
          deleted_at: "2026-08-01T10:00:00.000Z",
          reason_code: "user_deleted",
        },
      }).success,
    ).toBe(false);
  });

  it("requires non-deleted memories to carry a redacted statement", () => {
    expect(
      ProjectMemorySyncSchema.safeParse({
        ...validMemory,
        statement_redacted: undefined,
      }).success,
    ).toBe(false);
  });
});
