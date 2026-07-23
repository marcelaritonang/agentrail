// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ActionLedger } from "../components/action-ledger";
import type { TraceSpan } from "../lib/trace-read-model";

function span(
  input: Pick<TraceSpan, "spanId" | "kind" | "name" | "startedAt"> &
    Partial<Pick<TraceSpan, "hasPayload">>,
): TraceSpan {
  return {
    projectId: "project-a",
    traceId: "trace-a",
    parentSpanId: "root",
    agentId: "research-agent",
    onBehalfOf: null,
    endedAt: new Date(Date.parse(input.startedAt) + 10).toISOString(),
    outcome: "ok",
    model: null,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    pricingUnknown: false,
    pricingCatalogVersion: null,
    attributes: {},
    payloadTruncated: false,
    hasPayload: true,
    ...input,
  };
}

afterEach(cleanup);

describe("ActionLedger", () => {
  it("shows only action and tool spans in chronological order", () => {
    render(
      <ActionLedger
        traceId="trace-a"
        spans={[
          span({
            spanId: "tool-b",
            kind: "tool",
            name: "filesystem.read",
            startedAt: "2026-07-21T10:00:00.300Z",
          }),
          span({
            spanId: "llm-a",
            kind: "llm",
            name: "model.plan",
            startedAt: "2026-07-21T10:00:00.100Z",
          }),
          span({
            spanId: "action-a",
            kind: "action",
            name: "web.search",
            startedAt: "2026-07-21T10:00:00.200Z",
          }),
        ]}
      />,
    );

    expect(
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.textContent),
    ).toEqual([
      expect.stringContaining("Web search"),
      expect.stringContaining("Filesystem read"),
    ]);
    expect(screen.queryByText("Model plan")).not.toBeInTheDocument();
  });

  it("uses payload-aware recorded data actions on desktop and mobile rows", () => {
    render(
      <ActionLedger
        traceId="trace-a"
        spans={[
          span({
            spanId: "action-without-payload",
            kind: "action",
            name: "publish.metadata",
            startedAt: "2026-07-21T10:00:00.200Z",
            hasPayload: false,
          }),
          span({
            spanId: "tool-with-payload",
            kind: "tool",
            name: "filesystem.write",
            startedAt: "2026-07-21T10:00:00.300Z",
            hasPayload: true,
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "External actions" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Action Ledger · tools or systems the agent called or changed",
      ),
    ).toBeVisible();
    expect(
      screen.getAllByText("Metadata only", { selector: "span" }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("link", { name: "Inspect recorded data" }),
    ).toHaveLength(2);
    expect(
      screen.queryByRole("link", { name: /publish metadata/i }),
    ).not.toBeInTheDocument();
  });
});
