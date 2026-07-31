import { describe, expect, it } from "vitest";

import { createCloudHarness } from "./harness.js";

describe("hosted activation to analytics evidence", () => {
  it("moves one CLI activation through ingest, worker, product dashboard, and founder analytics", async () => {
    const harness = await createCloudHarness("activation-metrics");

    try {
      const user = await harness.seedGithubUser({
        userId: "user_activation_metrics",
        email: "activation@example.com",
        role: "admin",
      });
      const activation = await harness.loginViaCliAndApprove({ user });

      expect(activation.result.exitCode).toBe(0);
      expect(activation.storeSetCount).toBe(1);
      expect(activation.replayedTokenStatus).toBe("access_denied");

      const pack = await harness.createAndFlushContextPack({
        credential: activation.credential,
        installationId: activation.installationId,
        task: "Audit AgentRail AWS Bedrock queue architecture.",
      });

      expect(pack.status).toBe("ready");
      expect(pack.context.length).toBeGreaterThan(0);
      expect(harness.usageResponseStatuses()).toContain(202);
      await expect(harness.runUsageWorkerOnce()).resolves.toEqual({
        inserted: 1,
        duplicates: 0,
      });

      await expect(
        harness.productOverview(user.projectId),
      ).resolves.toMatchObject({
        packs7d: 1,
        packs30d: 1,
        connectedClients: 1,
        nextAction: "report_outcome",
      });
      await expect(
        harness.productIntegrations(user.projectId),
      ).resolves.toEqual([
        expect.objectContaining({
          installationId: activation.installationId,
          client: "codex",
          packageVersion: "0.1.2",
          status: "connected",
        }),
      ]);
      await expect(harness.founderAnalytics()).resolves.toMatchObject({
        authenticatedUsers: 1,
        activatedInstallations: 1,
        activeUsers7d: 1,
        activeUsers30d: 1,
        firstPackConversion: 1,
        packsPerActiveUser30d: 1,
      });
    } finally {
      await harness.dispose();
    }
  });
});
