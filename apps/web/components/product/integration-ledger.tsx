import { TerminalWindow } from "@phosphor-icons/react/ssr";

import type { IntegrationRecord } from "../../lib/product-read-model";
import { InstallationActions } from "./installation-actions";

export function IntegrationLedger({
  integrations,
}: {
  integrations: readonly IntegrationRecord[];
}) {
  if (integrations.length === 0) {
    return (
      <section className="product-panel product-empty-ledger">
        <p className="page-eyebrow">No connected clients</p>
        <h2>Install the npm CLI, then run the activation flow.</h2>
        <pre>
          <code>npm install -g @agentrail-sdk/cli</code>
        </pre>
        <pre>
          <code>agentrail login --api-url https://agentrail.id</code>
        </pre>
      </section>
    );
  }

  return (
    <section className="product-ledger" aria-label="Integration ledger">
      {integrations.map((integration) => (
        <article
          className="product-ledger-row"
          key={integration.installationId}
        >
          <div className="product-ledger-icon">
            <TerminalWindow aria-hidden="true" size={17} weight="regular" />
          </div>
          <div className="product-ledger-main">
            <div>
              <p className="page-eyebrow">{integration.client}</p>
              <h2>{integration.installationId}</h2>
            </div>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>{integration.status}</dd>
              </div>
              <div>
                <dt>Package</dt>
                <dd>{integration.packageVersion}</dd>
              </div>
              <div>
                <dt>Last seen</dt>
                <dd>{integration.lastSeenAt ?? "Waiting for first pack"}</dd>
              </div>
              <div>
                <dt>Last pack</dt>
                <dd>{integration.lastSuccessfulPackAt ?? "No pack yet"}</dd>
              </div>
              <div>
                <dt>Privacy</dt>
                <dd>{integration.privacyMode}</dd>
              </div>
              <div>
                <dt>Workspace count</dt>
                <dd>
                  {integration.workspaceCount === null
                    ? "Not collected"
                    : integration.workspaceCount}
                </dd>
              </div>
            </dl>
            {integration.staleVersionWarning ? (
              <p className="product-ledger-warning">
                {integration.staleVersionWarning}
              </p>
            ) : null}
          </div>
          <InstallationActions installationId={integration.installationId} />
        </article>
      ))}
    </section>
  );
}
