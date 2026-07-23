export function TraceFilters({
  query,
  outcome,
  actor,
}: {
  query?: string;
  outcome?: string;
  actor?: string;
}) {
  return (
    <details className="run-filter-disclosure" open>
      <summary>Search and filters</summary>
      <form
        className="trace-filters"
        action="/traces"
        method="get"
        role="search"
      >
        <label>
          <span>Search by run name or ID</span>
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Run name or ID"
            autoComplete="off"
          />
        </label>
        <label>
          <span>Status</span>
          <select name="outcome" defaultValue={outcome ?? ""}>
            <option value="">All</option>
            <option value="ok">Succeeded</option>
            <option value="error">Failed</option>
          </select>
        </label>
        <label>
          <span id="agent-filter-label">Agent</span>
          <input
            name="actor"
            defaultValue={actor}
            aria-labelledby="agent-filter-label"
            aria-describedby="agent-filter-help"
            autoComplete="off"
          />
          <small id="agent-filter-help">Agent name or ID</small>
        </label>
        <button type="submit">Apply filters</button>
      </form>
    </details>
  );
}
