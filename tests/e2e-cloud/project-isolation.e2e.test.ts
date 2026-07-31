import { describe, expect, it } from "vitest";

import { createCloudHarness } from "./harness.js";

describe("hosted project isolation evidence", () => {
  it("blocks dashboard, approval, revoke, event spoofing, and admin access across projects", async () => {
    const harness = await createCloudHarness("project-isolation");

    try {
      const alpha = await harness.seedGithubUser({
        userId: "user_alpha",
        email: "alpha@example.com",
        role: "member",
      });
      const beta = await harness.seedGithubUser({
        userId: "user_beta",
        email: "beta@example.com",
        role: "member",
      });

      await expect(
        harness.canReadProject({ user: alpha, projectId: beta.projectId }),
      ).resolves.toBe(false);

      const pending = await harness.issueDeviceCode();
      await expect(
        harness.approveDeviceCode({
          user: alpha,
          projectId: beta.projectId,
          userCode: pending.userCode,
        }),
      ).resolves.toBe(404);
      await expect(
        harness.approveDeviceCode({
          user: beta,
          projectId: beta.projectId,
          userCode: pending.userCode,
        }),
      ).resolves.toBe(200);

      const token = await harness.pollApprovedDeviceCode(pending.deviceCode);
      await expect(
        harness.revokeInstallation({
          user: alpha,
          installationId: token.installationId,
        }),
      ).resolves.toBe(404);
      await expect(
        harness.postSpoofedUsageEvent({
          credential: token.credential,
          projectId: alpha.projectId,
        }),
      ).resolves.toBe(400);
      await expect(harness.adminAnalyticsAs(alpha)).resolves.toBe(403);
    } finally {
      await harness.dispose();
    }
  });
});
