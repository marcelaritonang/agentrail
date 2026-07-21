import type { Metadata } from "next";

import { TraceEmptyState } from "../../../components/trace-empty-state";
import { TraceFilters } from "../../../components/trace-filters";
import { TraceTable } from "../../../components/trace-table";
import { configuredProjectId } from "../../../lib/project-context";
import { listTraces } from "../../../lib/trace-read-model";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Traces" };

type TraceSearchParams = {
  q?: string | string[];
  outcome?: string | string[];
  actor?: string | string[];
  page?: string | string[];
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TracesPage({
  searchParams,
}: {
  searchParams: Promise<TraceSearchParams>;
}) {
  const parameters = await searchParams;
  const query = first(parameters.q);
  const actor = first(parameters.actor);
  const rawOutcome = first(parameters.outcome);
  const outcome =
    rawOutcome === "ok" || rawOutcome === "error" ? rawOutcome : undefined;
  const requestedPage = Number(first(parameters.page) ?? "1");
  const page = await listTraces({
    projectId: configuredProjectId(),
    page: Number.isFinite(requestedPage) ? requestedPage : 1,
    ...(query === undefined ? {} : { query }),
    ...(actor === undefined ? {} : { actor }),
    ...(outcome === undefined ? {} : { outcome }),
  });
  const activeQuery = new URLSearchParams();
  if (query) activeQuery.set("q", query);
  if (actor) activeQuery.set("actor", actor);
  if (outcome) activeQuery.set("outcome", outcome);
  const filtered = activeQuery.size > 0;

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="page-eyebrow">Recorder index / project scope</span>
          <h1>Trace archive</h1>
          <p>
            Completed agent operations, priced spans, and consequential actions.
          </p>
        </div>
        <dl className="archive-count">
          <dt>Persisted traces</dt>
          <dd>{page.total.toLocaleString("en-US")}</dd>
        </dl>
      </header>

      <TraceFilters
        {...(query === undefined ? {} : { query })}
        {...(actor === undefined ? {} : { actor })}
        {...(outcome === undefined ? {} : { outcome })}
      />
      {page.items.length === 0 ? (
        <TraceEmptyState filtered={filtered} />
      ) : (
        <TraceTable page={page} queryString={activeQuery.toString()} />
      )}
    </>
  );
}
