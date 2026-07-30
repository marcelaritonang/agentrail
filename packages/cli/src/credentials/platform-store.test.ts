import { describe, expect, it } from "vitest";

import { selectCredentialStore, type CommandRunner } from "./platform-store.js";

describe("platform credential store selection", () => {
  it("uses macOS Keychain when the security command exists", async () => {
    const calls: {
      command: string;
      args: readonly string[];
      stdin?: string;
    }[] = [];
    const runner: CommandRunner = async (command, args, stdin) => {
      calls.push({ command, args, ...(stdin === undefined ? {} : { stdin }) });
      return { exitCode: 0, stdout: "ar_inst_from_keychain\n", stderr: "" };
    };

    const store = await selectCredentialStore({
      directory: "/not/public",
      platform: "darwin",
      commandAvailable: async (command) => command === "security",
      runner,
    });

    await store.set("project_a", "ar_inst_secret_value");
    expect(await store.get("project_a")).toBe("ar_inst_from_keychain");
    await store.delete("project_a");

    expect(store.kind).toBe("platform");
    expect(calls.some((call) => call.command === "security")).toBe(true);
    expect(calls.flatMap((call) => call.args)).not.toContain(
      "ar_inst_secret_value",
    );
  });

  it("falls back to restricted files when no platform store command exists", async () => {
    const store = await selectCredentialStore({
      directory: "/safe/fallback",
      platform: "linux",
      commandAvailable: async () => false,
    });

    expect(store.kind).toBe("restricted-file");
  });
});
