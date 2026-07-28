import { describe, expect, it } from "vitest";

import type { SpanEnvelope } from "@agentrail-sdk/contracts";
import { AgentRail } from "./agentrail.js";

const TRACE_ID = "0af7651916cd43dd8448eb211c80319c";

function testRail(delivered: SpanEnvelope[]) {
  let spanSequence = 0;
  let millisecond = 0;

  return new AgentRail({
    actor: { agentId: "planner", onBehalfOf: "user_42" },
    sink: { add: (span) => delivered.push(span) },
    clock: () => new Date(Date.UTC(2026, 6, 21, 10, 0, 0, millisecond++)),
    ids: {
      traceId: () => TRACE_ID,
      spanId: () => (++spanSequence).toString(16).padStart(16, "0"),
    },
  });
}

describe("AgentRail", () => {
  it("inherits the trace actor and permits a per-span override", async () => {
    const delivered: SpanEnvelope[] = [];
    const rail = testRail(delivered);

    await rail.trace({ name: "answer" }, async (trace) => {
      await trace.span({ kind: "llm", name: "plan" }, async () => undefined);
      await trace.span(
        { kind: "tool", name: "delegate", actor: { agentId: "browser" } },
        async () => undefined,
      );
    });

    expect(delivered.find((span) => span.name === "plan")).toMatchObject({
      agent_id: "planner",
      on_behalf_of: "user_42",
    });
    expect(delivered.find((span) => span.name === "delegate")).toMatchObject({
      agent_id: "browser",
      on_behalf_of: "user_42",
    });
    expect(delivered.at(-1)).toMatchObject({
      trace_id: TRACE_ID,
      kind: "trace",
      name: "answer",
      outcome: "ok",
    });
  });

  it("records error envelopes and rethrows the original error", async () => {
    const delivered: SpanEnvelope[] = [];
    const rail = testRail(delivered);
    const failure = new Error("tool failed");

    await expect(
      rail.trace({ name: "answer" }, (trace) =>
        trace.action({ name: "filesystem.read" }, async () => {
          throw failure;
        }),
      ),
    ).rejects.toBe(failure);

    expect(delivered.at(-2)).toMatchObject({
      name: "filesystem.read",
      kind: "action",
      outcome: "error",
    });
    expect(delivered.at(-1)).toMatchObject({
      name: "answer",
      kind: "trace",
      outcome: "error",
    });
  });

  it("returns the callback value and emits each completed span exactly once", async () => {
    const delivered: SpanEnvelope[] = [];
    const rail = testRail(delivered);

    const result = await rail.trace({ name: "answer" }, (trace) =>
      trace.span({ kind: "custom", name: "compose" }, async () => 42),
    );

    expect(result).toBe(42);
    expect(delivered.map((span) => span.name)).toEqual(["compose", "answer"]);
    expect(delivered.every((span) => span.ended_at >= span.started_at)).toBe(
      true,
    );
  });

  it("does not turn a sink failure into a second span emission", async () => {
    let attempts = 0;
    const deliveryFailure = new Error("sink unavailable");
    const rail = new AgentRail({
      actor: { agentId: "planner" },
      sink: {
        add: () => {
          attempts += 1;
          throw deliveryFailure;
        },
      },
      ids: {
        traceId: () => TRACE_ID,
        spanId: () => "0000000000000001",
      },
    });

    await expect(
      rail.trace({ name: "answer" }, async () => undefined),
    ).rejects.toBe(deliveryFailure);
    expect(attempts).toBe(1);
  });
});
