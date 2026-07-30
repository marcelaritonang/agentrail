export default function ProductDashboardLoading() {
  return (
    <div className="product-page">
      <section className="page-heading product-heading">
        <div>
          <p className="page-eyebrow">Private control plane</p>
          <h1>Usage overview</h1>
          <p>Loading scoped AgentRail usage metrics…</p>
        </div>
      </section>
      <div className="product-skeleton" aria-label="Loading usage overview" />
    </div>
  );
}
