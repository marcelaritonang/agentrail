import { createProductReadModel } from "../../../lib/product-read-model";
import { requireViewer } from "../../../lib/authz";
import { database } from "../../../lib/control-database";
import { MetricStrip } from "../../../components/product/metric-strip";
import { OnboardingNextAction } from "../../../components/product/onboarding-next-action";

export const dynamic = "force-dynamic";

export default async function ProductDashboardPage() {
  const viewer = await requireViewer();
  const readModel = createProductReadModel(database.db);
  const overview = await readModel.getUserOverview({
    projectId: viewer.projectId,
    now: new Date(),
  });

  return (
    <div className="product-page">
      <section className="page-heading product-heading">
        <div>
          <p className="page-eyebrow">Private control plane</p>
          <h1>Usage overview</h1>
          <p>
            See whether AgentRail is actually installed, sending safe context
            metrics, and helping developers reuse the right context.
          </p>
        </div>
      </section>

      <MetricStrip overview={overview} />
      <OnboardingNextAction nextAction={overview.nextAction} />

      <section className="product-panel">
        <div>
          <p className="page-eyebrow">Estimated impact</p>
          <h2>Context reduction is estimated, not billed truth.</h2>
        </div>
        <p>
          AgentRail counts only safe usage metadata: package version, client,
          status, token estimates, source counts, warnings, and outcome labels.
          It does not store prompts, file paths, snippets, patches, or secrets
          in metrics-only mode.
        </p>
      </section>
    </div>
  );
}
