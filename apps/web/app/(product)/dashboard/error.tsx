"use client";

export default function ProductDashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="trace-error product-error" role="alert">
      <p className="empty-code">Dashboard unavailable</p>
      <h1>Usage overview could not be loaded.</h1>
      <p>Retry after checking the database and auth environment variables.</p>
      <button type="button" onClick={reset}>
        Retry
      </button>
    </div>
  );
}
