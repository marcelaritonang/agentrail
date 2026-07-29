import type { Metadata } from "next";

import { PublicSiteShell } from "../../components/public-site-shell";
import { readPublicAgentRailConfig } from "../../lib/public-config";

export const metadata: Metadata = {
  title: "AgentRail Architecture",
  description:
    "AgentRail local pipeline, AWS reference mapping, and current versus planned boundaries.",
};

function repositoryFileUrl(sourceUrl: URL, path: string) {
  const base = sourceUrl.href.endsWith("/")
    ? sourceUrl.href
    : `${sourceUrl.href}/`;
  return new URL(`blob/main/${path}`, base).href;
}

export default function ArchitecturePage() {
  const config = readPublicAgentRailConfig();
  const architectureUrl =
    config.sourceUrl === null
      ? null
      : repositoryFileUrl(config.sourceUrl, "docs/architecture.md");

  return (
    <PublicSiteShell>
      <article className="public-doc">
        <p className="landing-section-kicker">System boundary</p>
        <h1>AgentRail Architecture</h1>
        <p>
          AgentRail records AI-agent traces through a TypeScript SDK, accepts
          spans through an ingestion API, processes them asynchronously, and
          presents a forensic dashboard for investigation.
        </p>

        <section>
          <h2>Current local stack</h2>
          <p>
            M1 runs locally with the SDK, ingestion service, worker, PostgreSQL,
            Redis, MinIO-compatible object storage, and the Next.js dashboard.
            Payload evidence stays behind backend API routes.
          </p>
        </section>

        <section>
          <h2>AWS reference mapping</h2>
          <p>
            The planned AWS path maps ingestion to API Gateway and Lambda,
            buffering to SQS, metadata to RDS/PostgreSQL, evidence blobs to S3,
            and operational signals to CloudWatch. This is a deployment plan,
            not a claim that hosted production is active.
          </p>
        </section>

        <section>
          <h2>Privacy modes</h2>
          <p>
            Local-only mode is current. Metrics-only reporting and evidence sync
            are planned modes that require explicit controls before hosted beta.
          </p>
          {architectureUrl === null ? null : (
            <a href={architectureUrl} target="_blank" rel="noreferrer">
              Read the full architecture document
            </a>
          )}
        </section>
      </article>
    </PublicSiteShell>
  );
}
