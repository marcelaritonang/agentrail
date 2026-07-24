import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("dashboard design contract", () => {
  const css = readFileSync(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  function rulesFor(source: string) {
    return Array.from(source.matchAll(/([^{}]+)\{([^{}]*)\}/g)).map(
      ([, selectors, declarations]) => ({
        selectors: selectors
          .split(",")
          .map((selector) => selector.trim())
          .filter(Boolean),
        declarations,
      }),
    );
  }

  function mediaBody(query: string): string {
    const marker = `@media (${query})`;
    const markerIndex = css.indexOf(marker);
    expect(markerIndex, `${marker} should exist`).toBeGreaterThanOrEqual(0);
    const bodyStart = css.indexOf("{", markerIndex) + 1;
    let depth = 1;
    for (let index = bodyStart; index < css.length; index += 1) {
      const char = css[index];
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      if (depth === 0) return css.slice(bodyStart, index);
    }
    throw new Error(`Could not find end of ${marker}`);
  }

  function declarationsFor(selector: string, source = css): string[] {
    return rulesFor(source)
      .filter((rule) => rule.selectors.includes(selector))
      .map((rule) => rule.declarations);
  }

  function expectDeclaration(
    selector: string,
    property: string,
    value: string,
    source = css,
  ) {
    const declaration = new RegExp(
      `${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*;`,
    );
    expect(
      declarationsFor(selector, source).some((block) =>
        declaration.test(block),
      ),
      `${selector} should declare ${property}: ${value}`,
    ).toBe(true);
  }

  function expectPxAtLeast(
    selector: string,
    property: string,
    floor: number,
    source = css,
  ) {
    const values = declarationsFor(selector, source).flatMap((block) =>
      Array.from(
        block.matchAll(
          new RegExp(
            `${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([\\d.]+)px\\s*;`,
            "g",
          ),
        ),
        (match) => Number(match[1]),
      ),
    );
    expect(
      values.some((value) => value >= floor),
      `${selector} should declare ${property} >= ${floor}px`,
    ).toBe(true);
  }

  function expectNoDeclaration(
    selector: string,
    property: string,
    value: string,
  ) {
    const declaration = new RegExp(
      `${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*;`,
    );
    expect(
      declarationsFor(selector).some((block) => declaration.test(block)),
      `${selector} should not declare ${property}: ${value}`,
    ).toBe(false);
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
      ".trace-error details p",
      ".trace-loading p",
      ".trace-loading strong",
      ".detail-loading > strong",
      ".trace-not-found p",
      ".evidence-drawer-header p",
      ".evidence-loading span",
      ".evidence-message strong",
      ".evidence-message p",
      ".evidence-notice",
      ".trace-status-fact small",
    ]) {
      expectPxAtLeast(selector, "font-size", 14);
    }
  });

  it("keeps dashboard controls and run names at the approved reading floor", () => {
    for (const selector of [
      ".trace-filters input",
      ".trace-filters select",
      ".trace-filters button",
      ".trace-name",
      ".read-only-example a",
      ".run-action a",
      ".trace-empty > a",
      ".trace-not-found a",
      ".trace-back",
      ".trace-error summary",
      ".span-row-content > a",
      ".what-happened li > a",
      ".action-table td a",
      ".action-mobile-list > li > a",
      ".advanced-metadata summary",
      ".recorded-data-action",
    ]) {
      expectPxAtLeast(selector, "font-size", 13);
    }
  });

  it("keeps forensic metadata at eleven pixels or larger", () => {
    for (const selector of [
      ".page-eyebrow",
      ".trace-table th",
      ".trace-facts dt",
      ".trace-facts dd",
      ".span-identity code",
      ".span-actor",
      ".span-duration",
      ".evidence-facts dt",
      ".evidence-facts dd",
      ".evidence-payload pre",
    ]) {
      expectPxAtLeast(selector, "font-size", 11);
    }
  });

  it("allows detail facts to wrap long technical identifiers", () => {
    expectDeclaration(".trace-facts dd", "overflow-wrap", "anywhere");
    expectNoDeclaration(".trace-facts dd", "overflow", "hidden");
    expectNoDeclaration(".trace-facts dd", "text-overflow", "ellipsis");
    expectNoDeclaration(".trace-facts dd", "white-space", "nowrap");
  });

  it("provides touch-size controls and explicit reduced-motion behavior", () => {
    const mobile = mediaBody("max-width: 1023px");
    for (const selector of [
      ".read-only-example a",
      ".trace-filters input",
      ".trace-filters select",
      ".trace-filters button",
      ".run-action a",
      ".trace-empty > a",
      ".trace-error button",
      ".trace-back",
      ".trace-error summary",
      ".recorded-data-action",
      ".advanced-metadata summary",
      ".evidence-drawer-header button",
    ]) {
      expectPxAtLeast(selector, "min-height", 44, mobile);
    }
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?transition-duration:\s*0\.001ms\s*!important\s*;/,
    );
  });
});
