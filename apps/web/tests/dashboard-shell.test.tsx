// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  demoMode: false,
  sourceUrl: null as string | null,
}));

vi.mock("../lib/demo-mode", () => ({
  DEMO_TRACE_ID: "8044491c65f76da9f773b8369a00d889",
  demoModeEnabled: () => state.demoMode,
}));

vi.mock("../lib/source-url", () => ({
  configuredSourceUrl: () => state.sourceUrl,
}));

import DashboardLayout from "../app/(dashboard)/layout";
import { ReadOnlyExampleBanner } from "../components/read-only-example";

afterEach(() => {
  state.demoMode = false;
  state.sourceUrl = null;
  cleanup();
});

describe("dashboard shell", () => {
  it("orients the demo shell without an unconfigured source control", () => {
    state.demoMode = true;

    render(
      <DashboardLayout>
        <div>Dashboard content</div>
      </DashboardLayout>,
    );

    expect(screen.getByRole("link", { name: "AgentRail home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Agent runs" })).toHaveAttribute(
      "href",
      "/traces",
    );
    expect(screen.getByText("Read-only example")).toBeInTheDocument();
    expect(screen.queryByText("M1 recorder")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Source" })).not.toBeInTheDocument();
  });

  it("uses the parsed configured URL for the source control", () => {
    state.sourceUrl = "https://github.com/example/agentrail";

    render(
      <DashboardLayout>
        <div>Dashboard content</div>
      </DashboardLayout>,
    );

    expect(screen.getByRole("link", { name: "Source" })).toHaveAttribute(
      "href",
      "https://github.com/example/agentrail",
    );
    expect(screen.queryByText("Read-only example")).not.toBeInTheDocument();
  });

  it("links from the sample banner to the synthetic run", () => {
    render(<ReadOnlyExampleBanner />);

    expect(
      screen.getByText(
        "This synthetic example shows how a research agent handled one task.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Explore the sample run" }),
    ).toHaveAttribute("href", "/traces/8044491c65f76da9f773b8369a00d889");
  });

  it("omits the sample-run link from the detail banner", () => {
    render(<ReadOnlyExampleBanner detail />);

    expect(
      screen.getByText("This run uses synthetic data and cannot be changed."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Explore the sample run" }),
    ).not.toBeInTheDocument();
  });
});
