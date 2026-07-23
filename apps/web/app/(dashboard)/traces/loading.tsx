export default function TracesLoading() {
  return (
    <section
      className="trace-loading"
      aria-label="Loading agent runs"
      aria-busy="true"
    >
      <header>
        <h1>Agent runs</h1>
        <p>Review recorded work from your instrumented AI agents.</p>
        <strong>Loading agent runs…</strong>
      </header>
      <div className="loading-filters" aria-hidden="true" />
      <div className="loading-table" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
    </section>
  );
}
