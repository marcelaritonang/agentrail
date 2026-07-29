// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { ComponentType } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type TestConfig = {
  testerIntakeUrl: URL | null;
};

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.doUnmock("../lib/public-config");
});

async function renderFoundingTesterPage(config: TestConfig) {
  vi.doMock("../lib/public-config", () => ({
    readPublicAgentRailConfig: () => ({
      siteUrl: new URL("https://agentrail.id/"),
      sourceUrl: null,
      contactUrl: null,
      testerIntakeUrl: config.testerIntakeUrl,
    }),
  }));

  const pageModule = "../app/founding-testers/page";
  const { default: FoundingTesterPage } = (await import(pageModule)) as {
    default: ComponentType;
  };

  return render(<FoundingTesterPage />);
}

describe("AgentRail founding tester page", () => {
  it("shows an honest unavailable state when the intake URL is not configured", async () => {
    await renderFoundingTesterPage({ testerIntakeUrl: null });

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "AgentRail Founding Testers",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/intake is being prepared/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open tester intake" }),
    ).not.toBeInTheDocument();
  });

  it("links to the configured HTTPS intake without rendering a fake local form", async () => {
    const intakeUrl = new URL(
      "https://github.com/marcelaritonang/agentrail/issues/new?template=founding-tester.yml",
    );

    await renderFoundingTesterPage({ testerIntakeUrl: intakeUrl });

    expect(
      screen.getByRole("link", { name: "Open tester intake" }),
    ).toHaveAttribute("href", intakeUrl.href);
    expect(
      screen.queryByText(/intake is being prepared/i),
    ).not.toBeInTheDocument();
  });
});
