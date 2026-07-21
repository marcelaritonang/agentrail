import { MagnifyingGlass } from "@phosphor-icons/react/ssr";

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
    <form className="trace-filters" action="/traces" method="get" role="search">
      <label className="filter-search">
        <span className="sr-only">Search trace name</span>
        <MagnifyingGlass aria-hidden="true" size={15} weight="regular" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Trace name"
          autoComplete="off"
        />
      </label>
      <label>
        <span>Outcome</span>
        <select name="outcome" defaultValue={outcome ?? ""}>
          <option value="">All</option>
          <option value="ok">OK</option>
          <option value="error">Error</option>
        </select>
      </label>
      <label>
        <span>Actor</span>
        <input
          name="actor"
          defaultValue={actor}
          placeholder="agent_id"
          autoComplete="off"
        />
      </label>
      <button type="submit">Apply</button>
    </form>
  );
}
