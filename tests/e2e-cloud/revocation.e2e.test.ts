import { describe, expect, it } from "vitest";

import { createCloudHarness } from "./harness.js";

describe("hosted installation revocation evidence", () => {
  it("rejects the next hosted event while local Context Relay continues working", async () => {
    const harness = await createCloudHarness("revocation");

    try {
      const user = await harness.seedGithubUser({
        userId: "user_revocation",
        email: "revocation@example.com",
        role: "member",
      });
      const activation = await harness.loginViaCliAndApprove({ user });

      await harness.createAndFlushContextPack({
        credential: activation.credential,
        installationId: activation.installationId,
        task: "Inspect local context before revoke.",
      });
      await harness.runUsageWorkerOnce();

      await expect(
        harness.revokeInstallation({
          user,
          installationId: activation.installationId,
        }),
      ).resolves.toBe(200);

      const revokedPack = await harness.createAndFlushContextPack({
        credential: activation.credential,
        installationId: activation.installationId,
        task: "Inspect local context after revoke.",
      });

      expect(revokedPack.context.length).toBeGreaterThan(0);
      expect(harness.lastUsageResponseStatus()).toBe(401);
      expect(harness.lastSpoolStaleReason()).toBe("unauthorized");
      await expect(
        harness.productIntegrations(user.projectId),
      ).resolves.toEqual([
        expect.objectContaining({
          installationId: activation.installationId,
          status: "revoked",
        }),
      ]);
    } finally {
      await harness.dispose();
    }
  });
});
