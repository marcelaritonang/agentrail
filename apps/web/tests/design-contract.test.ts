import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("dashboard design contract", () => {
  const css = readFileSync(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  it("defines semantic forensic tokens", () => {
    expect(css).toContain("--surface-canvas:");
    expect(css).toContain("--signal-action:");
    expect(css).toContain("--signal-llm:");
    expect(css).toContain("--signal-retrieval:");
    expect(css).toContain("--signal-error:");
  });

  it("does not use pure black or white token values", () => {
    expect(css).not.toMatch(/#(?:000000|000|ffffff|fff)\b/i);
  });
});
