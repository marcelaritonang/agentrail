import { describe, expect, it } from "vitest";

import { configuredSourceUrl, sourceQuickstartUrl } from "./source-url";

describe("configuredSourceUrl", () => {
  it("leaves an unset or blank source unconfigured", () => {
    expect(configuredSourceUrl(undefined)).toBeNull();
    expect(configuredSourceUrl("   ")).toBeNull();
  });

  it("returns a configured absolute HTTPS source URL", () => {
    expect(
      configuredSourceUrl("https://github.com/example/agentrail"),
    ).toBe("https://github.com/example/agentrail");
  });

  it.each(["http://example.com/repo", "/relative"])(
    "rejects non-HTTPS source URLs",
    (value) => {
      expect(() => configuredSourceUrl(value)).toThrow(
        "NEXT_PUBLIC_AGENTRAIL_SOURCE_URL must be an absolute https:// URL",
      );
    },
  );
});

describe("sourceQuickstartUrl", () => {
  it("links to the local quickstart section", () => {
    expect(sourceQuickstartUrl("https://github.com/example/agentrail")).toBe(
      "https://github.com/example/agentrail#local-quickstart",
    );
  });
});
