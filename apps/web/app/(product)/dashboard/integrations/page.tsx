import { IntegrationLedger } from "../../../../components/product/integration-ledger";
import { requireViewer } from "../../../../lib/authz";
import { database } from "../../../../lib/control-database";
import { createProductReadModel } from "../../../../lib/product-read-model";

export const dynamic = "force-dynamic";

export default async function ProductIntegrationsPage() {
  const viewer = await requireViewer();
  const readModel = createProductReadModel(database.db);
  const integrations = await readModel.listIntegrations({
    projectId: viewer.projectId,
    now: new Date(),
  });

  return (
    <div className="product-page">
      <section className="page-heading product-heading">
        <div>
          <p className="page-eyebrow">Connected agents</p>
          <h1>Integrations</h1>
          <p>
            Manage the local Codex or Claude clients that can send AgentRail
            usage metadata for this project.
          </p>
        </div>
      </section>

      <IntegrationLedger integrations={integrations} />
    </div>
  );
}
