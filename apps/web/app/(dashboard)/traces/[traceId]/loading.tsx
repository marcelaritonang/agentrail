export default function TraceDetailLoading() {
  return (
    <div
      className="detail-loading"
      aria-label="Loading trace evidence"
      aria-busy="true"
    >
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
