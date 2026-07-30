import { describe, expect, it } from "vitest";

import { ContextPackRequestSchema, relativeContextPath } from "./types.js";

describe("Context Relay contracts", () => {
  it("bounds a context request", () => {
    expect(
      ContextPackRequestSchema.parse({
        task: "Add OAuth without changing session semantics",
        tokenBudget: 4_000,
        focus: ["auth", "tests"],
      }),
    ).toMatchObject({ tokenBudget: 4_000 });

    expect(() =>
      ContextPackRequestSchema.parse({ task: "", tokenBudget: 4_000 }),
    ).toThrow();
    expect(() =>
      ContextPackRequestSchema.parse({ task: "x", tokenBudget: 64 }),
    ).toThrow();
  });

  it("accepts only normalized relative context paths", () => {
    expect(relativeContextPath("src/auth.ts")).toBe("src/auth.ts");
    expect(relativeContextPath("docs/guide.md")).toBe("docs/guide.md");
    expect(() => relativeContextPath("../secret")).toThrow();
    expect(() => relativeContextPath("C:\\secret.txt")).toThrow();
    expect(() => relativeContextPath("/etc/passwd")).toThrow();
    expect(() => relativeContextPath("src/./auth.ts")).toThrow();
  });
});
