import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { presentRun, type RunPresentation } from "../lib/trace-presentation";
import type { TracePage } from "../lib/trace-read-model";

function traceHref(traceId: string) {
  return `/traces/${traceId}`;
}

function pageHref(page: number, queryString: string) {
  const parameters = new URLSearchParams(queryString);
  parameters.set("page", String(page));
  return `/traces?${parameters.toString()}`;
}

function pluralize(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function RunStatus({ run }: { run: RunPresentation }) {
  return (
    <span
      className={`outcome outcome-${run.outcomeLabel === "Succeeded" ? "ok" : run.outcomeLabel === "Failed" ? "error" : "unknown"}`}
    >
      <i aria-hidden="true" />
      {run.outcomeLabel ?? "Status unavailable"}
      {run.completionLabel === null ? null : (
        <b className="incomplete-label">{run.completionLabel}</b>
      )}
    </span>
  );
}

export function TraceTable({
  page,
  queryString,
  isReadOnlyExample,
}: {
  page: TracePage;
  queryString: string;
  isReadOnlyExample: boolean;
}) {
  const finalPage = Math.max(1, Math.ceil(page.total / page.pageSize));
  const runs = page.items.map((trace) =>
    presentRun(trace, { isReadOnlyExample }),
  );

  return (
    <section className="trace-index" aria-label="Agent run results">
      <div className="trace-table-wrap">
        <table className="trace-table" aria-label="Agent runs">
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col">Agent</th>
              <th scope="col">Recorded</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const href = traceHref(run.traceId);
              return (
                <tr key={run.traceId}>
                  <td data-label="Run">
                    <Link className="trace-name" href={href}>
                      {run.displayTitle}
                    </Link>
                    <span className="run-technical-name">
                      {run.technicalName}
                    </span>
                    <code>{run.shortRunId}</code>
                  </td>
                  <td data-label="Agent">
                    <span>{run.agentId}</span>
                    {run.requestedBy === null ? null : (
                      <small>Requested by {run.requestedBy}</small>
                    )}
                  </td>
                  <td data-label="Recorded">
                    <dl className="recorded-facts">
                      <div>
                        <dt>Steps</dt>
                        <dd>{pluralize(run.stepCount, "step")}</dd>
                      </div>
                      <div>
                        <dt>Duration</dt>
                        <dd>{run.durationLabel}</dd>
                      </div>
                      <div>
                        <dt>Model cost</dt>
                        <dd>
                          {run.modelCostLabel}
                          {run.modelCostTechnicalLabel === null ? null : (
                            <small>{run.modelCostTechnicalLabel}</small>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Started</dt>
                        <dd>{run.startedAtLabel}</dd>
                      </div>
                    </dl>
                  </td>
                  <td data-label="Status">
                    <RunStatus run={run} />
                  </td>
                  <td className="run-action" data-label="Action">
                    <Link href={href}>Open run</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="trace-pagination" aria-label="Agent run pages">
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
