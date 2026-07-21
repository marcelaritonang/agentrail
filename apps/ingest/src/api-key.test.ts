import { describe, expect, it } from "vitest";

import { apiKeyPrefix, digestApiKey, verifyApiKey } from "./api-key.js";

describe("API key authentication", () => {
  it("derives a stable peppered digest without storing the raw key", () => {
    const key = `ar_live_${"a".repeat(64)}`;

    expect(digestApiKey(key, "test-pepper")).toBe(
      digestApiKey(key, "test-pepper"),
    );
    expect(digestApiKey(key, "different-pepper")).not.toBe(
      digestApiKey(key, "test-pepper"),
    );
    expect(apiKeyPrefix(key)).toBe(key.slice(0, 16));
  });

  it("compares a presented key with constant-length digest bytes", () => {
    const key = `ar_live_${"b".repeat(64)}`;
    const digest = digestApiKey(key, "test-pepper");

    expect(verifyApiKey(key, "test-pepper", digest)).toBe(true);
    expect(verifyApiKey(`${key}x`, "test-pepper", digest)).toBe(false);
    expect(verifyApiKey(key, "test-pepper", "not-a-hex-digest")).toBe(false);
  });
});
