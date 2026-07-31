"use client";

export default function AdminAnalyticsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="dashboard-frame product-frame admin-frame">
      <main className="dashboard-main product-main">
        <section className="product-panel product-error">
          <div>
            <p className="page-eyebrow">Founder analytics unavailable</p>
            <h1>Private metrics could not be loaded.</h1>
          </div>
          <p>
            Retry after checking the database connection and admin role. The
            public trace archive is not affected.
          </p>
          <button type="button" onClick={reset}>
            Retry
          </button>
        </section>
      </main>
    </div>
  );
}
