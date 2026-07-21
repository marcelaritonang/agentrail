import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import {
  formatCost,
  formatDuration,
  formatTimestamp,
  shortId,
} from "../lib/format";
import type { TraceListItem, TracePage } from "../lib/trace-read-model";

function traceHref(traceId: string) {
  return `/traces/${traceId}`;
}

function pageHref(page: number, queryString: string) {
  const parameters = new URLSearchParams(queryString);
  parameters.set("page", String(page));
  return `/traces?${parameters.toString()}`;
}

function Outcome({ trace }: { trace: TraceListItem }) {
  return (
    <span className={`outcome outcome-${trace.outcome ?? "unknown"}`}>
      <i aria-hidden="true" />
      {trace.outcome?.toUpperCase() ?? "NO OUTCOME"}
      {trace.completionState === "incomplete" ? (
        <b className="incomplete-label">INCOMPLETE</b>
      ) : null}
    </span>
  );
}

export function TraceTable({
  page,
  queryString,
}: {
  page: TracePage;
  queryString: string;
}) {
  const finalPage = Math.max(1, Math.ceil(page.total / page.pageSize));

  return (
    <section className="trace-index" aria-label="Trace results">
      <div className="trace-table-wrap">
        <table className="trace-table" aria-label="Agent traces">
          <thead>
            <tr>
              <th scope="col">Trace</th>
              <th scope="col">Actor</th>
              <th scope="col">Duration</th>
              <th scope="col">Spans</th>
              <th scope="col">Outcome</th>
              <th scope="col">Cost</th>
              <th scope="col">Started</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((trace) => (
              <tr key={trace.traceId}>
                <td>
                  <Link className="trace-name" href={traceHref(trace.traceId)}>
                    {trace.name}
                  </Link>
                  <code>{shortId(trace.traceId)}</code>
                </td>
                <td>
                  <span>{trace.agentId}</span>
                  {trace.onBehalfOf === null ? null : (
                    <small>{trace.onBehalfOf}</small>
                  )}
                </td>
                <td className="mono-cell">
                  {formatDuration(trace.durationMs ?? -1)}
                </td>
                <td className="mono-cell">{trace.spanCount}</td>
                <td>
                  <Outcome trace={trace} />
                </td>
                <td
                  className={
                    trace.pricingUnknown ? "cost-unpriced" : "mono-cell"
                  }
                >
                  {formatCost(trace)}
                </td>
                <td className="mono-cell">
                  <time dateTime={trace.startedAt}>
                    {formatTimestamp(trace.startedAt)}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ol className="trace-mobile-list" aria-label="Agent traces mobile view">
        {page.items.map((trace) => (
          <li key={trace.traceId}>
            <div className="mobile-trace-lead">
              <Link className="trace-name" href={traceHref(trace.traceId)}>
                {trace.name}
              </Link>
              <Outcome trace={trace} />
            </div>
            <code>{shortId(trace.traceId)}</code>
            <dl>
              <div>
                <dt>Actor</dt>
                <dd>{trace.agentId}</dd>
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
                <dd
                  className={trace.pricingUnknown ? "cost-unpriced" : undefined}
                >
                  {formatCost(trace)}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>

      <footer className="trace-pagination" aria-label="Trace pages">
        <span>
          {page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1}–
          {Math.min(page.page * page.pageSize, page.total)} of {page.total}
        </span>
        <div>
          {page.page > 1 ? (
            <Link
              href={pageHref(page.page - 1, queryString)}
              aria-label="Previous page"
            >
              <ArrowLeft aria-hidden="true" size={14} weight="regular" />
              Prev
            </Link>
          ) : (
            <span aria-disabled="true">Prev</span>
          )}
          <code>
            {page.page}/{finalPage}
          </code>
          {page.page < finalPage ? (
            <Link
              href={pageHref(page.page + 1, queryString)}
              aria-label="Next page"
            >
              Next
              <ArrowRight aria-hidden="true" size={14} weight="regular" />
            </Link>
          ) : (
            <span aria-disabled="true">Next</span>
          )}
        </div>
      </footer>
    </section>
  );
}
