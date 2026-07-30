import { describe, expect, it } from "vitest";

import { estimateTokens } from "./tokens.js";

describe("token estimation", () => {
  it("uses a stable UTF-8 byte heuristic", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("é")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});
