export default function TraceDetailLoading() {
  return (
    <div
      className="detail-loading"
      aria-label="Loading run details"
      aria-busy="true"
    >
      <strong>Loading run details…</strong>
      <div className="detail-loading-header" />
      <div className="detail-loading-facts" />
      <div className="detail-loading-rail">
        {Array.from({ length: 6 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
    </div>
  );
}
