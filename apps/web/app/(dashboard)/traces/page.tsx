import type { Metadata } from "next";

import { ReadOnlyExampleBanner } from "../../../components/read-only-example";
import { RunOrientation } from "../../../components/run-orientation";
import { TraceEmptyState } from "../../../components/trace-empty-state";
import { TraceFilters } from "../../../components/trace-filters";
import { TraceTable } from "../../../components/trace-table";
import { demoModeEnabled } from "../../../lib/demo-mode";
import { configuredProjectId } from "../../../lib/project-context";
import { configuredSourceUrl } from "../../../lib/source-url";
import { listTraces } from "../../../lib/trace-read-model";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Agent runs" };

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
  const isReadOnlyExample = demoModeEnabled();
  const sourceUrl = configuredSourceUrl();

  return (
    <>
      {isReadOnlyExample ? <ReadOnlyExampleBanner /> : null}
      <header className="page-heading">
        <div>
          <span className="page-eyebrow">Agent activity / project scope</span>
          <h1>Agent runs</h1>
          <p>
            Review what an AI agent did, how long it took, what it cost, and
            which tools it used.
          </p>
        </div>
        <dl className="archive-count">
          <dt>Recorded runs</dt>
          <dd>{page.total.toLocaleString("en-US")}</dd>
        </dl>
      </header>

      <RunOrientation />
      <TraceFilters
        {...(query === undefined ? {} : { query })}
        {...(actor === undefined ? {} : { actor })}
        {...(outcome === undefined ? {} : { outcome })}
      />
      {page.items.length === 0 ? (
        <TraceEmptyState filtered={filtered} sourceUrl={sourceUrl} />
      ) : (
        <TraceTable
          page={page}
          queryString={activeQuery.toString()}
          isReadOnlyExample={isReadOnlyExample}
        />
      )}
    </>
  );
}
