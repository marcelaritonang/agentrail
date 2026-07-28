import Link from "next/link";

import { sourceQuickstartUrl } from "../lib/source-url";

export function InstallAgentRailCard({
  sourceUrl,
}: {
  sourceUrl: string | null;
}) {
  return (
    <section
      aria-label="Install and test AgentRail"
      className="install-agentrail-card"
    >
      <div className="install-agentrail-copy">
        <span className="page-eyebrow">Open-source test path</span>
        <h2>Install and test AgentRail</h2>
        <p>
          Start with the guided sample here, then run the local stack from
          source. npm install agentrail is not this project; that unscoped npm
          package belongs to another maintainer.
        </p>
      </div>
      <div className="install-agentrail-grid">
        <div>
          <strong>Try from source today</strong>
          <p>Clone the repository, install dependencies, then seed one run.</p>
          <pre aria-label="Source checkout commands">
            <code>{`pnpm install
pnpm bootstrap:local`}</code>
          </pre>
          {sourceUrl === null ? null : (
            <Link href={sourceQuickstartUrl(sourceUrl)}>
              Open source checkout
            </Link>
          )}
        </div>
        <div>
          <strong>NPM release target</strong>
          <p>
            These are the intended package names after npm auth is configured.
          </p>
          <pre aria-label="NPM install commands">
            <code>{`npm install @agentrail-sdk/sdk
npx @agentrail-sdk/mcp`}</code>
          </pre>
          <small>
            Publish requires npm authentication and scope ownership.
          </small>
        </div>
      </div>
    </section>
  );
}
