import type { SpanEnvelope } from "@agentrail/contracts";
import { resolveActor, type ResolvedActor } from "./actor.js";
import type { IdGenerator } from "./ids.js";
import { completedSpan, type SpanOptions } from "./span-builder.js";

export type SpanSink = {
  add(span: SpanEnvelope): void | Promise<void>;
};

export class SpanContext {
  constructor(
    public readonly traceId: string,
    public readonly spanId: string,
    public readonly actor: ResolvedActor,
  ) {}
}

type TraceContextDependencies = {
  traceId: string;
  traceName: string;
  parentSpanId: string;
  actor: ResolvedActor;
  sink: SpanSink;
  clock: () => Date;
  ids: IdGenerator;
};

export class TraceContext {
  readonly traceId: string;
  readonly traceName: string;
  readonly actor: ResolvedActor;

  constructor(private readonly dependencies: TraceContextDependencies) {
    this.traceId = dependencies.traceId;
    this.traceName = dependencies.traceName;
    this.actor = dependencies.actor;
  }

  span<T>(
    options: SpanOptions,
    callback: (span: SpanContext) => T | Promise<T>,
  ): Promise<T> {
    return this.runSpan(options, callback);
  }

  action<T>(
    options: Omit<SpanOptions, "kind">,
    callback: (span: SpanContext) => T | Promise<T>,
  ): Promise<T> {
    return this.runSpan({ ...options, kind: "action" }, callback);
  }

  private async runSpan<T>(
    options: SpanOptions,
    callback: (span: SpanContext) => T | Promise<T>,
  ): Promise<T> {
    const spanId = this.dependencies.ids.spanId();
    const actor = resolveActor(this.dependencies.actor, options.actor);
    const startedAt = this.dependencies.clock();
    const context = new SpanContext(this.traceId, spanId, actor);

    let result: T;
    try {
      result = await callback(context);
    } catch (error) {
      try {
        await this.emit(options, spanId, actor, startedAt, "error");
      } catch {
        // Preserve the instrumented operation's original error identity.
      }
      throw error;
    }

    await this.emit(options, spanId, actor, startedAt, "ok");
    return result;
  }

  private async emit(
    options: SpanOptions,
    spanId: string,
    actor: ResolvedActor,
    startedAt: Date,
    outcome: SpanEnvelope["outcome"],
  ): Promise<void> {
    await this.dependencies.sink.add(
      completedSpan({
        traceId: this.traceId,
        spanId,
        parentSpanId: this.dependencies.parentSpanId,
        traceName: this.traceName,
        kind: options.kind,
        name: options.name,
        actor,
        startedAt,
        endedAt: this.dependencies.clock(),
        outcome,
        ...(options.model === undefined ? {} : { model: options.model }),
        ...(options.inputTokens === undefined
          ? {}
          : { inputTokens: options.inputTokens }),
        ...(options.outputTokens === undefined
          ? {}
          : { outputTokens: options.outputTokens }),
        ...(options.attributes === undefined
          ? {}
          : { attributes: options.attributes }),
        ...(options.payload === undefined ? {} : { payload: options.payload }),
      }),
    );
  }
}
