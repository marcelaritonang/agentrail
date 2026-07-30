import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { resolveWorkspaceRoot } from "./workspace.js";

async function temporaryDirectory(name: string): Promise<string> {
  const root = join(tmpdir(), `agentrail-${name}-${process.pid}-${Date.now()}`);
  await mkdir(root, { recursive: true });
  return root;
}

describe("workspace containment", () => {
  it("resolves an existing directory to its real path", async () => {
    const root = await temporaryDirectory("workspace-root");
    try {
      await expect(resolveWorkspaceRoot(root)).resolves.toContain("agentrail-");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects nonexistent roots and file roots", async () => {
    const root = await temporaryDirectory("workspace-invalid");
    const filePath = join(root, "file.txt");
    await writeFile(filePath, "not a workspace");
    try {
      await expect(resolveWorkspaceRoot(join(root, "missing"))).rejects.toThrow(
        /workspace root/i,
      );
      await expect(resolveWorkspaceRoot(filePath)).rejects.toThrow(
        /workspace root/i,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
