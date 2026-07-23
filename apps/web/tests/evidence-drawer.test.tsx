// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
  attributes: { provider: "test-provider" },
  payloadTruncated: false,
  hasPayload: true,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function evidenceResponse(answer: string): Response {
  return new Response(
    JSON.stringify({
      state: "available",
      truncated: false,
      payload: { answer },
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}

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
    ["redacted", "Sensitive fields were removed before storage."],
    [
      "truncated",
      "Recorded data was shortened at the configured capture limit.",
    ],
    ["none", "No input/output was captured for this step."],
    ["error", "Recorded data couldn't be loaded."],
  ] as const)("renders the %s evidence state", async (state, text) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => fetchResult(state)),
    );

    render(<EvidenceDrawer traceId="trace-a" span={span} />);

    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("uses recorded-data terminology and exposes complete forensic facts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => fetchResult("redacted")),
    );
    render(<EvidenceDrawer traceId="trace-a" span={span} />);

    expect(
      await screen.findByRole("dialog", {
        name: "Recorded data for model.generate",
      }),
    ).toBeVisible();
    expect(screen.getByText("Evidence · Span llm-child")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Model generate" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Input and output captured by the project-scoped AgentRail backend.",
      ),
    ).toBeVisible();
    expect(screen.getByText("Called an AI model")).toBeVisible();
    expect(screen.getByText("LLM")).toBeVisible();
    expect(screen.getByText("1,000")).toBeVisible();
    expect(screen.getByText("500")).toBeVisible();
    expect(screen.getByText("$0.0040")).toBeVisible();
    expect(screen.getByText("Advanced metadata")).toBeVisible();
    expect(screen.getByLabelText("Raw span attributes")).toHaveTextContent(
      '"provider": "test-provider"',
    );
    expect(screen.getByText("Recorded input/output")).toBeVisible();
  });

  it("never renders recorded data from a previously selected span", async () => {
    const responseA = deferred<Response>();
    const responseB = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(() => responseA.promise)
        .mockImplementationOnce(() => responseB.promise),
    );
    const { rerender } = render(
      <EvidenceDrawer traceId="trace-a" span={span} />,
    );

    await act(() => {
      responseA.resolve(evidenceResponse("span A evidence"));
      return responseA.promise;
    });
    expect(await screen.findByText(/span A evidence/)).toBeVisible();

    const spanB: TraceSpan = {
      ...span,
      spanId: "llm-second",
      name: "model.revise",
    };
    rerender(<EvidenceDrawer traceId="trace-a" span={spanB} />);

    expect(screen.queryByText(/span A evidence/)).not.toBeInTheDocument();
    expect(screen.getByText("Loading recorded data…")).toBeVisible();

    await act(() => {
      responseB.resolve(evidenceResponse("span B evidence"));
      return responseB.promise;
    });
    expect(await screen.findByText(/span B evidence/)).toBeVisible();
    expect(screen.queryByText(/span A evidence/)).not.toBeInTheDocument();
  });

  it("keeps B evidence when superseded A resolves despite abort", async () => {
    const responseA = deferred<Response>();
    const responseB = deferred<Response>();
    let signalA: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: unknown, init?: RequestInit) => {
        if (signalA === undefined) {
          signalA = init?.signal ?? undefined;
          return responseA.promise;
        }
        return responseB.promise;
      }),
    );
    const { rerender } = render(
      <EvidenceDrawer traceId="trace-a" span={span} />,
    );
    await waitFor(() => expect(signalA).toBeDefined());

    const spanB: TraceSpan = {
      ...span,
      spanId: "llm-second",
      name: "model.revise",
    };
    rerender(<EvidenceDrawer traceId="trace-a" span={spanB} />);
    expect(signalA).toBeDefined();
    expect(signalA!.aborted).toBe(true);

    await act(async () => {
      responseB.resolve(evidenceResponse("span B evidence"));
      await responseB.promise;
    });
    expect(await screen.findByText(/span B evidence/)).toBeVisible();

    await act(async () => {
      responseA.resolve(evidenceResponse("late span A evidence"));
      await responseA.promise;
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/span B evidence/)).toBeVisible();
    expect(screen.queryByText(/late span A evidence/)).not.toBeInTheDocument();
  });

  it("keeps B evidence when superseded A rejects despite abort", async () => {
    const responseA = deferred<Response>();
    const responseB = deferred<Response>();
    let signalA: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: unknown, init?: RequestInit) => {
        if (signalA === undefined) {
          signalA = init?.signal ?? undefined;
          return responseA.promise;
        }
        return responseB.promise;
      }),
    );
    const { rerender } = render(
      <EvidenceDrawer traceId="trace-a" span={span} />,
    );
    await waitFor(() => expect(signalA).toBeDefined());

    const spanB: TraceSpan = {
      ...span,
      spanId: "llm-second",
      name: "model.revise",
    };
    rerender(<EvidenceDrawer traceId="trace-a" span={spanB} />);
    expect(signalA).toBeDefined();
    expect(signalA!.aborted).toBe(true);

    await act(async () => {
      responseB.resolve(evidenceResponse("span B evidence"));
      await responseB.promise;
    });
    expect(await screen.findByText(/span B evidence/)).toBeVisible();

    await act(async () => {
      responseA.reject(new Error("late span A failure"));
      await responseA.promise.catch(() => undefined);
      await Promise.resolve();
    });
    expect(screen.getByText(/span B evidence/)).toBeVisible();
    expect(
      screen.queryByText("Recorded data couldn't be loaded."),
    ).not.toBeInTheDocument();
  });

  it("closes with Escape and restores focus to the exact active origin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => fetchResult("redacted")),
    );
    const { rerender } = render(
      <>
        <button
          type="button"
          data-span-id="llm-child"
          data-evidence-origin="steps"
        >
          Steps origin
        </button>
        <button
          type="button"
          data-span-id="llm-child"
          data-evidence-origin="timeline"
        >
          Timeline origin
        </button>
      </>,
    );
    screen.getByRole("button", { name: "Timeline origin" }).focus();
    rerender(
      <>
        <button
          type="button"
          data-span-id="llm-child"
          data-evidence-origin="steps"
        >
          Steps origin
        </button>
        <button
          type="button"
          data-span-id="llm-child"
          data-evidence-origin="timeline"
        >
          Timeline origin
        </button>
        <EvidenceDrawer traceId="trace-a" span={span} />
      </>,
    );
    const dialog = await screen.findByRole("dialog", {
      name: /recorded data/i,
    });

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(routerPush).toHaveBeenCalledWith("/traces/trace-a");
    expect(
      screen.getByRole("button", { name: "Timeline origin" }),
    ).toHaveFocus();
  });

  it("forgets a captured origin when the selected span changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
    const spanB: TraceSpan = {
      ...span,
      spanId: "llm-second",
      name: "model.revise",
    };
    const origins = (selectedSpan: TraceSpan, includeDrawer: boolean) => (
      <>
        <button
          type="button"
          data-span-id="llm-child"
          data-evidence-origin="steps"
        >
          Span A origin
        </button>
        <button
          type="button"
          data-span-id="llm-second"
          data-evidence-origin="timeline"
        >
          Span B origin
        </button>
        {includeDrawer ? (
          <EvidenceDrawer traceId="trace-a" span={selectedSpan} />
        ) : null}
      </>
    );
    const { rerender } = render(origins(span, false));
    screen.getByRole("button", { name: "Span A origin" }).focus();
    rerender(origins(span, true));
    expect(
      screen.getByRole("button", { name: "Close recorded data" }),
    ).toHaveFocus();

    rerender(origins(spanB, true));
    const dialogB = screen.getByRole("dialog", {
      name: "Recorded data for model.revise",
    });
    fireEvent.keyDown(dialogB, { key: "Escape" });

    expect(routerPush).toHaveBeenCalledWith("/traces/trace-a");
    expect(screen.getByRole("button", { name: "Span B origin" })).toHaveFocus();
  });

  it("keeps Tab focus inside the drawer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => fetchResult("redacted")),
    );
    render(<EvidenceDrawer traceId="trace-a" span={span} />);
    const close = await screen.findByRole("button", {
      name: "Close recorded data",
    });
    const dialog = screen.getByRole("dialog", { name: /recorded data/i });

    close.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });

    expect(close).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });

    expect(screen.getByText("Advanced metadata")).toHaveFocus();
  });

  it("shows loading copy while the backend request is pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );

    render(<EvidenceDrawer traceId="trace-a" span={span} />);

    expect(screen.getByText("Loading recorded data…")).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Close recorded data" }),
      ).toHaveFocus(),
    );
  });
});
