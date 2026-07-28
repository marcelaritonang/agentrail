import type { SpanEnvelope } from "@agentrail-sdk/contracts";
import { resolveActor, rootActor, type Actor } from "./actor.js";
import { secureIds, type IdGenerator } from "./ids.js";
import { completedSpan, type TraceOptions } from "./span-builder.js";
import {
  TraceContext,
  type DeliverySummary,
  type ShutdownOptions,
  type SpanSink,
} from "./trace-context.js";

export type AgentRailOptions = {
  actor: Actor;
  sink: SpanSink;
  clock?: () => Date;
  ids?: IdGenerator;
};

export class AgentRail {
  private readonly actor;
  private readonly sink;
  private readonly clock;
  private readonly ids;

  constructor(options: AgentRailOptions) {
    this.actor = rootActor(options.actor);
    this.sink = options.sink;
    this.clock = options.clock ?? (() => new Date());
    this.ids = options.ids ?? secureIds;
  }

  shutdown(
    options: ShutdownOptions = { timeoutMs: 5_000 },
  ): Promise<DeliverySummary> {
    return (
      this.sink.shutdown?.(options) ??
      Promise.resolve({ delivered: 0, dropped: 0, pending: 0 })
    );
  }

  async trace<T>(
    options: TraceOptions,
    callback: (trace: TraceContext) => T | Promise<T>,
  ): Promise<T> {
    const traceId = this.ids.traceId();
    const spanId = this.ids.spanId();
    const actor = resolveActor(this.actor, options.actor);
    const startedAt = this.clock();
    const context = new TraceContext({
      traceId,
      traceName: options.name,
      parentSpanId: spanId,
      actor,
      sink: this.sink,
      clock: this.clock,
      ids: this.ids,
    });

    let result: T;
    try {
      result = await callback(context);
    } catch (error) {
      try {
        await this.emitTrace(
          options,
          traceId,
          spanId,
          actor,
          startedAt,
          "error",
        );
      } catch {
        // Preserve the traced operation's original error identity.
      }
      throw error;
    }

    await this.emitTrace(options, traceId, spanId, actor, startedAt, "ok");
    return result;
  }

  private async emitTrace(
    options: TraceOptions,
    traceId: string,
    spanId: string,
    actor: ReturnType<typeof rootActor>,
    startedAt: Date,
    outcome: SpanEnvelope["outcome"],
  ): Promise<void> {
    await this.sink.add(
      completedSpan({
        traceId,
        spanId,
        parentSpanId: null,
        traceName: options.name,
        kind: "trace",
        name: options.name,
        actor,
        startedAt,
        endedAt: this.clock(),
        outcome,
        ...(options.attributes === undefined
          ? {}
          : { attributes: options.attributes }),
        ...(options.payload === undefined ? {} : { payload: options.payload }),
      }),
    );
  }
}
