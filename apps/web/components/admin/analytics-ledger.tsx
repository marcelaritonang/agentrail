import type { CountBucket, FounderAnalytics } from "../../lib/admin-analytics";

export function AnalyticsLedger({
  analytics,
}: {
  analytics: FounderAnalytics;
}) {
  return (
    <div className="admin-analytics-ledger">
      <section className="admin-metric-strip" aria-label="Founder metrics">
        <Metric
          label="Authenticated users"
          value={analytics.authenticatedUsers}
          note="distinct npm/GitHub-linked accounts"
        />
        <Metric
          label="Activated installations"
          value={analytics.activatedInstallations}
          note="connected credentials"
        />
        <Metric
          label="Active users 7d"
          value={analytics.activeUsers7d}
          note="accepted context pack events"
        />
        <Metric
          label="Active users 30d"
          value={analytics.activeUsers30d}
          note="not npm downloads"
        />
      </section>

      <section className="admin-panel-grid" aria-label="Founder funnels">
        <Panel title="Conversion and retention">
          <dl className="admin-fact-list">
            <Fact
              label="First-pack conversion"
              value={formatPercent(analytics.firstPackConversion)}
            />
            <Fact
              label="Weekly retention"
              value={formatPercent(analytics.weeklyRetention)}
            />
            <Fact
              label="Packs / active user 30d"
              value={formatNullableNumber(analytics.packsPerActiveUser30d)}
            />
          </dl>
        </Panel>

        <Panel title="Quality">
          <dl className="admin-fact-list">
            <Fact
              label="Error rate 30d"
              value={formatPercent(analytics.errorRate30d)}
            />
            <Fact
              label="P95 latency 30d"
              value={
                analytics.p95LatencyMs30d === null
                  ? "Unavailable"
                  : `${analytics.p95LatencyMs30d.toLocaleString("en-US")} ms`
              }
            />
            <Fact
              label="npm downloads"
              value={
                analytics.npmDownloads.value === null
                  ? "Unavailable"
                  : analytics.npmDownloads.value.toLocaleString("en-US")
              }
            />
          </dl>
          <p className="admin-panel-note">
            npm downloads are displayed as public distribution evidence only.
            They never count as active users.
          </p>
          <p className="admin-panel-note">
            Token and context reduction signals are estimated from local
            heuristic Context Pack events, not guaranteed cost savings.
          </p>
        </Panel>
      </section>

      <section className="admin-panel-grid" aria-label="Distribution metrics">
        <BucketPanel
          title="Client distribution"
          buckets={analytics.clientDistribution}
        />
        <BucketPanel
          title="Package versions"
          buckets={analytics.versionDistribution}
        />
        <BucketPanel
          title="Privacy modes"
          buckets={analytics.privacyModeDistribution}
        />
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <article className="admin-metric">
      <span>{label}</span>
      <strong>{value.toLocaleString("en-US")}</strong>
      <small>{note}</small>
    </article>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="admin-panel">
      <p className="page-eyebrow">Founder analytics</p>
      <h2>{title}</h2>
      {children}
    </article>
  );
}

function BucketPanel({
  title,
  buckets,
}: {
  title: string;
  buckets: readonly CountBucket[];
}) {
  return (
    <Panel title={title}>
      {buckets.length === 0 ? (
        <p className="admin-panel-note">No accepted data yet.</p>
      ) : (
        <ol className="admin-bucket-list">
          {buckets.map((bucket) => (
            <li key={bucket.label}>
              <span>{bucket.label}</span>
              <strong>{bucket.count.toLocaleString("en-US")}</strong>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatPercent(value: number | null): string {
  return value === null ? "Unavailable" : `${Math.round(value * 100)}%`;
}

function formatNullableNumber(value: number | null): string {
  return value === null ? "Unavailable" : value.toLocaleString("en-US");
}
