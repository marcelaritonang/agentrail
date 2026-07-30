// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TracePage } from "../lib/trace-read-model";

const state = vi.hoisted(() => ({
  demoMode: true,
  page: null as TracePage | null,
  sourceUrl: null as string | null,
}));

vi.mock("../lib/demo-mode", () => ({
  DEMO_PROJECT_ID: "00000000-0000-4000-8000-000000000001",
  DEMO_TRACE_ID: "0af7651916cd43dd8448eb211c80319c",
  demoModeEnabled: () => state.demoMode,
  isReadOnlySampleTrace: (trace: { traceId: string; name: string }) =>
    trace.traceId === "0af7651916cd43dd8448eb211c80319c" ||
    trace.name === "sample.research-answer",
}));

vi.mock("../lib/project-context", () => ({
  configuredProjectId: () => "00000000-0000-4000-8000-000000000001",
}));

vi.mock("../lib/source-url", () => ({
  configuredSourceUrl: () => state.sourceUrl,
  sourceQuickstartUrl: (sourceUrl: string) => `${sourceUrl}#local-quickstart`,
}));

vi.mock("../lib/trace-read-model", () => ({
  listTraces: () => Promise.resolve(state.page),
}));

import TracesPage from "../app/(dashboard)/traces/page";
import { TraceTable } from "../components/trace-table";

afterEach(cleanup);

function tracePageFixture(pricingUnknown = true): TracePage {
  return {
    page: 1,
    pageSize: 25,
    total: 1,
    items: [
      {
        traceId: "0af7651916cd43dd8448eb211c80319c",
        rootSpanId: "root-span",
        name: "sample.research-answer",
        agentId: "research-agent",
        onBehalfOf: "sample-user",
        startedAt: "2026-07-21T10:00:00.000Z",
        endedAt: "2026-07-21T10:00:01.250Z",
        durationMs: 1_250,
        outcome: "ok",
        completionState: null,
        totalCostUsd: pricingUnknown ? null : "0.00400000",
        pricingUnknown,
        spanCount: 4,
      },
    ],
  };
}

describe("agent run index", () => {
  it("orients users and presents the read-only example as an agent run", async () => {
    state.page = tracePageFixture(false);
    state.demoMode = true;
    state.sourceUrl = null;

    render(await TracesPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Agent runs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Review what an AI agent did, how long it took, what it cost, and which tools it used.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Research answer")).toBeInTheDocument();
    expect(screen.getByText("sample.research-answer")).toBeInTheDocument();
    expect(screen.getByText("3 steps")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Open run" })[0],
    ).toHaveAttribute("href", "/traces/0af7651916cd43dd8448eb211c80319c");
    expect(screen.queryByText(/\bOK\b/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "How to inspect an agent run" }),
    ).toHaveTextContent(
      "1Choose a run2Open it3Inspect steps and recorded data",
    );
  });

  it("marks the seeded local sample as a read-only example outside demo mode", async () => {
    state.page = tracePageFixture(false);
    state.demoMode = false;
    state.sourceUrl = null;

    render(await TracesPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("complementary")).toHaveTextContent(
      "Read-only example",
    );
    expect(
      screen.getByRole("link", { name: "Explore the sample run" }),
    ).toHaveAttribute("href", "/traces/0af7651916cd43dd8448eb211c80319c");
    expect(screen.getByText("Research answer")).toBeInTheDocument();
  });

  it("explains how to install and test AgentRail without pointing at the wrong npm package", async () => {
    state.page = tracePageFixture(false);
    state.demoMode = true;
    state.sourceUrl = "https://github.com/marcelaritonang/agentrail";

    render(await TracesPage({ searchParams: Promise.resolve({}) }));

    const installGuide = screen.getByRole("region", {
      name: "Install and test AgentRail",
    });

    expect(installGuide).toHaveTextContent(
      "npm install agentrail is not this project",
    );
    expect(installGuide).toHaveTextContent("npm install @agentrail-sdk/sdk");
    expect(installGuide).toHaveTextContent(
      "npm install -D @agentrail-sdk/cli",
    );
    expect(installGuide).toHaveTextContent(
      "npx -y @agentrail-sdk/cli context",
    );
    expect(installGuide).toHaveTextContent("npx -y @agentrail-sdk/mcp");
    expect(
      within(installGuide).getByRole("link", { name: "Open source checkout" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/marcelaritonang/agentrail#local-quickstart",
    );
  });

  it("renders the semantic desktop ledger and keeps unpriced facts truthful", () => {
    render(
      <TraceTable
        page={tracePageFixture()}
        queryString=""
        isReadOnlyExample={false}
        readOnlyTraceIds={[]}
      />,
    );

    const table = screen.getByRole("table", { name: "Agent runs" });
    expect(
      within(table).getByRole("columnheader", { name: "Run" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Agent" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Recorded" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Status" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Succeeded")).toBeInTheDocument();
    expect(within(table).getByText("Price unavailable")).toBeInTheDocument();
    expect(within(table).getByText("UNPRICED")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open run" }).closest("td"),
    ).toHaveAttribute("data-label", "Action");
    expect(screen.queryByText(/running/i)).not.toBeInTheDocument();
  });
});
