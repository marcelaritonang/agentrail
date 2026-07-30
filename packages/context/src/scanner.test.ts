import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { scanWorkspace } from "./scanner.js";

async function makeFixture(): Promise<string> {
  const root = join(tmpdir(), `agentrail-scanner-${process.pid}-${Date.now()}`);
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "docs", "private"), { recursive: true });
  await mkdir(join(root, "node_modules", "pkg"), { recursive: true });
  await mkdir(join(root, "dist"), { recursive: true });
  await mkdir(join(root, "aws"), { recursive: true });
  await writeFile(join(root, ".gitignore"), "ignored.tmp\n");
  await writeFile(join(root, ".agentrailignore"), "docs/private/**\n");
  await writeFile(join(root, "src", "app.ts"), "export const app = true;\n");
  await writeFile(join(root, "docs", "guide.md"), "# Guide\n\nUse this.\n");
  await writeFile(join(root, ".env"), "SECRET=value\n");
  await writeFile(join(root, ".env.local"), "SECRET=value\n");
  await writeFile(join(root, ".npmrc"), "//registry.npmjs.org/:_authToken=x\n");
  await writeFile(join(root, "id_rsa"), "private-key\n");
  await writeFile(join(root, "server.pem"), "private-key\n");
  await writeFile(join(root, "aws", "credentials"), "private-key\n");
  await writeFile(join(root, "ignored.tmp"), "ignored\n");
  await writeFile(join(root, "docs", "private", "notes.md"), "ignored\n");
  await writeFile(join(root, "node_modules", "pkg", "index.js"), "ignored\n");
  await writeFile(join(root, "dist", "generated.js"), "ignored\n");
  await writeFile(join(root, "binary.bin"), Buffer.from([0, 1, 2, 3]));
  await writeFile(join(root, "large.txt"), "x".repeat(64));
  return root;
}

describe("safe workspace scanner", () => {
  it("returns allowed source files and excludes unsafe/default ignored files", async () => {
    const root = await makeFixture();
    try {
      const result = await scanWorkspace({
        root,
        limits: { maxFileBytes: 32, maxFiles: 100, deadlineMs: 5_000 },
      });
      const paths = result.files.map((file) => file.relativePath).sort();

      expect(paths).toContain("src/app.ts");
      expect(paths).toContain("docs/guide.md");
      expect(paths).not.toContain(".env");
      expect(paths).not.toContain(".env.local");
      expect(paths).not.toContain(".npmrc");
      expect(paths).not.toContain("id_rsa");
      expect(paths).not.toContain("server.pem");
      expect(paths).not.toContain("aws/credentials");
      expect(paths).not.toContain("node_modules/pkg/index.js");
      expect(paths).not.toContain("dist/generated.js");
      expect(paths).not.toContain("ignored.tmp");
      expect(paths).not.toContain("docs/private/notes.md");
      expect(result.warnings.map((warning) => warning.code)).toEqual(
        expect.arrayContaining(["binary_excluded", "file_too_large"]),
      );
      expect(result.complete).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("enforces file count limits and marks partial scans", async () => {
    const root = await makeFixture();
    try {
      const result = await scanWorkspace({
        root,
        limits: { maxFiles: 1, maxFileBytes: 1_000, deadlineMs: 5_000 },
      });
      expect(result.files).toHaveLength(1);
      expect(result.complete).toBe(false);
      expect(result.warnings.map((warning) => warning.code)).toContain(
        "file_limit",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("marks deadline-bound scans as partial", async () => {
    const root = await makeFixture();
    try {
      const result = await scanWorkspace({
        root,
        limits: { maxFiles: 100, maxFileBytes: 1_000, deadlineMs: 0 },
        now: () => 1,
      });
      expect(result.complete).toBe(false);
      expect(result.warnings.map((warning) => warning.code)).toContain(
        "partial_index",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects symlinks that escape the workspace", async () => {
    const root = await makeFixture();
    const external = join(
      tmpdir(),
      `agentrail-scanner-external-${process.pid}-${Date.now()}.txt`,
    );
    await writeFile(external, "outside");
    try {
      try {
        await symlink(external, join(root, "src", "external.txt"));
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          (error as NodeJS.ErrnoException).code === "EPERM"
        ) {
          return;
        }
        throw error;
      }

      const result = await scanWorkspace({
        root,
        limits: { maxFiles: 100, maxFileBytes: 1_000, deadlineMs: 5_000 },
      });

      expect(result.files.map((file) => file.relativePath)).not.toContain(
        "src/external.txt",
      );
      expect(result.warnings.map((warning) => warning.code)).toContain(
        "symlink_escape",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(external, { force: true });
    }
  });
});
