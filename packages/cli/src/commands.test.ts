import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { runAgentRailCommand } from "./main.js";

async function fixtureRoot(): Promise<string> {
  const root = join(
    tmpdir(),
    `agentrail-cli-commands-${process.pid}-${Date.now()}`,
  );
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "app.ts"), "export const app = true;\n");
  return root;
}

describe("AgentRail CLI commands", () => {
  it("runs doctor and context as local JSON commands", async () => {
    const root = await fixtureRoot();
    try {
      const doctor = await runAgentRailCommand([
        "doctor",
        "--root",
        root,
        "--json",
      ]);
      expect(doctor.exitCode).toBe(0);
      expect(JSON.parse(doctor.stdout)).toMatchObject({
        ok: true,
      });

      const context = await runAgentRailCommand([
        "context",
        "--root",
        root,
        "--task",
        "Inspect app",
        "--token-budget",
        "1000",
        "--json",
      ]);
      expect(context.exitCode).toBe(0);
      expect(JSON.parse(context.stdout).pack.context[0].path).toBe(
        "src/app.ts",
      );
      const receipts = await readdir(
        join(root, ".agentrail", "receipts", "v1"),
      );
      expect(receipts).toHaveLength(1);
      const receipt = JSON.parse(
        await readFile(
          join(root, ".agentrail", "receipts", "v1", receipts[0] ?? ""),
          "utf8",
        ),
      ) as { packageVersion?: string };
      expect(receipt.packageVersion).toBe("0.1.1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("sets up Codex and Claude managed MCP entries without duplicates", async () => {
    const root = await fixtureRoot();
    const codexConfig = join(root, "codex.toml");
    const claudeConfig = join(root, ".mcp.json");
    try {
      const first = await runAgentRailCommand([
        "setup",
        "--client",
        "codex",
        "--client",
        "claude",
        "--root",
        root,
        "--codex-config",
        codexConfig,
      ]);
      const second = await runAgentRailCommand([
        "setup",
        "--client",
        "codex",
        "--client",
        "claude",
        "--root",
        root,
        "--codex-config",
        codexConfig,
      ]);

      const codex = await readFile(codexConfig, "utf8");
      const claude = JSON.parse(await readFile(claudeConfig, "utf8")) as {
        mcpServers: Record<string, unknown>;
      };

      expect(first.exitCode).toBe(0);
      expect(second.exitCode).toBe(0);
      expect(codex.match(/BEGIN AGENTRAIL MANAGED BLOCK/g)).toHaveLength(1);
      expect(claude.mcpServers.agentrail).toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
