import { ArrowLeft } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import {
  formatCost,
  formatDuration,
  formatTimestamp,
  shortId,
} from "../lib/format";
import type { TraceDetail } from "../lib/trace-read-model";

export function TraceHeader({ trace }: { trace: TraceDetail }) {
  return (
    <header className="trace-detail-header">
      <Link className="trace-back" href="/traces">
        <ArrowLeft aria-hidden="true" size={14} weight="regular" />
        Trace archive
      </Link>

      <div className="trace-title-row">
        <div>
          <span className="page-eyebrow">
            Forensic record / {shortId(trace.traceId)}
          </span>
          <h1>{trace.name}</h1>
        </div>
        <div className="trace-state-line">
          {trace.outcome === null ? null : (
            <span className={`outcome outcome-${trace.outcome}`}>
              <i aria-hidden="true" />
              {trace.outcome.toUpperCase()}
            </span>
          )}
          {trace.completionState === "incomplete" ? (
            <strong className="incomplete-label">INCOMPLETE</strong>
          ) : null}
        </div>
      </div>

      <dl className="trace-facts">
        <div>
          <dt>Actor</dt>
          <dd>{trace.agentId}</dd>
        </div>
        <div>
          <dt>On behalf of</dt>
          <dd>{trace.onBehalfOf ?? "—"}</dd>
        </div>
        <div>
          <dt>Started</dt>
          <dd>
            <time dateTime={trace.startedAt}>
              {formatTimestamp(trace.startedAt)}
            </time>
          </dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{formatDuration(trace.durationMs ?? -1)}</dd>
        </div>
        <div>
          <dt>Spans</dt>
          <dd>{trace.spanCount}</dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd className={trace.pricingUnknown ? "cost-unpriced" : undefined}>
            {formatCost(trace)}
          </dd>
        </div>
      </dl>
    </header>
  );
}
