import { describe, expect, it } from "vitest";

import {
  createEvidenceEnvelopeSchema,
  EvidenceEnvelopeSchema,
  EvidenceSourceSchema,
  MAX_EVIDENCE_ENVELOPE_BYTES,
} from "./evidence.js";

const validSource = {
  source_id: "src_0123456789abcdefghijklmn",
  trust_class: "project_source",
  relative_path: "packages/context/src/pack.ts",
  locator: {
    start_line: 10,
    end_line: 16,
    symbol: "createContextPack",
  },
  content_hash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  selection_reasons: ["matches-task"],
  excerpt_redacted: "export function createContextPack() { /* redacted */ }",
};

const validEnvelope = {
  schema_version: 1,
  envelope_id: "env_0123456789abcdefghijklmn",
  receipt_id: "rcpt_0123456789abcdefghijklmn",
  pack_id: "cp_0123456789abcdefghijklmn",
  created_at: "2026-08-01T10:00:00.000Z",
  sources: [validSource],
};

describe("EvidenceSourceSchema", () => {
  it("accepts a relative redacted evidence source", () => {
    expect(EvidenceSourceSchema.safeParse(validSource).success).toBe(true);
  });

  it("rejects unknown nested fields", () => {
    expect(
      EvidenceSourceSchema.safeParse({
        ...validSource,
        locator: {
          ...validSource.locator,
          raw_path: "C:/private/file.ts",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects absolute paths, parent traversal, NUL, credentials, and env-key paths", () => {
    for (const relative_path of [
      "/etc/passwd",
      "C:\\Users\\Legion\\repo\\file.ts",
      "\\\\server\\share\\file.ts",
      "src/../.env",
      "src/\0/file.ts",
      ".env",
      "keys/private.pem",
      "ssh/id_rsa",
      "AWS_SECRET_ACCESS_KEY",
      "DATABASE_URL",
    ]) {
      expect(
        EvidenceSourceSchema.safeParse({
          ...validSource,
          relative_path,
        }).success,
        relative_path,
      ).toBe(false);
    }
  });

  it("rejects locators where the end line precedes the start line", () => {
    expect(
      EvidenceSourceSchema.safeParse({
        ...validSource,
        locator: {
          ...validSource.locator,
          start_line: 20,
          end_line: 19,
        },
      }).success,
    ).toBe(false);
  });
});

describe("EvidenceEnvelopeSchema", () => {
  it("accepts up to 100 evidence sources", () => {
    expect(
      EvidenceEnvelopeSchema.safeParse({
        ...validEnvelope,
        sources: Array.from({ length: 100 }, (_, index) => ({
          ...validSource,
          source_id: `src_${String(index).padStart(24, "0")}`,
        })),
      }).success,
    ).toBe(true);
  });

  it("rejects more than 100 evidence sources", () => {
    expect(
      EvidenceEnvelopeSchema.safeParse({
        ...validEnvelope,
        sources: Array.from({ length: 101 }, (_, index) => ({
          ...validSource,
          source_id: `src_${String(index).padStart(24, "0")}`,
        })),
      }).success,
    ).toBe(false);
  });

  it("rejects serialized envelopes over 240 KB", () => {
    const parsed = createEvidenceEnvelopeSchema().safeParse({
      ...validEnvelope,
      sources: [
        {
          ...validSource,
          excerpt_redacted: "x".repeat(MAX_EVIDENCE_ENVELOPE_BYTES),
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects client-supplied project or installation fields", () => {
    expect(
      EvidenceEnvelopeSchema.safeParse({
        ...validEnvelope,
        project_id: "client-supplied-project",
      }).success,
    ).toBe(false);

    expect(
      EvidenceEnvelopeSchema.safeParse({
        ...validEnvelope,
        installation_id: "client-supplied-installation",
      }).success,
    ).toBe(false);
  });
});
