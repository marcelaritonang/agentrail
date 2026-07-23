import { buildTraceRail } from "../lib/trace-rail";
import type { TraceDetail } from "../lib/trace-read-model";
import { SpanRow } from "./span-row";

export function TraceRail({ trace }: { trace: TraceDetail }) {
  const bounds =
    trace.endedAt === null
      ? undefined
      : {
          traceStartMs: Date.parse(trace.startedAt),
          traceEndMs: Date.parse(trace.endedAt),
        };
  const rows = buildTraceRail(trace.spans, bounds);

  return (
    <section className="trace-rail" aria-labelledby="trace-rail-title">
      <header className="trace-section-heading">
        <div>
          <span>Trace Rail</span>
          <h2 id="trace-rail-title">Technical timeline</h2>
        </div>
        <p>
          Exact order, nesting, and duration of {rows.length} recorded spans
        </p>
      </header>
      <div className="trace-rail-columns" aria-hidden="true">
        <span>Span / kind</span>
        <span>Actor</span>
        <span>Duration</span>
        <span>Waterfall</span>
      </div>
      <ol>
        {rows.map((row) => (
          <SpanRow key={row.spanId} row={row} />
        ))}
      </ol>
    </section>
  );
}
