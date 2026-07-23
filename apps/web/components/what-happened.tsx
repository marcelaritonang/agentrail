import type { RunDetailPresentation } from "../lib/trace-presentation";
import type { TraceDetail } from "../lib/trace-read-model";

export function WhatHappened({
  trace,
  presentation,
}: {
  trace: TraceDetail;
  presentation: RunDetailPresentation;
}) {
  return (
    <section
      className="what-happened"
      aria-labelledby="what-happened-title"
      data-trace-id={trace.traceId}
    >
      <header className="trace-section-heading">
        <div>
          <span>Recorded sequence</span>
          <h2 id="what-happened-title">What happened</h2>
        </div>
        <p>Plain-language view of every recorded step</p>
      </header>
      <ol aria-label="What happened">
        {presentation.rootBoundary === null ? null : (
          <li className="run-boundary">
            <span>Run boundary</span>
            <strong>{presentation.rootBoundary.categoryLabel}</strong>
          </li>
        )}
        {presentation.steps.map((step) => (
          <li key={step.spanId}>
            <span>{step.ordinal}</span>
            <div>
              <strong>{step.categoryLabel}</strong>
              <code>{step.technicalName}</code>
            </div>
            <span>{step.outcomeLabel}</span>
            <span>{step.durationLabel}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
