import { describe, expect, it } from "vitest";

import { scanSource } from "./rules";

describe("AgentRail anti-slop rules", () => {
  it.each([
    ["transition-all", '<button className="transition-all">Open</button>'],
    [
      "gradient text",
      '<h1 className="bg-clip-text text-transparent bg-gradient-to-r">A</h1>',
    ],
    ["raw component color", '<div style={{ color: "#000000" }} />'],
    ["second icon family", 'import { Search } from "lucide-react";'],
  ])("flags %s", (_, source) => {
    expect(scanSource("fixture.tsx", source)).not.toHaveLength(0);
  });

  it("allows semantic colors in globals and the single Phosphor family", () => {
    expect(
      scanSource(
        "globals.css",
        ":root { --surface-canvas: oklch(0.15 0.01 252); }",
      ),
    ).toHaveLength(0);
    expect(
      scanSource(
        "icon.tsx",
        'import { X } from "@phosphor-icons/react"; export const Icon = X;',
      ),
    ).toHaveLength(0);
  });

  it("blocks low-contrast amber-on-amber declarations in one rule", () => {
    const findings = scanSource(
      "fixture.css",
      ".badge { color: var(--signal-action); background: var(--signal-action-muted); }",
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "amber-on-amber",
          severity: "blocking",
        }),
      ]),
    );
  });

  it("reports oversized radius and decorative motion as advisory", () => {
    const findings = scanSource(
      "fixture.tsx",
      '<div className="rounded-3xl animate-pulse hover:scale-105" />',
    );

    expect(
      findings.filter((finding) => finding.severity === "advisory"),
    ).toHaveLength(3);
  });
});
