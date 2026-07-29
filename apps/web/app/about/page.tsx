import type { Metadata } from "next";
import { Code } from "@phosphor-icons/react/ssr";

import { PublicSiteShell } from "../../components/public-site-shell";
import { readPublicAgentRailConfig } from "../../lib/public-config";

export const metadata: Metadata = {
  title: "About AgentRail",
  description:
    "AgentRail startup status, contact, AWS deployment plan, and open-source roadmap.",
};

const roadmap = [
  [
    "30 days",
    "Collect feedback from three founding testers using the published SDK/MCP packages and the guided forensic dashboard.",
  ],
  [
    "60 days",
    "Document an AWS reference deployment using API Gateway, Lambda, SQS, RDS/PostgreSQL, S3, and CloudWatch.",
  ],
  [
    "90 days",
    "Add hosted project onboarding, broader pricing catalog support, and Amazon Bedrock cost metadata experiments.",
  ],
] as const;

export default function AboutPage() {
  const config = readPublicAgentRailConfig();
  const sourceUrl = config.sourceUrl?.href ?? null;
  const issuesUrl =
    config.contactUrl?.href ??
    (sourceUrl === null ? null : `${sourceUrl.replace(/\/$/, "")}/issues`);

  return (
    <PublicSiteShell>
      <div className="about-main">
        <header className="about-hero">
          <h1>About AgentRail</h1>
          <p>
            AgentRail is an open-source flight recorder for AI agents. It
            records traces, tool actions, cost metadata, actor attribution, and
            evidence payload status so developers can debug and audit autonomous
            AI workflows.
          </p>
        </header>

        <div className="about-grid">
          <section className="about-copy">
            <h2>Startup status</h2>
            <p>
              AgentRail is an early open-source startup project built from
              Indonesia. The current milestone includes a TypeScript SDK,
              ingestion pipeline, worker-side pricing, local Docker setup,
              forensic dashboard, guided demo, and read-only MCP server.
            </p>
            <p>
              The product is seeking founding testers before hosted multi-tenant
              work. The immediate goal is to prove that AI agent traces can be
              captured, priced, and investigated without putting sensitive
              evidence directly into chat clients.
            </p>
          </section>

          <aside className="about-facts" aria-label="Startup facts">
            <h2>Contact</h2>
            <dl>
              <div>
                <dt>Founder</dt>
                <dd>Marcel Aritonang</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>Indonesia</dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>
                  {issuesUrl === null ? (
                    "Contact URL pending"
                  ) : (
                    <a href={issuesUrl} target="_blank" rel="noreferrer">
                      GitHub Issues
                    </a>
                  )}
                </dd>
              </div>
              <div>
                <dt>Repository</dt>
                <dd>
                  {sourceUrl === null ? (
                    "Public source URL pending"
                  ) : (
                    <a href={sourceUrl} target="_blank" rel="noreferrer">
                      <Code size={14} aria-hidden="true" />
                      GitHub source
                    </a>
                  )}
                </dd>
              </div>
            </dl>
          </aside>

          <section className="about-roadmap">
            <h2>30/60/90 day roadmap</h2>
            <dl>
              {roadmap.map(([term, description]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </PublicSiteShell>
  );
}
