// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EvidenceDrawer } from "../components/evidence-drawer";
import type { TraceSpan } from "../lib/trace-read-model";

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

const span: TraceSpan = {
  projectId: "project-a",
  traceId: "trace-a",
  spanId: "llm-child",
  parentSpanId: "root",
  kind: "llm",
  name: "model.generate",
  agentId: "writer-agent",
  onBehalfOf: "sample-user",
  startedAt: "2026-07-21T10:00:00.250Z",
  endedAt: "2026-07-21T10:00:00.500Z",
  outcome: "ok",
  model: "test.known",
  inputTokens: 1_000,
  outputTokens: 500,
  costUsd: "0.00400000",
  pricingUnknown: false,
  pricingCatalogVersion: "2026-07-21",
  attributes: {},
  payloadTruncated: false,
  hasPayload: true,
};

function fetchResult(state: "redacted" | "truncated" | "none" | "error") {
  if (state === "none") {
    return Promise.resolve({ status: 204, ok: true });
  }
  if (state === "error") {
    return Promise.resolve({ status: 502, ok: false });
  }
  return Promise.resolve({
    status: 200,
    ok: true,
    json: () =>
      Promise.resolve({
        state: state === "redacted" ? "redacted" : "available",
        truncated: state === "truncated",
        payload: { prompt: "safe", answer: "evidence" },
      }),
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  routerPush.mockReset();
});

describe("EvidenceDrawer", () => {
  it.each([
    ["redacted", /sensitive fields were redacted/i],
    ["truncated", /payload was truncated/i],
    ["none", /payload capture is disabled/i],
    ["error", /evidence could not be loaded/i],
  ] as const)("renders the %s evidence state", async (state, text) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => fetchResult(state)),
    );

    render(<EvidenceDrawer traceId="trace-a" span={span} />);

    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("closes with Escape and restores focus to the selected rail row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => fetchResult("redacted")),
    );
    render(
      <>
        <button type="button" data-span-id="llm-child">
          Origin
        </button>
        <EvidenceDrawer traceId="trace-a" span={span} />
      </>,
    );
    const dialog = await screen.findByRole("dialog", { name: /evidence/i });

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(routerPush).toHaveBeenCalledWith("/traces/trace-a");
    expect(screen.getByRole("button", { name: "Origin" })).toHaveFocus();
  });

  it("keeps Tab focus inside the drawer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => fetchResult("redacted")),
    );
    render(<EvidenceDrawer traceId="trace-a" span={span} />);
    const close = await screen.findByRole("button", {
      name: /close evidence/i,
    });
    const dialog = screen.getByRole("dialog", { name: /evidence/i });

    close.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });

    expect(close).toHaveFocus();
  });
});
