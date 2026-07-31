import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { atomicReplace, createTimestampedBackup } from "./config-backup.js";

async function tempRoot(): Promise<string> {
  const root = join(tmpdir(), `agentrail-cli-${process.pid}-${Date.now()}`);
  await mkdir(root, { recursive: true });
  return root;
}

describe("configuration backups", () => {
  it("creates byte-equivalent backups and replaces atomically", async () => {
    const root = await tempRoot();
    const configPath = join(root, "config.toml");
    try {
      await writeFile(configPath, "original");
      const backup = await createTimestampedBackup(
        configPath,
        () => new Date("2026-07-30T00:00:00.000Z"),
      );
      expect(backup.sourceExisted).toBe(true);
      expect(backup.backupPath).not.toBeNull();
      await expect(readFile(backup.backupPath ?? "", "utf8")).resolves.toBe(
        "original",
      );

      await atomicReplace(configPath, "next");
      await expect(readFile(configPath, "utf8")).resolves.toBe("next");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not create a backup for a nonexistent source", async () => {
    const root = await tempRoot();
    try {
      const backup = await createTimestampedBackup(join(root, "missing.json"));
      expect(backup.sourceExisted).toBe(false);
      expect(backup.backupPath).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
