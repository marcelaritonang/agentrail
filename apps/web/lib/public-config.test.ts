import { describe, expect, it } from "vitest";

import { readPublicAgentRailConfig } from "./public-config";

describe("readPublicAgentRailConfig", () => {
  it("defaults the canonical site to agentrail.id", () => {
    expect(readPublicAgentRailConfig({}).siteUrl.href).toBe(
      "https://agentrail.id/",
    );
  });

  it("normalizes a configured canonical site URL to its origin", () => {
    expect(
      readPublicAgentRailConfig({
        NEXT_PUBLIC_AGENTRAIL_SITE_URL:
          "https://preview.agentrail.id/path?ignored=1#ignored",
      }).siteUrl.href,
    ).toBe("https://preview.agentrail.id/");
  });

  it.each([
    "http://example.com",
    "javascript:alert(1)",
    "/relative",
    "not a url",
  ])("rejects unsafe optional public URL %s", (value) => {
    expect(
      readPublicAgentRailConfig({
        NEXT_PUBLIC_AGENTRAIL_CONTACT_URL: value,
      }).contactUrl,
    ).toBeNull();
  });

  it("keeps safe optional https URLs", () => {
    const config = readPublicAgentRailConfig({
      NEXT_PUBLIC_AGENTRAIL_SOURCE_URL: "https://github.com/team/agentrail",
      NEXT_PUBLIC_AGENTRAIL_CONTACT_URL:
        "https://github.com/team/agentrail/issues/new",
      NEXT_PUBLIC_AGENTRAIL_TESTER_INTAKE_URL:
        "https://github.com/team/agentrail/issues/new?template=founding-tester.yml",
    });

    expect(config.sourceUrl?.href).toBe("https://github.com/team/agentrail");
    expect(config.contactUrl?.href).toBe(
      "https://github.com/team/agentrail/issues/new",
    );
    expect(config.testerIntakeUrl?.href).toBe(
      "https://github.com/team/agentrail/issues/new?template=founding-tester.yml",
    );
  });
});
