import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("dashboard design contract", () => {
  const css = readFileSync(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const rules = Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g)).map(
    ([, selectors, declarations]) => ({
      selectors: selectors
        .split(",")
        .map((selector) => selector.trim())
        .filter(Boolean),
      declarations,
    }),
  );

  function declarationsFor(selector: string): string[] {
    return rules
      .filter((rule) => rule.selectors.includes(selector))
      .map((rule) => rule.declarations);
  }

  function expectDeclaration(
    selector: string,
    property: string,
    value: string,
  ) {
    const declaration = new RegExp(
      `${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*;`,
    );
    expect(
      declarationsFor(selector).some((block) => declaration.test(block)),
      `${selector} should declare ${property}: ${value}`,
    ).toBe(true);
  }

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

  it("keeps explanatory dashboard copy at the approved reading floor", () => {
    for (const selector of [
      ".page-heading p",
      ".run-summary",
      ".read-only-example p",
      ".trace-empty p",
      ".trace-error p",
    ]) {
      expectDeclaration(selector, "font-size", "14px");
      expectDeclaration(selector, "line-height", "1.55");
    }
  });

  it("keeps dashboard controls and run names at the approved reading floor", () => {
    for (const selector of [
      ".trace-filters input",
      ".trace-filters select",
      ".trace-filters button",
      ".trace-name",
      ".run-action a",
      ".span-row-content > a",
      ".what-happened li > a",
      ".action-table td a",
      ".action-mobile-list > li > a",
    ]) {
      expectDeclaration(selector, "font-size", "13px");
    }
  });

  it("keeps forensic metadata at eleven pixels or larger", () => {
    for (const selector of [
      ".page-eyebrow",
      ".trace-table th",
      ".trace-facts dt",
      ".span-identity code",
      ".span-actor",
      ".span-duration",
      ".evidence-facts dt",
      ".evidence-facts dd",
    ]) {
      expectDeclaration(selector, "font-size", "11px");
    }
  });

  it("provides touch-size controls and explicit reduced-motion behavior", () => {
    expect(css).toMatch(
      /@media\s*\(max-width:\s*1023px\)[\s\S]*?min-height:\s*44px\s*;/,
    );
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?transition-duration:\s*0\.001ms\s*!important\s*;/,
    );
  });
});
