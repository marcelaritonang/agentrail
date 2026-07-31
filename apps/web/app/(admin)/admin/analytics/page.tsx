import Link from "next/link";

import {
  createAdminAnalyticsPageDataLoader,
  createAdminAnalyticsReadModel,
} from "../../../../lib/admin-analytics";
import { requireAdmin } from "../../../../lib/authz";
import { database } from "../../../../lib/control-database";
import { AnalyticsLedger } from "../../../../components/admin/analytics-ledger";
import { ProductMark } from "../../../../components/product-mark";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const readModel = createAdminAnalyticsReadModel(database.db);
  const loadAnalytics = createAdminAnalyticsPageDataLoader({
    requireAdmin,
    readAnalytics: (input) => readModel.getFounderAnalytics(input),
  });
  const analytics = await loadAnalytics({ now: new Date() });

  return (
    <div className="dashboard-frame product-frame admin-frame">
      <header className="dashboard-header">
        <Link className="dashboard-brand" href="/" aria-label="AgentRail home">
          <ProductMark />
          <strong>AgentRail</strong>
        </Link>

        <nav className="dashboard-nav" aria-label="Admin dashboard">
          <Link href="/dashboard">User dashboard</Link>
          <Link href="/dashboard/integrations">Integrations</Link>
          <Link href="/admin/analytics" aria-current="page">
            Founder analytics
          </Link>
        </nav>

        <div className="dashboard-meta">
          <span className="sample-stamp">Admin only</span>
        </div>
      </header>

      <main className="dashboard-main product-main">
        <div className="product-page admin-page">
          <section className="page-heading product-heading">
            <div>
              <p className="page-eyebrow">Server-authorized founder view</p>
              <h1>Private usage analytics</h1>
              <p>
                These numbers are derived from accepted safe usage events and
                authenticated account rows. Public npm downloads are separated
                from active-user metrics.
              </p>
            </div>
          </section>

          <AnalyticsLedger analytics={analytics} />
        </div>
      </main>
    </div>
  );
}
