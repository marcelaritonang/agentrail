import { describe, expect, it } from "vitest";

import { runLogoutCommand } from "./logout.js";
import type { CredentialStore } from "../credentials/types.js";

describe("agentrail logout command", () => {
  it("removes only the hosted credential and keeps local MCP setup intact", async () => {
    const calls: string[] = [];
    const values = new Map([["project_a", "ar_inst_credential_secret"]]);
    const store: CredentialStore = {
      kind: "restricted-file",
      async get(projectKey) {
        return values.get(projectKey) ?? null;
      },
      async set(projectKey, credential) {
        values.set(projectKey, credential);
      },
      async delete(projectKey) {
        calls.push("store:delete");
        values.delete(projectKey);
      },
    };

    const result = await runLogoutCommand({ store, projectKey: "project_a" });

    expect(result.exitCode).toBe(0);
    expect(calls).toEqual(["store:delete"]);
    expect(await store.get("project_a")).toBeNull();
    expect(result.stdout).toMatch(/local mcp setup/i);
    expect(`${result.stdout}${result.stderr}`).not.toContain(
      "ar_inst_credential_secret",
    );
  });
});
