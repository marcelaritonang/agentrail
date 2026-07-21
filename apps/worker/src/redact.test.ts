import { describe, expect, it } from "vitest";

import { redactPayload } from "./redact.js";

describe("redactPayload", () => {
  it("redacts secrets recursively without mutating the source", () => {
    const source = {
      authorization: "Bearer secret",
      x_api_key: "secret",
      nested: { password: "secret", query: "safe" },
      rows: [{ api_key: "secret", value: 42 }],
    };

    expect(redactPayload(source, { maxBytes: 64_000 })).toEqual({
      value: {
        authorization: "[REDACTED]",
        x_api_key: "[REDACTED]",
        nested: { password: "[REDACTED]", query: "safe" },
        rows: [{ api_key: "[REDACTED]", value: 42 }],
      },
      truncated: false,
    });
    expect(source.nested.password).toBe("secret");
  });

  it("truncates deterministically within the serialized byte limit", () => {
    const first = redactPayload({ text: "é".repeat(1_000) }, { maxBytes: 96 });
    const second = redactPayload({ text: "é".repeat(1_000) }, { maxBytes: 96 });

    expect(first).toEqual(second);
    expect(first.truncated).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(first.value))).toBeLessThanOrEqual(
      96,
    );
  });
});
