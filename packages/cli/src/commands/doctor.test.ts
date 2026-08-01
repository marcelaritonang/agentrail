import { describe, expect, it } from "vitest";

import { runDoctorCommand } from "./doctor.js";

describe("agentrail doctor command", () => {
  it("prints the context-first MCP guidance when local checks pass", async () => {
    const result = await runDoctorCommand({
      root: "/workspace",
      json: false,
      resolveRoot: async (root) => root,
      inspectCredentialStore: async () => ({
        ok: true,
        warnings: [],
        failures: [],
      }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("AgentRail is installed.");
    expect(result.stdout).toContain(
      "Your AI can now call agentrail_prepare_context before a coding task.",
    );
    expect(result.stdout).toContain(
      "Login is optional; local context still works offline.",
    );
  });

  it("fails when the fallback credential file is world-readable", async () => {
    const result = await runDoctorCommand({
      root: "/workspace",
      json: true,
      resolveRoot: async (root) => root,
      inspectCredentialStore: async () => ({
        ok: false,
        warnings: [],
        failures: [
          {
            code: "unsafe_permissions",
            detail: "Credential file permissions are too broad.",
          },
        ],
      }),
    });

    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.stdout) as {
      ok: boolean;
      checks: { id: string; status: string }[];
    };
    expect(parsed.ok).toBe(false);
    expect(parsed.checks).toContainEqual(
      expect.objectContaining({ id: "credential_store", status: "fail" }),
    );
  });
});
