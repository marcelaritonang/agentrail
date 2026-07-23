import { formatDuration, formatTimestamp } from "../lib/format";
import { humanizeName } from "../lib/trace-presentation";
import type { TraceSpan } from "../lib/trace-read-model";
import { RecordedDataAction } from "./recorded-data-action";

function actions(spans: readonly TraceSpan[]): TraceSpan[] {
  return spans
    .filter((span) => span.kind === "action" || span.kind === "tool")
    .sort(
      (left, right) =>
        Date.parse(left.startedAt) - Date.parse(right.startedAt) ||
        left.spanId.localeCompare(right.spanId),
    );
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
          <span>
            Action Ledger · tools or systems the agent called or changed
          </span>
          <h2 id="action-ledger-title">External actions</h2>
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
            <table className="action-table" aria-label="External actions">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Operation</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Recorded data</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((span) => (
                  <tr key={span.spanId}>
                    <td>{formatTimestamp(span.startedAt)}</td>
                    <td>
                      <strong>
                        {humanizeName(span.name, "Recorded action")}
                      </strong>
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
                      <RecordedDataAction
                        traceId={traceId}
                        spanId={span.spanId}
                        hasPayload={span.hasPayload}
                        origin="actions"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ol
            className="action-mobile-list"
            aria-label="External actions mobile view"
          >
            {ledger.map((span) => (
              <li key={span.spanId}>
                <div>
                  <strong>{humanizeName(span.name, "Recorded action")}</strong>
                  <span className={`outcome outcome-${span.outcome}`}>
                    <i aria-hidden="true" />
                    {span.outcome.toUpperCase()}
                  </span>
                </div>
                <code>{span.kind.toUpperCase()}</code>
                <dl>
                  <div>
                    <dt>Time</dt>
                    <dd>{formatTimestamp(span.startedAt)}</dd>
                  </div>
                  <div>
                    <dt>Agent</dt>
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
                <RecordedDataAction
                  traceId={traceId}
                  spanId={span.spanId}
                  hasPayload={span.hasPayload}
                  origin="actions"
                />
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
