import type { Metadata } from "next";

import { PublicSiteShell } from "../../components/public-site-shell";

export const metadata: Metadata = {
  title: "AgentRail Terms",
  description:
    "Current software boundary and future hosted-service terms for AgentRail.",
};

export default function TermsPage() {
  return (
    <PublicSiteShell>
      <article className="public-doc">
        <p className="landing-section-kicker">Open-source terms</p>
        <h1>AgentRail Terms</h1>
        <p>
          AgentRail is currently distributed as Apache-2.0 open-source software
          and public npm packages. The public dashboard is a read-only product
          demo with synthetic sample data.
        </p>

        <section>
          <h2>Software boundary</h2>
          <p>
            The repository license controls use, modification, and distribution
            of the open-source code. Self-hosted operators are responsible for
            their own deployment, access control, backups, and data handling.
          </p>
        </section>

        <section>
          <h2>Service availability</h2>
          <p>
            AgentRail does not yet offer a hosted production service, uptime
            commitment, paid account, customer workspace, or support contract.
            Hosted service terms will be updated before any hosted beta.
          </p>
        </section>

        <section>
          <h2>Acceptable use and warranty</h2>
          <p>
            Do not use AgentRail to store secrets, regulated data, or third
            party data unless your own deployment is configured for that use.
            The software is provided without warranty under the Apache-2.0
            license.
          </p>
        </section>
      </article>
    </PublicSiteShell>
  );
}
