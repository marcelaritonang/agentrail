import type { Metadata } from "next";

import { PublicSiteShell } from "../../components/public-site-shell";
import { readPublicAgentRailConfig } from "../../lib/public-config";

export const metadata: Metadata = {
  title: "AgentRail Security",
  description:
    "Security disclosure and current data-handling boundary for AgentRail.",
};

function repositoryFileUrl(sourceUrl: URL, path: string) {
  const base = sourceUrl.href.endsWith("/")
    ? sourceUrl.href
    : `${sourceUrl.href}/`;
  return new URL(`blob/main/${path}`, base).href;
}

export default function SecurityPage() {
  const config = readPublicAgentRailConfig();
  const securityPolicyUrl =
    config.sourceUrl === null
      ? null
      : repositoryFileUrl(config.sourceUrl, "SECURITY.md");

  return (
    <PublicSiteShell>
      <article className="public-doc">
        <p className="landing-section-kicker">Responsible disclosure</p>
        <h1>AgentRail Security</h1>
        <p>
          AgentRail stores trace metadata and evidence status for agentic
          workflows. The current public demo is synthetic; self-hosted operators
          control their own database, object storage, and network exposure.
        </p>

        <section>
          <h2>Report a vulnerability</h2>
          <p>
            {config.contactUrl === null
              ? "Configure NEXT_PUBLIC_AGENTRAIL_CONTACT_URL before accepting private reports through this site."
              : "Use the configured contact channel for responsible disclosure."}
          </p>
          {config.contactUrl === null ? null : (
            <a href={config.contactUrl.href} target="_blank" rel="noreferrer">
              Open security contact
            </a>
          )}
        </section>

        <section>
          <h2>Security policy</h2>
          <p>
            {securityPolicyUrl === null
              ? "Configure NEXT_PUBLIC_AGENTRAIL_SOURCE_URL to expose the repository security policy from this page."
              : "The repository security policy is the source of truth for supported versions and disclosure handling."}
          </p>
          {securityPolicyUrl === null ? null : (
            <a href={securityPolicyUrl} target="_blank" rel="noreferrer">
              View SECURITY.md
            </a>
          )}
        </section>

        <section>
          <h2>Current controls</h2>
          <p>
            Raw API keys are not stored in PostgreSQL, unknown model pricing is
            explicit, and browser evidence access goes through backend routes.
            Hosted authentication, organization controls, and external audit
            reports are future work.
          </p>
        </section>
      </article>
    </PublicSiteShell>
  );
}
