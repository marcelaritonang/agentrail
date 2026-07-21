export default function TracesLoading() {
  return (
    <div className="trace-loading" aria-label="Loading traces" aria-busy="true">
      <div className="loading-heading" />
      <div className="loading-filters" />
      <div className="loading-table">
        {Array.from({ length: 7 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
    </div>
  );
}
