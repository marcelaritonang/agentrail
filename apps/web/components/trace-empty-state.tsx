import Link from "next/link";

export function TraceEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <section className="trace-empty" aria-labelledby="empty-title">
      <span className="empty-code">RECORDER / 000</span>
      <h2 id="empty-title">
        {filtered ? "No traces match" : "No evidence recorded"}
      </h2>
      <p>
        {filtered
          ? "Change the query or clear the filters to return to the full trace archive."
          : "Instrument one agent operation. Completed spans will appear here after the worker persists them."}
      </p>
      {filtered ? (
        <Link href="/traces">Clear filters</Link>
      ) : (
        <pre aria-label="SDK install command">
          <code>pnpm add @agentrail/sdk</code>
        </pre>
      )}
    </section>
  );
}
