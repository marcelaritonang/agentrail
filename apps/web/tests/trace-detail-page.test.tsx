// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TraceDetail, TraceSpan } from "../lib/trace-read-model";

const state = vi.hoisted(() => ({
  trace: null as TraceDetail | null,
}));

vi.mock("../lib/demo-mode", () => ({
  DEMO_TRACE_ID: "demo-trace",
  demoModeEnabled: () => false,
}));

vi.mock("../lib/project-context", () => ({
  configuredProjectId: () => "project-a",
}));

vi.mock("../lib/trace-read-model", () => {
  return {
    getTraceDetail: vi.fn(async () => state.trace),
  };
});

vi.mock("../components/read-only-example", () => ({
  ReadOnlyExampleBanner: () => <aside>Read-only example</aside>,
}));

vi.mock("../components/trace-header", () => ({
  TraceHeader: () => (
    <section>
      <h1>Run summary</h1>
    </section>
  ),
}));

vi.mock("../components/what-happened", () => ({
  WhatHappened: () => (
    <section>
      <h2>What happened</h2>
    </section>
  ),
}));

vi.mock("../components/trace-rail", () => ({
  TraceRail: () => (
    <section>
      <h2>Technical timeline</h2>
    </section>
  ),
}));

vi.mock("../components/action-ledger", () => ({
  ActionLedger: () => (
    <section>
      <h2>External actions</h2>
    </section>
  ),
}));

vi.mock("../components/evidence-drawer", () => ({
  EvidenceDrawer: ({ span }: { span: TraceSpan }) => (
    <aside aria-label="Evidence drawer">{span.spanId}</aside>
  ),
}));

import TraceDetailPage from "../app/(dashboard)/traces/[traceId]/page";

afterEach(cleanup);

function spanFixture(
  input: Partial<TraceSpan> & Pick<TraceSpan, "spanId" | "name">,
): TraceSpan {
  return {
    projectId: "project-a",
    traceId: "trace-a",
    parentSpanId: "root",
    kind: "custom",
    agentId: "research-agent",
    onBehalfOf: null,
    startedAt: "2026-07-21T10:00:00.100Z",
    endedAt: "2026-07-21T10:00:00.200Z",
    outcome: "ok",
    model: null,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    pricingUnknown: false,
    pricingCatalogVersion: null,
    attributes: {},
    payloadTruncated: false,
    hasPayload: false,
    ...input,
  };
}

function traceFixture(): TraceDetail {
  return {
    traceId: "trace-a",
    rootSpanId: "root",
    name: "sample.research-answer",
    agentId: "research-agent",
    onBehalfOf: "sample-user",
    startedAt: "2026-07-21T10:00:00.000Z",
    endedAt: "2026-07-21T10:00:01.250Z",
    durationMs: 1_250,
    outcome: "ok",
    completionState: "complete",
    totalCostUsd: "0.00400000",
    pricingUnknown: false,
    spanCount: 3,
    spans: [
      spanFixture({
        spanId: "root",
        name: "sample.research-answer",
        parentSpanId: null,
        kind: "trace",
      }),
      spanFixture({
        spanId: "without-payload",
        name: "record.metadata",
      }),
      spanFixture({
        spanId: "with-payload",
        name: "publish.answer",
        kind: "action",
        hasPayload: true,
      }),
    ],
  };
}

async function renderPage(span?: string) {
  state.trace = traceFixture();
  const page = await TraceDetailPage({
    params: Promise.resolve({ traceId: "trace-a" }),
    searchParams: Promise.resolve(span === undefined ? {} : { span }),
  });
  render(page);
}

describe("TraceDetailPage", () => {
  it("orders the readable summary before the sequence and forensic sections", async () => {
    await renderPage();

    expect(
      screen.getAllByRole("heading").map((heading) => heading.textContent),
    ).toEqual([
      "Run summary",
      "What happened",
      "Technical timeline",
      "External actions",
    ]);
  });

  it("mounts evidence only for a selected span with payload", async () => {
    await renderPage("with-payload");

    expect(
      screen.getByRole("complementary", { name: "Evidence drawer" }),
    ).toHaveTextContent("with-payload");
  });

  it.each(["without-payload", "missing-span"])(
    "does not mount evidence for selection %s",
    async (spanId) => {
      await renderPage(spanId);

      expect(
        screen.queryByRole("complementary", { name: "Evidence drawer" }),
      ).not.toBeInTheDocument();
    },
  );
});
