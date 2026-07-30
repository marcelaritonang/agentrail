import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createRestrictedFileCredentialStore,
  inspectRestrictedFileStore,
} from "./file-store.js";

async function fixtureDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), "agentrail-credentials-"));
}

describe("restricted file credential store", () => {
  it("stores credentials in a project-keyed file and restricts POSIX permissions", async () => {
    const directory = await fixtureDirectory();
    const chmodCalls: number[] = [];
    try {
      const store = createRestrictedFileCredentialStore({
        directory,
        platform: "linux",
        chmod: async (_path, mode) => {
          chmodCalls.push(mode);
        },
      });

      await store.set("project_a", "ar_inst_secret_value");

      expect(await store.get("project_a")).toBe("ar_inst_secret_value");
      expect(chmodCalls).toContain(0o600);
      expect(await readFile(join(directory, "v1.json"), "utf8")).toContain(
        "project_a",
      );

      await store.delete("project_a");
      expect(await store.get("project_a")).toBeNull();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reports unsafe POSIX permissions as a failing doctor condition", async () => {
    const directory = await fixtureDirectory();
    try {
      const status = await inspectRestrictedFileStore({
        directory,
        platform: "linux",
        stat: async () => ({ mode: 0o100644 }),
      });

      expect(status.ok).toBe(false);
      expect(status.failures).toContainEqual(
        expect.objectContaining({ code: "unsafe_permissions" }),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("warns on Windows without printing the credential path publicly", async () => {
    const directory = await fixtureDirectory();
    try {
      const status = await inspectRestrictedFileStore({
        directory,
        platform: "win32",
      });

      expect(status.ok).toBe(true);
      expect(status.warnings).toContainEqual(
        expect.objectContaining({ code: "windows_file_fallback" }),
      );
      expect(
        status.warnings.map((warning) => warning.detail).join("\n"),
      ).not.toContain(directory);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
