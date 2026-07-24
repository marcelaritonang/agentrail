import { describe, expect, it } from "vitest";

import type {
  AgentRailReadModel,
  AgentRailSpan,
  AgentRailTrace,
} from "./types";
import {
  AGENTRAIL_MCP_TOOL_NAMES,
  createAgentRailToolHandlers,
  safeErrorMessage,
} from "./tools";

function parseResult(result: { content: [{ type: "text"; text: string }] }) {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

const trace: AgentRailTrace = {
  traceId: "8044491c65f76da9f773b8369a00d889",
  rootSpanId: "0dbf4a99a87409e7",
  name: "sample.research-answer",
  agentId: "research-agent",
  onBehalfOf: "founder-review",
  startedAt: "2026-07-22T14:53:01.863Z",
  endedAt: "2026-07-22T14:53:03.113Z",
  outcome: "ok",
  completionState: "complete",
  totalCostUsd: "0.00400000",
  pricingUnknown: false,
  spanCount: 4,
};

const spans: AgentRailSpan[] = [
  {
    traceId: trace.traceId,
    spanId: trace.rootSpanId!,
    parentSpanId: null,
    kind: "trace",
    name: "sample.research-answer",
    agentId: "research-agent",
    onBehalfOf: "founder-review",
    startedAt: "2026-07-22T14:53:01.863Z",
    endedAt: "2026-07-22T14:53:03.113Z",
    outcome: "ok",
    model: null,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    pricingUnknown: false,
    attributes: {},
    hasPayload: false,
    payloadTruncated: false,
  },
  {
    traceId: trace.traceId,
    spanId: "c67f6aafecfa753f",
    parentSpanId: trace.rootSpanId,
    kind: "llm",
    name: "draft.answer",
    agentId: "research-agent",
    onBehalfOf: "founder-review",
    startedAt: "2026-07-22T14:53:02.100Z",
    endedAt: "2026-07-22T14:53:02.941Z",
    outcome: "ok",
    model: "test.known",
    inputTokens: 1_000,
    outputTokens: 500,
    costUsd: "0.00400000",
    pricingUnknown: false,
    attributes: { safety: "redacted_payload" },
    hasPayload: true,
    payloadTruncated: false,
  },
  {
    traceId: trace.traceId,
    spanId: "77422db049831bea",
    parentSpanId: trace.rootSpanId,
    kind: "action",
    name: "filesystem.write",
    agentId: "research-agent",
    onBehalfOf: "founder-review",
    startedAt: "2026-07-22T14:53:02.970Z",
    endedAt: "2026-07-22T14:53:03.078Z",
    outcome: "ok",
    model: null,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    pricingUnknown: false,
    attributes: { path: "application-brief.md" },
    hasPayload: false,
    payloadTruncated: false,
  },
  {
    traceId: trace.traceId,
    spanId: "1111111111111111",
    parentSpanId: trace.rootSpanId,
    kind: "tool",
    name: "browser.search",
    agentId: "research-agent",
    onBehalfOf: "founder-review",
    startedAt: "2026-07-22T14:53:02.000Z",
    endedAt: "2026-07-22T14:53:02.050Z",
    outcome: "ok",
    model: null,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    pricingUnknown: false,
    attributes: { query: "agent observability" },
    hasPayload: false,
    payloadTruncated: false,
  },
];

function createFakeReadModel(): {
  readModel: AgentRailReadModel;
  listInputs: AgentRailReadModel extends {
    listTraces(input: infer Input): Promise<unknown>;
  }
    ? Input[]
    : never;
} {
  const listInputs: Parameters<AgentRailReadModel["listTraces"]>[0][] = [];
  return {
    listInputs,
    readModel: {
      async listTraces(input) {
        listInputs.push(input);
        return { items: [trace], total: 1 };
      },
      async getTrace(traceId) {
        if (traceId !== trace.traceId) return null;
        return { ...trace, spans };
      },
      async getPayloadStatus(traceId, spanId) {
        if (traceId !== trace.traceId || spanId !== spans[1]!.spanId) {
          return {
            found: false,
            payloadMode: null,
            hasPayload: false,
            truncated: false,
            reason: "span_not_found",
          };
        }
        return {
          found: true,
          payloadMode: "redacted",
          hasPayload: true,
          truncated: false,
          reason: "available",
        };
      },
    },
  };
}

describe("AgentRail MCP tools", () => {
  it("exposes only the approved read-only tools", () => {
    expect(AGENTRAIL_MCP_TOOL_NAMES).toEqual([
      "agentrail_list_traces",
      "agentrail_get_trace",
      "agentrail_get_actions",
      "agentrail_get_payload_status",
      "agentrail_open_dashboard",
    ]);
  });

  it("lists traces with bounded limits, filters, and dashboard links", async () => {
    const { readModel, listInputs } = createFakeReadModel();
    const handlers = createAgentRailToolHandlers({
      readModel,
      dashboardUrl: "https://agentrail.example",
    });

    const body = parseResult(
      await handlers.agentrail_list_traces({
        limit: 100,
        query: "research",
        actor: "research-agent",
        outcome: "ok",
      }),
    );

    expect(listInputs).toEqual([
      {
        limit: 25,
        query: "research",
        actor: "research-agent",
        outcome: "ok",
      },
    ]);
    expect(body).toMatchObject({
      total: 1,
      limit: 25,
      traces: [
        {
          traceId: trace.traceId,
          name: "sample.research-answer",
          agentId: "research-agent",
          requestedBy: "founder-review",
          outcome: "ok",
          completionState: "complete",
          spanCount: 4,
          cost: "0.00400000",
          pricingUnknown: false,
          dashboardUrl:
            "https://agentrail.example/traces/8044491c65f76da9f773b8369a00d889",
        },
      ],
    });
  });

  it("returns trace detail with ordered spans and no raw payload content", async () => {
    const { readModel } = createFakeReadModel();
    const handlers = createAgentRailToolHandlers({ readModel });

    const body = parseResult(
      await handlers.agentrail_get_trace({ traceId: trace.traceId }),
    );

    expect(body).toMatchObject({
      trace: {
        traceId: trace.traceId,
        durationMs: 1250,
      },
      spans: [
        { spanId: "0dbf4a99a87409e7", kind: "trace" },
        { spanId: "1111111111111111", kind: "tool" },
        {
          spanId: "c67f6aafecfa753f",
          kind: "llm",
          payload: { hasPayload: true, truncated: false },
        },
        { spanId: "77422db049831bea", kind: "action" },
      ],
    });
    expect(JSON.stringify(body)).not.toContain("payloadRef");
    expect(JSON.stringify(body)).not.toContain("rawPayload");
  });

  it("returns only action and tool spans for action inspection", async () => {
    const { readModel } = createFakeReadModel();
    const handlers = createAgentRailToolHandlers({ readModel });

    const body = parseResult(
      await handlers.agentrail_get_actions({ traceId: trace.traceId }),
    );

    expect(body).toMatchObject({
      traceId: trace.traceId,
      actions: [
        { spanId: "1111111111111111", kind: "tool", name: "browser.search" },
        {
          spanId: "77422db049831bea",
          kind: "action",
          name: "filesystem.write",
        },
      ],
    });
  });

  it("checks payload status without returning payload content", async () => {
    const { readModel } = createFakeReadModel();
    const handlers = createAgentRailToolHandlers({ readModel });

    const body = parseResult(
      await handlers.agentrail_get_payload_status({
        traceId: trace.traceId,
        spanId: "c67f6aafecfa753f",
      }),
    );

    expect(body).toEqual({
      traceId: trace.traceId,
      spanId: "c67f6aafecfa753f",
      found: true,
      payloadMode: "redacted",
      hasPayload: true,
      truncated: false,
      reason: "available",
      rawPayloadReturned: false,
    });
  });

  it("returns setup guidance when dashboard URL is not configured", async () => {
    const { readModel } = createFakeReadModel();
    const handlers = createAgentRailToolHandlers({ readModel });

    const body = parseResult(
      await handlers.agentrail_open_dashboard({ traceId: trace.traceId }),
    );

    expect(body).toEqual({
      configured: false,
      message:
        "Set AGENTRAIL_DASHBOARD_URL to let this MCP server return dashboard links.",
    });
  });

  it("keeps configuration errors free of secret connection strings", () => {
    const message = safeErrorMessage(
      new Error(
        "Connection failed for postgresql://agentrail:secret@localhost:5433/agentrail_test",
      ),
    );

    expect(message).toBe("Connection failed for postgresql://[redacted]");
    expect(message).not.toContain("secret");
    expect(message).not.toContain("localhost:5433");
  });
});
