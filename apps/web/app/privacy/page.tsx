import type { Metadata } from "next";

import { PublicSiteShell } from "../../components/public-site-shell";

export const metadata: Metadata = {
  title: "AgentRail Privacy",
  description:
    "Privacy boundary for AgentRail local mode, metrics-only telemetry, and future evidence sync.",
};

export default function PrivacyPage() {
  return (
    <PublicSiteShell>
      <article className="public-doc">
        <p className="landing-section-kicker">Trust boundary</p>
        <h1>AgentRail Privacy</h1>
        <p>
          AgentRail is local-first today. The public demo uses synthetic sample
          data, and the open-source stack runs on infrastructure controlled by
          the developer who deploys it.
        </p>

        <section>
          <h2>Current local-only mode</h2>
          <p>
            The SDK sends spans to the configured AgentRail ingestion endpoint.
            Metadata is stored in PostgreSQL, and redacted evidence payloads are
            stored behind the backend. Browser clients do not access blob
            storage directly.
          </p>
        </section>

        <section>
          <h2>Metrics-only mode</h2>
          <p>
            A future hosted mode may support metrics-only reporting. That mode
            must exclude raw prompts, model responses, tool payloads, user
            secrets, database URLs, API keys, and object-store credentials.
          </p>
        </section>

        <section>
          <h2>Evidence sync mode</h2>
          <p>
            Evidence sync is not active in the public product. Before any hosted
            evidence sync ships, AgentRail needs explicit project controls for
            redaction, retention, deletion, and export.
          </p>
        </section>
      </article>
    </PublicSiteShell>
  );
}
