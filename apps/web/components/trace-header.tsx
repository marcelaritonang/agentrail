import { ArrowLeft } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import type { RunDetailPresentation } from "../lib/trace-presentation";
import type { TraceDetail } from "../lib/trace-read-model";

export function TraceHeader({
  trace,
  presentation,
}: {
  trace: TraceDetail;
  presentation: RunDetailPresentation;
}) {
  return (
    <header className="trace-detail-header">
      <Link className="trace-back" href="/traces">
        <ArrowLeft aria-hidden="true" size={14} weight="regular" />
        Back to all agent runs
      </Link>

      <div className="trace-title-row">
        <span className="page-eyebrow">
          <span>{presentation.technicalName}</span> · Run ID{" "}
          {presentation.shortRunId}
        </span>
        <h1>{presentation.displayTitle}</h1>
        <p className="run-summary">{presentation.summary}</p>
      </div>

      <dl className="trace-facts" aria-label="At a glance">
        <div>
          <dt>Status</dt>
          <dd className="trace-status-fact">
            {presentation.outcomeLabel === null ? (
              <span>No final outcome has been recorded yet.</span>
            ) : (
              <span
                className={`outcome outcome-${trace.outcome}`}
                data-outcome={trace.outcome}
              >
                <i aria-hidden="true" />
                {presentation.outcomeLabel}
              </span>
            )}
            {presentation.completionLabel === null ? null : (
              <>
                <strong className="incomplete-label">
                  {presentation.completionLabel}
                </strong>
                <small>{presentation.completionExplanation}</small>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>Agent</dt>
          <dd>{presentation.agentId}</dd>
        </div>
        <div>
          <dt>Requested by</dt>
          <dd>{presentation.requestedBy ?? "Not recorded"}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{presentation.durationLabel}</dd>
        </div>
        <div>
          <dt>Steps</dt>
          <dd>{presentation.stepCount}</dd>
        </div>
        <div>
          <dt>Model cost</dt>
          <dd
            className={
              presentation.modelCostTechnicalLabel === null
                ? undefined
                : "cost-unpriced"
            }
          >
            <span>{presentation.modelCostLabel}</span>
            {presentation.modelCostTechnicalLabel === null ? null : (
              <code>{presentation.modelCostTechnicalLabel}</code>
            )}
          </dd>
        </div>
      </dl>
    </header>
  );
}
