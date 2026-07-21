import { ArrowSquareOut } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { formatDuration, formatTimestamp } from "../lib/format";
import type { TraceSpan } from "../lib/trace-read-model";

function actions(spans: readonly TraceSpan[]): TraceSpan[] {
  return spans
    .filter((span) => span.kind === "action" || span.kind === "tool")
    .sort(
      (left, right) =>
        Date.parse(left.startedAt) - Date.parse(right.startedAt) ||
        left.spanId.localeCompare(right.spanId),
    );
}

function evidenceHref(traceId: string, spanId: string): string {
  return `/traces/${encodeURIComponent(traceId)}?span=${encodeURIComponent(spanId)}`;
}

export function ActionLedger({
  traceId,
  spans,
}: {
  traceId: string;
  spans: readonly TraceSpan[];
}) {
  const ledger = actions(spans);

  return (
    <section className="action-ledger" aria-labelledby="action-ledger-title">
      <header className="trace-section-heading">
        <div>
          <span>Consequential operations</span>
          <h2 id="action-ledger-title">Action Ledger</h2>
        </div>
        <p>{ledger.length} action and tool spans / chronological</p>
      </header>

      {ledger.length === 0 ? (
        <p className="ledger-empty">
          No action or tool spans were recorded for this trace.
        </p>
      ) : (
        <>
          <div className="action-table-wrap">
            <table className="action-table" aria-label="Action Ledger">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Operation</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((span) => (
                  <tr key={span.spanId}>
                    <td>{formatTimestamp(span.startedAt)}</td>
                    <td>
                      <strong>{span.name}</strong>
                      <code>{span.kind.toUpperCase()}</code>
                    </td>
                    <td>{span.agentId}</td>
                    <td>
                      <span className={`outcome outcome-${span.outcome}`}>
                        <i aria-hidden="true" />
                        {span.outcome.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {formatDuration(
                        Date.parse(span.endedAt) - Date.parse(span.startedAt),
                      )}
                    </td>
                    <td>
                      <Link href={evidenceHref(traceId, span.spanId)}>
                        Inspect
                        <ArrowSquareOut
                          aria-hidden="true"
                          size={13}
                          weight="regular"
                        />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ol
            className="action-mobile-list"
            aria-label="Action Ledger mobile view"
          >
            {ledger.map((span) => (
              <li key={span.spanId}>
                <div>
                  <strong>{span.name}</strong>
                  <span className={`outcome outcome-${span.outcome}`}>
                    <i aria-hidden="true" />
                    {span.outcome.toUpperCase()}
                  </span>
                </div>
                <code>{span.kind.toUpperCase()}</code>
                <dl>
                  <div>
                    <dt>Actor</dt>
                    <dd>{span.agentId}</dd>
                  </div>
                  <div>
                    <dt>Duration</dt>
                    <dd>
                      {formatDuration(
                        Date.parse(span.endedAt) - Date.parse(span.startedAt),
                      )}
                    </dd>
                  </div>
                </dl>
                <Link href={evidenceHref(traceId, span.spanId)}>
                  Inspect evidence
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
