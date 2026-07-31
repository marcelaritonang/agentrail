import { describe, expect, it } from "vitest";

import { createCloudHarness } from "./harness.js";

const SECRET_LITERAL = "sk-agentrail-e2e-secret-never-send";

describe("hosted privacy evidence", () => {
  it("sends only metrics-safe fields from Context Relay to hosted ingest", async () => {
    const harness = await createCloudHarness("privacy");

    try {
      const user = await harness.seedGithubUser({
        userId: "user_privacy",
        email: "privacy@example.com",
        role: "member",
      });
      const activation = await harness.loginViaCliAndApprove({ user });
      await harness.writeWorkspaceFile(
        "src/private-agent.ts",
        [
          `const OPENAI_API_KEY = "${SECRET_LITERAL}";`,
          'const prompt = "Summarize private customer banking records";',
          "export function privateAgent() { return OPENAI_API_KEY.length; }",
          "",
        ].join("\n"),
      );

      await harness.createAndFlushContextPack({
        credential: activation.credential,
        installationId: activation.installationId,
        task: "Find private agent implementation.",
      });

      for (const body of harness.usageRequestBodies()) {
        expect(JSON.stringify(body)).not.toContain(SECRET_LITERAL);
        expect(harness.containsForbiddenPrivacyField(body)).toBe(false);
      }
    } finally {
      await harness.dispose();
    }
  });
});
