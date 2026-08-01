import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Instrument_Sans: () => ({ variable: "--font-instrument" }),
  JetBrains_Mono: () => ({ variable: "--font-jetbrains" }),
}));

import { metadata } from "../app/layout";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { alt, contentType, size } from "../app/opengraph-image";

describe("public metadata routes", () => {
  it("publishes canonical root metadata for social previews", () => {
    expect(metadata.metadataBase?.href).toBe("https://agentrail.id/");
    expect(metadata.title).toEqual({
      default: "AgentRail",
      template: "%s | AgentRail",
    });
    expect(metadata.description).toBe(
      "Local-first context and forensic evidence for developers building with AI agents.",
    );
    expect(metadata.alternates).toMatchObject({ canonical: "/" });
    expect(metadata.icons).toMatchObject({
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    });
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      siteName: "AgentRail",
      title: "AgentRail",
      description:
        "Local-first context and forensic evidence for developers building with AI agents.",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("allows public pages and points crawlers at the canonical sitemap", () => {
    expect(robots()).toMatchObject({
      rules: expect.arrayContaining([
        expect.objectContaining({ userAgent: "*", allow: "/" }),
      ]),
      sitemap: "https://agentrail.id/sitemap.xml",
    });
  });

  it("lists only current public routes in a stable order", () => {
    expect(sitemap().map((entry) => new URL(entry.url).pathname)).toEqual([
      "/",
      "/about",
      "/architecture",
      "/founding-testers",
      "/privacy",
      "/security",
      "/terms",
      "/traces",
    ]);
  });

  it("defines a restrained generated Open Graph image", () => {
    expect(alt).toBe("AgentRail forensic recorder for AI agents");
    expect(contentType).toBe("image/png");
    expect(size).toEqual({ width: 1200, height: 630 });
  });
});
