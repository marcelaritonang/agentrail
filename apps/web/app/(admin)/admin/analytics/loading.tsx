import { ProductMark } from "../../../../components/product-mark";

export default function AdminAnalyticsLoading() {
  return (
    <div className="dashboard-frame product-frame admin-frame">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <ProductMark />
          <strong>AgentRail</strong>
        </div>
        <div className="dashboard-meta">
          <span className="sample-stamp">Admin only</span>
        </div>
      </header>
      <main className="dashboard-main product-main">
        <section className="product-skeleton" aria-label="Loading analytics" />
      </main>
    </div>
  );
}
