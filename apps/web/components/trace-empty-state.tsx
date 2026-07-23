import Link from "next/link";

import { sourceQuickstartUrl } from "../lib/source-url";

export function TraceEmptyState({
  filtered,
  sourceUrl,
}: {
  filtered: boolean;
  sourceUrl: string | null;
}) {
  return (
    <section className="trace-empty" aria-labelledby="empty-title">
      <span className="empty-code">RECORDER / 000</span>
      <h2 id="empty-title">
        {filtered
          ? "No agent runs match these filters"
          : "No agent runs recorded yet"}
      </h2>
      <p>
        {filtered
          ? "Change or clear the filters to return to all recorded agent runs."
          : "Runs appear here after an instrumented application sends spans and the worker persists them."}
      </p>
      {filtered ? (
        <Link href="/traces">Clear filters</Link>
      ) : (
        <>
          <pre aria-label="Local quickstart command">
            <code>docker compose up -d --build</code>
          </pre>
          {sourceUrl === null ? null : (
            <Link href={sourceQuickstartUrl(sourceUrl)}>
              Open local quickstart
            </Link>
          )}
        </>
      )}
    </section>
  );
}
